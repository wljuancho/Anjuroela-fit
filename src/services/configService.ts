import * as SecureStore from 'expo-secure-store';
import { AI_CONFIG } from '../constants/config';

const API_KEY_VISION_KEY = 'API_KEY_VISION';

export type AiProvider = 'gemini' | 'openai';

export interface ApiKeyTestResult {
  ok: boolean;
  detail: string | null;
}

export function detectAiProvider(apiKey: string): AiProvider {
  const trimmed = apiKey.trim();
  return trimmed.startsWith('sk-') ? 'openai' : 'gemini';
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    const message: unknown = data?.error?.message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  } catch {
    // El cuerpo no es JSON; se ignora
  }
  return '';
}

function describeError(provider: AiProvider, status: number, detail: string): string {
  const suffix = detail ? ` — ${detail}` : ` (HTTP ${status})`;
  if (status === 401 || status === 403) {
    return provider === 'gemini' ? `API Key inválida (403)${suffix}` : `API Key inválida (403)${suffix}`;
  }
  if (status === 404) {
    return `Modelo no encontrado (404)${suffix}`;
  }
  if (status === 400) {
    return `Petición inválida (400)${suffix}`;
  }
  if (status === 429) {
    return `Límite de peticiones alcanzado (429)${suffix}`;
  }
  return `Error del proveedor (HTTP ${status})${suffix}`;
}

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

export async function testVisionApiKey(apiKey: string): Promise<ApiKeyTestResult> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, detail: 'Ingresa una API Key para poder probarla.' };
  }

  const provider = detectAiProvider(trimmed);

  try {
    if (provider === 'openai') {
      const response = await fetch(AI_CONFIG.OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${trimmed}`,
        },
        body: JSON.stringify({
          model: AI_CONFIG.OPENAI_CHAT_MODEL,
          messages: [{ role: 'user', content: 'Responde OK' }],
          max_tokens: 5,
        }),
      });
      if (response.ok) {
        return { ok: true, detail: null };
      }
      const detail = await readErrorDetail(response);
      console.error(
        `OpenAI test failed: HTTP ${response.status}`,
        detail || `Respuesta: ${response.status} ${response.statusText}`,
      );
      return { ok: false, detail: describeError(provider, response.status, detail) };
    }

    const url = `${AI_CONFIG.GEMINI_API_URL}?key=${trimmed}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Responde OK' }] }],
      }),
    });
    if (response.ok) {
      return { ok: true, detail: null };
    }
    const detail = await readErrorDetail(response);
    console.error(
      `Gemini test failed: HTTP ${response.status}`,
      detail || `Respuesta: ${response.status} ${response.statusText}`,
    );
    return { ok: false, detail: describeError(provider, response.status, detail) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('testVisionApiKey: error de red', e);
    return { ok: false, detail: `Sin conexión a internet (Network error) — ${message}` };
  }
}