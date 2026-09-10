import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from './storage';

const SESSION_KEY = 'anjuroela_fit:user_session';

export async function getStoredSession<T>(): Promise<T | null> {
  try {
    const secure = await SecureStore.getItemAsync(SESSION_KEY);
    if (secure) {
      return JSON.parse(secure) as T;
    }
  } catch {
    // fall through to legacy AsyncStorage migration
  }

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

export async function setStoredSession<T>(session: T): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
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
}