import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  getGoalSummary,
  getWeightHistory,
  addWeightLog,
  updateWeightLog,
  deleteWeightLog,
  getStrengthExerciseRecords,
  getMuscleProgressHistory,
} from '../services/progressService';
import { getAllBodyParts } from '../services/exerciseService';
import type {
  GoalSummary,
  WeightLog,
  NewWeightLog,
  ExerciseStrengthRecord,
  MuscleSessionPoint,
} from '../types/progress';
import type { BodyPart } from '../types/exercise';

export interface ProgressData {
  summary: GoalSummary | null;
  weightLogs: WeightLog[];
  strengthRecords: ExerciseStrengthRecord[];
  bodyParts: BodyPart[];
  selectedMuscleGroupId: number | null;
  setSelectedMuscleGroupId: (id: number | null) => void;
  muscleSessionHistory: MuscleSessionPoint[];
  selectedExerciseId: number | null;
  setSelectedExerciseId: (id: number | null) => void;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  saveWeight: (data: NewWeightLog, id?: number) => Promise<void>;
  removeWeight: (id: number) => Promise<void>;
}

export function useProgressData(userId: number): ProgressData {
  const [summary, setSummary] = useState<GoalSummary | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [strengthRecords, setStrengthRecords] = useState<ExerciseStrengthRecord[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [selectedMuscleGroupId, setSelectedMuscleGroupId] = useState<number | null>(null);
  const [muscleSessionHistory, setMuscleSessionHistory] = useState<MuscleSessionPoint[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const loadData = useCallback(
    async (silent: boolean) => {
      if (!userId) {
        return;
      }
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const [goal, logs, records, parts] = await Promise.all([
          getGoalSummary(userId),
          getWeightHistory(),
          getStrengthExerciseRecords(),
          getAllBodyParts(),
        ]);
        if (!mounted.current) {
          return;
        }
        setSummary(goal);
        setWeightLogs(logs);
        setStrengthRecords(records);
        setBodyParts(parts);
        setSelectedMuscleGroupId((prev) => {
          if (parts.length === 0) {
            return null;
          }
          if (prev && parts.some((bp) => bp.id === prev)) {
            return prev;
          }
          return parts[0].id;
        });
        setSelectedExerciseId((prev) => {
          if (records.length === 0) {
            return null;
          }
          if (prev && records.some((r) => r.exerciseId === prev)) {
            return prev;
          }
          return records[0].exerciseId;
        });
        setRefreshKey((k) => k + 1);
      } catch (e) {
        if (!silent && mounted.current) {
          setError(e instanceof Error ? e.message : 'No se pudieron cargar tus datos.');
        }
      } finally {
        if (!silent && mounted.current) {
          setLoading(false);
        }
      }
    },
    [userId],
  );

  const reload = useCallback(() => loadData(false), [loadData]);
  const refresh = useCallback(() => loadData(true), [loadData]);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    setMuscleSessionHistory([]);
    if (selectedMuscleGroupId === null) {
      return;
    }
    getMuscleProgressHistory(selectedMuscleGroupId)
      .then((points) => {
        if (!cancelled) {
          setMuscleSessionHistory(points);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMuscleSessionHistory([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedMuscleGroupId, refreshKey]);

  const saveWeight = useCallback(
    async (data: NewWeightLog, id?: number) => {
      try {
        if (id) {
          await updateWeightLog(id, data);
        } else {
          await addWeightLog(data);
        }
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'No se pudo registrar el peso.';
        Alert.alert('Error', message);
      }
    },
    [reload],
  );

  const removeWeight = useCallback(
    async (id: number) => {
      try {
        await deleteWeightLog(id);
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'No se pudo eliminar el registro.';
        Alert.alert('Error', message);
      }
    },
    [reload],
  );

  return {
    summary,
    weightLogs,
    strengthRecords,
    bodyParts,
    selectedMuscleGroupId,
    setSelectedMuscleGroupId,
    muscleSessionHistory,
    selectedExerciseId,
    setSelectedExerciseId,
    loading,
    error,
    reload,
    refresh,
    saveWeight,
    removeWeight,
  };
}