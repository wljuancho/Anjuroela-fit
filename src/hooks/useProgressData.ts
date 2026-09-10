import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  getGoalSummary,
  getWeightHistory,
  addWeightLog,
  updateWeightLog,
  deleteWeightLog,
  getStrengthExerciseRecords,
} from '../services/progressService';
import type {
  GoalSummary,
  WeightLog,
  NewWeightLog,
  ExerciseStrengthRecord,
} from '../types/progress';

export interface ProgressData {
  summary: GoalSummary | null;
  weightLogs: WeightLog[];
  strengthRecords: ExerciseStrengthRecord[];
  selectedExerciseId: number | null;
  setSelectedExerciseId: (id: number | null) => void;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  saveWeight: (data: NewWeightLog, id?: number) => Promise<void>;
  removeWeight: (id: number) => Promise<void>;
}

export function useProgressData(userId: number): ProgressData {
  const [summary, setSummary] = useState<GoalSummary | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [strengthRecords, setStrengthRecords] = useState<ExerciseStrengthRecord[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    if (!userId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [goal, logs, records] = await Promise.all([
        getGoalSummary(userId),
        getWeightHistory(),
        getStrengthExerciseRecords(),
      ]);
      if (!mounted.current) {
        return;
      }
      setSummary(goal);
      setWeightLogs(logs);
      setStrengthRecords(records);
      setSelectedExerciseId((prev) => {
        if (records.length === 0) {
          return null;
        }
        if (prev && records.some((r) => r.exerciseId === prev)) {
          return prev;
        }
        return records[0].exerciseId;
      });
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'No se pudieron cargar tus datos.');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

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
    selectedExerciseId,
    setSelectedExerciseId,
    loading,
    error,
    reload,
    saveWeight,
    removeWeight,
  };
}