import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Cabecera del usuario activo que leen las políticas RLS de Supabase
// (current_setting('request.headers', true)::json->>'x-app-user') para aislar
// los datos por usuario aunque la app use la clave anónima (publishable).
const APP_USER_HEADER = 'x-app-user';

let supabase: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient | null {
  if (!supabase && isSupabaseConfigured()) {
    supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      global: { headers: {} },
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return supabase;
}

// Reconstruye el cliente con la cabecera del usuario activo. Se invoca al
// iniciar sesión, al cargar una sesión guardada y al cerrar sesión (null).
// El cliente es stateless (REST), por lo que recrearlo es seguro y barato.
export function setSupabaseAppUser(userEmail: string | null): void {
  if (!isSupabaseConfigured()) {
    supabase = null;
    return;
  }
  const normalized = userEmail ? userEmail.toLowerCase().trim() : null;
  supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: {
      headers: normalized
        ? { [APP_USER_HEADER]: normalized }
        : {},
    },
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}