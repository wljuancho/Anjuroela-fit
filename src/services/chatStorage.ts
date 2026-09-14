import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage } from '../types/coach';

const PREFIX = 'anjuroela_fit:chat';

function keyFor(userId: number): string {
  return `${PREFIX}:${userId}`;
}

export async function getStoredChat(userId: number): Promise<ChatMessage[] | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatMessage[]) : null;
  } catch {
    return null;
  }
}

export async function storeChat(userId: number, messages: ChatMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(messages));
  } catch {
    // Silently ignore storage errors to avoid crashing the UI
  }
}

export async function appendChatMessage(userId: number, message: ChatMessage): Promise<void> {
  const current = (await getStoredChat(userId)) ?? [];
  current.push(message);
  await storeChat(userId, current);
}

export async function clearStoredChat(userId: number): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    // Silently ignore storage errors
  }
}