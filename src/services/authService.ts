import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';
import { formatDate, assertSafeIdentifier } from './utils';
import { provisionRemoteUser, syncLocalToRemote } from './syncService';
import { getSupabase, setSupabaseAppUser, isSupabaseConfigured } from './supabaseClient';

export type AuthProvider = 'local' | 'google';

// El EMAIL es la clave primaria de `users` (identidad única de la cuenta),
// por lo que `id` == `email` en todos los registros de usuario.
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  auth_provider: AuthProvider;
  created_at?: string;
}

export interface UserProfileRecord {
  user_id: string;
  age?: number | null;
  height?: number | null;
  current_weight?: number | null;
  target_weight?: number | null;
  goal_weeks?: number | null;
  goal_date?: string | null;
  goal_status?: string | null;
  gender?: string | null;
  sex_for_calorie_formula?: string | null;
}

export type GenderValue = 'mujer' | 'hombre';

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

async function upgradeLegacyHash(userId: string, storedHash: string, password: string): Promise<void> {
  if (storedHash.startsWith(`${HASH_PREFIX}:`)) {
    return;
  }
  const salt = await generateSalt();
  const nextHash = await hashPassword(password, salt);
  const db = getDatabase();
  await db.runAsync('UPDATE users SET password_hash = ? WHERE email = ?', [nextHash, userId]);
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const db = getDatabase();
  const normalizedEmail = email.toLowerCase().trim();
  const result = await db.getAllAsync<{
    name: string;
    email: string;
    auth_provider: string;
  }>(
    'SELECT name, email, auth_provider FROM users WHERE email = ? LIMIT 1',
    [normalizedEmail],
  );
  if (!result[0]) {
    return null;
  }
  return {
    id: result[0].email,
    name: result[0].name,
    email: result[0].email,
    auth_provider: result[0].auth_provider === 'google' ? 'google' : 'local',
  };
}

export async function createLocalUser(
  name: string,
  email: string,
  password: string,
): Promise<UserRecord> {
  const db = getDatabase();
  const salt = await generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const normalizedEmail = email.toLowerCase().trim();
  await db.runAsync(
    'INSERT INTO users (name, email, password_hash, auth_provider) VALUES (?, ?, ?, ?)',
    [name, normalizedEmail, passwordHash, 'local'],
  );
  // La cuenta recién creada se asume como usuario activo en la nube para que
  // las políticas RLS del upsert de Registro acepten la fila (email=header).
  setSupabaseAppUser(normalizedEmail);
  // El registro no puede pasar por la cola ordinaria: esa cola comprueba si
  // una cuenta ya existe en la nube para detectar eliminaciones remotas. Una
  // cuenta nueva todavía no existe y sería revocada antes de subirla.
  try {
    await provisionRemoteUser({
      email: normalizedEmail,
      name,
      password_hash: passwordHash,
      auth_provider: 'local',
    });
  } catch (error) {
    // No dejamos una cuenta local huérfana: de otro modo un reintento diría
    // erróneamente que el correo ya está registrado aunque nunca llegó a la
    // nube. Aún no existen datos dependientes de una cuenta recién creada.
    await db.runAsync('DELETE FROM users WHERE email = ?', [normalizedEmail]);
    throw error;
  }
  return {
    id: normalizedEmail,
    name,
    email: normalizedEmail,
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
    name: string;
    email: string;
    password_hash: string;
    auth_provider: string;
  }>('SELECT name, email, password_hash, auth_provider FROM users WHERE email = ? LIMIT 1', [
    normalizedEmail,
  ]);

  if (!result[0]) {
    return null;
  }

  const hashValid = await verifyPassword(password, result[0].password_hash);
  if (!hashValid) {
    return null;
  }

  void upgradeLegacyHash(result[0].email, result[0].password_hash, password);

  return {
    id: result[0].email,
    name: result[0].name,
    email: result[0].email,
    auth_provider: 'local',
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
    gender?: GenderValue;
  } | null;
}

export async function getProfile(userId: string): Promise<UserProfileRecord | null> {
  const db = getDatabase();
  const result = await db.getAllAsync<UserProfileRecord>(
    'SELECT user_id, age, height, current_weight, target_weight, goal_weeks, goal_date, goal_status, gender FROM user_profiles WHERE user_id = ? LIMIT 1',
    [userId],
  );
  return result[0] ?? null;
}

export async function updateGoalStatus(userId: string, status: 'active' | 'completed' | 'expired'): Promise<void> {
  const db = getDatabase();
  await db.runAsync('UPDATE user_profiles SET goal_status = ? WHERE user_id = ?', [
    status,
    userId,
  ]);
  void syncLocalToRemote('user_profiles');
}

export async function hasProfile(userId: string): Promise<boolean> {
  const profile = await getProfile(userId);
  return !!profile;
}

export async function saveProfile(userId: string, data: {
  age?: number;
  height?: number;
  gender?: GenderValue;
  currentWeight: number;
  targetWeight: number;
  goalWeeks: number;
  goalDate: string;
}): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO user_profiles
       (user_id, age, height, gender, current_weight, target_weight, goal_weeks, goal_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       age = COALESCE(excluded.age, user_profiles.age),
       height = COALESCE(excluded.height, user_profiles.height),
       gender = COALESCE(excluded.gender, user_profiles.gender),
       current_weight = excluded.current_weight,
       target_weight = excluded.target_weight,
       goal_weeks = excluded.goal_weeks,
       goal_date = excluded.goal_date`,
    [
      userId,
      data.age ?? null,
      data.height ?? null,
      data.gender ?? null,
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

// Actualización PARCIAL del perfil: solo cambia las columnas enviadas y
// conserva las del resto. Se usa desde el módulo de Perfil al completar campos
// que quedaron vacíos (p. ej. 'gender' en cuentas antiguas) sin borrar el resto.
export async function updateUserProfile(
  userId: string,
  data: {
    age?: number;
    height?: number;
    gender?: GenderValue;
    currentWeight?: number;
    targetWeight?: number;
    goalWeeks?: number;
    goalDate?: string;
  },
): Promise<void> {
  const db = getDatabase();
  const fields: { column: string; value: number | string | null }[] = [];
  if (data.age !== undefined) fields.push({ column: 'age', value: data.age });
  if (data.height !== undefined) fields.push({ column: 'height', value: data.height });
  if (data.gender !== undefined) fields.push({ column: 'gender', value: data.gender });
  if (data.currentWeight !== undefined) {
    fields.push({ column: 'current_weight', value: data.currentWeight });
  }
  if (data.targetWeight !== undefined) {
    fields.push({ column: 'target_weight', value: data.targetWeight });
  }
  if (data.goalWeeks !== undefined) fields.push({ column: 'goal_weeks', value: data.goalWeeks });
  if (data.goalDate !== undefined) fields.push({ column: 'goal_date', value: data.goalDate });
  if (!fields.length) return;

  const setClause = fields.map((f) => `${f.column} = ?`).join(', ');
  const result = await db.runAsync(
    `UPDATE user_profiles SET ${setClause} WHERE user_id = ?`,
    [...fields.map((f) => f.value ?? null), userId],
  );
  if (result.changes === 0) {
    // Sin fila previa (caso extremo): se siembra el perfil con los campos dados.
    const row: Record<string, string | number | null> = { user_id: userId };
    for (const f of fields) row[f.column] = f.value;
    const keys = Object.keys(row);
    const quoted = keys.map((k) => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    await db.runAsync(
      `INSERT INTO user_profiles (${quoted}) VALUES (${placeholders})`,
      keys.map((k) => row[k] ?? null),
    );
  }
  void syncLocalToRemote('user_profiles');
}

// Cambia el nombre visible de la cuenta (tabla `users`; se replica a Supabase).
export async function updateUserName(userId: string, name: string): Promise<void> {
  const db = getDatabase();
  const cleanName = name.trim();
  if (!cleanName) {
    throw new Error('El nombre no puede quedar vacío.');
  }
  await db.runAsync('UPDATE users SET name = ? WHERE email = ?', [cleanName, userId]);
  void syncLocalToRemote('users');
}

// Cambia la contraseña local verificando primero la actual. El hash nuevo se
// persiste en SQLite y se sube a Supabase para validar en otros dispositivos.
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const db = getDatabase();
  const result = await db.getAllAsync<{ password_hash: string }>(
    'SELECT password_hash FROM users WHERE email = ? LIMIT 1',
    [userId],
  );
  const storedHash = result[0]?.password_hash;
  if (!storedHash) {
    throw new Error('No existe una contraseña local para esta cuenta.');
  }
  const valid = await verifyPassword(currentPassword, storedHash);
  if (!valid) {
    throw new Error('La contraseña actual es incorrecta.');
  }
  if (newPassword.length < 6) {
    throw new Error('La nueva contraseña debe tener al menos 6 caracteres.');
  }
  const salt = await generateSalt();
  const nextHash = await hashPassword(newPassword, salt);
  await db.runAsync('UPDATE users SET password_hash = ? WHERE email = ?', [nextHash, userId]);
  void syncLocalToRemote('users');
}

export async function getUserSession(userId: string): Promise<UserSession> {
  const db = getDatabase();
  const userResult = await db.getAllAsync<{
    name: string;
    email: string;
    auth_provider: string;
  }>(
    'SELECT name, email, auth_provider FROM users WHERE email = ? LIMIT 1',
    [userId],
  );
  const row = userResult[0]!;
  const user: UserRecord = {
    id: row.email,
    name: row.name,
    email: row.email,
    auth_provider: row.auth_provider === 'google' ? 'google' : 'local',
  };
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
          gender:
            profile.gender === 'mujer' || profile.gender === 'hombre'
              ? profile.gender
              : undefined,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Autenticación multidispositivo (validación contra Supabase)
// ---------------------------------------------------------------------------

interface RemoteUserRow {
  name: string;
  email: string;
  password_hash: string | null;
  auth_provider: string | null;
}

async function findRemoteUserByEmail(email: string): Promise<RemoteUserRow | null> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) return null;
  try {
    const normalizedEmail = email.toLowerCase().trim();
    const { data, error } = await supabase
      .from('users')
      .select('name, email, password_hash, auth_provider')
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
    const normalizedEmail = remote.email.toLowerCase().trim();
    const provider = remote.auth_provider === 'google' ? 'google' : 'local';
    await db.runAsync(
      `INSERT INTO users (name, email, password_hash, auth_provider)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         password_hash = excluded.password_hash,
         auth_provider = excluded.auth_provider`,
      [
        remote.name,
        normalizedEmail,
        remote.password_hash,
        provider,
      ],
    );
  } catch {
    // Fallo no letal: la sesión de usuario igual se crea sin importar la copia local.
  }
}

async function importRemoteProfile(userId: string): Promise<void> {
  const supabase = getSupabase();
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
  assertSafeIdentifier(table);
  const db = getDatabase();
  const columns = db
    .getAllSync<{ name: string }>(`PRAGMA table_info("${table}")`)
    .map((c) => c.name);
  const keys = Object.keys(row).filter(
    (k) => columns.includes(k) && row[k] !== undefined,
  );
  if (!keys.length) return;
  keys.forEach(assertSafeIdentifier);
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
export async function checkRemoteUserExistence(userId: string): Promise<RemoteUserExistence> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) return 'unknown';
  try {
    // La cabecera debe apuntar al usuario consultado para que las políticas
    // RLS de `users` permitan leer su propia fila.
    setSupabaseAppUser(userId);
    const { data, error } = await supabase
      .from('users')
      .select('email')
      .eq('email', userId);
    if (error) return 'unknown';
    return data && data.length > 0 ? 'present' : 'absent';
  } catch {
    return 'unknown';
  }
}

/**
 * Elimina la cuenta del usuario en Supabase. Al borrar la fila de `users` se
 * dispara el borrado en cascada (`cascade_delete_user_data()` + FKs) que
 * elimina todo su contenido: perfiles, rutinas, sesiones, series, peso y
 * comidas. La política RLS anon_own_users solo permite borrar la propia fila,
 * así que la operación exige la cabecera x-app-user con el correo de la sesión
 * (se establece aquí antes de la petición).
 */
export async function deleteRemoteUserAccount(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    throw new Error('Supabase no está configurado; no se pudo eliminar la cuenta.');
  }
  const normalized = userId.toLowerCase().trim();
  setSupabaseAppUser(normalized);
  const { error } = await supabase.from('users').delete().eq('email', normalized);
  if (error) {
    throw new Error(`No se pudo eliminar la cuenta: ${error.message}`);
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
  const normalizedEmail = email.toLowerCase().trim();
  // La lectura de `users` exige que la cabecera RLS coincida con la fila
  // consultada; al verificarse las credenciales el usuario "se autentica" con
  // su propio correo antes de descargar su cuenta al dispositivo.
  setSupabaseAppUser(normalizedEmail);
  const remote = await findRemoteUserByEmail(normalizedEmail);
  if (!remote || !remote.password_hash) return null;

  const valid = await verifyPassword(password, remote.password_hash);
  if (!valid) return null;

  await importRemoteUser(remote);
  await importRemoteProfile(remote.email);

  return {
    id: remote.email.toLowerCase().trim(),
    name: remote.name,
    email: remote.email.toLowerCase().trim(),
    auth_provider: (remote.auth_provider === 'google' ? 'google' : 'local') as AuthProvider,
  };
}
