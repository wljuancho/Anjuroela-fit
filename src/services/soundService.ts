import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;
let audioModeReady = false;

/**
 * Configura la sesión de audio para que los avisos suenen por el canal de
 * MÚSICA/MEDIA (speaker), incluso con el dispositivo en modo silencio, y
 * hagan ducking de otras apps. Equivalente en expo-audio de:
 * playsInSilentModeIOS=true, staysActiveInBackground=true y
 * shouldDuckAndroid=true.
 */
async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    });
    audioModeReady = true;
  } catch {
    // Modo de audio no disponible: el tono igual se intentará reproducir.
  }
}

/**
 * Reproduce un tono breve de alerta/error de forma segura.
 *
 * La reproducción nunca debe romper el hilo de la interfaz ni lanzar: si no
 * hay permiso, el dispositivo está en silencio o la librería falla, se ignora
 * en silencio. El player se crea una sola vez y se reutiliza.
 */
export function playErrorSound(): void {
  void ensureAudioMode();
  try {
    if (!player) {
      player = createAudioPlayer(require('../../assets/sounds/error.wav'));
    }
    player.seekTo(0);
    player.play();
  } catch {
    // Sin sonido: la app sigue funcionando (modo silencioso/api error).
  }
}

let countdownPlayer: AudioPlayer | null = null;

/** Tono suave de cuenta regresiva (se comparte entre descanso y trabajo). */
function playCountdownTone(): void {
  void ensureAudioMode();
  try {
    if (!countdownPlayer) {
      countdownPlayer = createAudioPlayer(require('../../assets/sounds/error.beep.wav'));
    }
    countdownPlayer.seekTo(0);
    countdownPlayer.play();
  } catch {
    // Sin sonido: la app sigue funcionando (modo silencioso/dispositivo).
  }
}

/**
 * Reproduce un tono corto y suave que avisa al usuario que el descanso está
 * por terminar (ej. faltan 7 segundos). Nunca lanza; el tono siempre sale por
 * el canal de MÚSICA/MEDIA configurado en ensureAudioMode.
 */
export function playRestWarningSound(): void {
  playCountdownTone();
}

/**
 * Reproduce el mismo tono suave cuando falten 5 segundos de trabajo/ejercicio
 * (modos Tiempo y Circuito). Nunca lanza.
 */
export function playWorkWarningSound(): void {
  playCountdownTone();
}
