import type { DayOfWeek, MuscleExercise, WorkoutPlan } from '../types/workout';

export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  MainTabs: undefined;
};

export type MainTabParamList = {
  Rutina: undefined;
  Ejercicios: undefined;
  Progreso: undefined;
  Comida: undefined;
  Ajustes: undefined;
};

export type MusclePanelParams = {
  day: DayOfWeek;
  muscleId: number;
  bodyPartId: number;
  bodyPartName: string;
};

export type RutinaStackParamList = {
  RutinaHome: undefined;
  MusclePanel: MusclePanelParams;
  ExerciseConfig: MusclePanelParams & {
    exercise: MuscleExercise;
    sessionId: number;
  };
  WorkoutActive: MusclePanelParams & {
    exercise: MuscleExercise;
    sessionId: number;
    plan: WorkoutPlan;
  };
};
