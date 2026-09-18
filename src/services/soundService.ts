import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

let player: AudioPlayer | null = null;

/**
 * Reproduce un tono breve de alerta/error de forma segura.
 *
 * La reproducción nunca debe romper el hilo de la interfaz ni lanzar: si no
 * hay permiso, el dispositivo está en silencio o la librería falla, se ignora
 * en silencio. El player se crea una sola vez y se reutiliza.
 */
export function playErrorSound(): void {
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

/**
 * Reproduce un tono corto y suave que avisa al usuario que el descanso está
 * por terminar (ej. faltan 7 segundos). Nunca lanza; usa el mismo patrón
 * seguro que playErrorSound con un recurso sonoro más ligero.
 */
export function playRestWarningSound(): void {
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
