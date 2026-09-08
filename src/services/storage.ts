import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = '@anjuroela_fit';

export const StorageKeys = {
  User: `${PREFIX}:user`,
  OnboardingComplete: `${PREFIX}:onboarding_complete`,
  Theme: `${PREFIX}:theme`,
  AuthToken: `${PREFIX}:auth_token`,
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
