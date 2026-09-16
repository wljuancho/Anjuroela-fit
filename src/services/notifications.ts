import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'workout-timer';
const WARNING_TIMER_ID = 'workout-timer-warning';
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
  id: string | null;
  firedAt: number | null;
}

export async function scheduleFiveSecondWarning(endsAt: number): Promise<WarningSchedule> {
  const firedAt = endsAt - FIVE_SECONDS_WARNING;
  if (firedAt <= Date.now()) {
    return { id: null, firedAt: null };
  }
  try {
    await setupNotificationChannel();
    await cancelScheduledWarnings();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Temporizador de entrenamiento',
        body: 'Faltan 5 segundos. ¡Prepárate para la siguiente fase!',
        sound: 'default',
        data: { timerId: WARNING_TIMER_ID },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(firedAt),
        channelId: CHANNEL_ID,
      },
    });
    return { id, firedAt };
  } catch {
    return { id: null, firedAt: null };
  }
}