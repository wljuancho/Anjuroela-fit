import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';
import type { WorkoutPlan } from '../types/workout';
import { getItem, removeItem, setItem, StorageKeys } from '../services/storage';
import {
  cancelScheduledWarnings,
  ensureNotificationPermission,
  scheduleWorkoutWarnings,
} from '../services/notifications';
import { playRestWarningSound, playWorkWarningSound } from '../services/soundService';

type Phase = 'series' | 'rest' | 'work' | 'done';

interface TimerState {
  phase: Phase;
  running: boolean;
  endsAt: number | null;
  pausedRemainingMs: number;
  currentSeries: number;
  workDone: number;
  roundIndex: number;
  exerciseIndex: number;
  hasPlayedRestWarning: boolean;
  hasPlayedWorkWarning: boolean;
  interrupted: boolean;
}

interface TimerSnapshotData {
  version: 1;
  savedAt: number;
  sessionId: number;
  exerciseId: number;
  day: string;
  muscleId: number;
  bodyPartId: number;
  bodyPartName: string;
  mode: WorkoutPlan['mode'];
  series: number;
  reps: number;
  workSeconds: number;
  restSeconds: number;
  name?: string;
  rounds?: number;
  exercises?: { exerciseId: number; name: string }[];
  roundIndex?: number;
  exerciseIndex?: number;
  phase: Phase;
  running: boolean;
  endsAt: number | null;
  pausedRemainingMs: number;
  currentSeries: number;
  workDone: number;
  hasPlayedRestWarning?: boolean;
  hasPlayedWorkWarning?: boolean;
  interrupted?: boolean;
  startTime?: number;
  targetEndTime?: number | null;
}

export interface UseWorkoutTimerOptions {
  plan: WorkoutPlan;
  sessionId: number;
  exerciseId: number;
  day: string;
  muscleId: number;
  bodyPartId: number;
  bodyPartName: string;
}

const STALE_MS = 60 * 60 * 1000; // 1 hora: una sesión abandonada se descarta.
// Si la app estuvo fuera (cerrada/en segundo plano) más de 2 minutos, la
// sesión se declara pausada/interrumpida y el usuario decide continuar o
// reiniciar (no se auto-avanza en silencio con tiempo real).
const INTERRUPT_DELAY_MS = 2 * 60 * 1000;

function createInitialState(plan: WorkoutPlan): TimerState {
  if (plan.mode === 'reps') {
    return {
      phase: 'series',
      running: false,
      endsAt: null,
      pausedRemainingMs: 0,
      currentSeries: 1,
      workDone: 0,
      roundIndex: 0,
      exerciseIndex: 0,
      hasPlayedRestWarning: false,
      hasPlayedWorkWarning: false,
      interrupted: false,
    };
  }
  if (plan.mode === 'circuit') {
    return {
      phase: 'work',
      running: true,
      endsAt: Date.now() + plan.workSeconds * 1000,
      pausedRemainingMs: 0,
      currentSeries: 1,
      workDone: 0,
      roundIndex: 0,
      exerciseIndex: 0,
      hasPlayedRestWarning: false,
      hasPlayedWorkWarning: false,
      interrupted: false,
    };
  }
  return {
    phase: 'work',
    running: true,
    endsAt: Date.now() + plan.workSeconds * 1000,
    pausedRemainingMs: 0,
    currentSeries: 1,
    workDone: 0,
    roundIndex: 0,
    exerciseIndex: 0,
    hasPlayedRestWarning: false,
    hasPlayedWorkWarning: false,
    interrupted: false,
  };
}

function computeSeconds(state: TimerState, now: number): number {
  if (state.phase === 'series' || state.phase === 'done') {
    return 0;
  }
  if (state.running && state.endsAt != null) {
    return Math.max(0, Math.ceil((state.endsAt - now) / 1000));
  }
  return Math.max(0, Math.ceil(state.pausedRemainingMs / 1000));
}

interface StepResult {
  next: TimerState;
  shouldVibrate: boolean;
}

function onExpire(state: TimerState, plan: WorkoutPlan, now: number): StepResult {
  if (
    state.phase === 'done' ||
    state.phase === 'series' ||
    !state.running ||
    state.endsAt == null ||
    state.endsAt > now
  ) {
    return { next: state, shouldVibrate: false };
  }

  if (plan.mode === 'reps') {
    if (state.currentSeries < plan.series) {
      return {
        next: {
          ...state,
          phase: 'series',
          currentSeries: state.currentSeries + 1,
          running: false,
          endsAt: null,
          pausedRemainingMs: 0,
        },
        shouldVibrate: false,
      };
    }
    return {
      next: { ...state, phase: 'done', running: false, endsAt: null },
      shouldVibrate: true,
    };
  }

  if (plan.mode === 'circuit') {
    const exerciseCount = plan.exercises.length;
    const isLastExercise = state.exerciseIndex >= exerciseCount - 1;

    if (state.phase === 'work') {
      const isLastRound = state.roundIndex >= plan.rounds - 1;
      if (isLastRound && isLastExercise) {
        return {
          next: { ...state, phase: 'done', running: false, endsAt: null },
          shouldVibrate: true,
        };
      }
      if (isLastExercise) {
        // Terminó la ronda entera (suma del tiempo de trabajo de todos los
        // ejercicios). Ahora sí va el descanso entre series/rondas.
        return {
          next: { ...state, phase: 'rest', endsAt: now + plan.restSeconds * 1000 },
          shouldVibrate: true,
        };
      }
      // Sigue directo con el siguiente ejercicio de la ronda, sin descanso.
      return {
        next: {
          ...state,
          phase: 'work',
          exerciseIndex: state.exerciseIndex + 1,
          endsAt: now + plan.workSeconds * 1000,
        },
        shouldVibrate: true,
      };
    }

    // phase === 'rest': terminó el descanso de la ronda, arranca la siguiente.
    return {
      next: {
        ...state,
        phase: 'work',
        exerciseIndex: 0,
        roundIndex: state.roundIndex + 1,
        endsAt: now + plan.workSeconds * 1000,
      },
      shouldVibrate: true,
    };
  }

  if (state.phase === 'work') {
    const done = state.workDone + 1;
    if (done >= plan.series) {
      return {
        next: { ...state, phase: 'done', running: false, endsAt: null, workDone: done },
        shouldVibrate: true,
      };
    }
    return {
      next: { ...state, phase: 'rest', workDone: done, endsAt: now + plan.restSeconds * 1000 },
      shouldVibrate: true,
    };
  }

  return {
    next: { ...state, phase: 'work', endsAt: now + plan.workSeconds * 1000 },
    shouldVibrate: true,
  };
}

function catchUp(state: TimerState, plan: WorkoutPlan, now: number): { state: TimerState; steps: number } {
  let current = state;
  let steps = 0;
  let guard = 0;
  while (guard < 1000) {
    guard += 1;
    const result = onExpire(current, plan, now);
    if (result.next === current) {
      break;
    }
    current = result.next;
    steps += 1;
  }
  return { state: current, steps };
}

export function useWorkoutTimer(options: UseWorkoutTimerOptions) {
  const { plan, sessionId, exerciseId, day, muscleId, bodyPartId, bodyPartName } = options;

  const [state, setState] = useState<TimerState>(() => createInitialState(plan));
  const stateRef = useRef(state);
  // Marca el instante en que la app pasó a segundo plano (AppState != 'active')
  // para medir con precisión cuánto estuvo fuera al volver al primer plano.
  const backgroundedAtRef = useRef<number | null>(null);
  const [seconds, setSeconds] = useState<number>(() => computeSeconds(createInitialState(plan), Date.now()));

  const persistSnapshot = useCallback(
    (next: TimerState) => {
      const snapshot: TimerSnapshotData = {
        version: 1,
        savedAt: Date.now(),
        sessionId,
        exerciseId,
        day,
        muscleId,
        bodyPartId,
        bodyPartName,
        mode: plan.mode,
        series: plan.mode === 'circuit' ? plan.rounds : plan.series,
        reps: plan.mode === 'reps' ? plan.reps : 0,
        workSeconds:
          plan.mode === 'time' || plan.mode === 'circuit' ? plan.workSeconds : 0,
        restSeconds: plan.restSeconds,
        ...(plan.mode === 'circuit'
          ? {
              name: plan.name,
              rounds: plan.rounds,
              exercises: plan.exercises,
            }
          : {}),
        phase: next.phase,
        running: next.running,
        endsAt: next.endsAt,
        pausedRemainingMs: next.pausedRemainingMs,
        currentSeries: next.currentSeries,
        workDone: next.workDone,
        roundIndex: next.roundIndex,
        exerciseIndex: next.exerciseIndex,
        hasPlayedRestWarning: next.hasPlayedRestWarning,
        hasPlayedWorkWarning: next.hasPlayedWorkWarning,
        interrupted: next.interrupted,
        startTime: Date.now(),
        targetEndTime: next.endsAt,
      };
      void setItem(StorageKeys.WorkoutActiveTimer, snapshot);
    },
    [sessionId, exerciseId, day, muscleId, bodyPartId, bodyPartName, plan],
  );

  const commit = useCallback(
    (next: TimerState) => {
      stateRef.current = next;
      setState(next);
      setSeconds(computeSeconds(next, Date.now()));
      persistSnapshot(next);
    },
    [persistSnapshot],
  );

  const refreshSeconds = useCallback(() => {
    setSeconds(computeSeconds(stateRef.current, Date.now()));
  }, []);

  const handleExpiry = useCallback(
    (now: number) => {
      const current = stateRef.current;
      const result = onExpire(current, plan, now);
      if (result.next !== current) {
        if (result.shouldVibrate) {
          Vibration.vibrate(400);
        }
        commit(result.next);
      }
    },
    [plan, commit],
  );

  const handleCatchUp = useCallback(() => {
    const now = Date.now();
    const current = stateRef.current;
    const { state: caught, steps } = catchUp(current, plan, now);
    if (caught !== current) {
      if (steps === 1) {
        const result = onExpire(current, plan, now);
        if (result.shouldVibrate) {
          Vibration.vibrate(400);
        }
      }
      commit(caught);
    } else {
      refreshSeconds();
    }
  }, [plan, commit, refreshSeconds]);

  useEffect(() => {
    let active = true;
    (async () => {
      const raw = await getItem<TimerSnapshotData>(StorageKeys.WorkoutActiveTimer);
      if (!active) return;
      if (
        raw &&
        raw.version === 1 &&
        raw.sessionId === sessionId &&
        raw.exerciseId === exerciseId &&
        raw.savedAt >= Date.now() - STALE_MS
      ) {
        const restored: TimerState = {
          phase: raw.phase,
          running: raw.running,
          endsAt: raw.endsAt,
          pausedRemainingMs: raw.pausedRemainingMs,
          currentSeries: raw.currentSeries,
          workDone: raw.workDone,
          roundIndex: raw.roundIndex ?? 0,
          exerciseIndex: raw.exerciseIndex ?? 0,
          hasPlayedRestWarning: raw.hasPlayedRestWarning ?? false,
          hasPlayedWorkWarning: raw.hasPlayedWorkWarning ?? false,
          interrupted: false,
        };
        const restoredPlan: WorkoutPlan =
          raw.mode === 'reps'
            ? { mode: 'reps', series: raw.series, reps: raw.reps, restSeconds: raw.restSeconds }
            : raw.mode === 'circuit'
              ? {
                  mode: 'circuit',
                  name: raw.name,
                  exercises: raw.exercises ?? [],
                  rounds: raw.rounds ?? raw.series,
                  workSeconds: raw.workSeconds,
                  restSeconds: raw.restSeconds,
                }
              : {
                  mode: 'time',
                  series: raw.series,
                  workSeconds: raw.workSeconds,
                  restSeconds: raw.restSeconds,
                };
        const now = Date.now();
        // Si la sesión estuvo corriendo y la app salió hace más de 2 minutos,
        // no se congela el conteo ni se auto-avanza en silencio: se declara
        // interrumpida/pausada y el usuario decide continuar o reiniciar.
        const awayMs = now - raw.savedAt;
        let target: TimerState;
        if (restored.running && awayMs > INTERRUPT_DELAY_MS) {
          target = {
            ...restored,
            interrupted: true,
            running: false,
            endsAt: null,
          };
          void cancelScheduledWarnings();
        } else {
          const { state: caught, steps } = catchUp(restored, restoredPlan, now);
          target = caught;
          if (steps === 1) {
            const result = onExpire(restored, restoredPlan, now);
            if (result.shouldVibrate) {
              Vibration.vibrate(400);
            }
          }
        }
        stateRef.current = target;
        setState(target);
        setSeconds(computeSeconds(target, now));
        persistSnapshot(target);
      } else if (raw) {
        void removeItem(StorageKeys.WorkoutActiveTimer);
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionId, exerciseId, persistSnapshot]);

  useEffect(() => {
    const interval = setInterval(() => {
      handleExpiry(Date.now());
      refreshSeconds();
    }, 250);
    return () => clearInterval(interval);
  }, [handleExpiry, refreshSeconds]);

  // Avisos sonoros previos al cambio de fase (canal MÚSICA/MEDIA):
  // - Trabajo/ejercicio (modos Tiempo y Circuito): 5 s antes con playWorkWarningSound.
  // - Descanso (todos los modos): 7 s antes con playRestWarningSound.
  // Las banderas evitan repetirlos dentro de la misma fase y se reinician al
  // pasar a otra fase (o al terminar la sesión).
  useEffect(() => {
    const current = stateRef.current;
    let nextWork = current.hasPlayedWorkWarning;
    let nextRest = current.hasPlayedRestWarning;

    if (current.phase === 'work' && plan.mode !== 'reps') {
      if (seconds <= 5 && seconds > 2 && !nextWork) {
        playWorkWarningSound();
        nextWork = true;
      }
    } else {
      nextWork = false;
    }

    if (current.phase === 'rest') {
      if (seconds <= 7 && seconds > 5 && !nextRest) {
        playRestWarningSound();
        nextRest = true;
      }
    } else {
      nextRest = false;
    }

    if (nextWork !== current.hasPlayedWorkWarning || nextRest !== current.hasPlayedRestWarning) {
      commit({ ...current, hasPlayedWorkWarning: nextWork, hasPlayedRestWarning: nextRest });
    }
  }, [state.phase, seconds, plan.mode, commit]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (appState) => {
      if (appState === 'active') {
        const backgroundedAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        const current = stateRef.current;
        // Volvió al primer plano tras estar fuera >2 min con el conteo activo:
        // igual que en el arranque, la sesión se declara pausada/interrumpida y
        // el usuario decide (retomar en vivo o reiniciar). Si fue ≤2 min, el
        // tiempo avanza en tiempo real con catchUp.
        if (
          backgroundedAt != null &&
          current.running &&
          current.phase !== 'done' &&
          !current.interrupted &&
          Date.now() - backgroundedAt > INTERRUPT_DELAY_MS
        ) {
          commit({ ...current, interrupted: true, running: false, endsAt: null });
          void cancelScheduledWarnings();
          return;
        }
        handleCatchUp();
      } else {
        backgroundedAtRef.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [handleCatchUp, commit]);

  useEffect(() => {
    const current = stateRef.current;
    const endsAt = current.endsAt;
    const now = Date.now();
    if (current.running && endsAt != null && endsAt > now) {
      void (async () => {
        await ensureNotificationPermission();
        await scheduleWorkoutWarnings(endsAt);
      })();
    } else {
      void cancelScheduledWarnings();
    }
  }, [state.phase, state.running, state.endsAt, state.pausedRemainingMs, state.currentSeries, state.workDone]);

  useEffect(
    () => () => {
      void cancelScheduledWarnings();
    },
    [],
  );

  const clearTimer = useCallback(() => {
    void cancelScheduledWarnings();
    void removeItem(StorageKeys.WorkoutActiveTimer);
  }, []);

  const startRest = useCallback(() => {
    if (plan.mode !== 'reps') return;
    const now = Date.now();
    commit({
      ...stateRef.current,
      phase: 'rest',
      running: true,
      endsAt: now + plan.restSeconds * 1000,
      pausedRemainingMs: 0,
    });
  }, [plan, commit]);

  const skipRest = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'rest') return;
    const forced = { ...current, endsAt: Date.now() };
    const result = onExpire(forced, plan, Date.now());
    if (result.next !== forced) {
      if (result.shouldVibrate) {
        Vibration.vibrate(400);
      }
      commit(result.next);
    }
  }, [plan, commit]);

  // La sesión estuvo interrumpida (>2 min fuera): retoma "en vivo" avanzando
  // la fase con el tiempo real transcurrido (trabajo → descanso → …).
  const resumeAfterInterruption = useCallback(() => {
    const now = Date.now();
    const current = stateRef.current;
    if (!current.interrupted) return;
    const { state: caught, steps } = catchUp(current, plan, now);
    const resumed = { ...caught, interrupted: false };
    if (steps === 1) {
      const result = onExpire(current, plan, now);
      if (result.shouldVibrate) {
        Vibration.vibrate(400);
      }
    }
    commit(resumed);
  }, [plan, commit]);

  // Reinicia la sesión completa desde cero (serie/trabajo inicial).
  const restartAfterInterruption = useCallback(() => {
    commit(createInitialState(plan));
  }, [plan, commit]);

  const togglePause = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'work' && current.phase !== 'rest') return;
    const now = Date.now();
    if (current.running && current.endsAt != null) {
      commit({
        ...current,
        running: false,
        endsAt: null,
        pausedRemainingMs: Math.max(0, current.endsAt - now),
      });
    } else {
      const remaining = Math.max(1, current.pausedRemainingMs || 0);
      commit({ ...current, running: true, endsAt: now + remaining, pausedRemainingMs: 0 });
    }
  }, [commit]);

  return {
    phase: state.phase,
    running: state.running,
    currentSeries: state.currentSeries,
    workDone: state.workDone,
    roundIndex: state.roundIndex,
    exerciseIndex: state.exerciseIndex,
    seconds,
    interrupted: state.interrupted,
    startRest,
    skipRest,
    togglePause,
    resumeAfterInterruption,
    restartAfterInterruption,
    clearTimer,
  };
}