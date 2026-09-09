export type MealType = 'desayuno' | 'almuerzo' | 'cena' | 'snack';

export interface MealRecord {
  id: number;
  user_id: number;
  date: string;
  meal_type: MealType;
  image_uri?: string | null;
  description?: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes?: string | null;
  created_at?: string;
}

export interface NewMeal {
  user_id: number;
  date: string;
  meal_type: MealType;
  image_uri?: string | null;
  description?: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  notes?: string | null;
}

export interface NutritionEstimate {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DailyCalorieGoal {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface DailyMealSummary {
  date: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  meals: MealRecord[];
  goal: DailyCalorieGoal | null;
  remainingCalories: number | null;
}

export interface FoodRecommendation {
  id: string;
  title: string;
  description: string;
  calories: number;
  icon: string;
}