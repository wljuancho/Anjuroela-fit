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
    -- El EMAIL es la clave primaria de users: es la identidad unica de la
    -- cuenta y sustituye al antiguo id AUTOINCREMENT local (se migra en
    -- migrateUsersEmailPk).
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT,
      auth_provider TEXT DEFAULT 'local',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      age INTEGER,
      height REAL,
      current_weight REAL,
      target_weight REAL,
      goal_weeks INTEGER,
      goal_date TEXT,
      goal_status TEXT DEFAULT 'active',
      username TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (email) ON DELETE CASCADE
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
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exercises_v2 (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      body_part_id INTEGER NOT NULL,
      description TEXT,
      equipment TEXT,
      mode TEXT,
      is_active INTEGER DEFAULT 1,
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
      user_id TEXT NOT NULL,
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
      FOREIGN KEY (user_id) REFERENCES users (email) ON DELETE CASCADE
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
      calories_burned REAL NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS workout_circuits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL,
      body_part_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      work_seconds INTEGER NOT NULL,
      rest_seconds INTEGER NOT NULL,
      rounds INTEGER NOT NULL DEFAULT 3,
      exercises_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (body_part_id) REFERENCES body_parts (id) ON DELETE CASCADE,
      UNIQUE (day_of_week, body_part_id)
    );

    CREATE TABLE IF NOT EXISTS workout_circuits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL,
      body_part_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      work_seconds REAL NOT NULL DEFAULT 30,
      rest_seconds REAL NOT NULL DEFAULT 60,
      rounds INTEGER NOT NULL DEFAULT 4,
      exercises_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (body_part_id) REFERENCES body_parts (id) ON DELETE CASCADE,
      UNIQUE (day_of_week, body_part_id)
    );

    CREATE TABLE IF NOT EXISTS workout_circuits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL,
      body_part_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      work_seconds INTEGER NOT NULL,
      rest_seconds INTEGER NOT NULL,
      rounds INTEGER NOT NULL,
      exercises_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (body_part_id) REFERENCES body_parts (id) ON DELETE CASCADE,
      UNIQUE (day_of_week, body_part_id)
    );

    CREATE TABLE IF NOT EXISTS weight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      weight_kg REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS nutrition_profile (
      user_id TEXT PRIMARY KEY,
      daily_calories_goal INTEGER NOT NULL,
      activity_level TEXT NOT NULL,
      goal_type TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users (email) ON DELETE CASCADE
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
      date TEXT,
      meal_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      recipe TEXT,
      ingredients_list TEXT,
      servings_count INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Buffer local de borrados pendientes de propagar a Supabase: cada fila
    -- guarda la identidad (id local y/o clave de negocio) de una fila eliminada
    -- en SQLite para poder borrarla en la nube cuando haya conexión. Solo lo
    -- usa syncService; no se sincroniza ni se restaura desde la nube.
    CREATE TABLE IF NOT EXISTS pending_deletions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      row_id INTEGER,
      key_json TEXT,
      user_id TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await migrateWorkoutSets(database);
  await migrateWorkoutSessionsCalories(database);
  await migrateExercisesV2Mode(database);
  await migrateDayMuscles(database);
  await migrateUniqueSessionIndex(database);
  await migrateBodyPartsIsActive(database);
  await migrateExercisesIsActive(database);
  await migrateWeeklyMealPlanSchema(database);
  await migrateUsersEmailPk(database);
  await migrateDropUsersGoogleId(database);

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
    CREATE INDEX IF NOT EXISTS idx_weekly_meal_plan_date ON weekly_meal_plan (date);
    CREATE INDEX IF NOT EXISTS idx_pending_deletions_user ON pending_deletions (user_id);
  `);

  await migrateUserProfileGoalStatus(database);
  await migrateUserProfilesUnique(database);
  await cleanLegacyTestRecords(database);
  await resetExerciseCatalogOnce(database);
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

// Borra una sola vez cualquier ejercicio, músculo y configuración de rutina que
// exista (datos de pruebas). Se marca el estado para no volver a borrar lo que
// el usuario cree después. Con la siembra por defecto desactivada, una
// instalación nueva arranca sin catálogo.
async function resetExerciseCatalogOnce(db: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'catalog_cleaned' LIMIT 1",
  );
  if (rows[0]?.value === '1') return;

  await db.execAsync(`
    DELETE FROM workout_sets;
    DELETE FROM workout_sessions;
    DELETE FROM day_exercises;
    DELETE FROM day_muscles;
    DELETE FROM exercises_v2;
    DELETE FROM body_parts;
    DELETE FROM exercises;
    DELETE FROM workout_exercises;
    DELETE FROM workouts;
  `);
  await db.runAsync(
    "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('catalog_cleaned', '1')",
  );
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

async function migrateWorkoutSessionsCalories(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(workout_sessions)',
  );
  const names = columns.map((c) => c.name);
  if (!names.includes('calories_burned')) {
    await db.execAsync(
      'ALTER TABLE workout_sessions ADD COLUMN calories_burned REAL NOT NULL DEFAULT 0',
    );
  }
}

async function migrateBodyPartsIsActive(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(body_parts)');
  const names = columns.map((c) => c.name);
  if (!names.includes('is_active')) {
    await db.execAsync('ALTER TABLE body_parts ADD COLUMN is_active INTEGER DEFAULT 1');
  }
}

async function migrateExercisesV2Mode(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(exercises_v2)');
  const names = columns.map((c) => c.name);
  if (!names.includes('mode')) {
    await db.execAsync("ALTER TABLE exercises_v2 ADD COLUMN mode TEXT");
  }
}

async function migrateExercisesIsActive(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(exercises_v2)');
  const names = columns.map((c) => c.name);
  if (!names.includes('is_active')) {
    await db.execAsync('ALTER TABLE exercises_v2 ADD COLUMN is_active INTEGER DEFAULT 1');
  }
}

async function migrateWeeklyMealPlanSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>('PRAGMA table_info(weekly_meal_plan)');
  const names = columns.map((c) => c.name);
  const hasNewSchema = names.includes('date') && names.includes('recipe') && names.includes('ingredients_list');
  if (hasNewSchema) return;

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;

  await database.execAsync(`
    ALTER TABLE weekly_meal_plan RENAME TO weekly_meal_plan_legacy;
    CREATE TABLE IF NOT EXISTS weekly_meal_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_week TEXT NOT NULL,
      date TEXT,
      meal_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      recipe TEXT,
      ingredients_list TEXT,
      servings_count INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT
    );
  `);
  await database.runAsync(
    `INSERT INTO weekly_meal_plan (day_of_week, date, meal_type, title, description, servings_count, expires_at)
       SELECT day_of_week, ?, meal_type, title, description, servings, ?
         FROM weekly_meal_plan_legacy`,
    [todayStr, yesterdayStr],
  );
  await database.execAsync('DROP TABLE IF EXISTS weekly_meal_plan_legacy');
}

// Migra la identidad de `users` desde id INTEGER AUTOINCREMENT local hacia el
// EMAIL como clave primaria (mismo modelo que el esquema de Supabase). Solo
// actúa cuando la tabla mantenida en el dispositivo sigue el formato legacy
// (existe la columna 'id'); en instalaciones nuevas ya no hace falta.
//
// Reconstruye `users`, `user_profiles`, `nutrition_profile` y `meals_v2`
// mapeando el id numérico antiguo a su email mediante un JOIN, y después
// reemplaza las tablas viejas por las nuevas.
async function migrateUsersEmailPk(db: SQLite.SQLiteDatabase): Promise<void> {
  const usersColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(users)');
  if (!usersColumns.some((c) => c.name === 'id')) {
    return;
  }

  await db.execAsync('PRAGMA foreign_keys = OFF;');
  try {
    await db.withTransactionAsync(async () => {
      // 1) Tablas nuevas referenciando users(email).
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS users_v2 (
          email TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          password_hash TEXT,
          auth_provider TEXT DEFAULT 'local',
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS user_profiles_v2 (
          user_id TEXT PRIMARY KEY,
          age INTEGER,
          height REAL,
          current_weight REAL,
          target_weight REAL,
          goal_weeks INTEGER,
          goal_date TEXT,
          goal_status TEXT DEFAULT 'active',
          username TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (email) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS nutrition_profile_v2 (
          user_id TEXT PRIMARY KEY,
          daily_calories_goal INTEGER NOT NULL,
          activity_level TEXT NOT NULL,
          goal_type TEXT NOT NULL,
          updated_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users (email) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS meals_v2_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
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
          FOREIGN KEY (user_id) REFERENCES users (email) ON DELETE CASCADE
        );
      `);

      // 2) Copiar datos mapeando el id legacy -> email (usuario unificado).
      await db.execAsync(`
        INSERT OR IGNORE INTO users_v2 (email, name, password_hash, auth_provider, created_at)
        SELECT lower(trim(email)), name, password_hash, auth_provider, created_at
          FROM users;

        INSERT OR IGNORE INTO user_profiles_v2
          (user_id, age, height, current_weight, target_weight, goal_weeks, goal_date, goal_status, username, created_at)
        SELECT users_v2.email, up.age, up.height, up.current_weight, up.target_weight,
               up.goal_weeks, up.goal_date, up.goal_status, up.username, up.created_at
          FROM user_profiles up
          JOIN users u ON up.user_id = u.id
          JOIN users_v2 ON users_v2.email = lower(trim(u.email));

        INSERT OR IGNORE INTO nutrition_profile_v2
          (user_id, daily_calories_goal, activity_level, goal_type, updated_at)
        SELECT users_v2.email, np.daily_calories_goal, np.activity_level, np.goal_type, np.updated_at
          FROM nutrition_profile np
          JOIN users u ON np.user_id = u.id
          JOIN users_v2 ON users_v2.email = lower(trim(u.email));

        INSERT OR IGNORE INTO meals_v2_v2
          (id, user_id, date, meal_type, image_uri, description, calories, protein_g, carbs_g, fat_g, notes, created_at)
        SELECT m.id, users_v2.email, m.date, m.meal_type, m.image_uri, m.description,
               m.calories, m.protein_g, m.carbs_g, m.fat_g, m.notes, m.created_at
          FROM meals_v2 m
          JOIN users u ON m.user_id = u.id
          JOIN users_v2 ON users_v2.email = lower(trim(u.email));
      `);

      // 3) Reemplazar las tablas legacy por las nuevas (PK = email).
      await db.execAsync(`
        DROP TABLE user_profiles;
        DROP TABLE nutrition_profile;
        DROP TABLE meals_v2;
        DROP TABLE users;
        ALTER TABLE users_v2 RENAME TO users;
        ALTER TABLE user_profiles_v2 RENAME TO user_profiles;
        ALTER TABLE nutrition_profile_v2 RENAME TO nutrition_profile;
        ALTER TABLE meals_v2_v2 RENAME TO meals_v2;
      `);
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}

// Elimina la columna legacy 'google_id' de la tabla 'users' (el login con
// Google se eliminó; la columna sobra en SQLite y hace que el payload de sync
// incluya un campo inexistente en Supabase). Idempotente: solo actúa si la
// columna sigue existiendo en el esquema mantenido por el dispositivo.
// CREATE/IMPORT ya no la escriben; esta migración limpia dispositivos que
// migraron a email-PK con la columna aún presente.
async function migrateDropUsersGoogleId(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(users)');
  const names = columns.map((c) => c.name);
  if (!names.includes('google_id')) {
    return;
  }
  try {
    await db.execAsync('ALTER TABLE users DROP COLUMN google_id');
  } catch {
    // SQLite < 3.35 no soporta DROP COLUMN: opcional, el saneamiento del
    // payload en syncService evita la advertencia en Supabase igualmente.
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
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(user_profiles)');
  const names = columns.map((c) => c.name);
  // Con la PK=email (post-migración) la columna 'id' ya no existe y la
  // unicidad la garantiza la propia clave primaria.
  if (!names.includes('id')) {
    return;
  }
  await db.execAsync(`
    DELETE FROM user_profiles
    WHERE id NOT IN (SELECT MIN(id) FROM user_profiles GROUP BY user_id);
    DROP INDEX IF EXISTS idx_user_profiles_user;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles (user_id);
  `);
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
