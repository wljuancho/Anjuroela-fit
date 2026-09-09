export interface WeightLog {
  id: number;
  date: string;
  weight_kg: number;
  notes?: string | null;
  created_at?: string;
}

export interface NewWeightLog {
  date: string;
  weight_kg: number;
  notes?: string;
}

export type GoalDirection = 'lose' | 'gain' | 'maintain' | null;

export interface GoalSummary {
  initialWeight: number | null;
  currentWeight: number | null;
  targetWeight: number | null;
  goalDate: string | null;
  goalWeeks: number | null;
  differenceRemaining: number | null;
  progressPercent: number | null;
  direction: GoalDirection;
}

export interface StrengthHistoryEntry {
  date: string;
  maxWeightKg: number | null;
}

export interface ExerciseStrengthRecord {
  exerciseId: number;
  exerciseName: string;
  bodyPartName: string;
  history: StrengthHistoryEntry[];
}