import { getDatabase } from './database';
import { getProfile } from './authService';
import type {
  MealRecord,
  NewMeal,
  DailyMealSummary,
  DailyCalorieGoal,
  FoodRecommendation,
} from '../types/meal';

export async function addMeal(data: NewMeal): Promise<MealRecord> {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO meals_v2
      (user_id, date, meal_type, image_uri, description, calories, protein_g, carbs_g, fat_g, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.user_id,
      data.date,
      data.meal_type,
      data.image_uri ?? null,
      data.description?.trim() || null,
      data.calories,
      data.protein_g,
      data.carbs_g,
      data.fat_g,
      data.notes?.trim() || null,
    ],
  );
  return {
    id: result.lastInsertRowId,
    user_id: data.user_id,
    date: data.date,
    meal_type: data.meal_type,
    image_uri: data.image_uri ?? null,
    description: data.description?.trim() || null,
    calories: data.calories,
    protein_g: data.protein_g,
    carbs_g: data.carbs_g,
    fat_g: data.fat_g,
    notes: data.notes?.trim() || null,
  };
}

export async function getMealsByDate(userId: number, date: string): Promise<MealRecord[]> {
  const db = getDatabase();
  return db.getAllAsync<MealRecord>(
    'SELECT * FROM meals_v2 WHERE user_id = ? AND date = ? ORDER BY id ASC',
    [userId, date],
  );
}

export async function updateMeal(id: number, data: NewMeal): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE meals_v2 SET
      meal_type = ?, image_uri = ?, description = ?, calories = ?, protein_g = ?, carbs_g = ?, fat_g = ?, notes = ?
     WHERE id = ?`,
    [
      data.meal_type,
      data.image_uri ?? null,
      data.description?.trim() || null,
      data.calories,
      data.protein_g,
      data.carbs_g,
      data.fat_g,
      data.notes?.trim() || null,
      id,
    ],
  );
}

export async function deleteMeal(id: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM meals_v2 WHERE id = ?', [id]);
}

export async function calculateDailyCalorieGoal(userId: number): Promise<DailyCalorieGoal | null> {
  const profile = await getProfile(userId);
  if (!profile?.current_weight) return null;

  const weightKg = profile.current_weight;
  const heightCm = profile.height ?? null;
  const age = profile.age ?? null;

  // Mifflin-St Jeor with a neutral constant (avg. of male +5 / female -161).
  let bmr = 10 * weightKg + 6.25 * (heightCm ?? 170) - 5 * (age ?? 30) - 78;
  bmr *= 1.375; // light activity factor

  const targetWeight = profile.target_weight ?? null;
  let adjustment = 0;
  if (targetWeight !== null) {
    if (Math.abs(targetWeight - weightKg) > 0.01) {
      adjustment = targetWeight < weightKg ? -500 : 300;
    }
  }

  const calories = Math.round(Math.min(3500, Math.max(1200, bmr + adjustment)));

  const proteinG = Number((weightKg * 1.8).toFixed(1));
  const fatG = Math.round((calories * 0.25) / 9);
  const carbsG = Math.round((calories - proteinG * 4 - fatG * 9) / 4);

  return { calories, proteinG, carbsG, fatG };
}

export async function getDailySummary(userId: number, date: string): Promise<DailyMealSummary> {
  const meals = await getMealsByDate(userId, date);
  const goal = await calculateDailyCalorieGoal(userId);

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);

  return {
    date,
    totalCalories,
    totalProteinG: Number(meals.reduce((sum, m) => sum + m.protein_g, 0).toFixed(1)),
    totalCarbsG: meals.reduce((sum, m) => sum + m.carbs_g, 0),
    totalFatG: meals.reduce((sum, m) => sum + m.fat_g, 0),
    meals,
    goal,
    remainingCalories: goal ? goal.calories - totalCalories : null,
  };
}

export function getFoodRecommendations(goal: DailyCalorieGoal | null): FoodRecommendation[] {
  const useBulk = (goal?.calories ?? 2000) >= 2600;
  return [
    {
      id: 'recommendation-protein',
      title: 'Prioriza la proteína',
      description: 'Incluye huevos, pollo, pescado o legumbres en cada comida.',
      calories: 250,
      icon: 'bonfire',
    },
    {
      id: 'recommendation-veggies',
      title: 'La mitad del plato, vegetales',
      description: 'Verduras de hoja verde y colores variados para micronutrientes.',
      calories: 100,
      icon: 'leaf',
    },
    {
      id: 'recommendation-carbs',
      title: useBulk ? 'Aumenta tus carbohidratos' : 'Cuidado con los rápidos',
      description: useBulk
        ? 'Arroz, avena y papa cubren la energía para tus entrenamientos.'
        : 'Prefiere carbohidratos complejos y limita azúcares añadidos.',
      calories: 300,
      icon: 'nutrition',
    },
    {
      id: 'recommendation-hydration',
      title: 'Hidrátate',
      description: 'Toma al menos 2 L de agua al día para rendir mejor.',
      calories: 0,
      icon: 'water',
    },
  ];
}