import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'workout-timer';
const VIBRATE_CHANNEL_ID = 'workout-vibrate';
const WARNING_TIMER_ID = 'workout-timer-warning';
const TEN_SECONDS_WARNING = 10000;
const EIGHT_SECONDS_WARNING = 8000;
const FIVE_SECONDS_WARNING = 5000;

async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Temporizador de entrenamiento',
      description: 'Avisos del contador de trabajo y descanso.',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      sound: 'default',
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
    });
  } catch {
    // Sin soporte nativo (dev client sin el módulo): se ignora.
  }
}

async function setupVibrateChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(VIBRATE_CHANNEL_ID, {
      name: 'Vibración del temporizador',
      description: 'Vibración 10 segundos antes de terminar la fase.',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 600, 200, 600, 200, 600],
      enableVibrate: true,
      sound: null,
    });
  } catch {
    // Sin soporte nativo (dev client sin el módulo): se ignora.
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    await setupNotificationChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export async function cancelScheduledWarnings(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const pending = scheduled.filter(
      (n) => n.content.data?.timerId === WARNING_TIMER_ID,
    );
    await Promise.all(
      pending.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Ignorar errores de cancelación
  }
}

export interface WarningSchedule {
  ids: string[];
  firedAt: number[];
}

/**
 * Programa avisos antes de que termine la fase en curso:
 * - 10 s antes: solo vibración.
 * - 8 s antes: tono de alarma (sonido).
 * - 5 s antes: notificación con el mensaje de preparación.
 */
export async function scheduleWorkoutWarnings(endsAt: number): Promise<WarningSchedule> {
  const now = Date.now();
  const warnings = [
    {
      at: endsAt - TEN_SECONDS_WARNING,
      channelId: VIBRATE_CHANNEL_ID,
      sound: false,
      body: 'Faltan 10 segundos. ¡Prepárate!',
    },
    {
      at: endsAt - EIGHT_SECONDS_WARNING,
      channelId: CHANNEL_ID,
      sound: 'default',
      body: 'Faltan 8 segundos. ¡Prepárate!',
    },
    {
      at: endsAt - FIVE_SECONDS_WARNING,
      channelId: CHANNEL_ID,
      sound: 'default',
      body: 'Faltan 5 segundos. ¡Prepárate para la siguiente fase!',
    },
  ].filter((w) => w.at > now);

  if (warnings.length === 0) {
    return { ids: [], firedAt: [] };
  }

  try {
    await ensureNotificationPermission();
    await setupVibrateChannel();
    await cancelScheduledWarnings();
    const ids: string[] = [];
    const firedAt: number[] = [];
    for (const warning of warnings) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Temporizador de entrenamiento',
          body: warning.body,
          sound: warning.sound,
          data: { timerId: WARNING_TIMER_ID },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(warning.at),
          ...(Platform.OS === 'android' ? { channelId: warning.channelId } : {}),
        },
      });
      ids.push(id);
      firedAt.push(warning.at);
    }
    return { ids, firedAt };
  } catch {
    return { ids: [], firedAt: [] };
  }
}