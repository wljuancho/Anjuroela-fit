import { useCallback } from 'react';
import { Alert } from 'react-native';
import { getDailySummary, addMeal, updateMeal, deleteMeal } from '../services/mealService';
import { useLoadOnMount } from './useLoadOnMount';
import type { DailyMealSummary, NewMeal } from '../types/meal';

export interface NutritionLogs {
  summary: DailyMealSummary | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<DailyMealSummary | null>;
  saveMeal: (data: NewMeal, id?: number) => Promise<void>;
  removeMeal: (id: number) => Promise<void>;
}

export function useNutritionLogs(userId: number, date: string): NutritionLogs {
  const loader = useCallback(
    () => (userId ? getDailySummary(userId, date) : Promise.resolve(null)),
    [userId, date],
  );

  const { data: summary, loading, error, reload } = useLoadOnMount<DailyMealSummary>(
    loader,
    [userId, date],
  );

  const saveMeal = useCallback(
    async (data: NewMeal, id?: number) => {
      try {
        if (id) {
          await updateMeal(id, data);
        } else {
          await addMeal(data);
        }
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'No se pudo guardar la comida.';
        Alert.alert('Error', message);
      }
    },
    [reload],
  );

  const removeMeal = useCallback(
    async (id: number) => {
      try {
        await deleteMeal(id);
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'No se pudo eliminar la comida.';
        Alert.alert('Error', message);
      }
    },
    [reload],
  );

  return { summary, loading, error, reload, saveMeal, removeMeal };
}