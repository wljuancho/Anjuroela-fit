export type ActivityLevel = 'sedentario' | 'ligero' | 'moderado' | 'activo';

// Sexo biológico usado por la fórmula Mifflin-St Jeor para el BMR.
export type SexForFormula = 'male' | 'female' | 'not_specified';

export type NutritionGoalType = 'perder' | 'ganar' | 'mantener' | 'libre';

export type PlanMealType = 'desayuno' | 'almuerzo' | 'cena' | 'snack';

export interface NutritionProfile {
  userId: string;
  dailyCaloriesGoal: number;
  activityLevel: ActivityLevel;
  goalType: NutritionGoalType;
  sexForFormula?: SexForFormula;
  updatedAt?: string;
}

export interface NutritionProfileInput {
  dailyCaloriesGoal: number;
  activityLevel: ActivityLevel;
  goalType: NutritionGoalType;
  age?: number;
  heightCm?: number;
  sexForFormula?: SexForFormula;
}

export interface DailyCalories {
  id: number;
  date: string;
  calories_consumed: number;
  calories_burned?: number;
  user_id?: string | null;
  logged_at?: string;
}

export interface MealLog {
  id: number;
  date: string;
  meal_name: string;
  calories: number;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  meal_type?: PlanMealType | null;
  nutrition_source?: NutritionDataSource | null;
  nutrition_confidence?: NutritionConfidence | null;
  nutrition_observed?: string | null;
  nutrition_estimate_notes?: string | null;
  photo_uri?: string | null;
  user_id?: string | null;
  created_at?: string;
}

export interface NewMealLog {
  date: string;
  meal_name: string;
  calories: number;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  meal_type?: PlanMealType | null;
  nutrition_source: NutritionDataSource;
  nutrition_confidence?: NutritionConfidence | null;
  nutrition_observed?: string | null;
  nutrition_estimate_notes?: string | null;
  photo_uri?: string | null;
}

export type NutritionDataSource = 'manual' | 'catalog' | 'photo_ai' | 'photo_fallback' | 'unknown';
export type NutritionConfidence = 'alta' | 'media' | 'baja';

export interface NutritionEstimate {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealName?: string;
  description?: string;
  confidence?: 'alta' | 'media' | 'baja';
  notes?: string;
  estimator?: 'ai' | 'local';
}

export interface NutritionDayData {
  date: string;
  caloriesConsumed: number;
  goal: number | null;
  remaining: number | null;
  percentage: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  macroCompleteMeals: number;
  meals: MealLog[];
}

export interface CaloriasPeriodoResumen {
  weekConsumed: number;
  weekDays: number;
  monthConsumed: number;
  monthDays: number;
  goal: number | null;
  weekGoalTotal: number | null;
  monthGoalTotal: number | null;
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
