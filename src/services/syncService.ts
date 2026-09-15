import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getDatabase } from './database';
import { getStoredCurrentUserId } from './sessionStorage';
import { assertSafeIdentifier } from './utils';

// Tablas locales que se replican a Supabase en segundo plano.
// Coinciden 1:1 con las tablas activas del esquema (supabase_schema.sql).
// NO se sincronizan (quedan solo en el script como copia del esquema local):
// workouts, workout_exercises, exercises, meals, meals_v2, progress (legacy
// vacías tras la limpieza) y app_meta (metadatos internos del dispositivo).
const SYNC_TABLES = [
  'users',
  'user_profiles',
  'body_parts',
  'exercises_v2',
  'weekly_schedule',
  'day_muscles',
  'day_exercises',
  'workout_sessions',
  'workout_sets',
  'weight_logs',
  'nutrition_profile',
  'daily_calories',
  'meal_logs',
  'weekly_meal_plan',
] as const;

// Tablas cuya clave primaria no se llama 'id'; se usa su PK para el upsert.
// 'users' usa su UNIQUE(email) para evitar que ids AUTOINCREMENT locales
// sobrescriban una cuenta remota existente desde otro dispositivo.
// El resto apunta a las restricciones UNIQUE de negocio de las tablas
// (weekly_schedule por día, day_muscles por día+músculo, etc.) para que el
// upsert actualice en vez de duplicar.
const UPSERT_ON_CONFLICT: Record<string, string> = {
  users: 'email',
  nutrition_profile: 'user_id',
  weekly_schedule: 'day_of_week',
  day_muscles: 'day_of_week,body_part_id',
  day_exercises: 'day_of_week,body_part_id,exercise_id',
  workout_sessions: 'day_of_week,date',
  daily_calories: 'date',
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

let lastSyncAt = 0;
let syncing = false;

// Usuario activo (cacheado; se persiste con la sesión en SecureStore/AsyncStorage).
let activeUserId: number | null | undefined;

// Callback que marca la sesión como revocada (usuario eliminado en Supabase).
let sessionRevocationHandler: (() => void | Promise<void>) | null = null;
let revocationTriggered = false;

export function setSessionRevocationHandler(
  handler: (() => void | Promise<void>) | null,
): void {
  sessionRevocationHandler = handler;
}

export async function setActiveUserId(userId: number | null): Promise<void> {
  activeUserId = userId;
  if (userId !== null) {
    revocationTriggered = false;
  }
}

async function getActiveUserId(): Promise<number | null> {
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
export async function removeLocalUserAccount(userId: number): Promise<void> {
  try {
    await getDatabase().runAsync('DELETE FROM users WHERE id = ?', [userId]);
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
  if (!supabase || !isSupabaseConfigured()) return;

  const now = Date.now();
  if (syncing || now - lastSyncAt < SYNC_THROTTLE_MS) return;
  syncing = true;
  lastSyncAt = now;

  try {
    const online = await isOnline();
    if (!online) return;

    // Si el usuario activo ya no existe en Supabase: revoca y no sube nada.
    const userStillValid = await enforceRemoteUserExistence();
    if (!userStillValid) return;

    const tables = tableName ? [tableName] : SYNC_TABLES;
    for (const table of tables) {
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
          if (!rows.length) continue;
          const conflictColumn = UPSERT_ON_CONFLICT[table] ?? 'id';
          const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictColumn });
          if (error) {
            console.warn(`syncLocalToRemote: ${table} no sincronizada (${error.message})`);
          }
          continue;
        }

        assertSafeIdentifier(table);
        const rows = await getDatabase().getAllAsync<Record<string, unknown>>(
          `SELECT * FROM "${table}"`,
        );
        if (!rows.length) continue;
        const conflictColumn = UPSERT_ON_CONFLICT[table] ?? 'id';
        const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictColumn });
        if (error) {
          // Tabla sin contraparte en Supabase o sin PK: se ignora sin cortar el resto.
          console.warn(`syncLocalToRemote: ${table} no sincronizada (${error.message})`);
          continue;
        }

        // Asociar las filas subidas al usuario activo.
        if ((OWNED_TABLES as readonly string[]).includes(table)) {
          await markOwnedRows(table, rows);
        }
      } catch {
        // La tabla puede no existir aún en local o divergir del esquema remoto.
      }
    }
  } finally {
    syncing = false;
  }
}

async function markOwnedRows(
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
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
  userId: number,
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
  if (!supabase || !isSupabaseConfigured()) return;
  const ownerId = await getActiveUserId();
  if (ownerId === null) return;

  const online = await isOnline();
  if (!online) return;

  // Si el usuario activo ya no existe en Supabase: revoca y no descarga.
  const userStillValid = await enforceRemoteUserExistence();
  if (!userStillValid) return;

  try {
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
export async function purgeUserData(userId: number): Promise<void> {
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