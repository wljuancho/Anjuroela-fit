export type ActivityLevel = 'sedentario' | 'moderado' | 'activo';

export type NutritionGoalType = 'perder' | 'ganar' | 'mantener' | 'libre';

export type PlanMealType = 'desayuno' | 'almuerzo' | 'cena' | 'snack';

export interface NutritionProfile {
  userId: string;
  dailyCaloriesGoal: number;
  activityLevel: ActivityLevel;
  goalType: NutritionGoalType;
  updatedAt?: string;
}

export interface NutritionProfileInput {
  dailyCaloriesGoal: number;
  activityLevel: ActivityLevel;
  goalType: NutritionGoalType;
  age?: number;
  heightCm?: number;
}

export interface DailyCalories {
  id: number;
  date: string;
  calories_consumed: number;
  logged_at?: string;
}

export interface MealLog {
  id: number;
  date: string;
  meal_name: string;
  calories: number;
  photo_uri?: string | null;
  created_at?: string;
}

export interface NewMealLog {
  date: string;
  meal_name: string;
  calories: number;
  photo_uri?: string | null;
}

export interface NutritionEstimate {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealName?: string;
  description?: string;
  confidence?: 'alta' | 'media' | 'baja';
  notes?: string;
}

export interface NutritionDayData {
  date: string;
  caloriesConsumed: number;
  goal: number | null;
  remaining: number | null;
  percentage: number;
  meals: MealLog[];
}

export interface CaloriasPeriodoResumen {
  weekConsumed: number;
  weekDays: number;
  monthConsumed: number;
  monthDays: number;
  goal: number | null;
}

export interface MealIngredient {
  name: string;
  amount: string;
}

export interface WeeklyMealPlanItem {
  id: number;
  day_of_week: string;
  date: string;
  meal_type: PlanMealType;
  title: string;
  description: string | null;
  recipe: string | null;
  ingredients_list: MealIngredient[];
  servings_count: number;
  expires_at: string;
}