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
