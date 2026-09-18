import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getNutritionDayData,
  getCaloriasPeriodoResumen,
  addMealLog,
  deleteMealLog,
  saveNutritionProfile,
} from '../services/nutritionService';
import { useLoadOnMount } from './useLoadOnMount';
import type {
  CaloriasPeriodoResumen,
  NutritionDayData,
  NewMealLog,
  NutritionProfileInput,
} from '../types/nutrition';

export interface NutritionDataApi {
  data: NutritionDayData | null;
  period: CaloriasPeriodoResumen | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<NutritionDayData | null>;
  saveMeal: (meal: NewMealLog) => Promise<void>;
  removeMeal: (id: number) => Promise<void>;
  saveProfile: (profile: NutritionProfileInput) => Promise<void>;
}

export function useNutritionData(userId: string, date: string): NutritionDataApi {
  const loader = useCallback(
    () =>
      userId
        ? Promise.all([
            getNutritionDayData(userId, date),
            getCaloriasPeriodoResumen(userId, date),
          ]).then(([dayData, period]) => ({ dayData, period }))
        : Promise.resolve(null),
    [userId, date],
  );

  const { data: loaded, loading, error, reload } = useLoadOnMount<
    { dayData: NutritionDayData; period: CaloriasPeriodoResumen } | null
  >(loader, [userId, date]);

  const data = loaded?.dayData ?? null;
  const period = loaded?.period ?? null;

  const refresh = useCallback(async () => {
    const result = await reload();
    return result?.dayData ?? null;
  }, [reload]);

  const saveMeal = useCallback(
    async (meal: NewMealLog) => {
      try {
        await addMealLog(meal);
        await refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'No se pudo registrar la comida.';
        Alert.alert('Error', message);
      }
    },
    [refresh],
  );

  const removeMeal = useCallback(
    async (id: number) => {
      try {
        await deleteMealLog(id);
        await refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'No se pudo eliminar la comida.';
        Alert.alert('Error', message);
      }
    },
    [refresh],
  );

  const saveProfile = useCallback(
    async (profile: NutritionProfileInput) => {
      try {
        await saveNutritionProfile(userId, profile);
        await refresh();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'No se pudo guardar la meta de calorías.';
        Alert.alert('Error', message);
      }
    },
    [userId, refresh],
  );

  return { data, period, loading, error, reload: refresh, saveMeal, removeMeal, saveProfile };
}