import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from './storage';

const SESSION_KEY = 'anjuroela_fit:user_session';
// Respaldo en AsyncStorage. SecureStore en Android puede perder la sesión al
// cerrar la app (el Keystore del sistema puede invalidar la llave), por lo que
// guardamos una copia de seguridad que persiste de forma confiable.
const SESSION_BACKUP_KEY = 'anjuroela_fit:user_session_backup';

// Identificador del usuario activo. Se guarda en SecureStore con respaldo en
// AsyncStorage igual que la sesión y permite aislar los datos sincronizados
// (solo se suben/bajan los registros del usuario actualmente autenticado).
const CURRENT_USER_ID_KEY = 'anjuroela_fit:current_user_id';
const CURRENT_USER_ID_BACKUP_KEY = 'anjuroela_fit:current_user_id_backup';

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

export async function getStoredCurrentUserId(): Promise<number | null> {
  let userId: number | null = null;

  try {
    const secure = await SecureStore.getItemAsync(CURRENT_USER_ID_KEY);
    if (secure) {
      const parsed = JSON.parse(secure) as number;
      if (Number.isFinite(parsed)) {
        userId = parsed;
      }
    }
  } catch {
    userId = null;
  }

  if (userId === null) {
    try {
      const backup = await AsyncStorage.getItem(CURRENT_USER_ID_BACKUP_KEY);
      if (backup) {
        const parsed = JSON.parse(backup) as number;
        if (Number.isFinite(parsed)) {
          userId = parsed;
          try {
            await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, JSON.stringify(userId));
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return userId;
}

export async function setStoredCurrentUserId(userId: number): Promise<void> {
  try {
    await SecureStore.setItemAsync(CURRENT_USER_ID_KEY, JSON.stringify(userId));
  } catch {
    // Silently ignore storage errors
  }
  try {
    await AsyncStorage.setItem(CURRENT_USER_ID_BACKUP_KEY, JSON.stringify(userId));
  } catch {
    // Silently ignore storage errors
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
}