export const MIN_WEIGHT_GOAL_AGE = 18;
export const MIN_TARGET_BMI = 18.5;
export const MAX_WEEKLY_LOSS_KG = 0.75;
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
  heightCm: number;
  age: number;
}

export function validateGoal({
  currentWeightKg,
  targetWeightKg,
  weeks,
  heightCm,
  age,
}: GoalInput): GoalValidationResult {
  if (!Number.isFinite(age) || age < MIN_WEIGHT_GOAL_AGE || age > 100) {
    return { isValid: false, message: 'Esta app de metas nutricionales está diseñada para personas adultas (18+). Pide orientación profesional para menores de edad.' };
  }
  if (!Number.isFinite(heightCm) || heightCm < 120 || heightCm > 250) {
    return { isValid: false, message: 'Ingresa una estatura válida para revisar la seguridad de tu meta.' };
  }
  if (![currentWeightKg, targetWeightKg].every((weight) => Number.isFinite(weight) && weight >= 30 && weight <= 350)) {
    return { isValid: false, message: 'Los pesos deben estar entre 30 y 350 kg.' };
  }
  const heightM = heightCm / 100;
  const currentBmi = currentWeightKg / (heightM * heightM);
  const targetBmi = targetWeightKg / (heightM * heightM);
  if (targetBmi < MIN_TARGET_BMI) {
    return { isValid: false, message: `Ese peso objetivo queda por debajo del IMC adulto de referencia (${MIN_TARGET_BMI}). Elige una meta mayor o consúltala con un profesional.` };
  }
  if (currentBmi < MIN_TARGET_BMI && targetWeightKg < currentWeightKg) {
    return { isValid: false, message: 'Tu peso actual ya está por debajo del IMC adulto de referencia. La app no recomienda una meta de pérdida; consulta a un profesional.' };
  }
  if (!Number.isFinite(weeks) || weeks <= 0 || weeks > 104) {
    return {
      isValid: false,
      message: 'El plazo debe estar entre 1 y 104 semanas.',
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
  const maxAllowed = losing
    ? Math.min(MAX_WEEKLY_LOSS_KG, currentWeightKg * 0.0075)
    : Math.min(MAX_WEEKLY_GAIN_KG, currentWeightKg * 0.005);
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
