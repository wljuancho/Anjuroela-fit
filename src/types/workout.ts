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

export interface WorkoutSession {
  id: number;
  day_of_week: DayOfWeek;
  date: string;
  completed: number;
  created_at?: string;
}

export interface WorkoutSet {
  id: number;
  session_id: number;
  exercise_id: number;
  exercise_name: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
}

export interface WorkoutSetInput {
  exercise_id: number;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
}

export interface ExerciseWithSets {
  exercise_id: number;
  exercise_name: string;
  body_part_name: string;
  equipment: string | null;
  sets: WorkoutSet[];
}
