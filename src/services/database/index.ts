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
  `);

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
  `);

  await migrateWorkoutSets(database);
  await migrateDayMuscles(database);
  await migrateUniqueSessionIndex(database);
  await migrateUserProfileGoalStatus(database);
  await migrateUserProfilesUnique(database);
  await cleanLegacyTestRecords(database);
}

async function migrateUniqueSessionIndex(db: SQLite.SQLiteDatabase): Promise<void> {
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

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.closeAsync();
    db = null;
  }
}
