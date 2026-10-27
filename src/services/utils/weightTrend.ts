import type { GoalDirection, WeightLog } from '../../types/progress';

export interface WeightTrend {
  changeKgPerWeek: number;
  recentAverageKg: number;
  previousAverageKg: number;
  direction: 'down' | 'up' | 'stable';
}

/** Compara dos ventanas consecutivas de 14 días y evita inferir con muy pocos pesajes. */
export function calculateWeightTrend(logs: WeightLog[]): WeightTrend | null {
  const valid = logs
    .filter((log) => Number.isFinite(log.weight_kg) && /^\d{4}-\d{2}-\d{2}$/.test(log.date))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!valid.length) return null;

  const anchor = new Date(`${valid[0].date}T12:00:00Z`).getTime();
  const dayMs = 86_400_000;
  const recent: number[] = [];
  const previous: number[] = [];
  for (const log of valid) {
    const ageDays = Math.floor((anchor - new Date(`${log.date}T12:00:00Z`).getTime()) / dayMs);
    if (ageDays >= 0 && ageDays < 14) recent.push(log.weight_kg);
    else if (ageDays >= 14 && ageDays < 28) previous.push(log.weight_kg);
  }
  if (recent.length < 2 || previous.length < 2) return null;

  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const recentAverageKg = average(recent);
  const previousAverageKg = average(previous);
  const changeKgPerWeek = (recentAverageKg - previousAverageKg) / 2;
  const stableThreshold = Math.max(0.1, recentAverageKg * 0.0015);

  return {
    changeKgPerWeek: Math.round(changeKgPerWeek * 100) / 100,
    recentAverageKg: Math.round(recentAverageKg * 10) / 10,
    previousAverageKg: Math.round(previousAverageKg * 10) / 10,
    direction:
      Math.abs(changeKgPerWeek) <= stableThreshold
        ? 'stable'
        : changeKgPerWeek < 0
          ? 'down'
          : 'up',
  };
}

export function getWeightTrendGuidance(
  trend: WeightTrend,
  goal: GoalDirection,
): string {
  if (!goal) return 'Registra tu meta para interpretar esta tendencia en contexto.';
  if (goal === 'maintain') {
    return trend.direction === 'stable'
      ? 'La tendencia está estable, en línea con mantener. Continúa observando el promedio.'
      : 'Tu peso muestra una tendencia de cambio. Revisa el periodo completo antes de modificar tu plan.';
  }
  const movingTowardGoal =
    (goal === 'lose' && trend.direction === 'down') ||
    (goal === 'gain' && trend.direction === 'up');
  if (movingTowardGoal) {
    return 'La tendencia va en la dirección de tu meta. Mantén hábitos sostenibles; no hace falta ajustar por un pesaje aislado.';
  }
  if (trend.direction === 'stable') {
    return 'La tendencia está estable. Revisa que tus registros estén completos y evalúa varias semanas antes de cambiar el plan.';
  }
  return 'La tendencia no va hacia tu meta. Revisa tus registros y la constancia del plan; evita compensar con cambios extremos.';
}
