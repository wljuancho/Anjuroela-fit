export const MAX_WEEKLY_LOSS_KG = 1.0;
export const MAX_WEEKLY_GAIN_KG = 0.5;

export interface GoalValidationResult {
  isValid: boolean;
  message?: string;
  suggestedGoalKg?: number;
  suggestedWeekKg?: number;
}

export interface GoalInput {
  currentWeightKg: number;
  targetWeightKg: number;
  weeks: number;
}

export function validateGoal({
  currentWeightKg,
  targetWeightKg,
  weeks,
}: GoalInput): GoalValidationResult {
  if (weeks <= 0) {
    return {
      isValid: false,
      message: 'El plazo debe ser mayor a 0 semanas.',
    };
  }

  const diff = currentWeightKg - targetWeightKg;

  if (Math.abs(diff) < 0.01) {
    return {
      isValid: true,
      message: 'El peso objetivo coincide con el peso actual. No se requiere cambio.',
    };
  }

  const losing = diff > 0;
  const maxAllowed = losing ? MAX_WEEKLY_LOSS_KG : MAX_WEEKLY_GAIN_KG;
  const weeklyRate = Math.abs(diff) / weeks;

  if (weeklyRate <= maxAllowed) {
    return { isValid: true };
  }

  const suggestedWeekKg = maxAllowed;
  const suggestedGoalKg = losing
    ? currentWeightKg - maxAllowed * weeks
    : currentWeightKg + maxAllowed * weeks;

  return {
    isValid: false,
    message: `Esta meta no es realista de forma saludable para el plazo seleccionado. Para este periodo te sugerimos un objetivo razonable de ${suggestedGoalKg.toFixed(1)} kg.`,
    suggestedGoalKg,
    suggestedWeekKg,
  };
}
