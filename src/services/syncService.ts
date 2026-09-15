import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { getDatabase } from './database';
import { getStoredCurrentUserId } from './sessionStorage';
import { assertSafeIdentifier } from './utils';

// Tablas locales que se replican a Supabase en segundo plano.
// Coinciden 1:1 con las tablas activas del esquema (supabase_schema.sql).
// NO se sincronizan (quedan solo en el script como copia del esquema local):
// workouts, workout_exercises, exercises, meals, meals_v2, progress (legacy
// vacías tras la limpieza) y app_meta (metadatos internos del dispositivo).
const SYNC_TABLES = [
  // NIVEL 1: identidad y catálogo (tablas PADRE). Nunca son dependientes.
  // No se incluyen 'exercises', 'workouts', 'meals', 'meals_v2' ni 'progress':
  // son tablas legacy vacías tras la limpieza local; 'exercises_v2' es el
  // catálogo de ejercicios activo que referencia day_* y workout_sets.
  'users',
  'body_parts',
  'exercises_v2',
  // NIVEL 2: perfiles de usuario (FK a users por email).
  'user_profiles',
  'nutrition_profile',
  // NIVEL 3: configuración de rutinas y dietas (FK al catálogo de body_parts
  // y exercises_v2; dependen del catálogo subido en el NIVEL 1).
  'weekly_schedule',
  'day_muscles',
  'day_exercises',
  'weekly_meal_plan',
  // NIVEL 4: sesiones y progresos (workout_sets depende de workout_sessions y
  // exercises_v2; el resto son hojas sin FKs).
  'workout_sessions',
  'workout_sets',
  'weight_logs',
  'daily_calories',
  'meal_logs',
] as const;

// Dependencias FK para el sync DIRIGIDO (una sola tabla: p. ej. la edición de
// una rutina invoca syncLocalToRemote('day_exercises')). Al subir una tabla
// hija se suben antes sus padres para no tropezar con violaciones de clave
// foránea en Supabase (day_exercises_exercise_fk, workout_sets_session_fk...).
const PARENT_DEPENDENCIES: Record<string, readonly string[]> = {
  user_profiles: ['users'],
  nutrition_profile: ['users'],
  weekly_schedule: ['body_parts'],
  day_muscles: ['body_parts'],
  day_exercises: ['body_parts', 'exercises_v2'],
  workout_sets: ['workout_sessions', 'exercises_v2'],
  workout_sessions: [],
  weight_logs: [],
  daily_calories: [],
  meal_logs: [],
  weekly_meal_plan: [],
};

// Tablas cuya clave primaria no se llama 'id'; se usa su PK para el upsert.
// 'users' usa su UNIQUE(email) para evitar que ids AUTOINCREMENT locales
// sobrescriban una cuenta remota existente desde otro dispositivo.
// El resto apunta a las restricciones UNIQUE de negocio de las tablas
// (weekly_schedule por día, day_muscles por día+músculo, etc.) para que el
// upsert actualice en vez de duplicar.
const UPSERT_ON_CONFLICT: Record<string, string> = {
  users: 'email',
  user_profiles: 'user_id',
  nutrition_profile: 'user_id',
  weekly_schedule: 'day_of_week',
  day_muscles: 'day_of_week,body_part_id',
  day_exercises: 'day_of_week,body_part_id,exercise_id',
  workout_sessions: 'day_of_week,date',
  daily_calories: 'date',
  // En una instalación limpia el id local se conserva también en Supabase.
  // Así las FK de exercises_v2, sesiones y series son estables entre
  // dispositivos del mismo usuario.
};

// Tablas cuyo contenido es POR USUARIO pero NO tienen columna user_id.
// Para aislarlas sin modificar las tablas existentes se registra su dueño en
// la tabla auxiliar user_row_owners (aditiva) al subirlas; al bajar solo se
// restauran las filas del usuario activo.
const OWNED_TABLES = [
  'weekly_schedule',
  'day_muscles',
  'day_exercises',
  'workout_sessions',
  'workout_sets',
  'weight_logs',
  'meal_logs',
  'daily_calories',
  'weekly_meal_plan',
] as const;

// Tablas que YA tienen columna user_id: se filtran directamente por el
// usuario activo, tanto al subir como al bajar.
const USER_SCOPED_TABLES: Record<string, string> = {
  user_profiles: 'user_id',
  nutrition_profile: 'user_id',
  meals_v2: 'user_id',
};

// Tabla auxiliar que guarda la relación (tabla, fila) -> usuario dueño.
const OWNERSHIP_TABLE = 'user_row_owners';

// Orden seguro para restaurar filas respetando FK (padres antes que hijos).
const PULL_ORDER = [
  'weekly_schedule',
  'workout_sessions',
  'day_muscles',
  'day_exercises',
  'workout_sets',
  'weight_logs',
  'meal_logs',
  'daily_calories',
  'weekly_meal_plan',
] as const;

const SYNC_THROTTLE_MS = 10000;

// Reintento cuando la petición llega sin conexión: el flush se agendará para
// este intervalo (además de reintentarse al volver a primer plano y con cada
// nueva edición), hasta que la red vuelva.
const FLUSH_RETRY_OFFLINE_MS = 30000;

let lastSyncAt = 0;
let syncing = false;

// Cola de tablas pendientes de subir. Cuando una petición de sync llega dentro
// del throttle o sin conexión, NO se descarta: se encola y una pasada completa
// (con el orden FK de padres antes que hijos) la enviará en cuanto se libere el
// throttle o se recupere la red. '*full*' representa pasada completa.
const pendingSyncTables = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(delayMs = SYNC_THROTTLE_MS): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void executePendingSync();
  }, Math.max(0, delayMs));
}

function enqueueSync(tableName?: string, retryMs = SYNC_THROTTLE_MS): void {
  if (tableName && tableName !== '*') {
    pendingSyncTables.add(tableName);
  } else {
    pendingSyncTables.add('*');
  }
  scheduleFlush(retryMs);
}

/**
 * Solicita una pasada completa de subida. Se usa al volver a primer plano de la
 * app y al restaurar la conexión para vaciar la cola de pendientes (todo lo que
 * se guardó offline se sube en cuanto hay red).
 */
export function requestFullSync(): void {
  enqueueSync('*', 0);
}

// Usuario activo (cacheado; se persiste con la sesión en SecureStore/AsyncStorage).
// Identidad = EMAIL del usuario (clave primaria de `users`).
let activeUserId: string | null | undefined;

// Callback que marca la sesión como revocada (usuario eliminado en Supabase).
let sessionRevocationHandler: (() => void | Promise<void>) | null = null;
let revocationTriggered = false;

export function setSessionRevocationHandler(
  handler: (() => void | Promise<void>) | null,
): void {
  sessionRevocationHandler = handler;
}

export async function setActiveUserId(userId: string | null): Promise<void> {
  activeUserId = userId ?? null;
  if (userId !== null) {
    revocationTriggered = false;
  }
}

async function getActiveUserId(): Promise<string | null> {
  if (activeUserId === undefined) {
    activeUserId = await getStoredCurrentUserId();
  }
  return activeUserId;
}

/**
 * Verifica la existencia remota del usuario activo. Si la cuenta fue borrada
 * en Supabase ('absent'): elimina la fila local del usuario, purga sus datos,
 * dispara el callback de revocación y bloquea la sincronización (no se resube
 * el usuario ni sus registros). Devuelve false para abortar la sync en curso.
 * Con 'unknown' (offline/error) no revoca: no se puede concluir nada.
 */
async function enforceRemoteUserExistence(): Promise<boolean> {
  const userId = await getActiveUserId();
  if (userId === null) return true;

  // Importación dinámica para romper el ciclo authService <-> syncService.
  const { checkRemoteUserExistence } = await import('./authService');
  const status = await checkRemoteUserExistence(userId);
  if (status === 'absent') {
    if (!revocationTriggered) {
      revocationTriggered = true;
      activeUserId = null;
      await removeLocalUserAccount(userId);
      const handler = sessionRevocationHandler;
      if (handler) {
        try {
          await handler();
        } catch {
          // El flujo de cierre de sesión nunca debe interrumpir el sync.
        }
      }
    }
    return false;
  }

  if (status === 'present') {
    revocationTriggered = false;
  }
  return true;
}

/**
 * Elimina la fila de la cuenta local en SQLite para que un usuario borrado en
 * la nube no vuelva a subirse en sincronizaciones posteriores.
 */
export async function removeLocalUserAccount(userId: string): Promise<void> {
  try {
    await getDatabase().runAsync('DELETE FROM users WHERE email = ?', [userId]);
  } catch {
    // Fallo no letal.
  }
}

async function isOnline(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch('https://www.google.com/generate_204', {
      signal: controller.signal,
    });
    return response.ok || response.status === 204;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function tableColumns(table: string): string[] {
  assertSafeIdentifier(table);
  return getDatabase()
    .getAllSync<{ name: string }>(`PRAGMA table_info("${table}")`)
    .map((c) => c.name);
}

/**
 * Replica en segundo plano una tabla (o todas) desde SQLite local a Supabase.
 * Silenciosa: si no hay Supabase configurado, no hay red o la consulta falla,
 * la app sigue funcionando con SQLite sin lanzar alertas ni bloquearse.
 * El usuario activo (current_user_id) determina qué filas personales se suben:
 * workout_sessions, workout_sets, weight_logs, meal_logs y el resto de tablas
 * de usuario se registran bajo su dueño en user_row_owners para poder
 * restaurarlas en otro dispositivo.
 */
export async function syncLocalToRemote(tableName?: string): Promise<void> {
  enqueueSync(tableName, 0);
}

/**
 * Crea la cuenta remota antes de ejecutar el resto de la sincronización.
 *
 * La comprobación normal de existencia remota protege sesiones ya creadas:
 * si una cuenta desaparece de Supabase, no debe resubirse por accidente. Esa
 * regla no puede aplicarse durante el registro, porque una cuenta nueva aún
 * no existe en la nube. Este camino explícito evita que el primer sync la
 * interprete como una cuenta revocada.
 */
export async function provisionRemoteUser(user: {
  email: string;
  name: string;
  password_hash: string;
  auth_provider: string;
  created_at?: string | null;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    throw new Error('Supabase no está configurado; no es posible crear la cuenta en la nube.');
  }

  const payload = {
    email: user.email.toLowerCase().trim(),
    name: user.name,
    password_hash: user.password_hash,
    auth_provider: user.auth_provider,
    ...(user.created_at ? { created_at: user.created_at } : {}),
  };
  // Un alta nunca debe sobrescribir una cuenta que ya existe en otro
  // dispositivo. Las actualizaciones de cuenta, si se añaden, requieren un
  // flujo autenticado independiente.
  const { error } = await supabase.from('users').insert(payload);
  if (error) {
    // Se agenda el resto de la sincronización; el llamador decide si conserva
    // o revierte la alta local para que su flujo de registro sea consistente.
    enqueueSync('users', FLUSH_RETRY_OFFLINE_MS);
    throw new Error(`No se pudo crear la cuenta en Supabase: ${error.message}`);
  }
}

async function executePendingSync(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) return;
  if (pendingSyncTables.size === 0) return;

  const now = Date.now();
  if (syncing) {
    scheduleFlush(SYNC_THROTTLE_MS);
    return;
  }

  const timeSinceLastSync = now - lastSyncAt;
  if (timeSinceLastSync < SYNC_THROTTLE_MS) {
    scheduleFlush(SYNC_THROTTLE_MS - timeSinceLastSync);
    return;
  }

  syncing = true;
  lastSyncAt = Date.now();

  try {
    const online = await isOnline();
    if (!online) {
      scheduleFlush(FLUSH_RETRY_OFFLINE_MS);
      return;
    }

    // Si el usuario activo ya no existe en Supabase: revoca y no sube nada.
    const userStillValid = await enforceRemoteUserExistence();
    if (!userStillValid) {
      pendingSyncTables.clear();
      return;
    }

    let targetTables: string[];
    if (pendingSyncTables.has('*')) {
      targetTables = [...SYNC_TABLES];
    } else {
      const needed = new Set<string>();
      for (const table of pendingSyncTables) {
        needed.add(table);
        const parents = PARENT_DEPENDENCIES[table] ?? [];
        parents.forEach((p) => needed.add(p));
      }
      targetTables = SYNC_TABLES.filter((t) => needed.has(t));
    }

    for (const table of targetTables) {
      try {
        const activeUserIdValue =
          USER_SCOPED_TABLES[table] !== undefined ? await getActiveUserId() : null;

        // Tablas personales con columna user_id: solo se sube el usuario activo.
        if (USER_SCOPED_TABLES[table] !== undefined) {
          if (activeUserIdValue === null) continue;
          const col = USER_SCOPED_TABLES[table];
          assertSafeIdentifier(table);
          assertSafeIdentifier(col);
          const rows = await getDatabase().getAllAsync<Record<string, unknown>>(
            `SELECT * FROM "${table}" WHERE "${col}" = ?`,
            [activeUserIdValue],
          );
          if (!rows.length) {
            pendingSyncTables.delete(table);
            continue;
          }
          const conflictColumn = UPSERT_ON_CONFLICT[table] ?? 'id';
          // Los perfiles se restringen a sus columnas oficiales: la remota (o
          // una instalación antigua) puede no tener aún columnas locales extra
          // (edad, etc.), así que se filtra el payload antes del upsert.
          const rowsToSend =
            table === 'user_profiles'
              ? sanitizeUserProfilesPayload(rows)
              : table === 'nutrition_profile'
                ? sanitizeNutritionProfilePayload(rows)
                : rows;
          const { error } = await supabase.from(table).upsert(rowsToSend, { onConflict: conflictColumn });
          if (error) {
            console.warn(
              `syncLocalToRemote: ${table} no sincronizada ` +
                `(code=${error.code ?? 'n/a'}; message=${error.message}; ` +
                `details=${error.details ?? 'n/a'}; hint=${error.hint ?? 'n/a'})`,
            );
          } else {
            pendingSyncTables.delete(table);
          }
          continue;
        }

        assertSafeIdentifier(table);
        const rows = await getDatabase().getAllAsync<Record<string, unknown>>(
          `SELECT * FROM "${table}"`,
        );
        if (!rows.length) {
          pendingSyncTables.delete(table);
          continue;
        }
        const conflictColumn = UPSERT_ON_CONFLICT[table] ?? 'id';
        // Solo se envían columnas válidas del esquema remoto. Para `users` y
        // `user_profiles` se aplica un whitelist estricto (PK + columnas
        // oficiales), descartando columnas legacy o locales que el esquema de
        // Supabase pueda no tener aún, evitando advertencias y violaciones del
        // contrato del upsert.
        // Para las tablas de relación con UNIQUE compuesto NO se envía el 'id'
        // local: la nube regenera el id con su propia secuencia y así los ids
        // coincidentes de distintos dispositivos dejan de chocar contra la PK
        // remota (p. ej. 'day_exercises_pkey') en el INSERT.
        const isIdentityRegenerated = (
          IDENTITY_REGENERATED_TABLES as readonly string[]
        ).includes(table);
        const rowsToSend =
          table === 'users'
            ? sanitizeUsersPayload(rows)
            : table === 'user_profiles'
              ? sanitizeUserProfilesPayload(rows)
              : table === 'workout_sets'
                ? await mapWorkoutSetsToRemoteSessions(supabase, rows)
              : isIdentityRegenerated
                ? stripLocalIds(rows)
                : rows;
        const { error } = await supabase
          .from(table)
          .upsert(rowsToSend, { onConflict: conflictColumn });
        if (error) {
          // Tabla sin contraparte en Supabase o sin PK: se ignora sin cortar el resto.
          console.warn(
            `syncLocalToRemote: ${table} no sincronizada ` +
              `(code=${error.code ?? 'n/a'}; message=${error.message}; ` +
              `details=${error.details ?? 'n/a'}; hint=${error.hint ?? 'n/a'})`,
          );
          continue;
        }

        pendingSyncTables.delete(table);

        // Asociar las filas subidas al usuario activo.
        if ((OWNED_TABLES as readonly string[]).includes(table)) {
          // Si la nube regeneró los ids, la propiedad se registra con los ids
          // REMOTOS reales (los locales ya no coinciden tras el INSERT).
          const rowsForOwnership = isIdentityRegenerated
            ? await fetchRemoteIdsByComposite(supabase, table, rows)
            : rows;
          await markOwnedRows(table, rowsForOwnership);
        }
      } catch {
        // La tabla puede no existir aún en local o divergir del esquema remoto.
      }
    }

    if (pendingSyncTables.has('*')) {
      pendingSyncTables.clear();
    }
  } finally {
    syncing = false;
    if (pendingSyncTables.size > 0) {
      scheduleFlush(SYNC_THROTTLE_MS);
    }
  }
}

// Columnas válidas del esquema remoto de `users`. Cualquier otra columna que
// exista en la tabla local (p. ej. 'google_id' en instalaciones sin migrar)
// se descarta antes del upsert para no violar el esquema de Supabase.
const VALID_USERS_COLUMNS = [
  'email',
  'name',
  'password_hash',
  'auth_provider',
  'created_at',
] as const;

function sanitizeUsersPayload(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    // Se elimina explícitamente la propiedad obsoleta 'google_id' del objeto
    // (instalaciones que aún conserven la columna) antes de enviar el upsert.
    const { google_id: _obsoleteGoogleId, ...cleanRow } = row;
    const clean: Record<string, unknown> = {};
    for (const column of VALID_USERS_COLUMNS) {
      clean[column] = cleanRow[column] ?? null;
    }
    return clean;
  });
}

// Columnas oficiales de 'user_profiles' enviadas a Supabase. La edad es
// opcional, pero forma parte del contrato local/remoto y debe conservarse al
// sincronizar; el esquema SQL garantiza su presencia con ADD COLUMN IF NOT
// EXISTS en instalaciones anteriores.
const VALID_USER_PROFILES_COLUMNS = [
  'user_id',
  'age',
  'height',
  'current_weight',
  'target_weight',
  'goal_weeks',
  'goal_date',
  'goal_status',
  'username',
  'created_at',
] as const;

function sanitizeUserProfilesPayload(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const column of VALID_USER_PROFILES_COLUMNS) {
      clean[column] = row[column] ?? null;
    }
    return clean;
  });
}

// Columnas oficiales de 'nutrition_profile'. OJO: 'daily_calories_goal' NO se
// elimina: es la meta calórica diaria y existe como columna real (NOT NULL) en
// el esquema local y remoto; omitirla rompería el upsert con una violación de
// NOT NULL. El whitelist solo descarta columnas locales extra desconocidas.
const VALID_NUTRITION_PROFILE_COLUMNS = [
  'user_id',
  'daily_calories_goal',
  'activity_level',
  'goal_type',
  'updated_at',
] as const;

function sanitizeNutritionProfilePayload(
  rows: Record<string, unknown>[],
): Record<string, unknown>[] {
  return rows.map((row) => {
    const clean: Record<string, unknown> = {};
    for (const column of VALID_NUTRITION_PROFILE_COLUMNS) {
      clean[column] = row[column] ?? null;
    }
    return clean;
  });
}

// Tablas de relación con UNIQUE compuesto cuyo 'id' numérico es solo de la
// instalación local: al subirlas se omite 'id' para que Supabase lo regenere.
// Si se enviara, los ids locales de cada dispositivo coinciden y chocarían
// contra la PK remota en el INSERT ('duplicate key ... day_exercises_pkey').
const IDENTITY_REGENERATED_TABLES = [] as const;

// Claves de negocio (UNIQUE compuesto) de esas tablas: sirven para localizar
// en la nube la fila recién subida y conocer su id remoto real.
const REMOTE_ID_KEYS: Record<string, string[]> = {
  day_exercises: ['day_of_week', 'body_part_id', 'exercise_id'],
  day_muscles: ['day_of_week', 'body_part_id'],
  workout_sessions: ['day_of_week', 'date'],
  weekly_schedule: ['day_of_week'],
  daily_calories: ['date'],
  body_parts: ['name'],
};

function stripLocalIds(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((row) => {
    // Se descarta el 'id' local: la entidad se identifica únicamente por su
    // UNIQUE compuesto en el upsert, y la secuencia remota asigna el id nuevo.
    const { id: _localId, ...cleanRow } = row;
    return cleanRow;
  });
}

/**
 * workout_sessions recibe un id nuevo en Supabase. Las series creadas offline
 * conservan el id SQLite de la sesión, que no es una FK válida en la nube.
 * Se traduce por la identidad estable de la sesión: día de semana + fecha.
 */
async function mapWorkoutSetsToRemoteSessions(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const localSessionIds = [...new Set(rows.map((row) => Number(row.session_id)))].filter(
    (id) => Number.isFinite(id) && id > 0,
  );
  if (!localSessionIds.length) return rows;

  const placeholders = localSessionIds.map(() => '?').join(', ');
  const localSessions = await getDatabase().getAllAsync<{
    id: number;
    day_of_week: string;
    date: string;
  }>(
    `SELECT id, day_of_week, date FROM workout_sessions WHERE id IN (${placeholders})`,
    localSessionIds,
  );
  const remoteByLocalId = new Map<number, number>();
  for (const session of localSessions) {
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id')
      .eq('day_of_week', session.day_of_week)
      .eq('date', session.date)
      .limit(1);
    const remoteId = data?.[0]?.id;
    if (error || !Number.isFinite(Number(remoteId))) {
      throw new Error('La sesión remota aún no está disponible para sus series.');
    }
    remoteByLocalId.set(session.id, Number(remoteId));
  }

  return rows.map((row) => ({
    ...row,
    session_id: remoteByLocalId.get(Number(row.session_id)) ?? row.session_id,
  }));
}

async function fetchRemoteIdsByComposite(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  table: string,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const keys = REMOTE_ID_KEYS[table];
  if (!keys || !keys.length) return [];
  const { data, error } = await supabase
    .from(table)
    .select(['id', ...keys].join(', '));
  if (error || !data) return [];
  const remoteIdByIdentity = new Map<string, number>();
  for (const row of data as unknown as Record<string, unknown>[]) {
    remoteIdByIdentity.set(
      keys.map((k) => String(row[k] ?? '')).join('|'),
      Number(row.id),
    );
  }
  const resolved: Record<string, unknown>[] = [];
  for (const localRow of rows) {
    const identity = keys.map((k) => String(localRow[k] ?? '')).join('|');
    const remoteId = remoteIdByIdentity.get(identity);
    if (remoteId !== undefined && Number.isFinite(remoteId)) {
      resolved.push({ ...localRow, id: remoteId });
    }
  }
  return resolved;
}

async function markOwnedRows(
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) return;
  const ownerId = await getActiveUserId();
  if (ownerId === null) return;
  try {
    const payload = rows
      .filter((r) => Number.isFinite(Number(r.id)))
      .map((r) => ({
        table_name: table,
        row_id: Number(r.id),
        user_id: ownerId,
      }));
    if (!payload.length) return;
    const { error } = await supabase
      .from(OWNERSHIP_TABLE)
      .upsert(payload, { onConflict: 'table_name,row_id' });
    if (error) {
      console.warn(`syncLocalToRemote: propietario no registrado (${error.message})`);
    }
  } catch {
    // Fallo opcional; no bloquea la sincronización.
  }
}

async function insertLocalRow(table: string, row: Record<string, unknown>): Promise<void> {
  assertSafeIdentifier(table);
  const existing = tableColumns(table);
  const keys = Object.keys(row).filter((k) => existing.includes(k) && row[k] !== undefined);
  if (!keys.length) return;
  keys.forEach(assertSafeIdentifier);
  const quoted = keys.map((k) => `"${k}"`).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const params = keys.map((k) => (row[k] as string | number | null) ?? null);
  await getDatabase().runAsync(
    `INSERT OR REPLACE INTO "${table}" (${quoted}) VALUES (${placeholders})`,
    params,
  );
}

async function replaceLocalRows(table: string, rows: Record<string, unknown>[]): Promise<void> {
  assertSafeIdentifier(table);
  const db = getDatabase();
  const ids = rows
    .map((r) => Number(r.id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(', ');
    await db.runAsync(`DELETE FROM "${table}" WHERE id IN (${placeholders})`, ids);
  }
  for (const row of rows) {
    await insertLocalRow(table, row);
  }
}

async function mergeUserScopedRows(
  table: string,
  col: string,
  userId: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  assertSafeIdentifier(table);
  assertSafeIdentifier(col);
  const db = getDatabase();
  await db.runAsync(`DELETE FROM "${table}" WHERE "${col}" = ?`, [userId]);
  for (const row of rows) {
    await insertLocalRow(table, row);
  }
}

/**
 * Restaura desde Supabase los datos del usuario activo (los que le pertenecen
 * según user_row_owners y las tablas con columna user_id). Se invoca al
 * iniciar sesión o al detectar un cambio de usuario, siempre de forma silenciosa.
 */
export async function syncRemoteToLocal(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) return;
  const ownerId = await getActiveUserId();
  if (ownerId === null) return;

  const online = await isOnline();
  if (!online) return;

  // Si el usuario activo ya no existe en Supabase: revoca y no descarga.
  const userStillValid = await enforceRemoteUserExistence();
  if (!userStillValid) return;

  try {
    // El catálogo es necesario para que las FK locales de las rutinas y
    // sesiones tengan los mismos IDs que en Supabase al usar otro dispositivo.
    for (const table of ['body_parts', 'exercises_v2'] as const) {
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (!error && data) {
          await replaceLocalRows(table, data as Record<string, unknown>[]);
        }
      } catch {
        // Catálogo opcional: se conserva el local si la tabla aún no existe.
      }
    }

    for (const [table, col] of Object.entries(USER_SCOPED_TABLES)) {
      try {
        const { data, error } = await supabase.from(table).select('*').eq(col, ownerId);
        if (error || !data || data.length === 0) continue;
        await mergeUserScopedRows(
          table,
          col,
          ownerId,
          data as Record<string, unknown>[],
        );
      } catch {
        // Tabla ausente en la nube o divergencias de esquema: se ignora.
      }
    }

    const { data: owners, error: ownersError } = await supabase
      .from(OWNERSHIP_TABLE)
      .select('table_name, row_id')
      .eq('user_id', ownerId);
    if (ownersError || !owners) return;

    const rowsByTable = new Map<string, number[]>();
    for (const o of owners as { table_name: string; row_id: number }[]) {
      const arr = rowsByTable.get(o.table_name) ?? [];
      arr.push(o.row_id);
      rowsByTable.set(o.table_name, arr);
    }

    for (const table of PULL_ORDER) {
      const ids = rowsByTable.get(table);
      if (!ids || ids.length === 0) continue;
      try {
        const { data, error } = await supabase.from(table).select('*').in('id', ids);
        if (error || !data || data.length === 0) continue;
        await replaceLocalRows(table, data as Record<string, unknown>[]);
      } catch {
        // Se ignora por tabla para no cortar el resto de la restauración.
      }
    }
  } catch {
    // Restauración de datos opcional; nunca lanza al usuario.
  }
}

/**
 * Elimina de la base local los datos del usuario indicado (entrenamientos,
 * peso, comidas y el resto de tablas de usuario) para que al cambiar de
 * cuenta no queden registros de la cuenta anterior en el dispositivo.
 * No borra el catálogo de ejercicios ni la propia cuenta de usuario.
 */
export async function purgeUserData(userId: string): Promise<void> {
  const db = getDatabase();
  try {
    await db.withTransactionAsync(async () => {
      for (const table of OWNED_TABLES) {
        assertSafeIdentifier(table);
        await db.runAsync(`DELETE FROM "${table}"`);
      }
      await db.runAsync('DELETE FROM user_profiles WHERE user_id = ?', [userId]);
      await db.runAsync('DELETE FROM nutrition_profile WHERE user_id = ?', [userId]);
      await db.runAsync('DELETE FROM meals_v2 WHERE user_id = ?', [userId]);
    });
  } catch {
    // Si el borrado falla, el aislamiento se garantiza en el pull siguiente.
  }
}
