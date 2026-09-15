import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import {
  getStoredSession,
  setStoredSession,
  removeStoredSession,
  getStoredCurrentUserId,
  setStoredCurrentUserId,
  removeStoredCurrentUserId,
} from '../services/sessionStorage';
import {
  createLocalUser,
  verifyLocalCredentials,
  verifyRemoteCredentials,
  findUserByEmail,
  findOrCreateGoogleUser,
  getProfile,
  saveProfile as saveProfileForUser,
  getUserSession,
  hasProfile,
  type UserRecord,
} from '../services/authService';
import {
  setActiveUserId,
  syncRemoteToLocal,
  purgeUserData,
  syncLocalToRemote,
  removeLocalUserAccount,
  setSessionRevocationHandler,
} from '../services/syncService';

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
  goalStatus?: string;
  heightCm?: number;
  age?: number;
}

export interface HealthProfileData {
  currentWeight: number;
  targetWeight: number;
  goalWeeks: number;
  goalDate: string;
  age?: number;
  heightCm?: number;
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
  reloadProfile: () => Promise<void>;
  clearProfile: () => Promise<void>;
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

  // Registra el callback de revocación remota: si el usuario fue eliminado en
  // Supabase, la sync fuerza el cierre de sesión limpio (purga + estado React).
  useEffect(() => {
    setSessionRevocationHandler(() => {
      void performSignOut();
    });
    return () => setSessionRevocationHandler(null);
  }, []);

  async function loadSession() {
    try {
      const session = await getStoredSession<StoredSession>();
      if (session?.user) {
        setUser(session.user);
        setProfile(session.profile ?? null);
        await setActiveUserId(session.user.id);
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
    await setStoredSession(session);
  }

  async function refreshProfile(userId: number): Promise<UserProfile | null> {
    const profileRow = await getProfile(userId);
    if (profileRow) {
      return {
        currentWeight: profileRow.current_weight ?? undefined,
        targetWeight: profileRow.target_weight ?? undefined,
        goalWeeks: profileRow.goal_weeks ?? undefined,
        goalDate: profileRow.goal_date ?? undefined,
        goalStatus: profileRow.goal_status ?? undefined,
        heightCm: profileRow.height ?? undefined,
        age: profileRow.age ?? undefined,
      };
    }
    return null;
  }

  // Cierre de sesión completo: limpia el estado en memoria de React, purga las
  // tablas locales de SQLite del usuario, elimina su cuenta local para evitar
  // resubirla y limpia la sesión/current_user_id de SecureStore/AsyncStorage.
  async function performSignOut() {
    const currentUserId = await getStoredCurrentUserId();
    if (currentUserId !== null) {
      await purgeUserData(currentUserId);
      await removeLocalUserAccount(currentUserId);
    }
    setUser(null);
    setProfile(null);
    await setActiveUserId(null);
    await removeStoredSession();
    await removeStoredCurrentUserId();
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
        const newRecord = await createLocalUser(name, email, password);
        const prevUserId = await getStoredCurrentUserId();
        await setActiveUserId(newRecord.id);
        await setStoredCurrentUserId(newRecord.id);
        if (prevUserId && prevUserId !== newRecord.id) {
          await purgeUserData(prevUserId);
        }
      },

      async signIn(email: string, password: string) {
        const localRecord = await verifyLocalCredentials(email, password);
        let record = localRecord;

        if (!record) {
          const remoteRecord = await verifyRemoteCredentials(email, password);
          if (!remoteRecord) return false;
          record = remoteRecord;
        }

        const nextUser: AuthUser = {
          id: record.id,
          name: record.name,
          email: record.email,
          authProvider: 'local',
        };

        const previousUserId = await getStoredCurrentUserId();
        await setActiveUserId(nextUser.id);
        await setStoredCurrentUserId(nextUser.id);

        if (previousUserId && previousUserId !== nextUser.id) {
          await purgeUserData(previousUserId);
        }

        // Siempre se descargan los datos frescos del usuario desde Supabase.
        await syncRemoteToLocal();

        let nextProfile: UserProfile | null = null;
        try {
          nextProfile = await refreshProfile(record.id);
        } catch {
          // Profile fetch failed; user is still authenticated without profile
        }
        setUser(nextUser);
        setProfile(nextProfile);
        await persistSession(nextUser, nextProfile);
        void syncLocalToRemote();
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

        const previousUserId = await getStoredCurrentUserId();
        await setActiveUserId(nextUser.id);
        await setStoredCurrentUserId(nextUser.id);

        if (previousUserId && previousUserId !== nextUser.id) {
          await purgeUserData(previousUserId);
        }

        // Siempre se descargan los datos frescos del usuario desde Supabase.
        await syncRemoteToLocal();

        const nextProfile = await refreshProfile(record.id);
        setUser(nextUser);
        setProfile(nextProfile);
        await persistSession(nextUser, nextProfile);
        void syncLocalToRemote();
      },

      async saveHealthProfile(data: HealthProfileData) {
        if (!user) {
          throw new Error('No hay sesión activa.');
        }
        await saveProfileForUser(user.id, {
          age: data.age ?? profile?.age,
          height: data.heightCm ?? profile?.heightCm,
          currentWeight: data.currentWeight,
          targetWeight: data.targetWeight,
          goalWeeks: data.goalWeeks,
          goalDate: data.goalDate,
        });
        const nextProfile: UserProfile = {
          currentWeight: data.currentWeight,
          targetWeight: data.targetWeight,
          goalWeeks: data.goalWeeks,
          goalDate: data.goalDate,
          goalStatus: 'active',
          heightCm: data.heightCm ?? profile?.heightCm,
          age: data.age ?? profile?.age,
        };
        setProfile(nextProfile);
        await persistSession(user, nextProfile);
      },

      async reloadProfile() {
        if (!user) return;
        const nextProfile = await refreshProfile(user.id);
        setProfile(nextProfile);
        await persistSession(user, nextProfile);
      },

      async clearProfile() {
        if (!user) return;
        setProfile(null);
        await persistSession(user, null);
      },

      async signOut() {
        await performSignOut();
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
