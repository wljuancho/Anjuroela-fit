import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from './storage';

const SESSION_KEY = 'anjuroela_fit:user_session';
// Respaldo en AsyncStorage. SecureStore en Android puede perder la sesión al
// cerrar la app (el Keystore del sistema puede invalidar la llave), por lo que
// guardamos una copia de seguridad que persiste de forma confiable.
const SESSION_BACKUP_KEY = 'anjuroela_fit:user_session_backup';

// Identificador del usuario activo. Ahora el EMAIL es la clave primaria de
// `users`, así que se persiste el email (en SecureStore con respaldo en
// AsyncStorage, igual que la sesión). Permite aislar los datos sincronizados
// (solo se suben/bajan los registros del usuario actualmente autenticado).
const CURRENT_USER_ID_KEY = 'anjuroela_fit:current_user_email';
const CURRENT_USER_ID_BACKUP_KEY = 'anjuroela_fit:current_user_email_backup';

// Claves del formato legacy (id numérico autoincrement de `users`) que se
// migran una sola vez a la primera lectura.
const LEGACY_CURRENT_USER_ID_KEY = 'anjuroela_fit:current_user_id';
const LEGACY_CURRENT_USER_ID_BACKUP_KEY = 'anjuroela_fit:current_user_id_backup';

function looksLikeEmail(value: string | null): value is string {
  return typeof value === 'string' && value.includes('@');
}

export async function getStoredSession<T>(): Promise<T | null> {
  let session: T | null = null;

  // 1) Fuente principal: SecureStore
  try {
    const secure = await SecureStore.getItemAsync(SESSION_KEY);
    if (secure) {
      session = JSON.parse(secure) as T;
    }
  } catch {
    // Si falla la lectura, intentamos con el respaldo de AsyncStorage
    session = null;
  }

  // 2) Respaldo: AsyncStorage (se recupera incluso si SecureStore falla)
  if (!session) {
    try {
      const backup = await AsyncStorage.getItem(SESSION_BACKUP_KEY);
      if (backup) {
        session = JSON.parse(backup) as T;
        if (session) {
          // Re-sincroniza SecureStore con el respaldo recuperado
          try {
            await SecureStore.setItemAsync(SESSION_KEY, backup);
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 3) Migración del key legacy (una sola vez)
  if (!session) {
    try {
      const legacy = await AsyncStorage.getItem(StorageKeys.User);
      if (!legacy) {
        return null;
      }
      const parsed = JSON.parse(legacy) as T;
      await setStoredSession(parsed);
      await AsyncStorage.removeItem(StorageKeys.User);
      return parsed;
    } catch {
      return null;
    }
  }

  return session;
}

export async function setStoredSession<T>(session: T): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Silently ignore storage errors to avoid crashing the UI
  }
  try {
    await AsyncStorage.setItem(SESSION_BACKUP_KEY, JSON.stringify(session));
  } catch {
    // Silently ignore storage errors to avoid crashing the UI
  }
}

export async function removeStoredSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // Silently ignore storage errors
  }
  try {
    await AsyncStorage.removeItem(SESSION_BACKUP_KEY);
  } catch {
    // Silently ignore storage errors
  }
}

export async function getStoredCurrentUserId(): Promise<string | null> {
  let userId: string | null = null;

  // 1) Fuente principal: SecureStore (email)
  try {
    const secure = await SecureStore.getItemAsync(CURRENT_USER_ID_KEY);
    if (looksLikeEmail(secure)) {
      userId = secure;
    }
  } catch {
    userId = null;
  }

  // 2) Respaldo: AsyncStorage (email)
  if (!userId) {
    try {
      const backup = await AsyncStorage.getItem(CURRENT_USER_ID_BACKUP_KEY);
      if (looksLikeEmail(backup)) {
        userId = backup;
        try {
          await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, userId);
        } catch {
          // ignore
        }
      }
    } catch {
      userId = null;
    }
  }

  // 3) Migración del formato legacy (id numérico): se resuelve el email desde
  //    la sesión guardada y se actualizan las claves. Si no se puede resolver,
  //    se limpian las claves legacy para no volver a intentarlo.
  if (!userId) {
    try {
      const legacy =
        (await SecureStore.getItemAsync(LEGACY_CURRENT_USER_ID_KEY)) ??
        (await AsyncStorage.getItem(LEGACY_CURRENT_USER_ID_BACKUP_KEY));
      if (legacy) {
        await SecureStore.deleteItemAsync(LEGACY_CURRENT_USER_ID_KEY);
        await AsyncStorage.removeItem(LEGACY_CURRENT_USER_ID_BACKUP_KEY);
        const session = await getStoredSession<{ user?: { email?: string } }>();
        const email = session?.user?.email ?? null;
        if (email) {
          userId = email.toLowerCase().trim();
          await setStoredCurrentUserId(userId);
        }
      }
    } catch {
      userId = null;
    }
  }

  // 4) Autorreparación: si no hay clave persistida pero existe sesión, el
  //    email del usuario se deriva de la sesión y se guarda.
  if (!userId) {
    try {
      const session = await getStoredSession<{ user?: { email?: string } }>();
      const email = session?.user?.email ?? null;
      if (email) {
        userId = email.toLowerCase().trim();
        await setStoredCurrentUserId(userId);
      }
    } catch {
      userId = null;
    }
  }

  return userId;
}

export async function setStoredCurrentUserId(userId: string): Promise<void> {
  const email = userId.toLowerCase().trim();
  try {
    await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, email);
  } catch {
    // Silently ignore storage errors to avoid crashing the UI
  }
  try {
    await AsyncStorage.setItem(CURRENT_USER_ID_BACKUP_KEY, email);
  } catch {
    // Silently ignore storage errors to avoid crashing the UI
  }
}

export async function removeStoredCurrentUserId(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(CURRENT_USER_ID_KEY);
  } catch {
    // Silently ignore storage errors
  }
  try {
    await AsyncStorage.removeItem(CURRENT_USER_ID_BACKUP_KEY);
  } catch {
    // Silently ignore storage errors
  }
  try {
    await SecureStore.deleteItemAsync(LEGACY_CURRENT_USER_ID_KEY);
  } catch {
    // Silently ignore storage errors
  }
  try {
    await AsyncStorage.removeItem(LEGACY_CURRENT_USER_ID_BACKUP_KEY);
  } catch {
    // Silently ignore storage errors
  }
}