import * as SecureStore from 'expo-secure-store';
import { AI_CONFIG } from '../constants/config';

const API_KEY_VISION_KEY = 'API_KEY_VISION';

export async function getVisionApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(API_KEY_VISION_KEY);
  } catch {
    return null;
  }
}

export async function saveVisionApiKey(apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    await deleteVisionApiKey();
    return;
  }
  await SecureStore.setItemAsync(API_KEY_VISION_KEY, trimmed);
}

export async function deleteVisionApiKey(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(API_KEY_VISION_KEY);
  } catch {
    // Silently ignore storage errors
  }
}

export async function testVisionApiKey(apiKey: string): Promise<boolean> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return false;
  }

  const url = `${AI_CONFIG.GEMINI_API_URL}?key=${trimmed}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Responde OK' }] }],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}