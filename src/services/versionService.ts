import Constants from 'expo-constants';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface RemoteUpdateInfo {
  hasUpdate: boolean;
  downloadUrl: string;
  message: string;
}

interface AppVersionRow {
  id: number;
  is_active: boolean;
  latest_version_code: number;
  latest_version_name: string;
  download_url: string;
  message: string;
  created_at: string;
}

export function getLocalVersionCode(): number | null {
  const fromExpoConfig = Constants.expoConfig?.android?.versionCode;
  if (typeof fromExpoConfig === 'number' && fromExpoConfig > 0) {
    return fromExpoConfig;
  }
  const manifest = Constants.manifest as { android?: { versionCode?: number } } | null;
  if (typeof manifest?.android?.versionCode === 'number' && manifest.android.versionCode > 0) {
    return manifest.android.versionCode;
  }
  return null;
}

/**
 * Consulta la tabla remota `app_versions` en Supabase y compara el
 * latest_version_code con el versionCode local. Devuelve null cuando no hay
 * actualización (sin registros activos o versión local ya igual/superior) o
 * cuando el backend de Supabase no está disponible.
 */
export async function checkForRemoteUpdate(): Promise<RemoteUpdateInfo | null> {
  if (!supabase || !isSupabaseConfigured()) return null;

  const localVersionCode = getLocalVersionCode();
  if (localVersionCode === null) return null;

  const { data, error } = await supabase
    .from('app_versions')
    .select('*')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const row = data[0] as AppVersionRow;
  if (!row.download_url || typeof row.latest_version_code !== 'number') return null;

  // Si la versión local ya es igual o superior, no se muestra nada
  // (evita falsos avisos con registros antiguos en la tabla).
  if (localVersionCode >= row.latest_version_code) return null;

  return {
    hasUpdate: true,
    downloadUrl: row.download_url,
    message: row.message || 'Hay una nueva versión disponible de Anjuroela Fit.',
  };
}