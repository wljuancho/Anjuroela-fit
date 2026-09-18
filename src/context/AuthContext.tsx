import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
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
  getProfile,
  saveProfile as saveProfileForUser,
  updateUserProfile,
  updateUserName,
  changePassword,
  getUserSession,
  hasProfile,
  deleteRemoteUserAccount,
  type UserRecord,
  type GenderValue,
} from '../services/authService';
import {
  setActiveUserId,
  syncRemoteToLocal,
  purgeUserData,
  syncLocalToRemote,
  requestFullSync,
  removeLocalUserAccount,
  setSessionRevocationHandler,
  discardPendingDeletionsForUser,
} from '../services/syncService';
import { setSupabaseAppUser } from '../services/supabaseClient';
import type { SexForFormula } from '../types/nutrition';

export interface AuthUser {
  id: string;
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
  gender?: GenderValue;
  sexForFormula?: SexForFormula;
}

export interface HealthProfileData {
  currentWeight: number;
  targetWeight: number;
  goalWeeks: number;
  goalDate: string;
  age?: number;
  heightCm?: number;
  gender?: GenderValue;
}

export interface ProfileEditableFields {
  name?: string;
  gender?: GenderValue;
  age?: number;
  heightCm?: number;
  currentWeight?: number;
  targetWeight?: number;
  goalWeeks?: number;
  goalDate?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasProfileCompleted: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  saveHealthProfile: (data: HealthProfileData) => Promise<void>;
  updateProfile: (fields: ProfileEditableFields) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  reloadProfile: () => Promise<void>;
  clearProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface StoredSession {
  userId: string;
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

  // Escuchador de primer plano (AppState): vacía los pendientes acumulados offline
  // y actualiza los datos desde Supabase al reabrir o volver a la app.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        requestFullSync();
        void syncRemoteToLocal();
      }
    });
    return () => subscription.remove();
  }, []);

  async function loadSession() {
    try {
      const session = await getStoredSession<StoredSession>();
      if (session?.user) {
        const storedUser = session.user;
        // Sesiones guardadas por versiones antiguas de la app: `id` era
        // numérico. Se normaliza para que la identidad sea siempre el email.
        const nextUser: AuthUser = {
          id: typeof storedUser.id === 'number' ? storedUser.email : storedUser.id,
          name: storedUser.name,
          email: storedUser.email,
          authProvider: storedUser.authProvider,
        };
        const nextProfile = session.profile ?? null;
        setUser(nextUser);
        setProfile(nextProfile);
        await setActiveUserId(nextUser.id);
        setSupabaseAppUser(nextUser.id);
        // Los cambios hechos sin conexión viven en SQLite. Al reabrir la app
        // se solicita una pasada completa para que se suban en cuanto haya
        // red, incluso si Android cerró los temporizadores de reintento.
        requestFullSync();
        void syncRemoteToLocal();
        if (nextUser.id !== storedUser.id) {
          await persistSession(nextUser, nextProfile);
        }
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

  async function refreshProfile(userId: string): Promise<UserProfile | null> {
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
        gender:
          profileRow.gender === 'mujer' || profileRow.gender === 'hombre'
            ? profileRow.gender
            : undefined,
        sexForFormula:
          profileRow.sex_for_calorie_formula === 'male' ||
          profileRow.sex_for_calorie_formula === 'female' ||
          profileRow.sex_for_calorie_formula === 'not_specified'
            ? profileRow.sex_for_calorie_formula
            : undefined,
      };
    }
    return null;
  }

  // Cierre de sesión completo: limpia el estado en memoria de React, purga las
  // tablas locales de SQLite del usuario, elimina su cuenta local para evitar
  // resubirla y limpia la sesión/current_user_id de SecureStore/AsyncStorage.
  async function performSignOut() {
    setSupabaseAppUser(null);
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
        // Auto-login tras el registro: con el perfil aún vacío, RootNavigator
        // aterriza directo en el Onboarding (cuestionario de metas/calorías),
        // y el Tutorial solo aparece después de guardar el perfil. Así no se
        // salta el cuestionario ni se exige un segundo inicio de sesión.
        const nextUser: AuthUser = {
          id: newRecord.id,
          name: newRecord.name,
          email: newRecord.email,
          authProvider: 'local',
        };
        setSupabaseAppUser(newRecord.id);
        setUser(nextUser);
        setProfile(null);
        await persistSession(nextUser, null);
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
        setSupabaseAppUser(nextUser.id);

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

      async saveHealthProfile(data: HealthProfileData) {
        if (!user) {
          throw new Error('No hay sesión activa.');
        }
        await saveProfileForUser(user.id, {
          age: data.age ?? profile?.age,
          height: data.heightCm ?? profile?.heightCm,
          gender: (data.gender ?? profile?.gender) as GenderValue | undefined,
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
          gender: (data.gender ?? profile?.gender) as GenderValue | undefined,
        };
        setProfile(nextProfile);
        await persistSession(user, nextProfile);
      },

      async updateProfile(fields: ProfileEditableFields) {
        if (!user) throw new Error('No hay sesión activa.');

        if (fields.name !== undefined) {
          await updateUserName(user.id, fields.name);
        }

        const profileFields: Parameters<typeof updateUserProfile>[1] = {
          ...(fields.gender !== undefined ? { gender: fields.gender as GenderValue } : {}),
          ...(fields.age !== undefined ? { age: fields.age } : {}),
          ...(fields.heightCm !== undefined ? { height: fields.heightCm } : {}),
          ...(fields.currentWeight !== undefined ? { currentWeight: fields.currentWeight } : {}),
          ...(fields.targetWeight !== undefined ? { targetWeight: fields.targetWeight } : {}),
          ...(fields.goalWeeks !== undefined ? { goalWeeks: fields.goalWeeks } : {}),
          ...(fields.goalDate !== undefined ? { goalDate: fields.goalDate } : {}),
        };
        if (Object.keys(profileFields).length > 0) {
          await updateUserProfile(user.id, profileFields);
        }

        const nextProfile = await refreshProfile(user.id);
        setProfile(nextProfile);
        let nextUser = user;
        if (fields.name !== undefined && fields.name.trim()) {
          nextUser = { ...user, name: fields.name.trim() };
          setUser(nextUser);
        }
        await persistSession(nextUser, nextProfile);
      },

      async changePassword(currentPassword: string, newPassword: string) {
        if (!user) throw new Error('No hay sesión activa.');
        await changePassword(user.id, currentPassword, newPassword);
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

      async deleteAccount() {
        if (!user) return;
        // 1) Se borra la cuenta y todo su contenido en Supabase (cascada).
        await deleteRemoteUserAccount(user.id);
        // 2) Los borrados pendientes de esa cuenta quedan huérfanos: se
        //    descartan para que no se apliquen con otra sesión.
        await discardPendingDeletionsForUser(user.id);
        // 3) Limpieza local completa (datos, cuenta local y sesión).
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
