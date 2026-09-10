import { getDatabase } from './database';
import { formatDate } from './utils';
import type {
  DayOfWeek,
  DayMuscle,
  WeeklyScheduleEntry,
  WorkoutSession,
  WorkoutSet,
  WorkoutSetInput,
  ExerciseWithSets,
} from '../types/workout';

const CYCLE_DAYS = 4;

export function getCycleKey(date: Date): number {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const ref = new Date(2024, 0, 1).getTime();
  const days = Math.floor((start.getTime() - ref) / 86400000);
  return Math.floor(days / CYCLE_DAYS);
}

const DEFAULT_SCHEDULE: { day: DayOfWeek; bodyPartName: string | null }[] = [
  { day: 'lunes', bodyPartName: 'Pecho' },
  { day: 'martes', bodyPartName: 'Espalda' },
  { day: 'miercoles', bodyPartName: 'Piernas' },
  { day: 'jueves', bodyPartName: 'Hombros' },
  { day: 'viernes', bodyPartName: 'Bíceps' },
  { day: 'sabado', bodyPartName: 'Tríceps' },
  { day: 'domingo', bodyPartName: null },
];

async function ensureDefaultSchedule(): Promise<void> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM weekly_schedule');
    if (rows[0]?.cnt > 0) return;

    await db.withTransactionAsync(async () => {
      for (const entry of DEFAULT_SCHEDULE) {
        let bodyPartId: number | null = null;
        if (entry.bodyPartName) {
          const bp = await db.getAllAsync<{ id: number }>(
            'SELECT id FROM body_parts WHERE name = ? LIMIT 1',
            [entry.bodyPartName],
          );
          bodyPartId = bp[0]?.id ?? null;
        }
        await db.runAsync(
          'INSERT INTO weekly_schedule (day_of_week, body_part_id) VALUES (?, ?)',
          [entry.day, bodyPartId],
        );
      }
    });
  } catch {
    throw new Error('No se pudo inicializar la rutina semanal.');
  }
}

export async function initWorkoutData(): Promise<void> {
  try {
    await ensureDefaultSchedule();
  } catch {
    // ensureDefaultSchedule already raises a user-facing error
  }
}

export async function getWeeklySchedule(): Promise<WeeklyScheduleEntry[]> {
  const db = getDatabase();
  try {
    return await db.getAllAsync<WeeklyScheduleEntry>(
      `SELECT ws.id, ws.day_of_week, ws.body_part_id, bp.name as body_part_name
       FROM weekly_schedule ws
       LEFT JOIN body_parts bp ON bp.id = ws.body_part_id
       ORDER BY CASE ws.day_of_week
         WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miercoles' THEN 3
         WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 WHEN 'sabado' THEN 6
         WHEN 'domingo' THEN 7 END`,
    );
  } catch {
    throw new Error('No se pudo cargar la rutina semanal.');
  }
}

export async function updateScheduleDay(dayOfWeek: DayOfWeek, bodyPartId: number | null): Promise<void> {
  const db = getDatabase();
  try {
    await db.runAsync(
      'UPDATE weekly_schedule SET body_part_id = ? WHERE day_of_week = ?',
      [bodyPartId, dayOfWeek],
    );
  } catch {
    throw new Error('No se pudo actualizar el día de la rutina.');
  }
}

export async function getOrCreateSession(dayOfWeek: DayOfWeek): Promise<WorkoutSession> {
  const db = getDatabase();
  try {
    const today = formatDate(new Date());
    const existing = await db.getAllAsync<WorkoutSession>(
      'SELECT * FROM workout_sessions WHERE day_of_week = ? AND date = ? LIMIT 1',
      [dayOfWeek, today],
    );
    if (existing[0]) return existing[0];

    const result = await db.runAsync(
      'INSERT INTO workout_sessions (day_of_week, date, completed) VALUES (?, ?, 0)',
      [dayOfWeek, today],
    );
    return { id: result.lastInsertRowId, day_of_week: dayOfWeek, date: today, completed: 0 };
  } catch {
    throw new Error('No se pudo iniciar la sesión de entrenamiento.');
  }
}

export async function completeSession(sessionId: number): Promise<void> {
  const db = getDatabase();
  try {
    await db.runAsync('UPDATE workout_sessions SET completed = 1 WHERE id = ?', [sessionId]);
  } catch {
    throw new Error('No se pudo completar la sesión.');
  }
}

export async function upsertSets(sessionId: number, sets: WorkoutSetInput[]): Promise<void> {
  const db = getDatabase();
  try {
    await db.withTransactionAsync(async () => {
      for (const s of sets) {
        const setType = s.set_type ?? 'reps';
        const timeSeconds = setType === 'time' ? s.time_seconds ?? null : null;
        const existing = await db.getAllAsync<{ id: number }>(
          'SELECT id FROM workout_sets WHERE session_id = ? AND exercise_id = ? AND set_number = ?',
          [sessionId, s.exercise_id, s.set_number],
        );
        if (existing[0]) {
          await db.runAsync(
            'UPDATE workout_sets SET weight_kg = ?, reps = ?, set_type = ?, time_seconds = ? WHERE id = ?',
            [s.weight_kg, s.reps, setType, timeSeconds, existing[0].id],
          );
        } else {
          await db.runAsync(
            'INSERT INTO workout_sets (session_id, exercise_id, set_number, weight_kg, reps, set_type, time_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [sessionId, s.exercise_id, s.set_number, s.weight_kg, s.reps, setType, timeSeconds],
          );
        }
      }
    });
  } catch {
    throw new Error('No se pudieron guardar las series.');
  }
}

export async function getSetsForSession(sessionId: number): Promise<WorkoutSet[]> {
  const db = getDatabase();
  try {
    return await db.getAllAsync<WorkoutSet>(
      `SELECT ws.id, ws.session_id, ws.exercise_id, e.name as exercise_name,
              ws.set_number, ws.weight_kg, ws.reps, ws.set_type, ws.time_seconds
       FROM workout_sets ws
       INNER JOIN exercises_v2 e ON e.id = ws.exercise_id
       WHERE ws.session_id = ?
       ORDER BY ws.exercise_id, ws.set_number`,
      [sessionId],
    );
  } catch {
    throw new Error('No se pudieron cargar las series.');
  }
}

export async function getExercisesWithSets(sessionId: number): Promise<ExerciseWithSets[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<{
      exercise_id: number;
      exercise_name: string;
      body_part_name: string;
      equipment: string | null;
      id: number;
      set_number: number;
      weight_kg: number | null;
      reps: number | null;
      set_type: 'reps' | 'time' | null;
      time_seconds: number | null;
    }>(
      `SELECT e.id as exercise_id, e.name as exercise_name, bp.name as body_part_name,
              e.equipment, ws.id, ws.set_number, ws.weight_kg, ws.reps, ws.set_type, ws.time_seconds
       FROM workout_sets ws
       INNER JOIN exercises_v2 e ON e.id = ws.exercise_id
       INNER JOIN body_parts bp ON bp.id = e.body_part_id
       WHERE ws.session_id = ?
       ORDER BY e.name, ws.set_number`,
      [sessionId],
    );

    const grouped = new Map<number, ExerciseWithSets>();
    for (const row of rows) {
      if (!grouped.has(row.exercise_id)) {
        grouped.set(row.exercise_id, {
          exercise_id: row.exercise_id,
          exercise_name: row.exercise_name,
          body_part_name: row.body_part_name,
          equipment: row.equipment,
          sets: [],
        });
      }
      grouped.get(row.exercise_id)!.sets.push({
        id: row.id,
        session_id: sessionId,
        exercise_id: row.exercise_id,
        exercise_name: row.exercise_name,
        set_number: row.set_number,
        weight_kg: row.weight_kg,
        reps: row.reps,
        set_type: row.set_type ?? 'reps',
        time_seconds: row.time_seconds ?? null,
      });
    }
    return Array.from(grouped.values());
  } catch {
    throw new Error('No se pudieron cargar los ejercicios de la sesión.');
  }
}

export async function getExercisesForBodyPart(bodyPartId: number): Promise<{ id: number; name: string; equipment: string | null }[]> {
  const db = getDatabase();
  try {
    return await db.getAllAsync(
      'SELECT id, name, equipment FROM exercises_v2 WHERE body_part_id = ? ORDER BY name',
      [bodyPartId],
    );
  } catch {
    throw new Error('No se pudieron cargar los ejercicios.');
  }
}

export async function getExerciseHistory(exerciseId: number): Promise<WorkoutSet[]> {
  const db = getDatabase();
  try {
    return await db.getAllAsync<WorkoutSet>(
      `SELECT ws.id, ws.session_id, ws.exercise_id, e.name as exercise_name,
              ws.set_number, ws.weight_kg, ws.reps, ws.set_type, ws.time_seconds
       FROM workout_sets ws
       INNER JOIN exercises_v2 e ON e.id = ws.exercise_id
       WHERE ws.exercise_id = ?
       ORDER BY ws.session_id DESC, ws.set_number`,
      [exerciseId],
    );
  } catch {
    throw new Error('No se pudo cargar el historial del ejercicio.');
  }
}

export async function getDayMuscles(day: DayOfWeek): Promise<DayMuscle[]> {
  const db = getDatabase();
  try {
    const currentKey = getCycleKey(new Date());
    const rows = await db.getAllAsync<{
      id: number;
      day_of_week: DayOfWeek;
      body_part_id: number;
      body_part_name: string;
      position: number;
      completed: number;
      completed_date: string | null;
    }>(
      `SELECT dm.id, dm.day_of_week, dm.body_part_id, bp.name as body_part_name,
              dm.position, dm.completed, dm.completed_date
       FROM day_muscles dm
       INNER JOIN body_parts bp ON bp.id = dm.body_part_id
       WHERE dm.day_of_week = ?
       ORDER BY dm.position, dm.id`,
      [day],
    );
    return rows.map((r) => ({
      ...r,
      isCompletedInCycle:
        r.completed === 1 &&
        !!r.completed_date &&
        getCycleKey(new Date(r.completed_date)) === currentKey,
    }));
  } catch {
    throw new Error('No se pudieron cargar los músculos del día.');
  }
}

export async function getAllDayMuscles(): Promise<DayMuscle[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<DayMuscle & { body_part_name: string }>(
      `SELECT dm.id, dm.day_of_week, dm.body_part_id, bp.name as body_part_name,
              dm.position, dm.completed, dm.completed_date
       FROM day_muscles dm
       INNER JOIN body_parts bp ON bp.id = dm.body_part_id
       ORDER BY dm.day_of_week, dm.position, dm.id`,
    );
    const currentKey = getCycleKey(new Date());
    return rows.map((r) => ({
      ...r,
      isCompletedInCycle:
        r.completed === 1 &&
        !!r.completed_date &&
        getCycleKey(new Date(r.completed_date)) === currentKey,
    }));
  } catch {
    throw new Error('No se pudo cargar la rutina.');
  }
}

export async function addMusclesToDay(day: DayOfWeek, bodyPartIds: number[]): Promise<void> {
  const db = getDatabase();
  try {
    await db.withTransactionAsync(async () => {
      for (const bodyPartId of bodyPartIds) {
        const pos = await db.getAllAsync<{ mx: number }>(
          'SELECT COALESCE(MAX(position), -1) + 1 as mx FROM day_muscles WHERE day_of_week = ?',
          [day],
        );
        await db.runAsync(
          'INSERT OR IGNORE INTO day_muscles (day_of_week, body_part_id, position, completed) VALUES (?, ?, ?, 0)',
          [day, bodyPartId, pos[0]?.mx ?? 0],
        );
      }
    });
  } catch {
    throw new Error('No se pudo agregar el músculo al día.');
  }
}

export async function removeMuscleFromDay(muscleId: number): Promise<void> {
  const db = getDatabase();
  try {
    await db.runAsync('DELETE FROM day_muscles WHERE id = ?', [muscleId]);
  } catch {
    throw new Error('No se pudo quitar el músculo del día.');
  }
}

export async function markMuscleCompleted(muscleId: number): Promise<void> {
  const db = getDatabase();
  try {
    await db.runAsync(
      'UPDATE day_muscles SET completed = 1, completed_date = ? WHERE id = ?',
      [formatDate(new Date()), muscleId],
    );
  } catch {
    throw new Error('No se pudo marcar el músculo como terminado.');
  }
}

export async function resetStaleCompletions(): Promise<void> {
  const db = getDatabase();
  try {
    const currentKey = getCycleKey(new Date());
    const rows = await db.getAllAsync<{ id: number; completed_date: string | null }>(
      'SELECT id, completed_date FROM day_muscles WHERE completed = 1',
    );
    for (const row of rows) {
      if (!row.completed_date || getCycleKey(new Date(row.completed_date)) !== currentKey) {
        await db.runAsync(
          'UPDATE day_muscles SET completed = 0, completed_date = NULL WHERE id = ?',
          [row.id],
        );
      }
    }
  } catch {
    // Reset no requiere error al usuario; se ignora
  }
}

export async function getLastWeightForExercise(exerciseId: number): Promise<number | null> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<{ weight_kg: number | null }>(
      `SELECT ws.weight_kg
       FROM workout_sets ws
       WHERE ws.exercise_id = ? AND ws.weight_kg IS NOT NULL AND ws.weight_kg > 0
       ORDER BY ws.session_id DESC, ws.set_number ASC
       LIMIT 1`,
      [exerciseId],
    );
    return rows[0]?.weight_kg ?? null;
  } catch {
    return null;
  }
}
