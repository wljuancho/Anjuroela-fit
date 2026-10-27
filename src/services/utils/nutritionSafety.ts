import type { NutritionGoalType } from '../../types/nutrition';

export const MIN_DAILY_CALORIES_GOAL = 1200;
export const MAX_DAILY_CALORIES_GOAL = 6000;
export const ADULT_REFERENCE_BMI = 18.5;
export const MIN_NUTRITION_GOAL_AGE = 18;

export interface CalorieGoalInput {
  calories: number;
  age: number;
  heightCm: number;
  weightKg: number;
  goalType: NutritionGoalType;
}

export function validateCalorieGoal(input: CalorieGoalInput): string | null {
  const { calories, age, heightCm, weightKg, goalType } = input;
  if (!Number.isFinite(age) || age < MIN_NUTRITION_GOAL_AGE || age > 100) return `Esta meta requiere ${MIN_NUTRITION_GOAL_AGE} años o más; está diseñada para personas adultas.`;
  if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 250) return 'Ingresa una estatura válida para calcular tu meta.';
  if (!Number.isFinite(weightKg) || weightKg < 30 || weightKg > 350) return 'Ingresa un peso válido para calcular tu meta.';
  if (!Number.isFinite(calories) || calories < MIN_DAILY_CALORIES_GOAL || calories > MAX_DAILY_CALORIES_GOAL) {
    return `La meta debe estar entre ${MIN_DAILY_CALORIES_GOAL} y ${MAX_DAILY_CALORIES_GOAL} kcal. Para un objetivo distinto, consulta con un profesional.`;
  }
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  if (goalType === 'perder' && bmi < ADULT_REFERENCE_BMI) {
    return 'Con estos datos no podemos recomendar una meta para perder peso. Consulta con un profesional.';
  }
  return null;
}
