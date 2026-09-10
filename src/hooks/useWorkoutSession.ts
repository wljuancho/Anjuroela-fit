import { useCallback, useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Alert } from 'react-native';
import {
  initWorkoutData,
  getWeeklySchedule,
  updateScheduleDay,
  getOrCreateSession,
  completeSession,
  upsertSets,
  getExercisesForBodyPart,
} from '../services/workoutService';
import { getAllBodyParts } from '../services/exerciseService';
import type { BodyPart } from '../types/exercise';
import type {
  DayOfWeek,
  WeeklyScheduleEntry,
  WorkoutSetInput,
} from '../types/workout';
import { DAYS_ORDER } from '../types/workout';

export interface SessionExercise {
  id: number;
  name: string;
  equipment: string | null;
}

export interface WorkoutSessionData {
  schedule: WeeklyScheduleEntry[];
  selectedDay: DayOfWeek;
  setSelectedDay: (day: DayOfWeek) => void;
  bodyParts: BodyPart[];
  sessionExercises: SessionExercise[];
  completedDays: DayOfWeek[];
  setsMap: Map<number, WorkoutSetInput[]>;
  loading: boolean;
  saving: boolean;
  setSetsMap: Dispatch<SetStateAction<Map<number, WorkoutSetInput[]>>>;
  handleSaveWorkout: () => Promise<void>;
  saveDayEdit: (day: DayOfWeek, bodyPartId: number | null) => Promise<void>;
}

function getTodayDayOfWeek(): DayOfWeek {
  const jsDay = new Date().getDay();
  return DAYS_ORDER[jsDay === 0 ? 6 : jsDay - 1];
}

export function useWorkoutSession(): WorkoutSessionData {
  const [schedule, setSchedule] = useState<WeeklyScheduleEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getTodayDayOfWeek);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [completedDays, setCompletedDays] = useState<DayOfWeek[]>([]);
  const [setsMap, setSetsMap] = useState<Map<number, WorkoutSetInput[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSchedule = useCallback(async () => {
    await initWorkoutData();
    const s = await getWeeklySchedule();
    setSchedule(s);
    const bp = await getAllBodyParts();
    setBodyParts(bp);
    return s;
  }, []);

  const loadDayExercises = useCallback(
    async (day: DayOfWeek, scheduleData?: WeeklyScheduleEntry[]) => {
      const s = scheduleData ?? schedule;
      const entry = s.find((e) => e.day_of_week === day);
      if (!entry?.body_part_id) {
        setSessionExercises([]);
        setSessionId(null);
        setSetsMap(new Map());
        return;
      }
      const exercises = await getExercisesForBodyPart(entry.body_part_id);
      setSessionExercises(exercises);
      const session = await getOrCreateSession(day);
      setSessionId(session.id);
      const initialMap = new Map<number, WorkoutSetInput[]>();
      for (const ex of exercises) {
        if (!initialMap.has(ex.id)) {
          initialMap.set(ex.id, []);
        }
      }
      setSetsMap(initialMap);
    },
    [schedule],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const s = await loadSchedule();
        if (active) {
          await loadDayExercises(getTodayDayOfWeek(), s);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [loadSchedule]);

  useEffect(() => {
    loadDayExercises(selectedDay);
  }, [selectedDay, loadDayExercises]);

  const handleSaveWorkout = useCallback(async () => {
    if (!sessionId) {
      Alert.alert('Sin ejercicio', 'No hay ejercicios para guardar este día.');
      return;
    }
    const allSets: WorkoutSetInput[] = [];
    for (const [, sets] of setsMap) {
      allSets.push(...sets);
    }
    if (allSets.length === 0) {
      Alert.alert('Sin series', 'Añade al menos una serie para guardar.');
      return;
    }
    setSaving(true);
    try {
      await upsertSets(sessionId, allSets);
      await completeSession(sessionId);
      setCompletedDays((prev) => {
        if (prev.includes(selectedDay)) {
          return prev;
        }
        return [...prev, selectedDay];
      });
      Alert.alert('Guardado', 'Entrenamiento registrado correctamente.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo guardar el entrenamiento.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  }, [sessionId, setsMap, selectedDay]);

  const saveDayEdit = useCallback(
    async (day: DayOfWeek, bodyPartId: number | null) => {
      try {
        await updateScheduleDay(day, bodyPartId);
        const s = await loadSchedule();
        if (day === selectedDay) {
          await loadDayExercises(day, s);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'No se pudo actualizar el día.';
        Alert.alert('Error', message);
      }
    },
    [selectedDay, loadSchedule, loadDayExercises],
  );

  return {
    schedule,
    selectedDay,
    setSelectedDay,
    bodyParts,
    sessionExercises,
    completedDays,
    setsMap,
    setSetsMap,
    loading,
    saving,
    handleSaveWorkout,
    saveDayEdit,
  };
}