export type DayOfWeek = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

export const DAYS_ORDER: DayOfWeek[] = [
  'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  lunes: 'Lun',
  martes: 'Mar',
  miercoles: 'Mié',
  jueves: 'Jue',
  viernes: 'Vie',
  sabado: 'Sáb',
  domingo: 'Dom',
};

export interface WeeklyScheduleEntry {
  id: number;
  day_of_week: DayOfWeek;
  body_part_id: number | null;
  body_part_name: string | null;
}

export interface DayMuscle {
  id: number;
  day_of_week: DayOfWeek;
  body_part_id: number;
  body_part_name: string;
  position: number;
  completed: number;
  completed_date: string | null;
  isCompleted: boolean;
}

export interface MuscleExercise {
  id: number;
  name: string;
  equipment: string | null;
  mode?: 'reps' | 'time' | null;
  lastWeightKg: number | null;
  avgWeightKg: number | null;
}

export interface DayExercise {
  id: number;
  day_of_week: DayOfWeek;
  body_part_id: number;
  exercise_id: number;
  exercise_name: string;
  equipment: string | null;
  mode?: 'reps' | 'time' | null;
  position: number;
}

export interface WorkoutSession {
  id: number;
  day_of_week: DayOfWeek;
  date: string;
  session_type?: 'routine' | 'casual';
  note?: string | null;
  completed: number;
  calories_burned?: number;
  created_at?: string;
}

export type SetType = 'reps' | 'time';

export interface RepsPlan {
  mode: 'reps';
  series: number;
  reps: number;
  restSeconds: number;
}

export interface TimePlan {
  mode: 'time';
  series: number;
  workSeconds: number;
  restSeconds: number;
}

export interface CircuitExercise {
  exerciseId: number;
  name: string;
}

export interface CircuitPlan {
  mode: 'circuit';
  name?: string;
  exercises: CircuitExercise[];
  rounds: number;
  workSeconds: number;
  restSeconds: number;
}

export interface WorkoutCircuit {
  id: number;
  day_of_week: DayOfWeek;
  body_part_id: number;
  name: string;
  work_seconds: number;
  rest_seconds: number;
  rounds: number;
  exercises_json: string;
}

export type WorkoutPlan = RepsPlan | TimePlan | CircuitPlan;

export interface WorkoutSet {
  id: number;
  session_id: number;
  exercise_id: number;
  exercise_name: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  set_type?: SetType;
  time_seconds?: number | null;
  rest_seconds?: number | null;
}

export interface WorkoutSetInput {
  exercise_id: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  set_type?: SetType;
  time_seconds?: number | null;
  rest_seconds?: number | null;
}

export interface ExerciseWithSets {
  exercise_id: number;
  exercise_name: string;
  body_part_id: number;
  body_part_name: string;
  equipment: string | null;
  sets: WorkoutSet[];
}
