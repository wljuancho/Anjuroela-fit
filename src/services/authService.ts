import * as Crypto from 'expo-crypto';
import { getDatabase } from './database';

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
}

async function hashPassword(password: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${password}-anjuroela-fix-salt`,
  );
  return digest;
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const db = getDatabase();
  const result = await db.getAllAsync<UserRecord>(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  return result[0] ?? null;
}

export async function createLocalUser(
  name: string,
  email: string,
  password: string,
): Promise<UserRecord> {
  const db = getDatabase();
  const passwordHash = await hashPassword(password);
  const result = await db.runAsync(
    'INSERT INTO users (name, email, password_hash, auth_provider) VALUES (?, ?, ?, ?)',
    [name, email.toLowerCase().trim(), passwordHash, 'local'],
  );
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
  }>('SELECT * FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);

  if (!result[0]) {
    return null;
  }

  const hash = await hashPassword(password);
  if (hash !== result[0].password_hash) {
    return null;
  }

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
  return {
    id: result.lastInsertRowId,
    name,
    email: email.toLowerCase().trim(),
    auth_provider: 'google',
    google_id: googleId,
  };
}

export async function findOrCreateGoogleUser(
  name: string,
  email: string,
  googleId: string,
): Promise<UserRecord> {
  const existing = await findUserByEmail(email);
  if (existing) {
    return existing;
  }
  return createGoogleUser(name, email, googleId);
}

export interface UserSession {
  user: UserRecord;
  profile: {
    currentWeight?: number;
    targetWeight?: number;
    goalWeeks?: number;
    goalDate?: string;
  } | null;
}

export async function getProfile(userId: number): Promise<UserProfileRecord | null> {
  const db = getDatabase();
  const result = await db.getAllAsync<UserProfileRecord>(
    'SELECT * FROM user_profiles WHERE user_id = ? LIMIT 1',
    [userId],
  );
  return result[0] ?? null;
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
}

export async function getUserSession(userId: number): Promise<UserSession> {
  const db = getDatabase();
  const userResult = await db.getAllAsync<UserRecord>(
    'SELECT * FROM users WHERE id = ? LIMIT 1',
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
        }
      : null,
  };
}
