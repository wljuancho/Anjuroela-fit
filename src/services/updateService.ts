import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_UPDATE_CONFIG } from '../constants/config';

export interface UpdateInfo {
  latestVersion: string;
  downloadUrl: string;
  notes?: string;
}

const APK_FILE_NAME = 'anjuroela-fit.apk';
const UNKNOWN_SOURCES_ASKED_KEY = '@anjuroela_fit:unknown_sources_asked';

export function getInstalledVersion(): string | null {
  return Application.nativeApplicationVersion;
}

export function isPlatformSupported(): boolean {
  return Platform.OS === 'android';
}

function normalizeVersion(value: string): number[] {
  return value
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((part) => parseInt(part, 10) || 0)
    .slice(0, 3);
}

export function compareVersions(a: string, b: string): number {
  const aa = normalizeVersion(a);
  const bb = normalizeVersion(b);
  const len = Math.max(aa.length, bb.length);
  for (let i = 0; i < len; i++) {
    const diff = (aa[i] ?? 0) - (bb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Consulta el manifiesto remoto y compara con la versión instalada.
 * Devuelve null si no hay actualización, si la plataforma no es Android
 * o si el servidor no está disponible.
 */
export async function checkForAppUpdate(): Promise<UpdateInfo | null> {
  if (!isPlatformSupported()) return null;

  const installed = getInstalledVersion();
  if (!installed) return null;

  let response: Response;
  try {
    response = await fetchWithTimeout(APP_UPDATE_CONFIG.MANIFEST_URL, APP_UPDATE_CONFIG.FETCH_TIMEOUT_MS);
    if (!response.ok) return null;
  } catch {
    return null;
  }

  let manifest: UpdateInfo;
  try {
    const data = (await response.json()) as Partial<UpdateInfo>;
    if (!data.latestVersion || !data.downloadUrl) return null;
    manifest = { latestVersion: data.latestVersion, downloadUrl: data.downloadUrl, notes: data.notes };
  } catch {
    return null;
  }

  return compareVersions(manifest.latestVersion, installed) > 0 ? manifest : null;
}

/**
 * Descarga el APK en el almacenamiento interno de la app y devuelve un
 * content:// seguro para el instalador (evita FileUriExposedException).
 */
export async function downloadApk(info: UpdateInfo): Promise<string> {
  const target = `${FileSystem.documentDirectory}${APK_FILE_NAME}`;
  const existing = await FileSystem.getInfoAsync(target);
  if (existing.exists) {
    await FileSystem.deleteAsync(target, { idempotent: true });
  }
  const result = await FileSystem.downloadAsync(info.downloadUrl, target);
  if (result.status !== 200) {
    throw new Error('La descarga del APK falló.');
  }
  const apkUri = await FileSystem.getContentUriAsync(target);
  return apkUri;
}

/**
 * Pide al usuario el permiso nativo 'Instalar apps desconocidas' la primera vez.
 */
export async function ensureUnknownSourcesPermission(): Promise<void> {
  const alreadyAsked = await AsyncStorage.getItem(UNKNOWN_SOURCES_ASKED_KEY);
  if (alreadyAsked === 'true') return;
  await AsyncStorage.setItem(UNKNOWN_SOURCES_ASKED_KEY, 'true');
  await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES');
}

/**
 * Abre el instalador de Android con el APK descargado.
 */
export async function openApkInstaller(contentUri: string): Promise<void> {
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
  });
}