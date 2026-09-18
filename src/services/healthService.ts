import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getSdkStatus,
  initialize,
  requestPermission,
  getGrantedPermissions,
  revokeAllPermissions,
  readRecords,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import type {
  Permission,
  ReadRecordsResult,
  RevokeAllPermissionsResponse,
} from 'react-native-health-connect';
import appleHealthKit from 'react-native-health';
import type {
  HealthInputOptions,
  HealthKitPermissions,
  HealthPermission,
  HealthUnit,
  HealthValue,
  HealthStatusCode,
  HealthStatusResult,
} from 'react-native-health';
import { getDatabase } from './database';
import { getStoredCurrentUserId } from './sessionStorage';

// Clave de AsyncStorage (sin prefijo) que recorda si el usuario quiere
// sincronizar su wearable (reloj/pulsera/anillo) con la app. Es por email
// porque cada cuenta gestiona su propia vinculación.
function healthSyncStorageKey(email: string): string {
  return `health_sync_enabled_${email}`;
}

async function getSyncUserId(email?: string | null): Promise<string | null> {
  if (email) return email;
  return await getStoredCurrentUserId();
}

export async function isHealthSyncEnabled(email?: string | null): Promise<boolean> {
  const userId = await getSyncUserId(email);
  if (!userId) return false;
  try {
    return (await AsyncStorage.getItem(healthSyncStorageKey(userId))) === 'true';
  } catch {
    return false;
  }
}

export async function setHealthSyncEnabled(
  email: string,
  enabled: boolean,
): Promise<void> {
  try {
    const key = healthSyncStorageKey(email);
    if (enabled) {
      await AsyncStorage.setItem(key, 'true');
    } else {
      await AsyncStorage.removeItem(key);
    }
  } catch {
    // La preferencia no es crítica: el peor caso es repetir la vinculación.
  }
}

// ---------------------------------------------------------------------------
// Disponibilidad de la plataforma
// ---------------------------------------------------------------------------

async function androidSdkAvailable(): Promise<boolean> {
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

// Paquete oficial de la app "Health Connect" de Google y accesos directos a su
// ficha en Google Play (el deep link market:// abre la tienda instalada; el
// HTTPS es el respaldo a su ficha web).
export const HEALTH_CONNECT_PROVIDER_PACKAGE = 'com.google.android.apps.healthdata';
export const HEALTH_CONNECT_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

export type AndroidHealthConnectStatus =
  | 'available'
  | 'not-installed'
  | 'update-required';

// Consulta el estado de Health Connect en Android distinguiendo si la app de
// Google está instalada (y actualizada) o no. En iOS no aplica: el flujo usa
// Salud/HealthKit, así que siempre se reporta 'available'.
export async function getAndroidHealthConnectStatus(): Promise<AndroidHealthConnectStatus> {
  if (Platform.OS !== 'android') return 'available';
  try {
    const status = await getSdkStatus(HEALTH_CONNECT_PROVIDER_PACKAGE);
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
      return 'update-required';
    }
    return 'not-installed';
  } catch {
    return 'not-installed';
  }
}

// Abre la ficha de Health Connect en Google Play (o su página web si el
// dispositivo no tiene la tienda de Play).
export async function openHealthConnectPlayStore(): Promise<void> {
  try {
    await Linking.openURL(`market://details?id=${HEALTH_CONNECT_PROVIDER_PACKAGE}`);
  } catch {
    await Linking.openURL(HEALTH_CONNECT_PLAY_STORE_URL);
  }
}

async function iosHealthAvailable(): Promise<boolean> {
  try {
    return await iosCall<boolean>((cb) => appleHealthKit.isAvailable(cb));
  } catch {
    return false;
  }
}

export async function isWearableAvailable(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return await iosHealthAvailable();
  }
  if (Platform.OS === 'android') {
    return await androidSdkAvailable();
  }
  return false;
}

// ---------------------------------------------------------------------------
// iOS HealthKit: envoltorio de callbacks -> promesas
// ---------------------------------------------------------------------------

type IosCallback<T> = (cb: (error: unknown, results: T) => void) => void;

function iosCall<T>(fn: IosCallback<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    fn((error, results) => {
      if (error != null) {
        reject(new Error(typeof error === 'string' ? error : 'HealthKit no disponible.'));
      } else {
        resolve(results);
      }
    });
  });
}

// Identificadores nativos de HealthKit en la librería (Constants.Permissions /
// Units). Se usan literales: los enums de los .d.ts no están en el bundle en
// tiempo de ejecución, así que acceder a `HealthPermission.HeartRate` etc.
// fallaría al ejecutarse aunque compile.
const IOS_READ_PERMISSIONS: HealthPermission[] = [
  'HeartRate' as HealthPermission,
  'ActiveEnergyBurned' as HealthPermission,
];

const IOS_PERMISSIONS_CONFIG: HealthKitPermissions = {
  permissions: { read: IOS_READ_PERMISSIONS, write: [] },
};

const IOS_HEART_RATE_OPTIONS: HealthInputOptions = {
  startDate: '',
  endDate: '',
  unit: 'bpm' as HealthUnit,
  ascending: false,
};

const IOS_ACTIVE_CALORIES_OPTIONS: HealthInputOptions = {
  startDate: '',
  endDate: '',
  unit: 'kilocalorie' as HealthUnit,
  ascending: false,
};

// HealthStatusCode.SharingAuthorized (los códigos tampoco se exportan en runtime).
const HEALTHKIT_SHARING_AUTHORIZED: HealthStatusCode = 2 as HealthStatusCode;

async function iosAuthReadStatuses(): Promise<HealthStatusCode[] | null> {
  try {
    const result = await iosCall<HealthStatusResult>((cb) =>
      appleHealthKit.getAuthStatus(IOS_PERMISSIONS_CONFIG, cb),
    );
    return result?.permissions?.read ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Permisos
// ---------------------------------------------------------------------------

const ANDROID_READ_REQUESTS: Permission[] = [
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
];

async function androidRequestPermissions(): Promise<boolean> {
  if (!(await androidSdkAvailable())) {
    throw new Error(
      'Health Connect no está disponible en este dispositivo. Instálalo desde Play Store o actualiza el reloj/la app de salud.',
    );
  }
  await initialize();
  const granted = await requestPermission(ANDROID_READ_REQUESTS);
  const grantedTypes = new Set(granted.map((p) => p.recordType));
  return (
    grantedTypes.has('HeartRate') && grantedTypes.has('ActiveCaloriesBurned')
  );
}

async function androidHasPermissions(): Promise<boolean> {
  if (!(await androidSdkAvailable())) return false;
  const granted = await getGrantedPermissions();
  const grantedTypes = new Set(granted.map((p) => p.recordType));
  return (
    grantedTypes.has('HeartRate') && grantedTypes.has('ActiveCaloriesBurned')
  );
}

async function iosInitHealth(): Promise<void> {
  if (!(await iosHealthAvailable())) {
    throw new Error(
      'Este dispositivo no es compatible con Salud (HealthKit).',
    );
  }
  await iosCall<HealthValue>((cb) =>
    appleHealthKit.initHealthKit(IOS_PERMISSIONS_CONFIG, cb),
  );
}

async function iosHasPermissions(): Promise<boolean> {
  if (!(await iosHealthAvailable())) return false;
  const statuses = await iosAuthReadStatuses();
  if (!statuses) return false;
  return IOS_READ_PERMISSIONS.every(
    (_, index) => statuses[index] === HEALTHKIT_SHARING_AUTHORIZED,
  );
}

/**
 * Solicita al usuario el acceso al wearable (HealthKit en iOS, Health Connect /
 * Salud en Android). Devuelve true cuando el ritmo cardíaco y las calorías
 * activas quedaron autorizados para lectura.
 */
export async function requestWearablePermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    await iosInitHealth();
    return await iosHasPermissions();
  }
  if (Platform.OS === 'android') {
    return await androidRequestPermissions();
  }
  return false;
}

export async function hasWearablePermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    return await iosHasPermissions();
  }
  if (Platform.OS === 'android') {
    return await androidHasPermissions();
  }
  return false;
}

/**
 * Desvincula el wearable. En iOS HealthKit no permite revocar por API: la
 * preferencia de la app deja de sincronizar (el permiso queda en la app Salud).
 * En Android se revocan los permisos de Health Connect (efectivo al reiniciar
 * la app, limitación documentada de la plataforma).
 */
export async function revokeWearableAccess(): Promise<{
  requiresRestart?: boolean;
  message?: string;
}> {
  if (Platform.OS === 'ios') {
    return {
      message:
        'Los permisos pueden gestionarse en la app Salud (Ajustes > Salud > Apps).',
    };
  }
  if (Platform.OS === 'android') {
    if (!(await androidSdkAvailable())) return { message: 'Health Connect no está disponible.' };
    let response: RevokeAllPermissionsResponse | void;
    try {
      response = await revokeAllPermissions();
    } catch {
      response = undefined;
    }
    return {
      requiresRestart: response?.requiresRestart ?? true,
      message:
        'Para que los permisos de Health Connect se revoquen por completo, reinicia la app.',
    };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Lectura de datos del wearable
// ---------------------------------------------------------------------------

interface WearableHeartRateReading {
  avgBpm: number;
  maxBpm: number;
  sampleCount: number;
}

async function androidReadHeartRate(
  startISO: string,
  endISO: string,
): Promise<WearableHeartRateReading | null> {
  const result = await readRecords<'HeartRate'>('HeartRate', {
    timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
    ascendingOrder: true,
  });
  return extractHeartRateStats(result);
}

async function iosReadHeartRate(
  startISO: string,
  endISO: string,
): Promise<WearableHeartRateReading | null> {
  const results = await iosCall<HealthValue[]>((cb) =>
    appleHealthKit.getHeartRateSamples(
      { ...IOS_HEART_RATE_OPTIONS, startDate: startISO, endDate: endISO },
      (err, res) => cb(err, res),
    ),
  );
  const samples = results
    .filter((r) => typeof r.value === 'number' && r.value > 0)
    .map((r) => ({ bpm: r.value, time: r.startDate }));
  if (samples.length === 0) return null;
  let sum = 0;
  let max = 0;
  for (const s of samples) {
    sum += s.bpm;
    if (s.bpm > max) max = s.bpm;
  }
  return { avgBpm: sum / samples.length, maxBpm: max, sampleCount: samples.length };
}

function extractHeartRateStats(
  result: ReadRecordsResult<'HeartRate'>,
): WearableHeartRateReading | null {
  const samples: { bpm: number; time: string }[] = [];
  for (const record of result.records) {
    for (const sample of record.samples ?? []) {
      if (sample.beatsPerMinute > 0) {
        samples.push({ bpm: sample.beatsPerMinute, time: sample.time });
      }
    }
  }
  if (samples.length === 0) return null;
  let sum = 0;
  let max = 0;
  for (const s of samples) {
    sum += s.bpm;
    if (s.bpm > max) max = s.bpm;
  }
  return { avgBpm: sum / samples.length, maxBpm: max, sampleCount: samples.length };
}

async function androidReadActiveCalories(
  startISO: string,
  endISO: string,
): Promise<number> {
  const result = await readRecords<'ActiveCaloriesBurned'>('ActiveCaloriesBurned', {
    timeRangeFilter: { operator: 'between', startTime: startISO, endTime: endISO },
  });
  let kcal = 0;
  for (const record of result.records) {
    kcal += record.energy?.inKilocalories ?? 0;
  }
  return Math.max(0, kcal);
}

async function iosReadActiveCalories(startISO: string, endISO: string): Promise<number> {
  const results = await iosCall<HealthValue[]>((cb) =>
    appleHealthKit.getActiveEnergyBurned(
      { ...IOS_ACTIVE_CALORIES_OPTIONS, startDate: startISO, endDate: endISO },
      (err, res) => cb(err, res),
    ),
  );
  let kcal = 0;
  for (const r of results) {
    if (typeof r.value === 'number' && r.value > 0) kcal += r.value;
  }
  return Math.max(0, kcal);
}

async function readActiveCalories(startISO: string, endISO: string): Promise<number> {
  if (Platform.OS === 'ios') {
    return await iosReadActiveCalories(startISO, endISO);
  }
  if (Platform.OS === 'android') {
    return await androidReadActiveCalories(startISO, endISO);
  }
  return 0;
}

async function readHeartRate(
  startISO: string,
  endISO: string,
): Promise<WearableHeartRateReading | null> {
  if (Platform.OS === 'ios') {
    return await iosReadHeartRate(startISO, endISO);
  }
  if (Platform.OS === 'android') {
    return await androidReadHeartRate(startISO, endISO);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cálculo de calorías unificado (heartbeat + repeticiones/rondas + descanso)
// ---------------------------------------------------------------------------

const SECONDS_PER_REP = 2;
const REST_MET = 1.5;
const FALLBACK_BODY_WEIGHT_KG = 70;
const DEFAULT_AGE = 30;

function keytelCaloriesPerMinute(
  heartRateBpm: number,
  weightKg: number,
  age: number,
  sexIsMale: boolean | null,
): number {
  const male = (-55.0969 + 0.6309 * heartRateBpm + 0.1988 * weightKg + 0.2017 * age) / 4.184;
  const female = (-20.4022 + 0.4472 * heartRateBpm - 0.1263 * weightKg + 0.074 * age) / 4.184;
  const value =
    sexIsMale === true ? male : sexIsMale === false ? female : (male + female) / 2;
  return Math.max(0, value);
}

interface BodyStats {
  weightKg: number;
  age: number;
  sexIsMale: boolean | null;
}

async function getBodyStats(): Promise<BodyStats> {
  const db = getDatabase();
  const weightRows = await db.getAllAsync<{ weight_kg: number }>(
    'SELECT weight_kg FROM weight_logs WHERE weight_kg > 0 ORDER BY date DESC, id DESC LIMIT 1',
  );
  const profileRows = await db.getAllAsync<{
    age: number | null;
    gender: string | null;
    current_weight: number | null;
  }>('SELECT age, gender, current_weight FROM user_profiles LIMIT 1');
  const profile = profileRows[0];
  const weightKg =
    profile?.current_weight && profile.current_weight > 0
      ? profile.current_weight
      : weightRows[0]?.weight_kg ?? FALLBACK_BODY_WEIGHT_KG;
  const age = profile?.age && profile.age > 0 ? profile.age : DEFAULT_AGE;
  const sexIsMale =
    profile?.gender === 'hombre'
      ? true
      : profile?.gender === 'mujer'
        ? false
        : null;
  return { weightKg, age, sexIsMale };
}

interface SessionStructure {
  workSeconds: number;
  restSeconds: number;
  totalSets: number;
}

// Recupera la estructura del ejercicio: series con sus repeticiones (o segundos
// de trabajo) y descansos, más las rondas en caso de que el día tenga circuitos.
// Si la sesión es de circuito (sin series registradas), se usa el trabajo y
// descanso configurados en workout_circuits multiplicados por el número de
// rondas. Así el cálculo de kcal siempre considera repeticiones, rondas y
// descanso junto con los latidos.
async function getSessionStructure(
  sessionId: number,
  dayOfWeek: string,
): Promise<SessionStructure> {
  const db = getDatabase();
  const sets = await db.getAllAsync<{
    set_type: string | null;
    reps: number | null;
    time_seconds: number | null;
    rest_seconds: number | null;
  }>(
    'SELECT set_type, reps, time_seconds, rest_seconds FROM workout_sets WHERE session_id = ?',
    [sessionId],
  );
  let workSeconds = 0;
  let restSeconds = 0;
  let totalSets = 0;
  for (const set of sets) {
    totalSets += 1;
    if (set.set_type === 'time' && set.time_seconds && set.time_seconds > 0) {
      workSeconds += set.time_seconds;
    } else if (set.reps && set.reps > 0) {
      workSeconds += set.reps * SECONDS_PER_REP;
    }
    if (set.rest_seconds && set.rest_seconds > 0) {
      restSeconds += set.rest_seconds;
    }
  }

  const circuits = await db.getAllAsync<{
    work_seconds: number | null;
    rest_seconds: number | null;
    rounds: number | null;
  }>(
    'SELECT work_seconds, rest_seconds, rounds FROM workout_circuits WHERE day_of_week = ?',
    [dayOfWeek],
  );
  let circuitWorkSeconds = 0;
  let circuitRestSeconds = 0;
  for (const circuit of circuits) {
    const rounds = circuit.rounds && circuit.rounds > 0 ? circuit.rounds : 1;
    circuitWorkSeconds += (circuit.work_seconds ?? 0) * rounds;
    circuitRestSeconds += (circuit.rest_seconds ?? 0) * rounds;
  }

  // Los circuitos no suelen registrar series: se toma la estructura del circuito.
  if (totalSets === 0 && circuitWorkSeconds > 0) {
    return {
      workSeconds: circuitWorkSeconds,
      restSeconds: circuitRestSeconds,
      totalSets: 0,
    };
  }
  return { workSeconds, restSeconds, totalSets };
}

function estimateSessionWindow(
  createdAt: string | null,
  date: string,
): { startISO: string; endISO: string } {
  let startISO: string;
  if (createdAt) {
    const iso = createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`;
    if (!Number.isNaN(new Date(iso).getTime())) {
      startISO = iso;
    } else {
      startISO = localDateToIsoStart(date);
    }
  } else {
    startISO = localDateToIsoStart(date);
  }
  let endISO = new Date().toISOString();
  if (new Date(endISO).getTime() <= new Date(startISO).getTime()) {
    endISO = new Date(new Date(startISO).getTime() + 60 * 60 * 1000).toISOString();
  }
  return { startISO, endISO };
}

function localDateToIsoStart(date: string): string {
  const parts = date.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) {
    return new Date().toISOString();
  }
  const value = new Date(parts[0], parts[1] - 1, parts[2]);
  return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
}

/**
 * Cálculo principal de la sesión cuando el wearable reporta latidos: combina el
 * ritmo cardíaco medido (fórmula de Keytel, kcal/min) aplicado al tiempo de
 * trabajo obtenido de las repeticiones/rondas, más la componente de descanso
 * (MET de reposo) del total de segundos de descanso. Si además el dispositivo
 * reporta kcal activas, se usa el mayor de ambos para no subestimar.
 */
async function computeWearableCalories(
  reading: WearableHeartRateReading,
  workSeconds: number,
  restSeconds: number,
  activeCalories: number,
): Promise<number> {
  const body = await getBodyStats();
  const kcalPerMinute = keytelCaloriesPerMinute(
    reading.avgBpm,
    body.weightKg,
    body.age,
    body.sexIsMale,
  );
  const workCalories = kcalPerMinute * (workSeconds / 60);
  const restCalories = (REST_MET * body.weightKg * restSeconds) / 3600;
  const blended = workCalories + restCalories;
  return Math.max(activeCalories, blended);
}

// ---------------------------------------------------------------------------
// Aplicación de las métricas a una sesión de entrenamiento
// ---------------------------------------------------------------------------

export async function applyWearableMetricsToSession(sessionId: number): Promise<void> {
  const db = getDatabase();
  try {
    if (!(await isHealthSyncEnabled())) return;

    const sessions = await db.getAllAsync<{
      day_of_week: string;
      date: string;
      created_at: string | null;
    }>(
      'SELECT day_of_week, date, created_at FROM workout_sessions WHERE id = ? LIMIT 1',
      [sessionId],
    );
    const session = sessions[0];
    if (!session) return;

    const authorized = await hasWearablePermissions().catch(() => false);
    if (!authorized) return;

    const { startISO, endISO } = estimateSessionWindow(session.created_at, session.date);
    const reading = await readHeartRate(startISO, endISO).catch(() => null);
    if (!reading || reading.sampleCount === 0) return;

    const structure = await getSessionStructure(sessionId, session.day_of_week);

    let caloriesBurned = 0;
    if (structure.workSeconds > 0 || structure.restSeconds > 0) {
      const activeCalories = await readActiveCalories(startISO, endISO).catch(() => 0);
      caloriesBurned = await computeWearableCalories(
        reading,
        structure.workSeconds,
        structure.restSeconds,
        activeCalories,
      );
    }

    const avgBpmRounded = Math.round(reading.avgBpm * 10) / 10;
    if (caloriesBurned > 0) {
      await db.runAsync(
        'UPDATE workout_sessions SET calories_burned = ?, heart_rate_avg = ?, calories_source = ? WHERE id = ?',
        [Math.round(caloriesBurned), avgBpmRounded, 'wearable', sessionId],
      );
    } else {
      await db.runAsync(
        'UPDATE workout_sessions SET heart_rate_avg = ? WHERE id = ?',
        [avgBpmRounded, sessionId],
      );
    }
  } catch {
    // No debe impedir completar la sesión si el wearable falla.
  }
}