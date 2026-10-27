import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type WorkoutSoundId = 'digital' | 'classic';

export const WORKOUT_SOUNDS: { id: WorkoutSoundId; label: string; source: number }[] = [
  { id: 'digital', label: 'Digital', source: require('../../assets/sounds/alarm-digital.wav') },
  { id: 'classic', label: 'Clásica', source: require('../../assets/sounds/alarm-classic.wav') },
];

const SOUND_KEY = '@anjuroela_fit:workout_sound';
const selectedSound = { current: 'digital' as WorkoutSoundId };
const tonePlayers = new Map<WorkoutSoundId, AudioPlayer>();
let backgroundPlayer: AudioPlayer | null = null;
let audioModeReady = false;
let soundLoaded = false;

export async function loadWorkoutSound(): Promise<WorkoutSoundId> {
  try {
    const value = await AsyncStorage.getItem(SOUND_KEY);
    if (value === 'digital' || value === 'classic') selectedSound.current = value;
  } catch {
    // Usa el sonido predeterminado si el almacenamiento no está disponible.
  }
  soundLoaded = true;
  return selectedSound.current;
}

export async function saveWorkoutSound(sound: WorkoutSoundId): Promise<void> {
  selectedSound.current = sound;
  soundLoaded = true;
  await AsyncStorage.setItem(SOUND_KEY, sound);
}

async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  });
  audioModeReady = true;
}

function playerFor(sound: WorkoutSoundId): AudioPlayer {
  let player = tonePlayers.get(sound);
  if (!player) {
    const source = WORKOUT_SOUNDS.find((item) => item.id === sound)?.source ?? WORKOUT_SOUNDS[0].source;
    player = createAudioPlayer(source);
    tonePlayers.set(sound, player);
  }
  return player;
}

export async function previewWorkoutSound(sound: WorkoutSoundId): Promise<void> {
  selectedSound.current = sound;
  await playCountdownTone();
}

async function playCountdownTone(): Promise<void> {
  try {
    if (!soundLoaded) await loadWorkoutSound();
    await ensureAudioMode();
    const player = playerFor(selectedSound.current);
    player.seekTo(0);
    player.play();
  } catch {
    // Una falla de audio nunca debe detener el temporizador.
  }
}

export function playErrorSound(): void {
  void playCountdownTone();
}

export function playRestWarningSound(): void {
  void playCountdownTone();
}

export function playWorkWarningSound(): void {
  void playCountdownTone();
}

/** Mantiene activo el servicio multimedia mientras corre el cronómetro. */
export async function startWorkoutAudioSession(): Promise<void> {
  try {
    await ensureAudioMode();
    if (!backgroundPlayer) {
      backgroundPlayer = createAudioPlayer(require('../../assets/sounds/silence.wav'));
      backgroundPlayer.loop = true;
      backgroundPlayer.volume = 0;
    }
    backgroundPlayer.setActiveForLockScreen(true, {
      title: 'Temporizador de entrenamiento',
      artist: 'Anjuroela Fit',
    });
    if (!backgroundPlayer.playing) backgroundPlayer.play();
  } catch {
    // El cronómetro continúa aunque el sistema no permita audio de fondo.
  }
}

export function stopWorkoutAudioSession(): void {
  try {
    backgroundPlayer?.pause();
    backgroundPlayer?.setActiveForLockScreen(false);
  } catch {
    // Ignora errores de cierre de la sesión de audio.
  }
}
