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
  SexForFormula,
  WeeklyMealPlanItem,
} from '../types/nutrition';
import { formatDate, formatNumber } from './utils';

const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  ligero: 1.375,
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
  sexForFormula?: SexForFormula | null;
}

// Termino por sexo de la fórmula Mifflin-St Jeor: +5 kcal para hombres,
// -161 kcal para mujeres y el promedio (-78) cuando el sexo no está definido.
const MIFFLIN_SEX_TERM: Record<SexForFormula, number> = {
  male: 5,
  female: -161,
  not_specified: -78,
};

export function calculateTDEE(input: TDEECalculationInput): number {
  // La edad es opcional: si el usuario aún no la registró (NULL/ausente) se
  // usa 30 años como valor por defecto para no bloquear la estimación de TDEE.
  const age = input.age ?? 30;
  const sex = input.sexForFormula ?? 'not_specified';
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * age;
  const bmr = base + MIFFLIN_SEX_TERM[sex];
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
    sex_for_calorie_formula: string | null;
    updated_at: string | null;
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
    sexForFormula: isSexForFormula(rows[0].sex_for_calorie_formula)
      ? rows[0].sex_for_calorie_formula
      : 'not_specified',
    updatedAt: rows[0].updated_at ?? undefined,
  };
}

function isSexForFormula(value: string | null | undefined): value is SexForFormula {
  return value === 'male' || value === 'female' || value === 'not_specified';
}

// Resuelve el sexo biológico para la fórmula Mifflin-St Jeor. Prioridad:
// 1) nutrition_profile.sex_for_calorie_formula (lo guarda el contador de
// calorías), 2) user_profiles.sex_for_calorie_formula, 3) user_profiles.gender
// ('hombre'/'mujer' del perfil). Solo 'male'/'female' explícitos se usan; si
// no hay ninguno se devuelve 'not_specified' (promedio en el BMR).
export async function resolveSexForFormula(userId: string): Promise<SexForFormula> {
  const db = getDatabase();
  const [nutritionRows, profileRows] = await Promise.all([
    db.getAllAsync<{ sex_for_calorie_formula: string | null }>(
      'SELECT sex_for_calorie_formula FROM nutrition_profile WHERE user_id = ? LIMIT 1',
      [userId],
    ),
    db.getAllAsync<{ sex_for_calorie_formula: string | null; gender: string | null }>(
      'SELECT sex_for_calorie_formula, gender FROM user_profiles WHERE user_id = ? LIMIT 1',
      [userId],
    ),
  ]);

  const nutritionSex = nutritionRows[0]?.sex_for_calorie_formula;
  if (nutritionSex === 'male' || nutritionSex === 'female') {
    return nutritionSex;
  }

  const profileSex = profileRows[0]?.sex_for_calorie_formula;
  if (profileSex === 'male' || profileSex === 'female') {
    return profileSex;
  }

  const gender = profileRows[0]?.gender;
  if (gender === 'hombre') return 'male';
  if (gender === 'mujer') return 'female';

  return 'not_specified';
}

export async function saveNutritionProfile(
  userId: string,
  data: NutritionProfileInput,
): Promise<void> {
  const db = getDatabase();
  const sexForFormula = data.sexForFormula ?? 'not_specified';
  await db.runAsync(
    `INSERT INTO nutrition_profile
       (user_id, daily_calories_goal, activity_level, goal_type, sex_for_calorie_formula, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       daily_calories_goal = excluded.daily_calories_goal,
       activity_level = excluded.activity_level,
       goal_type = excluded.goal_type,
       sex_for_calorie_formula = excluded.sex_for_calorie_formula,
       updated_at = excluded.updated_at`,
    [
      userId,
      data.dailyCaloriesGoal,
      data.activityLevel,
      data.goalType,
      sexForFormula,
      new Date().toISOString(),
    ],
  );

  const hasHeight = data.heightCm != null && data.heightCm > 0;
  const hasAge = data.age != null && data.age > 0;
  if (hasHeight || hasAge || data.sexForFormula) {
    await db.runAsync(
      `INSERT INTO user_profiles (user_id, height, age, sex_for_calorie_formula)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         height = COALESCE(excluded.height, user_profiles.height),
         age = COALESCE(excluded.age, user_profiles.age),
         sex_for_calorie_formula = COALESCE(excluded.sex_for_calorie_formula, user_profiles.sex_for_calorie_formula)`,
      [
        userId,
        hasHeight ? (data.heightCm as number) : null,
        hasAge ? (data.age as number) : null,
        data.sexForFormula ? sexForFormula : null,
      ],
    );
  }

  void syncLocalToRemote('nutrition_profile');
  if (hasHeight || hasAge || data.sexForFormula) {
    void syncLocalToRemote('user_profiles');
  }
}

export async function getDailyCaloriesConsumed(userId: string, date: string): Promise<number> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ calories_consumed: number }>(
    'SELECT calories_consumed FROM daily_calories WHERE user_id = ? AND date = ? LIMIT 1',
    [userId, date],
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
       FROM daily_calories WHERE user_id = ? AND date >= ? AND date <= ?`,
      [userId, weekStart, date],
    ),
    db.getAllAsync<{ total: number; days: number }>(
      `SELECT COALESCE(SUM(calories_consumed), 0) AS total, COUNT(*) AS days
       FROM daily_calories WHERE user_id = ? AND date >= ? AND date <= ?`,
      [userId, monthStart, date],
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

export async function addCaloriesToDay(
  userId: string,
  date: string,
  calories: number,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `INSERT INTO daily_calories (user_id, date, calories_consumed, logged_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET
       calories_consumed = calories_consumed + excluded.calories_consumed,
       logged_at = excluded.logged_at`,
    [userId, date, calories, new Date().toISOString()],
  );
  void syncLocalToRemote('daily_calories');
}

export async function subtractCaloriesFromDay(
  userId: string,
  date: string,
  calories: number,
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    'UPDATE daily_calories SET calories_consumed = MAX(0, calories_consumed - ?) WHERE user_id = ? AND date = ?',
    [calories, userId, date],
  );
  void syncLocalToRemote('daily_calories');
}

export async function addMealLog(userId: string, data: NewMealLog): Promise<MealLog> {
  const db = getDatabase();
  const result = await db.runAsync(
    'INSERT INTO meal_logs (date, meal_name, calories, photo_uri, user_id) VALUES (?, ?, ?, ?, ?)',
    [data.date, data.meal_name.trim(), data.calories, data.photo_uri ?? null, userId],
  );
  await addCaloriesToDay(userId, data.date, data.calories);
  void syncLocalToRemote('meal_logs');
  return {
    id: result.lastInsertRowId,
    date: data.date,
    meal_name: data.meal_name.trim(),
    calories: data.calories,
    photo_uri: data.photo_uri ?? null,
    user_id: userId,
  };
}

export async function getMealLogsByDate(userId: string, date: string): Promise<MealLog[]> {
  const db = getDatabase();
  return db.getAllAsync<MealLog>(
    'SELECT * FROM meal_logs WHERE (user_id = ? OR user_id IS NULL) AND date = ? ORDER BY created_at DESC, id DESC',
    [userId, date],
  );
}

export async function deleteMealLog(userId: string, id: number): Promise<void> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ date: string; calories: number; photo_uri: string | null }>(
    'SELECT date, calories, photo_uri FROM meal_logs WHERE id = ? AND (user_id = ? OR user_id IS NULL) LIMIT 1',
    [id, userId],
  );
  if (rows[0]) {
    await subtractCaloriesFromDay(userId, rows[0].date, rows[0].calories);
    await db.runAsync(
      'DELETE FROM meal_logs WHERE id = ? AND (user_id = ? OR user_id IS NULL)',
      [id, userId],
    );
    await queueLocalDeletion({ table: 'meal_logs', rowId: id });
    void syncLocalToRemote('meal_logs');
  }
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
    getDailyCaloriesConsumed(userId, date),
    getMealLogsByDate(userId, date),
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

export interface CaloriesWindowAvg {
  avgConsumed: number | null;
  avgBurned: number | null;
  days: number;
}

// Promedio de calorías (consumidas y quemadas) en los últimos N días de
// calendario, incluyendo hoy. AVG ignora los días sin registro, así que el
// resultado es la media de los días en los que el usuario tiene datos.
async function getLastNDaysCaloriesAvg(
  userId: string,
  days: number,
): Promise<CaloriesWindowAvg> {
  const db = getDatabase();
  const today = new Date();
  const past = new Date(today);
  past.setDate(past.getDate() - (days - 1));
  const rows = await db.getAllAsync<{
    avg_consumed: number | null;
    avg_burned: number | null;
    days: number;
  }>(
    `SELECT AVG(calories_consumed) AS avg_consumed,
            AVG(calories_burned) AS avg_burned,
            COUNT(*) AS days
     FROM daily_calories
     WHERE user_id = ? AND date >= ? AND date <= ?`,
    [userId, formatDate(past), formatDate(today)],
  );
  return {
    avgConsumed: rows[0]?.avg_consumed ?? null,
    avgBurned: rows[0]?.avg_burned ?? null,
    days: rows[0]?.days ?? 0,
  };
}

export async function getLast7DaysCaloriesAvg(userId: string): Promise<CaloriesWindowAvg> {
  return getLastNDaysCaloriesAvg(userId, 7);
}

export interface EnergySummary {
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  sexForFormula: SexForFormula;
  activityLevel: ActivityLevel | null;
  bmr: number | null;
  tdee: number | null;
  dailyCaloriesGoal: number | null;
  goalType: NutritionGoalType | null;
  last7DaysCaloriesAvg: number | null;
  last30DaysCaloriesAvg: number | null;
}

// Resumen energético para enriquecer el contexto del coach: datos físicos del
// perfil, BMR/TDEE calculados con Mifflin-St Jeor + factor de actividad, la
// meta diaria guardada y los promedios recientes de consumo.
export async function getEnergySummary(userId: string): Promise<EnergySummary | null> {
  const db = getDatabase();
  const [profileRows, nutritionRows] = await Promise.all([
    db.getAllAsync<{ age: number | null; height: number | null; current_weight: number | null }>(
      'SELECT age, height, current_weight FROM user_profiles WHERE user_id = ? LIMIT 1',
      [userId],
    ),
    db.getAllAsync<{
      daily_calories_goal: number;
      activity_level: ActivityLevel;
      goal_type: NutritionGoalType;
    }>(
      'SELECT daily_calories_goal, activity_level, goal_type FROM nutrition_profile WHERE user_id = ? LIMIT 1',
      [userId],
    ),
  ]);
  const profileRow = profileRows[0];
  const nutritionRow = nutritionRows[0];
  if (!profileRow && !nutritionRow) return null;

  const weightKg = profileRow?.current_weight ?? null;
  const heightCm = profileRow?.height ?? null;
  const age = profileRow?.age ?? null;
  const sexForFormula = await resolveSexForFormula(userId);
  const activityLevel = nutritionRow?.activity_level ?? null;

  let bmr: number | null = null;
  if (weightKg != null && heightCm != null && weightKg > 0 && heightCm > 0) {
    const effectiveAge = age ?? 30;
    bmr = Math.round(
      10 * weightKg +
        6.25 * heightCm -
        5 * effectiveAge +
        MIFFLIN_SEX_TERM[sexForFormula],
    );
  }

  let tdee: number | null = null;
  if (bmr != null && activityLevel) {
    tdee = Math.round(bmr * ACTIVITY_FACTORS[activityLevel]);
  }

  const [avg7, avg30] = await Promise.all([
    getLastNDaysCaloriesAvg(userId, 7),
    getLastNDaysCaloriesAvg(userId, 30),
  ]);

  return {
    weightKg,
    heightCm,
    age,
    sexForFormula,
    activityLevel,
    bmr,
    tdee,
    dailyCaloriesGoal: nutritionRow?.daily_calories_goal ?? null,
    goalType: nutritionRow?.goal_type ?? null,
    last7DaysCaloriesAvg: avg7.avgConsumed,
    last30DaysCaloriesAvg: avg30.avgConsumed,
  };
}
