import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@anjuroela_fit';

export const StorageKeys = {
  // Legacy session key kept for one-time migration to SecureStore (see sessionStorage.ts)
  User: `${PREFIX}:user`,
  OnboardingComplete: `${PREFIX}:onboarding_complete`,
  TutorialComplete: `${PREFIX}:tutorial_complete`,
  Theme: `${PREFIX}:theme`,
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

export async function getItem<T>(key: StorageKey): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export async function setItem<T>(key: StorageKey, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently ignore storage errors to avoid crashing the UI
  }
}

export async function removeItem(key: StorageKey): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Silently ignore storage errors
  }
}

export async function clearAll(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const appKeys = keys.filter((k) => k.startsWith(PREFIX));
    if (appKeys.length > 0) {
      await AsyncStorage.multiRemove(appKeys);
    }
  } catch {
    // Silently ignore storage errors
  }
}

// Claves dinámicas por usuario para los tutoriales contextuales de pantalla
// (formato pedido: tutorial_v2_completed_{userId}_{screenName}).
// El prefijo v2 fuerza que TANTO usuarios nuevos COMO usuarios antiguos vean
// el tutorial la primera vez que entren a cada pantalla, ya que la clave v1
// no existe en sus dispositivos.
// userId es el EMAIL del usuario (identidad principal de la cuenta).
export function tutorialStorageKey(userId: string, screen: string): string {
  return `${PREFIX}:tutorial_v2_completed_${userId}_${screen}`;
}

export async function getTutorialCompleted(userId: string, screen: string): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(tutorialStorageKey(userId, screen));
    return value === 'true';
  } catch {
    return false;
  }
}

export async function setTutorialCompleted(userId: string, screen: string): Promise<void> {
  try {
    await AsyncStorage.setItem(tutorialStorageKey(userId, screen), 'true');
  } catch {
    // Silently ignore storage errors
  }
}
