import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import { getDatabase } from './database';
import { getStoredCurrentUserId } from './sessionStorage';
import { assertSafeIdentifier } from './utils';

// Tablas locales que se replican a Supabase en segundo plano.
// Coinciden 1:1 con las tablas activas del esquema (supabase_schema.sql).
// Las tablas legacy (exercises, workouts, workout_exercises, meals, meals_v2,
// progress) se eliminaron del esquema local y de Supabase; solo app_meta
// queda como metadato interno del dispositivo y no se sincroniza.
const SYNC_TABLES = [
  // NIVEL 1: identidad y catálogo (tablas PADRE). Excluye las tablas legacy
  // eliminadas (exercises, workouts, workout_exercises, meals, meals_v2,
  // progress); 'exercises_v2' es el catálogo de ejercicios activo que
  // referencia day_* y workout_sets.
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
  'workout_circuits',
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
  workout_circuits: ['body_parts'],
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
  workout_sessions: 'user_id,day_of_week,date,session_type',
  workout_circuits: 'day_of_week,body_part_id',
  daily_calories: 'user_id,date',
  // En una instalación limpia el id local se conserva también en Supabase.
  // Así las FK de exercises_v2, sesiones y series son estables entre
  // dispositivos del mismo usuario.
};

// Tablas cuyo contenido es POR USUARIO pero sin columna de usuario propia:
// para aislarlas sin modificar sus tablas se registra su dueño en la tabla
// auxiliar user_row_owners (aditiva) al subirlas; al bajar solo se restauran
// las filas del usuario activo. workout_sessions y daily_calories SÍ tienen
// columna user_id (viven en USER_SCOPED_TABLES) y se conservan aquí solo para
// el registro de propiedad y el borrado en cascada al eliminar la cuenta.
const OWNED_TABLES = [
  'weekly_schedule',
  'day_muscles',
  'day_exercises',
  'workout_sessions',
  'workout_sets',
  'workout_circuits',
  'weight_logs',
  'meal_logs',
  'daily_calories',
  'weekly_meal_plan',
] as const;

// Tablas que YA tienen columna user_id: se filtran directamente por el
// usuario activo (o las filas legacy con user_id NULL), tanto al subir como
// al bajar.
const USER_SCOPED_TABLES: Record<string, string> = {
  user_profiles: 'user_id',
  nutrition_profile: 'user_id',
  workout_sessions: 'user_id',
  daily_calories: 'user_id',
};

// Tablas migradas a user_id que aún pueden contener filas legacy (user_id
// NULL) en Supabase: al bajarlas se incluyen esas filas con .or(...) para no
// perder historial de instalaciones antiguas.
const LEGACY_NULL_USER_FALLBACK_TABLES = new Set(['workout_sessions', 'daily_calories']);

// Tabla auxiliar que guarda la relación (tabla, fila) -> usuario dueño.
const OWNERSHIP_TABLE = 'user_row_owners';

// Buffer local de borrados pendientes de propagar a Supabase (solo lo usa
// syncService; no se sincroniza ni se restaura desde la nube).
const DELETIONS_TABLE = 'pending_deletions';

// Tablas cuya clave de negocio es un UNIQUE compuesto y cuyos ids remotos
// pueden no coincidir con el id local (el upsert por conflicto compuesto puede
// regenerar el id en la nube). Sus borrados se localizan por estas columnas
// (además del id local, cuando se conozca) en vez de solo por el id.
const DELETION_COMPOSITE_KEYS: Record<string, readonly string[]> = {
  weekly_schedule: ['day_of_week'],
  day_muscles: ['day_of_week', 'body_part_id'],
  day_exercises: ['day_of_week', 'body_part_id', 'exercise_id'],
  workout_circuits: ['day_of_week', 'body_part_id'],
  workout_sessions: ['user_id', 'day_of_week', 'date', 'session_type'],
  daily_calories: ['user_id', 'date'],
};

// Identidad de una fila eliminada localmente: id local (si lo había) y/o el
// UNIQUE de negocio (para tablas con clave compuesta).
export interface LocalDeletionIdentity {
  table: string;
  rowId?: number;
  key?: Record<string, string | number | null>;
}

interface PendingDeletionRow {
  id: number;
  table_name: string;
  row_id: number | null;
  key_json: string | null;
  user_id: string;
  created_at: string;
}

// Orden seguro para restaurar filas respetando FK (padres antes que hijos).
const PULL_ORDER = [
  'weekly_schedule',
  'day_muscles',
  'day_exercises',
  'workout_sets',
  'workout_circuits',
  'weight_logs',
  'meal_logs',
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

export async function getActiveUserId(): Promise<string | null> {
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

/**
 * Elimina del buffer local los borrados pendientes del usuario indicado. Se
 * usa al borrar la cuenta de forma definitiva: sus tickets de borrado han
 * quedado huérfanos (la fila remota ya no existe) y no deben propagarse ni
 * aplicarse con otra sesión.
 */
export async function discardPendingDeletionsForUser(userId: string): Promise<void> {
  try {
    await getDatabase().runAsync(
      `DELETE FROM ${DELETIONS_TABLE} WHERE user_id = ?`,
      [userId],
    );
  } catch {
    // Fallo no letal.
  }
}

/**
 * Registra en el buffer local un borrado que debe propagarse a Supabase en cuanto
 * haya conexión. Se invoca junto a cada DELETE de una tabla sincronizada; si el
 * borrado se hizo sin red, la entrada queda esperando y se envía al reconectar.
 * La entrada pertenece al usuario activo (se flushea solo con su sesión).
 */
export async function queueLocalDeletion(identity: LocalDeletionIdentity): Promise<void> {
  const userId = await getActiveUserId();
  if (userId === null) return;
  assertSafeIdentifier(identity.table);
  const rowId =
    identity.rowId !== undefined && Number.isFinite(Number(identity.rowId))
      ? Number(identity.rowId)
      : null;
  const keyJson = identity.key ? JSON.stringify(identity.key) : null;
  try {
    await getDatabase().runAsync(
      `INSERT INTO ${DELETIONS_TABLE} (table_name, row_id, key_json, user_id) VALUES (?, ?, ?, ?)`,
      [identity.table, rowId, keyJson, userId],
    );
  } catch {
    // Si el buffer no puede persistir, la fila local ya está borrada; el
    // siguiente flush completo del resto de tablas no la resucitará.
  }
}

let flushingDeletions = false;

/**
 * Propaga a Supabase los borrados pendientes del usuario activo. Se ejecuta
 * ANTES de los upserts en la subida y ANTES de la restauración en la bajada,
 * para que una fila eliminada sin conexión no vuelva a aparecer. Por cada
 * entrada: localiza la fila remota (por id local o por su clave de negocio),
 * la borra, limpia su registro de propietario y elimina la entrada del buffer.
 * Si falta red o falla la petición, la entrada se conserva para reintentar.
 */
async function flushPendingDeletions(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) return;
  const userId = await getActiveUserId();
  if (userId === null) return;
  if (flushingDeletions) return;

  const db = getDatabase();
  let entries: PendingDeletionRow[] = [];
  try {
    entries = await db.getAllAsync<PendingDeletionRow>(
      `SELECT * FROM ${DELETIONS_TABLE} WHERE user_id = ? ORDER BY id`,
      [userId],
    );
  } catch {
    return;
  }
  if (!entries.length) return;

  flushingDeletions = true;
  try {
    for (const entry of entries) {
      try {
        const outcome = await deleteRemoteRow(supabase, entry);
        // 'done' u 'absent': la fila ya no existe remoto (o nunca existió), la
        // entrada del buffer se descarta.
        if (outcome === 'done' || outcome === 'absent') {
          await db.runAsync(`DELETE FROM ${DELETIONS_TABLE} WHERE id = ?`, [entry.id]);
        }
      } catch {
        // Sin red o error transitorio: la entrada se conserva para reintentar.
        console.warn(`flushPendingDeletions: ${entry.table_name} (${entry.id}) sin borrar`);
      }
    }
  } finally {
    flushingDeletions = false;
  }

  try {
    const remaining = await db.getAllAsync<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM ${DELETIONS_TABLE} WHERE user_id = ?`,
      [userId],
    );
    if ((remaining[0]?.cnt ?? 0) > 0) {
      scheduleFlush(FLUSH_RETRY_OFFLINE_MS);
    }
  } catch {
    // Reintento programado por la cola de sync si el conteo falla.
  }
}

async function deleteRemoteRow(
  supabase: NonNullable<ReturnType<typeof getSupabase>>,
  entry: PendingDeletionRow,
): Promise<'done' | 'absent' | 'kept'> {
  const composited = DELETION_COMPOSITE_KEYS[entry.table_name] ?? null;
  let remoteId: number | null =
    entry.row_id !== null && Number.isFinite(Number(entry.row_id))
      ? Number(entry.row_id)
      : null;

  if (composited) {
    let keyValues: Record<string, string | number | null> | null = null;
    if (entry.key_json) {
      try {
        keyValues = JSON.parse(entry.key_json) as Record<string, string | number | null>;
      } catch {
        keyValues = null;
      }
    }
    if (!keyValues) {
      // Sin clave de negocio no se puede localizar la fila remota con seguridad.
      return 'kept';
    }
    let valid = true;
    for (const k of composited) {
      if (keyValues[k] === undefined || keyValues[k] === null) valid = false;
    }
    if (!valid) return 'kept';

    // Se resuelve el id remoto real por la clave de negocio: el upsert con
    // conflicto compuesto pudo haber regenerado el id en la nube.
    let query = supabase.from(entry.table_name).select('id').limit(1);
    for (const k of composited) {
      assertSafeIdentifier(k);
      query = query.eq(k, keyValues![k]);
    }
    const resolved = await query;
    if (resolved.error) {
      throw resolved.error;
    }
    if (!resolved.data || resolved.data.length === 0) {
      // La fila ya no existe en la nube.
      return 'absent';
    }
    remoteId = Number(resolved.data[0].id);
  }

  if (remoteId === null || !Number.isFinite(remoteId)) {
    return 'kept';
  }

  const { error: deleteError } = await supabase
    .from(entry.table_name)
    .delete()
    .eq('id', remoteId);
  if (deleteError) {
    throw deleteError;
  }

  // Limpieza del registro de propietario (solo tras un borrado correcto).
  try {
    await supabase
      .from(OWNERSHIP_TABLE)
      .delete()
      .eq('table_name', entry.table_name)
      .eq('row_id', remoteId);
  } catch {
    // La propiedad se pierde junto con la fila; el fallo no bloquea el flujo.
  }

  return 'done';
}

/**
 * Re-aplica localmente los borrados que siguen pendientes (p. ej. si una
 * restauración desde la nube volvió a insertar filas que tenían ticket de
 * borrado). Garantiza que cerrar y reabrir la app nunca resucite lo eliminado.
 */
async function reapplyPendingDeletionsLocal(): Promise<void> {
  const userId = await getActiveUserId();
  if (userId === null) return;
  const db = getDatabase();
  let entries: PendingDeletionRow[] = [];
  try {
    entries = await db.getAllAsync<PendingDeletionRow>(
      `SELECT * FROM ${DELETIONS_TABLE} WHERE user_id = ? ORDER BY id`,
      [userId],
    );
  } catch {
    return;
  }
  for (const entry of entries) {
    try {
      assertSafeIdentifier(entry.table_name);
      const composited = DELETION_COMPOSITE_KEYS[entry.table_name] ?? null;
      if (composited && entry.key_json) {
        const keyValues = JSON.parse(entry.key_json) as Record<string, string | number | null>;
        if (composited.some((k) => keyValues[k] === undefined || keyValues[k] === null)) continue;
        const conditions = composited.map((k) => `"${k}" = ?`).join(' AND ');
        await db.runAsync(
          `DELETE FROM "${entry.table_name}" WHERE ${conditions}`,
          composited.map((k) => keyValues[k] ?? null),
        );
      } else if (entry.row_id !== null && Number.isFinite(Number(entry.row_id))) {
        await db.runAsync(`DELETE FROM "${entry.table_name}" WHERE id = ?`, [
          Number(entry.row_id),
        ]);
      }
    } catch {
      // Entrada con identidad insuficiente o error local: se conserva.
    }
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

    // Los borrados pendientes de propagar se envían ANTES de los upserts:
    // así una fila re-creada con la misma clave de negocio no es borrada por
    // el ticket de la fila antigua tras ser re-insertada en la nube.
    await flushPendingDeletions();

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
            // workout_sessions y daily_calories combinan columna user_id y
            // registro de propietario: se conserva la propiedad para que el
            // borrado en cascada al eliminar la cuenta siga funcionando.
            if ((OWNED_TABLES as readonly string[]).includes(table)) {
              await markOwnedRows(table, rows);
            }
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
  'gender',
  'current_weight',
  'target_weight',
  'goal_weeks',
  'goal_date',
  'goal_status',
  'username',
  'sex_for_calorie_formula',
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
  'sex_for_calorie_formula',
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
  workout_sessions: ['user_id', 'day_of_week', 'date', 'session_type'],
  weekly_schedule: ['day_of_week'],
  daily_calories: ['user_id', 'date'],
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
  const userId = await getActiveUserId();
  if (userId === null) return rows;

  const localSessionIds = [...new Set(rows.map((row) => Number(row.session_id)))].filter(
    (id) => Number.isFinite(id) && id > 0,
  );
  if (!localSessionIds.length) return rows;

  const placeholders = localSessionIds.map(() => '?').join(', ');
  const localSessions = await getDatabase().getAllAsync<{
    id: number;
    day_of_week: string;
    date: string;
    session_type: string;
  }>(
    `SELECT id, day_of_week, date, session_type FROM workout_sessions ` +
      `WHERE id IN (${placeholders}) AND (user_id = ? OR user_id IS NULL)`,
    [...localSessionIds, userId],
  );
  const remoteByLocalId = new Map<number, number>();
  for (const session of localSessions) {
    // La sesión remota se localiza por la UNIQUE compuesta del usuario activo,
    // tolerando filas legacy sin user_id.
    const { data, error } = await supabase
      .from('workout_sessions')
      .select('id')
      .or(`user_id.eq.${userId},user_id.is.null`)
      .eq('day_of_week', session.day_of_week)
      .eq('date', session.date)
      .eq('session_type', session.session_type)
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

  // Se propagan los borrados pendientes ANTES de restaurar desde la nube: si
  // no, una fila eliminada sin conexión volvería a aparecer al reabrir la app.
  await flushPendingDeletions();
  // Si la restauración anterior (o una concurrente) reintrodujo filas que
  // tenían ticket de borrado, se vuelven a eliminar en local.
  await reapplyPendingDeletionsLocal();

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
        // Las tablas migradas a user_id aún pueden conservar filas legacy
        // (user_id NULL) en la nube; se incluyen con .or(...) para no perder
        // historial de instalaciones antiguas.
        const needsLegacyFallback = LEGACY_NULL_USER_FALLBACK_TABLES.has(table);
        const { data, error } = needsLegacyFallback
          ? await supabase
              .from(table)
              .select('*')
              .or(`user_id.eq.${ownerId},user_id.is.null`)
          : await supabase.from(table).select('*').eq(col, ownerId);
        if (error || !data || data.length === 0) continue;
        const rows = data as Record<string, unknown>[];
        if (needsLegacyFallback) {
          // workout_sessions y daily_calories conservan ids estables locales:
          // se reemplazan por id (las filas creadas offline sin subir se
          // preservan), en vez del borrado masivo de mergeUserScopedRows que
          // perdería el historial recién creado sin conexión.
          await replaceLocalRows(table, rows);
        } else {
          await mergeUserScopedRows(table, col, ownerId, rows);
        }
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
    });
  } catch {
    // Si el borrado falla, el aislamiento se garantiza en el pull siguiente.
  }
}
