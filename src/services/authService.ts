import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';
import { formatDate } from './utils';
import { syncLocalToRemote } from './syncService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export type AuthProvider = 'local' | 'google';

export interface UserRecord {
  id: number;
  name: string;
  email: string;
  auth_provider: AuthProvider;
  google_id?: string | null;
  created_at?: string;
}

export interface UserProfileRecord {
  id: number;
  user_id: number;
  age?: number | null;
  height?: number | null;
  current_weight?: number | null;
  target_weight?: number | null;
  goal_weeks?: number | null;
  goal_date?: string | null;
  goal_status?: string | null;
}

const HASH_PREFIX = 'v1';
const LEGACY_SALT = '-anjuroela-fix-salt';
const SALT_BYTE_LENGTH = 16;

function constantTimeEqual(a: string, b: string): boolean {
  const left = a.toLowerCase().trim();
  const right = b.toLowerCase().trim();
  if (left.length !== right.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
}

async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(SALT_BYTE_LENGTH);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`,
  );
  return `${HASH_PREFIX}:${salt}:${digest}`;
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.trim()) {
    return false;
  }
  if (!storedHash.startsWith(`${HASH_PREFIX}:`)) {
    const legacyDigest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${password}${LEGACY_SALT}`,
    );
    return constantTimeEqual(legacyDigest, storedHash);
  }
  const [prefix, salt, expectedHash] = storedHash.split(':');
  if (prefix !== HASH_PREFIX || !salt) {
    return false;
  }
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`,
  );
  return constantTimeEqual(digest, expectedHash);
}

async function upgradeLegacyHash(userId: number, storedHash: string, password: string): Promise<void> {
  if (storedHash.startsWith(`${HASH_PREFIX}:`)) {
    return;
  }
  const salt = await generateSalt();
  const nextHash = await hashPassword(password, salt);
  const db = getDatabase();
  await db.runAsync('UPDATE users SET password_hash = ? WHERE id = ?', [nextHash, userId]);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const db = getDatabase();
  const normalizedEmail = email.toLowerCase().trim();
  const result = await db.getAllAsync<UserRecord>(
    'SELECT id, name, email, auth_provider, google_id FROM users WHERE email = ? LIMIT 1',
    [normalizedEmail],
  );
  return result[0] ?? null;
}

export async function createLocalUser(
  name: string,
  email: string,
  password: string,
): Promise<UserRecord> {
  const db = getDatabase();
  const salt = await generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const result = await db.runAsync(
    'INSERT INTO users (name, email, password_hash, auth_provider) VALUES (?, ?, ?, ?)',
    [name, email.toLowerCase().trim(), passwordHash, 'local'],
  );
  void syncLocalToRemote('users');
  return {
    id: result.lastInsertRowId,
    name,
    email: email.toLowerCase().trim(),
    auth_provider: 'local',
  };
}

export async function verifyLocalCredentials(
  email: string,
  password: string,
): Promise<UserRecord | null> {
  const db = getDatabase();
  const normalizedEmail = email.toLowerCase().trim();
  const result = await db.getAllAsync<{
    id: number;
    name: string;
    email: string;
    password_hash: string;
    auth_provider: string;
  }>('SELECT id, name, email, password_hash, auth_provider FROM users WHERE email = ? LIMIT 1', [
    normalizedEmail,
  ]);

  if (!result[0]) {
    return null;
  }

  const hashValid = await verifyPassword(password, result[0].password_hash);
  if (!hashValid) {
    return null;
  }

  void upgradeLegacyHash(result[0].id, result[0].password_hash, password);

  return {
    id: result[0].id,
    name: result[0].name,
    email: result[0].email,
    auth_provider: 'local',
  };
}

export async function createGoogleUser(
  name: string,
  email: string,
  googleId: string,
): Promise<UserRecord> {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO users (name, email, auth_provider, google_id)
     VALUES (?, ?, 'google', ?)`,
    [name, email.toLowerCase().trim(), googleId],
  );
  void syncLocalToRemote('users');
  return {
    id: result.lastInsertRowId,
    name,
    email: email.toLowerCase().trim(),
    auth_provider: 'google',
    google_id: googleId,
  };
}

export interface UserSession {
  user: UserRecord;
  profile: {
    currentWeight?: number;
    targetWeight?: number;
    goalWeeks?: number;
    goalDate?: string;
    heightCm?: number;
    age?: number;
  } | null;
}

export async function getProfile(userId: number): Promise<UserProfileRecord | null> {
  const db = getDatabase();
  const result = await db.getAllAsync<UserProfileRecord>(
    'SELECT id, user_id, age, height, current_weight, target_weight, goal_weeks, goal_date, goal_status FROM user_profiles WHERE user_id = ? LIMIT 1',
    [userId],
  );
  return result[0] ?? null;
}

export async function updateGoalStatus(userId: number, status: 'active' | 'completed' | 'expired'): Promise<void> {
  const db = getDatabase();
  await db.runAsync('UPDATE user_profiles SET goal_status = ? WHERE user_id = ?', [
    status,
    userId,
  ]);
  void syncLocalToRemote('user_profiles');
}

export async function hasProfile(userId: number): Promise<boolean> {
  const profile = await getProfile(userId);
  return !!profile;
}

export async function saveProfile(userId: number, data: {
  age?: number;
  height?: number;
  currentWeight: number;
  targetWeight: number;
  goalWeeks: number;
  goalDate: string;
}): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO user_profiles
      (user_id, age, height, current_weight, target_weight, goal_weeks, goal_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      data.age ?? null,
      data.height ?? null,
      data.currentWeight,
      data.targetWeight,
      data.goalWeeks,
      data.goalDate || null,
    ],
  );

  await db.runAsync(
    `INSERT INTO weight_logs (date, weight_kg, notes)
     SELECT ?, ?, 'Peso inicial'
     WHERE NOT EXISTS (
       SELECT 1 FROM weight_logs WHERE date = ?
     )`,
    [formatDate(new Date()), data.currentWeight, formatDate(new Date())],
  );

  void syncLocalToRemote('user_profiles');
  void syncLocalToRemote('weight_logs');
}

export async function getUserSession(userId: number): Promise<UserSession> {
  const db = getDatabase();
  const userResult = await db.getAllAsync<UserRecord>(
    'SELECT id, name, email, auth_provider, google_id FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  const user = userResult[0];
  const profile = await getProfile(userId);

  return {
    user,
    profile: profile
      ? {
          currentWeight: profile.current_weight ?? undefined,
          targetWeight: profile.target_weight ?? undefined,
          goalWeeks: profile.goal_weeks ?? undefined,
          goalDate: profile.goal_date ?? undefined,
          heightCm: profile.height ?? undefined,
          age: profile.age ?? undefined,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Autenticación multidispositivo (validación contra Supabase)
// ---------------------------------------------------------------------------

interface RemoteUserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string | null;
  auth_provider: string | null;
  google_id: string | null;
}

async function findRemoteUserByEmail(email: string): Promise<RemoteUserRow | null> {
  if (!supabase || !isSupabaseConfigured()) return null;
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, password_hash, auth_provider, google_id')
      .eq('email', normalizedEmail)
      .limit(1);
    if (error || !data || data.length === 0) return null;
    return data[0] as RemoteUserRow;
  } catch {
    return null;
  }
}

async function importRemoteUser(remote: RemoteUserRow): Promise<void> {
  const db = getDatabase();
  try {
    await db.withTransactionAsync(async () => {
      const existing = await db.getAllAsync<{ id: number }>(
        'SELECT id FROM users WHERE email = ? LIMIT 1',
        [remote.email.toLowerCase().trim()],
      );
      if (existing[0] && existing[0].id !== remote.id) {
        await db.runAsync(
          'UPDATE user_profiles SET user_id = ? WHERE user_id = ?',
          [remote.id, existing[0].id],
        );
        await db.runAsync(
          'UPDATE nutrition_profile SET user_id = ? WHERE user_id = ?',
          [remote.id, existing[0].id],
        );
        await db.runAsync(
          'UPDATE meals_v2 SET user_id = ? WHERE user_id = ?',
          [remote.id, existing[0].id],
        );
        await db.runAsync('DELETE FROM users WHERE id = ?', [existing[0].id]);
      }
      await db.runAsync(
        `INSERT INTO users (id, name, email, password_hash, auth_provider, google_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           email = excluded.email,
           password_hash = excluded.password_hash,
           auth_provider = excluded.auth_provider,
           google_id = excluded.google_id`,
        [
          remote.id,
          remote.name,
          remote.email.toLowerCase().trim(),
          remote.password_hash,
          remote.auth_provider ?? 'local',
          remote.google_id ?? null,
        ],
      );
    });
  } catch {
    // Fallo no letal: la sesión de usuario igual se crea sin importar la copia local.
  }
}

async function importRemoteProfile(userId: number): Promise<void> {
  if (!supabase || !isSupabaseConfigured()) return;
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    if (!profileError && profileData && profileData.length) {
      await insertLocalRow('user_profiles', profileData[0] as Record<string, unknown>);
    }
  } catch {
    // Se ignora; el usuario puede simplemente no tener perfil aún.
  }
  try {
    const { data: nutData, error: nutError } = await supabase
      .from('nutrition_profile')
      .select('*')
      .eq('user_id', userId)
      .limit(1);
    if (!nutError && nutData && nutData.length) {
      await insertLocalRow('nutrition_profile', nutData[0] as Record<string, unknown>);
    }
  } catch {
    // Se ignora.
  }
}

async function insertLocalRow(table: string, row: Record<string, unknown>): Promise<void> {
  const db = getDatabase();
  const columns = db
    .getAllSync<{ name: string }>(`PRAGMA table_info("${table}")`)
    .map((c) => c.name);
  const keys = Object.keys(row).filter(
    (k) => columns.includes(k) && row[k] !== undefined,
  );
  if (!keys.length) return;
  const quoted = keys.map((k) => `"${k}"`).join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  await db.runAsync(
    `INSERT OR REPLACE INTO "${table}" (${quoted}) VALUES (${placeholders})`,
    keys.map((k) => (row[k] as string | number | null) ?? null),
  );
}

export type RemoteUserExistence = 'present' | 'absent' | 'unknown';

/**
 * Comprueba si la cuenta del usuario todavía existe en Supabase. Devuelve:
 * - 'present': la fila `users` existe en la nube.
 * - 'absent': la respuesta fue exitosa pero vacía (usuario borrado remotamente).
 * - 'unknown': Supabase no está configurado o hubo un error de red/timeout
 *   (no se puede concluir; NO se usa para revocar la sesión).
 */
export async function checkRemoteUserExistence(userId: number): Promise<RemoteUserExistence> {
  if (!supabase || !isSupabaseConfigured()) return 'unknown';
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId);
    if (error) return 'unknown';
    return data && data.length > 0 ? 'present' : 'absent';
  } catch {
    return 'unknown';
  }
}

/**
 * Valida credenciales contra la tabla `users` en Supabase. Se usa cuando
 * un usuario intenta iniciar sesión desde un dispositivo nuevo (su cuenta
 * existe en la nube pero no en la base SQLite local). Al verificar, importa
 * la cuenta y su perfil al dispositivo local.
 */
export async function verifyRemoteCredentials(
  email: string,
  password: string,
): Promise<UserRecord | null> {
  const remote = await findRemoteUserByEmail(email);
  if (!remote || !remote.password_hash) return null;

  const valid = await verifyPassword(password, remote.password_hash);
  if (!valid) return null;

  await importRemoteUser(remote);
  await importRemoteProfile(remote.id);

  return {
    id: remote.id,
    name: remote.name,
    email: remote.email.toLowerCase().trim(),
    auth_provider: (remote.auth_provider === 'google' ? 'google' : 'local') as AuthProvider,
    google_id: remote.google_id ?? null,
  };
}

/**
 * Flujo Google en contexto multidispositivo: primero busca localmente; si no
 * existe, busca en Supabase y lo importa al dispositivo.
 */
export async function findOrCreateGoogleUser(
  name: string,
  email: string,
  googleId: string,
): Promise<UserRecord> {
  const existing = await findUserByEmail(email);
  if (existing) return existing;

  const remote = await findRemoteUserByEmail(email);
  if (remote) {
    await importRemoteUser(remote);
    await importRemoteProfile(remote.id);
    return {
      id: remote.id,
      name: remote.name,
      email: remote.email.toLowerCase().trim(),
      auth_provider: 'google',
      google_id: remote.google_id ?? null,
    };
  }

  return createGoogleUser(name, email, googleId);
}
