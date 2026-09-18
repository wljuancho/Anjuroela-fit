import type { NavigatorScreenParams } from '@react-navigation/native';
import type { DayOfWeek, MuscleExercise, WorkoutPlan } from '../types/workout';

export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  Tutorial: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Perfil: undefined;
};

export type MainTabParamList = {
  Rutina: undefined;
  Ejercicios: undefined;
  Progreso: undefined;
  Comida: undefined;
  Entrenador: undefined;
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
    muscleExercises?: MuscleExercise[];
    sessionType?: 'routine' | 'casual';
  };
  WorkoutActive: MusclePanelParams & {
    exercise: MuscleExercise;
    sessionId: number;
    plan: WorkoutPlan;
    sessionType?: 'routine' | 'casual';
  };
  CasualWorkout: {
    sessionId?: number;
  };
};
