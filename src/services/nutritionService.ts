import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from './database';
import { syncLocalToRemote, queueLocalDeletion } from './syncService';
import type {
  ActivityLevel,
  CaloriasPeriodoResumen,
  MealIngredient,
  MealLog,
  NewMealLog,
  NutritionDayData,
  NutritionGoalType,
  NutritionProfile,
  NutritionProfileInput,
  WeeklyMealPlanItem,
} from '../types/nutrition';
import { formatDate, formatNumber } from './utils';

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  moderado: 1.55,
  activo: 1.725,
};

const GOAL_ADJUSTMENTS: Record<NutritionGoalType, number> = {
  perder: -500,
  ganar: 300,
  mantener: 0,
  libre: 0,
};

export interface TDEECalculationInput {
  age?: number | null;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  goalType: NutritionGoalType;
}

export function calculateTDEE(input: TDEECalculationInput): number {
  // La edad es opcional: si el usuario aún no la registró (NULL/ausente) se
  // usa 30 años como valor por defecto para no bloquear la estimación de TDEE.
  const age = input.age ?? 30;
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * age - 78;
  const tdee = bmr * ACTIVITY_FACTORS[input.activityLevel];
  const goal = tdee + GOAL_ADJUSTMENTS[input.goalType];
  return Math.round(Math.min(3500, Math.max(1200, goal)));
}

export async function getNutritionProfile(userId: string): Promise<NutritionProfile | null> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{
    user_id: string;
    daily_calories_goal: number;
    activity_level: ActivityLevel;
    goal_type: NutritionGoalType;
    updated_at: string;
  }>(
    'SELECT * FROM nutrition_profile WHERE user_id = ? LIMIT 1',
    [userId],
  );
  if (!rows[0]) {
    return null;
  }
  return {
    userId: rows[0].user_id,
    dailyCaloriesGoal: rows[0].daily_calories_goal,
    activityLevel: rows[0].activity_level,
    goalType: rows[0].goal_type,
    updatedAt: rows[0].updated_at,
  };
}

export async function saveNutritionProfile(
  userId: string,
  data: NutritionProfileInput,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO nutrition_profile
       (user_id, daily_calories_goal, activity_level, goal_type, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       daily_calories_goal = excluded.daily_calories_goal,
       activity_level = excluded.activity_level,
       goal_type = excluded.goal_type,
       updated_at = excluded.updated_at`,
    [userId, data.dailyCaloriesGoal, data.activityLevel, data.goalType, new Date().toISOString()],
  );

  const hasHeight = data.heightCm != null && data.heightCm > 0;
  const hasAge = data.age != null && data.age > 0;
  if (hasHeight || hasAge) {
    await db.runAsync(
      `INSERT INTO user_profiles (user_id, height, age)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         height = COALESCE(excluded.height, user_profiles.height),
         age = COALESCE(excluded.age, user_profiles.age)`,
      [
        userId,
        hasHeight ? (data.heightCm as number) : null,
        hasAge ? (data.age as number) : null,
      ],
    );
  }

  void syncLocalToRemote('nutrition_profile');
  if (hasHeight || hasAge) {
    void syncLocalToRemote('user_profiles');
  }
}

export async function getDailyCaloriesConsumed(date: string): Promise<number> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ calories_consumed: number }>(
    'SELECT calories_consumed FROM daily_calories WHERE date = ? LIMIT 1',
    [date],
  );
  return rows[0]?.calories_consumed ?? 0;
}

function startOfWeek(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const jsDay = dt.getDay();
  const daysSinceMonday = jsDay === 0 ? 6 : jsDay - 1;
  dt.setDate(dt.getDate() - daysSinceMonday);
  return formatDate(dt);
}

function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export async function getCaloriasPeriodoResumen(
  userId: string,
  date: string,
): Promise<CaloriasPeriodoResumen> {
  const db = getDatabase();
  const weekStart = startOfWeek(date);
  const monthStart = startOfMonth(date);
  const [profile, weekRows, monthRows] = await Promise.all([
    getNutritionProfile(userId),
    db.getAllAsync<{ total: number; days: number }>(
      `SELECT COALESCE(SUM(calories_consumed), 0) AS total, COUNT(*) AS days
       FROM daily_calories WHERE date >= ? AND date <= ?`,
      [weekStart, date],
    ),
    db.getAllAsync<{ total: number; days: number }>(
      `SELECT COALESCE(SUM(calories_consumed), 0) AS total, COUNT(*) AS days
       FROM daily_calories WHERE date >= ? AND date <= ?`,
      [monthStart, date],
    ),
  ]);
  return {
    weekConsumed: Math.round(weekRows[0]?.total ?? 0),
    weekDays: weekRows[0]?.days ?? 0,
    monthConsumed: Math.round(monthRows[0]?.total ?? 0),
    monthDays: monthRows[0]?.days ?? 0,
    goal: profile?.dailyCaloriesGoal ?? null,
  };
}

export async function addCaloriesToDay(date: string, calories: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO daily_calories (date, calories_consumed, logged_at)
     VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       calories_consumed = calories_consumed + excluded.calories_consumed,
       logged_at = excluded.logged_at`,
    [date, calories, new Date().toISOString()],
  );
  void syncLocalToRemote('daily_calories');
}

export async function subtractCaloriesFromDay(date: string, calories: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE daily_calories SET calories_consumed = MAX(0, calories_consumed - ?) WHERE date = ?',
    [calories, date],
  );
  void syncLocalToRemote('daily_calories');
}

export async function addMealLog(data: NewMealLog): Promise<MealLog> {
  const db = getDatabase();
  const result = await db.runAsync(
    'INSERT INTO meal_logs (date, meal_name, calories, photo_uri) VALUES (?, ?, ?, ?)',
    [data.date, data.meal_name.trim(), data.calories, data.photo_uri ?? null],
  );
  await addCaloriesToDay(data.date, data.calories);
  void syncLocalToRemote('meal_logs');
  return {
    id: result.lastInsertRowId,
    date: data.date,
    meal_name: data.meal_name.trim(),
    calories: data.calories,
    photo_uri: data.photo_uri ?? null,
  };
}

export async function getMealLogsByDate(date: string): Promise<MealLog[]> {
  const db = getDatabase();
  return db.getAllAsync<MealLog>(
    'SELECT * FROM meal_logs WHERE date = ? ORDER BY created_at DESC, id DESC',
    [date],
  );
}

export async function deleteMealLog(id: number): Promise<void> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ date: string; calories: number; photo_uri: string | null }>(
    'SELECT date, calories, photo_uri FROM meal_logs WHERE id = ? LIMIT 1',
    [id],
  );
  if (rows[0]) {
    await subtractCaloriesFromDay(rows[0].date, rows[0].calories);
  }
  await db.runAsync('DELETE FROM meal_logs WHERE id = ?', [id]);
  await queueLocalDeletion({ table: 'meal_logs', rowId: id });
  void syncLocalToRemote('meal_logs');
  const photoUri = rows[0]?.photo_uri;
  if (photoUri) {
    try {
      await FileSystem.deleteAsync(photoUri, { idempotent: true });
    } catch {
      // Ignorar errores de eliminación de archivo (no bloquea el borrado del registro)
    }
  }
}

export async function getWeeklyMealPlan(): Promise<WeeklyMealPlanItem[]> {
  const db = getDatabase();
  const today = formatDate(new Date());

  // Las filas caducadas se eliminan localmente; se registran en el buffer de
  // borrados para que también desaparezcan de Supabase y no vuelvan al reabrir.
  const expired = await db.getAllAsync<{ id: number }>(
    `SELECT id FROM weekly_meal_plan
     WHERE (expires_at IS NOT NULL AND expires_at < ?) OR (date IS NOT NULL AND date < ?)`,
    [today, today],
  );
  if (expired.length > 0) {
    await db.runAsync(
      'DELETE FROM weekly_meal_plan WHERE (expires_at IS NOT NULL AND expires_at < ?) OR (date IS NOT NULL AND date < ?)',
      [today, today],
    );
    for (const row of expired) {
      await queueLocalDeletion({ table: 'weekly_meal_plan', rowId: row.id });
    }
  }

  const rows = await db.getAllAsync<{
    id: number;
    day_of_week: string;
    date: string | null;
    meal_type: string;
    title: string;
    description: string | null;
    recipe: string | null;
    ingredients_list: string | null;
    servings_count: number;
    expires_at: string | null;
  }>(
    `SELECT * FROM weekly_meal_plan
     ORDER BY
       date ASC,
       CASE meal_type
         WHEN 'desayuno' THEN 0
         WHEN 'almuerzo' THEN 1
         WHEN 'cena' THEN 2
         ELSE 3
       END`,
  );

  return rows.map((r) => {
    let ingredients: MealIngredient[] = [];
    if (r.ingredients_list) {
      try {
        const parsed = JSON.parse(r.ingredients_list);
        if (Array.isArray(parsed)) {
          ingredients = parsed.map((i: any) => ({
            name: typeof i?.name === 'string' ? i.name : String(i?.name ?? ''),
            amount: typeof i?.amount === 'string' ? i.amount : String(i?.amount ?? ''),
          }));
        }
      } catch { /* ignore malformed JSON */ }
    }
    return {
      id: r.id,
      day_of_week: r.day_of_week,
      date: r.date ?? '',
      meal_type: r.meal_type as WeeklyMealPlanItem['meal_type'],
      title: r.title,
      description: r.description,
      recipe: r.recipe,
      ingredients_list: ingredients,
      servings_count: r.servings_count ?? 1,
      expires_at: r.expires_at ?? '',
    };
  });
}

export interface WeeklyMealPlanInput {
  day_of_week: string;
  date: string;
  meal_type: string;
  title: string;
  description?: string;
  recipe?: string;
  ingredients_list?: MealIngredient[];
  servings_count: number;
  expires_at: string;
}

const VALID_MEAL_TYPES = ['desayuno', 'almuerzo', 'cena', 'snack'];

export async function replaceWeeklyMealPlan(rows: WeeklyMealPlanInput[]): Promise<number> {
  const db = getDatabase();
  const removed = await db.getAllAsync<{ id: number }>('SELECT id FROM weekly_meal_plan');
  await db.runAsync('DELETE FROM weekly_meal_plan');
  for (const oldRow of removed) {
    await queueLocalDeletion({ table: 'weekly_meal_plan', rowId: oldRow.id });
  }
  let inserted = 0;
  for (const row of rows) {
    if (!VALID_MEAL_TYPES.includes(row.meal_type)) continue;
    if (!row.title?.trim()) continue;
    await db.runAsync(
      `INSERT INTO weekly_meal_plan
        (day_of_week, date, meal_type, title, description, recipe, ingredients_list, servings_count, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.day_of_week,
        row.date || null,
        row.meal_type,
        row.title.trim(),
        row.description?.trim() || null,
        row.recipe?.trim() || null,
        row.ingredients_list && row.ingredients_list.length > 0 ? JSON.stringify(row.ingredients_list) : null,
        row.servings_count || 1,
        row.expires_at || null,
      ],
    );
    inserted += 1;
  }
  if (inserted > 0) {
    void syncLocalToRemote('weekly_meal_plan');
  }
  return inserted;
}

export async function deleteWeeklyMealPlanItem(id: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync('DELETE FROM weekly_meal_plan WHERE id = ?', [id]);
  await queueLocalDeletion({ table: 'weekly_meal_plan', rowId: id });
  void syncLocalToRemote('weekly_meal_plan');
}

export async function clearWeeklyMealPlan(): Promise<void> {
  const db = getDatabase();
  const removed = await db.getAllAsync<{ id: number }>('SELECT id FROM weekly_meal_plan');
  await db.runAsync('DELETE FROM weekly_meal_plan');
  for (const oldRow of removed) {
    await queueLocalDeletion({ table: 'weekly_meal_plan', rowId: oldRow.id });
  }
  void syncLocalToRemote('weekly_meal_plan');
}

function parseIngredientAmount(raw: string): { value: number | null; unit: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, unit: '' };
  const match = trimmed.match(/^(\d+(?:[.,/]\d+)?)\s*(.*)/);
  if (!match) return { value: null, unit: trimmed };
  let numStr = match[1].replace(',', '.');
  if (numStr.includes('/')) {
    const [num, den] = numStr.split('/').map(Number);
    numStr = den ? String(num / den) : numStr;
  }
  const value = parseFloat(numStr);
  return { value: isNaN(value) ? null : value, unit: match[2].trim() };
}

export interface MarketIngredient {
  name: string;
  quantity: string;
}

export function aggregateMarketList(items: WeeklyMealPlanItem[]): MarketIngredient[] {
  interface AggEntry {
    value: number | null;
    unit: string;
    displayName: string;
  }
  const map = new Map<string, AggEntry>();

  for (const item of items) {
    const multiplier = item.servings_count || 1;
    for (const ing of item.ingredients_list) {
      const { value, unit } = parseIngredientAmount(ing.amount);
      const key = `${ing.name.toLowerCase().trim()}|${unit.toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        if (existing.value != null && value != null) {
          existing.value += value * multiplier;
        }
      } else {
        map.set(key, {
          displayName: ing.name.trim(),
          value: value != null ? value * multiplier : null,
          unit,
        });
      }
    }
  }

  return [...map.values()].map((e) => ({
    name: e.displayName,
    quantity: e.value != null
      ? `${formatNumber(e.value, e.value % 1 === 0 ? 0 : 2)} ${e.unit}`.trim()
      : e.unit,
  }));
}

export async function getNutritionDayData(
  userId: string,
  date: string,
): Promise<NutritionDayData> {
  const [profile, caloriesConsumed, meals] = await Promise.all([
    getNutritionProfile(userId),
    getDailyCaloriesConsumed(date),
    getMealLogsByDate(date),
  ]);
  const goal = profile?.dailyCaloriesGoal ?? null;
  const remaining = goal !== null ? goal - caloriesConsumed : null;
  const percentage =
    goal !== null && goal > 0 ? Math.min(100, (caloriesConsumed / goal) * 100) : 0;
  return {
    date,
    caloriesConsumed,
    goal,
    remaining,
    percentage,
    meals,
  };
}
