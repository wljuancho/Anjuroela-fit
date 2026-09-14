import * as SQLite from 'expo-sqlite';

const DB_NAME = 'anjuroela-fit.db';

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
  }
  return db;
}

export async function initDatabase(): Promise<void> {
  const database = getDatabase();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      auth_provider TEXT DEFAULT 'local',
      google_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      age INTEGER,
      height REAL,
      current_weight REAL,
      target_weight REAL,
      goal_weeks INTEGER,
      goal_date TEXT,
      goal_status TEXT DEFAULT 'active',
      username TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      muscle_group TEXT,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS body_parts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exercises_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      body_part_id INTEGER NOT NULL,
      description TEXT,
      equipment TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (body_part_id) REFERENCES body_parts (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      completed INTEGER DEFAULT 0,
      date TEXT DEFAULT CURRENT_DATE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workout_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      sets INTEGER DEFAULT 3,
      reps INTEGER DEFAULT 10,
      weight REAL,
      FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      calories INTEGER,
      protein REAL,
      carbs REAL,
      fats REAL,
      date TEXT DEFAULT CURRENT_DATE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meals_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      meal_type TEXT NOT NULL CHECK (meal_type IN ('desayuno', 'almuerzo', 'cena', 'snack')),
      image_uri TEXT,
      description TEXT,
      calories REAL DEFAULT 0,
      protein_g REAL DEFAULT 0,
      carbs_g REAL DEFAULT 0,
      fat_g REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT DEFAULT CURRENT_DATE,
      weight REAL,
      body_fat REAL,
      muscle_mass REAL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weekly_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL UNIQUE,
      body_part_id INTEGER,
      FOREIGN KEY (body_part_id) REFERENCES body_parts (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS day_muscles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL,
      body_part_id INTEGER NOT NULL,
      position INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      completed_date TEXT,
      FOREIGN KEY (body_part_id) REFERENCES body_parts (id) ON DELETE CASCADE,
      UNIQUE (day_of_week, body_part_id)
    );

    CREATE TABLE IF NOT EXISTS day_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL,
      body_part_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      position INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (body_part_id) REFERENCES body_parts (id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises_v2 (id) ON DELETE CASCADE,
      UNIQUE (day_of_week, body_part_id, exercise_id)
    );

    CREATE TABLE IF NOT EXISTS workout_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL,
      date TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_number INTEGER NOT NULL,
      weight_kg REAL,
      reps INTEGER,
      set_type TEXT DEFAULT 'reps',
      time_seconds REAL,
      FOREIGN KEY (session_id) REFERENCES workout_sessions (id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises_v2 (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nutrition_profile (
      user_id INTEGER PRIMARY KEY,
      daily_calories_goal INTEGER NOT NULL,
      activity_level TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_calories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      calories_consumed REAL NOT NULL DEFAULT 0,
      logged_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meal_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      meal_name TEXT NOT NULL,
      calories REAL NOT NULL DEFAULT 0,
      photo_uri TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weekly_meal_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL,
      meal_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      ingredients TEXT,
      servings INTEGER NOT NULL DEFAULT 1
    );
  `);

  await migrateWorkoutSets(database);
  await migrateDayMuscles(database);
  await migrateUniqueSessionIndex(database);

  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles (user_id);
    CREATE INDEX IF NOT EXISTS idx_day_muscles_day ON day_muscles (day_of_week);
    CREATE INDEX IF NOT EXISTS idx_day_exercises_day ON day_exercises (day_of_week);
    CREATE INDEX IF NOT EXISTS idx_exercises_v2_body_part ON exercises_v2 (body_part_id);
    CREATE INDEX IF NOT EXISTS idx_meals_v2_user_date ON meals_v2 (user_id, date);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_sessions_day_date ON workout_sessions (day_of_week, date);
    CREATE INDEX IF NOT EXISTS idx_workout_sets_session ON workout_sets (session_id);
    CREATE INDEX IF NOT EXISTS idx_workout_sets_exercise ON workout_sets (exercise_id);
    CREATE INDEX IF NOT EXISTS idx_workout_sets_session_exercise_set
      ON workout_sets (session_id, exercise_id, set_number);
    CREATE INDEX IF NOT EXISTS idx_weight_logs_date ON weight_logs (date);
    CREATE INDEX IF NOT EXISTS idx_meal_logs_date ON meal_logs (date);
    CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_day ON weekly_meal_plan (day_of_week);
  `);

  await migrateUserProfileGoalStatus(database);
  await migrateUserProfilesUnique(database);
  await cleanLegacyTestRecords(database);
  await seedWeeklyMealPlan(database);
}

async function migrateUniqueSessionIndex(db: SQLite.SQLiteDatabase): Promise<void> {
  const duplicates = await db.getAllAsync<{ cnt: number }>(
    `SELECT COUNT(*) as cnt
     FROM (SELECT 1 FROM workout_sessions GROUP BY day_of_week, date HAVING COUNT(*) > 1)`,
  );
  const indexRows = await db.getAllAsync<{ name: string }>(
    "PRAGMA index_list('workout_sessions')",
  );
  const hasIndex = indexRows.some((r) => r.name === 'idx_workout_sessions_day_date');

  // Solo se migra cuando existen sesiones duplicadas o falta el índice único.
  if ((duplicates[0]?.cnt ?? 0) === 0 && hasIndex) {
    return;
  }

  await db.execAsync(`
    DELETE FROM workout_sessions
    WHERE id NOT IN (SELECT MIN(id) FROM workout_sessions GROUP BY day_of_week, date);
    DROP INDEX IF EXISTS idx_workout_sessions_day_date;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_sessions_day_date ON workout_sessions (day_of_week, date);
  `);
}

async function cleanLegacyTestRecords(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DELETE FROM workout_exercises;
    DELETE FROM workouts;
    DELETE FROM exercises;
  `);
}

async function migrateDayMuscles(db: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM day_muscles');
  if ((rows[0]?.cnt ?? 0) > 0) return;

  const legacy = await db.getAllAsync<{ day_of_week: string; body_part_id: number }>(
    'SELECT day_of_week, body_part_id FROM weekly_schedule WHERE body_part_id IS NOT NULL',
  );
  for (const item of legacy) {
    await db.runAsync(
      'INSERT OR IGNORE INTO day_muscles (day_of_week, body_part_id, position, completed) VALUES (?, ?, ?, 0)',
      [item.day_of_week, item.body_part_id, 0],
    );
  }
}

async function migrateWorkoutSets(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(workout_sets)',
  );
  const names = columns.map((c) => c.name);
  if (!names.includes('set_type')) {
    await db.execAsync(`ALTER TABLE workout_sets ADD COLUMN set_type TEXT DEFAULT 'reps'`);
  }
  if (!names.includes('time_seconds')) {
    await db.execAsync('ALTER TABLE workout_sets ADD COLUMN time_seconds REAL');
  }
}

async function migrateUserProfileGoalStatus(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    "PRAGMA table_info(user_profiles)",
  );
  const names = columns.map((c) => c.name);
  if (!names.includes('goal_status')) {
    await db.execAsync("ALTER TABLE user_profiles ADD COLUMN goal_status TEXT DEFAULT 'active'");
  }
}

async function migrateUserProfilesUnique(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DELETE FROM user_profiles
    WHERE id NOT IN (SELECT MIN(id) FROM user_profiles GROUP BY user_id);
    DROP INDEX IF EXISTS idx_user_profiles_user;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles (user_id);
  `);
}

const WEEKLY_MEAL_PLAN_SEED: Array<{
  day_of_week: string;
  meal_type: string;
  title: string;
  description: string;
  ingredients: string;
  servings: number;
}> = [
  {
    day_of_week: 'lunes',
    meal_type: 'desayuno',
    title: 'Avena con fruta',
    description: 'Avena cocida con plátano, arándanos y una pizca de canela.',
    ingredients: 'Avena, plátano, arándanos, canela, leche o bebida vegetal',
    servings: 1,
  },
  {
    day_of_week: 'lunes',
    meal_type: 'almuerzo',
    title: 'Pechuga a la plancha con arroz',
    description: 'Pechuga de pollo a la plancha con arroz integral y verduras al vapor.',
    ingredients: 'Pechuga de pollo, arroz integral, brócoli, zanahoria, aceite de oliva',
    servings: 1,
  },
  {
    day_of_week: 'lunes',
    meal_type: 'cena',
    title: 'Ensalada de atún',
    description: 'Ensalada variada con atún, tomate, aguacate y huevo duro.',
    ingredients: 'Atún, lechuga, tomate, aguacate, huevo, aceite de oliva',
    servings: 1,
  },
  {
    day_of_week: 'lunes',
    meal_type: 'snack',
    title: 'Yogur griego y almendras',
    description: 'Yogur griego natural con un puñado de almendras.',
    ingredients: 'Yogur griego, almendras',
    servings: 1,
  },
  {
    day_of_week: 'martes',
    meal_type: 'desayuno',
    title: 'Huevos revueltos y pan integral',
    description: 'Huevos revueltos con espinacas y una rebanada de pan integral.',
    ingredients: 'Huevos, espinacas, pan integral, aceite de oliva',
    servings: 1,
  },
  {
    day_of_week: 'martes',
    meal_type: 'almuerzo',
    title: 'Salmón al horno con quinoa',
    description: 'Salmón al horno acompañado de quinoa y espárragos.',
    ingredients: 'Salmón, quinoa, espárragos, limón, aceite de oliva',
    servings: 1,
  },
  {
    day_of_week: 'martes',
    meal_type: 'cena',
    title: 'Sopa de pollo y verduras',
    description: 'Sopa ligera con pollo, calabacín, zanahoria y apio.',
    ingredients: 'Pollo, calabacín, zanahoria, apio, cebolla',
    servings: 2,
  },
  {
    day_of_week: 'martes',
    meal_type: 'snack',
    title: 'Manzana con mantequilla de maní',
    description: 'Manzana en rodajas con una cucharada de mantequilla de maní.',
    ingredients: 'Manzana, mantequilla de maní',
    servings: 1,
  },
  {
    day_of_week: 'miercoles',
    meal_type: 'desayuno',
    title: 'Batido de proteína y avena',
    description: 'Batido con proteína, avena, plátano y leche.',
    ingredients: 'Proteína en polvo, avena, plátano, leche',
    servings: 1,
  },
  {
    day_of_week: 'miercoles',
    meal_type: 'almuerzo',
    title: 'Carne magra con papa al horno',
    description: 'Carne magra asada con papa al horno y ensalada de lechuga.',
    ingredients: 'Carne magra, papa, lechuga, tomate, aceite de oliva',
    servings: 1,
  },
  {
    day_of_week: 'miercoles',
    meal_type: 'cena',
    title: 'Omelette de claras',
    description: 'Omelette de claras con champiñones y queso bajo en grasa.',
    ingredients: 'Claras de huevo, champiñones, queso bajo en grasa',
    servings: 1,
  },
  {
    day_of_week: 'miercoles',
    meal_type: 'snack',
    title: 'Requesón y frutas rojas',
    description: 'Requesón con fresas y arándanos.',
    ingredients: 'Requesón, fresas, arándanos',
    servings: 1,
  },
  {
    day_of_week: 'jueves',
    meal_type: 'desayuno',
    title: 'Panqueques de avena',
    description: 'Panqueques de avena y plátano con miel ligera.',
    ingredients: 'Avena, plátano, huevo, miel',
    servings: 2,
  },
  {
    day_of_week: 'jueves',
    meal_type: 'almuerzo',
    title: 'Pollo al curry con arroz',
    description: 'Pollo al curry con leche de coco y arroz blanco.',
    ingredients: 'Pollo, curry, leche de coco, arroz, cebolla',
    servings: 2,
  },
  {
    day_of_week: 'jueves',
    meal_type: 'cena',
    title: 'Ensalada César de pollo',
    description: 'Ensalada César con pollo a la parrilla y aderezo ligero.',
    ingredients: 'Pollo, lechuga, pan integral, queso parmesano, aderezo ligero',
    servings: 1,
  },
  {
    day_of_week: 'jueves',
    meal_type: 'snack',
    title: 'Zanahoria y hummus',
    description: 'Bastones de zanahoria con hummus.',
    ingredients: 'Zanahoria, hummus',
    servings: 1,
  },
  {
    day_of_week: 'viernes',
    meal_type: 'desayuno',
    title: 'Yogur con granola',
    description: 'Yogur natural con granola y frutas frescas.',
    ingredients: 'Yogur natural, granola, frutas frescas',
    servings: 1,
  },
  {
    day_of_week: 'viernes',
    meal_type: 'almuerzo',
    title: 'Pasta integral con vegetales',
    description: 'Pasta integral con tomate, espinaca y queso rallado.',
    ingredients: 'Pasta integral, tomate, espinaca, queso rallado, aceite de oliva',
    servings: 2,
  },
  {
    day_of_week: 'viernes',
    meal_type: 'cena',
    title: 'Tilapia a la plancha',
    description: 'Tilapia a la plancha con arroz de coliflor y limón.',
    ingredients: 'Tilapia, coliflor, limón, perejil, aceite de oliva',
    servings: 1,
  },
  {
    day_of_week: 'viernes',
    meal_type: 'snack',
    title: 'Mix de frutos secos',
    description: 'Puñado de nueces, almendras y avellanas.',
    ingredients: 'Nueces, almendras, avellanas',
    servings: 1,
  },
  {
    day_of_week: 'sabado',
    meal_type: 'desayuno',
    title: 'Tostadas con aguacate',
    description: 'Pan integral tostado con aguacate y huevo pochado.',
    ingredients: 'Pan integral, aguacate, huevo, limón',
    servings: 1,
  },
  {
    day_of_week: 'sabado',
    meal_type: 'almuerzo',
    title: 'Bowl de pollo y quinoa',
    description: 'Bowl con pollo, quinoa, garbanzos y vegetales asados.',
    ingredients: 'Pollo, quinoa, garbanzos, pimiento, calabacín',
    servings: 1,
  },
  {
    day_of_week: 'sabado',
    meal_type: 'cena',
    title: 'Pizza de calabacín',
    description: 'Base de calabacín con tomate, mozzarella y albahaca.',
    ingredients: 'Calabacín, tomate, mozzarella, albahaca',
    servings: 2,
  },
  {
    day_of_week: 'sabado',
    meal_type: 'snack',
    title: 'Batido verde',
    description: 'Batido de espinaca, manzana y jengibre.',
    ingredients: 'Espinaca, manzana, jengibre, agua o leche',
    servings: 1,
  },
  {
    day_of_week: 'domingo',
    meal_type: 'desayuno',
    title: 'Huevos al gusto con fruta',
    description: 'Huevos revueltos o cocidos con una pieza de fruta.',
    ingredients: 'Huevos, fruta de temporada',
    servings: 1,
  },
  {
    day_of_week: 'domingo',
    meal_type: 'almuerzo',
    title: 'Pollo al horno con vegetales',
    description: 'Pollo entero asado con papa, zanahoria y cebolla.',
    ingredients: 'Pollo, papa, zanahoria, cebolla, romero',
    servings: 4,
  },
  {
    day_of_week: 'domingo',
    meal_type: 'cena',
    title: 'Caldo de verduras',
    description: 'Caldo tibio con poro, apio, zanahoria y fideos integrales.',
    ingredients: 'Poro, apio, zanahoria, fideos integrales',
    servings: 3,
  },
  {
    day_of_week: 'domingo',
    meal_type: 'snack',
    title: 'Barrita de avena',
    description: 'Barrita casera de avena y miel.',
    ingredients: 'Avena, miel, nueces, pasas',
    servings: 2,
  },
];

async function seedWeeklyMealPlan(db: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM weekly_meal_plan',
  );
  if ((rows[0]?.cnt ?? 0) > 0) return;
  for (const meal of WEEKLY_MEAL_PLAN_SEED) {
    await db.runAsync(
      `INSERT INTO weekly_meal_plan
        (day_of_week, meal_type, title, description, ingredients, servings)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        meal.day_of_week,
        meal.meal_type,
        meal.title,
        meal.description,
        meal.ingredients,
        meal.servings,
      ],
    );
  }
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
