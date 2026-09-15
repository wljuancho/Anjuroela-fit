import { supabase, isSupabaseConfigured } from './supabaseClient';
import { getDatabase } from './database';

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
const UPSERT_ON_CONFLICT: Record<string, string> = {
  nutrition_profile: 'user_id',
};

const SYNC_THROTTLE_MS = 10000;

let lastSyncAt = 0;
let syncing = false;

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

/**
 * Replica en segundo plano una tabla (o todas) desde SQLite local a Supabase.
 * Silenciosa: si no hay Supabase configurado, no hay red o la consulta falla,
 * la app sigue funcionando con SQLite sin lanzar alertas ni bloquearse.
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

    const tables = tableName ? [tableName] : SYNC_TABLES;
    for (const table of tables) {
      try {
        const rows = await getDatabase().getAllAsync<Record<string, unknown>>(
          `SELECT * FROM "${table}"`,
        );
        if (!rows.length) continue;
        const onConflict = UPSERT_ON_CONFLICT[table] ?? 'id';
        const { error } = await supabase.from(table).upsert(rows, { onConflict });
        if (error) {
          // Tabla sin contraparte en Supabase o sin PK: se ignora sin cortar el resto.
          console.warn(`syncLocalToRemote: ${table} no sincronizada (${error.message})`);
        }
      } catch {
        // La tabla puede no existir aún en local o divergir del esquema remoto.
      }
    }
  } finally {
    syncing = false;
  }
}