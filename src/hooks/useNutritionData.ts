import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getNutritionDayData,
  addMealLog,
  deleteMealLog,
  saveNutritionProfile,
} from '../services/nutritionService';
import { useLoadOnMount } from './useLoadOnMount';
import type { NutritionDayData, NewMealLog, NutritionProfileInput } from '../types/nutrition';

export interface NutritionDataApi {
  data: NutritionDayData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<NutritionDayData | null>;
  saveMeal: (meal: NewMealLog) => Promise<void>;
  removeMeal: (id: number) => Promise<void>;
  saveProfile: (profile: NutritionProfileInput) => Promise<void>;
}

export function useNutritionData(userId: string, date: string): NutritionDataApi {
  const loader = useCallback(
    () => (userId ? getNutritionDayData(userId, date) : Promise.resolve(null)),
    [userId, date],
  );

  const { data, loading, error, reload } = useLoadOnMount<NutritionDayData>(loader, [userId, date]);

  const saveMeal = useCallback(
    async (meal: NewMealLog) => {
      try {
        await addMealLog(meal);
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'No se pudo registrar la comida.';
        Alert.alert('Error', message);
      }
    },
    [reload],
  );

  const removeMeal = useCallback(
    async (id: number) => {
      try {
        await deleteMealLog(id);
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'No se pudo eliminar la comida.';
        Alert.alert('Error', message);
      }
    },
    [reload],
  );

  const saveProfile = useCallback(
    async (profile: NutritionProfileInput) => {
      try {
        await saveNutritionProfile(userId, profile);
        await reload();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'No se pudo guardar la meta de calorías.';
        Alert.alert('Error', message);
      }
    },
    [userId, reload],
  );

  return { data, loading, error, reload, saveMeal, removeMeal, saveProfile };
}