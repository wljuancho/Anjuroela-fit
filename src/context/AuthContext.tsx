import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { getItem, setItem, removeItem, StorageKeys } from '../services/storage';
import {
  createLocalUser,
  verifyLocalCredentials,
  findUserByEmail,
  findOrCreateGoogleUser,
  getProfile,
  saveProfile as saveProfileForUser,
  getUserSession,
  hasProfile,
  type UserRecord,
} from '../services/authService';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  authProvider: 'local' | 'google';
}

export interface UserProfile {
  currentWeight?: number;
  targetWeight?: number;
  goalWeeks?: number;
  goalDate?: string;
}

export interface HealthProfileData {
  currentWeight: number;
  targetWeight: number;
  goalWeeks: number;
  goalDate: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasProfileCompleted: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: (name: string, email: string, googleId: string) => Promise<void>;
  saveHealthProfile: (data: HealthProfileData) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface StoredSession {
  userId: number;
  user: AuthUser;
  profile: UserProfile | null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const session = await getItem<StoredSession>(StorageKeys.User);
      if (session?.user) {
        setUser(session.user);
        setProfile(session.profile ?? null);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }

  async function persistSession(nextUser: AuthUser, nextProfile: UserProfile | null) {
    const session: StoredSession = {
      userId: nextUser.id,
      user: nextUser,
      profile: nextProfile,
    };
    await setItem(StorageKeys.User, session);
  }

  async function refreshProfile(userId: number): Promise<UserProfile | null> {
    const profileRow = await getProfile(userId);
    if (profileRow) {
      return {
        currentWeight: profileRow.current_weight ?? undefined,
        targetWeight: profileRow.target_weight ?? undefined,
        goalWeeks: profileRow.goal_weeks ?? undefined,
        goalDate: profileRow.goal_date ?? undefined,
      };
    }
    return null;
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      isLoading,
      isAuthenticated: !!user,
      hasProfileCompleted: !!profile,

      async signUp(name: string, email: string, password: string) {
        const existing = await findUserByEmail(email);
        if (existing) {
          throw new Error('Ya existe una cuenta con este correo.');
        }
        const record = await createLocalUser(name, email, password);
        const nextUser: AuthUser = {
          id: record.id,
          name: record.name,
          email: record.email,
          authProvider: 'local',
        };
        setUser(nextUser);
        setProfile(null);
        await persistSession(nextUser, null);
      },

      async signIn(email: string, password: string) {
        const record = await verifyLocalCredentials(email, password);
        if (!record) {
          return false;
        }
        const nextUser: AuthUser = {
          id: record.id,
          name: record.name,
          email: record.email,
          authProvider: 'local',
        };
        const nextProfile = await refreshProfile(record.id);
        setUser(nextUser);
        setProfile(nextProfile);
        await persistSession(nextUser, nextProfile);
        return true;
      },

      async signInWithGoogle(name: string, email: string, googleId: string) {
        const record = await findOrCreateGoogleUser(name, email, googleId);
        const nextUser: AuthUser = {
          id: record.id,
          name: record.name,
          email: record.email,
          authProvider: 'google',
        };
        const nextProfile = await refreshProfile(record.id);
        setUser(nextUser);
        setProfile(nextProfile);
        await persistSession(nextUser, nextProfile);
      },

      async saveHealthProfile(data: HealthProfileData) {
        if (!user) {
          throw new Error('No hay sesión activa.');
        }
        await saveProfileForUser(user.id, data);
        const nextProfile: UserProfile = {
          currentWeight: data.currentWeight,
          targetWeight: data.targetWeight,
          goalWeeks: data.goalWeeks,
          goalDate: data.goalDate,
        };
        setProfile(nextProfile);
        await persistSession(user, nextProfile);
      },

      async signOut() {
        setUser(null);
        setProfile(null);
        await removeItem(StorageKeys.User);
      },
    }),
    [user, profile, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return ctx;
}

export { getUserSession, hasProfile };
