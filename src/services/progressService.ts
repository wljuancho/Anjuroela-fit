import { getDatabase } from './database';
import { getProfile, updateGoalStatus } from './authService';
import type {
  WeightLog,
  NewWeightLog,
  GoalSummary,
  StrengthHistoryEntry,
  ExerciseStrengthRecord,
  MuscleGroupStrengthHistory,
  MuscleSessionPoint,
  GoalDeadlineEvaluation,
} from '../types/progress';

export async function addWeightLog(data: NewWeightLog): Promise<WeightLog> {
  const db = getDatabase();
  try {
    const existing = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM weight_logs WHERE date = ? LIMIT 1',
      [data.date],
    );
    if (existing[0]) {
      await db.runAsync(
        'UPDATE weight_logs SET weight_kg = ?, notes = ? WHERE id = ?',
        [data.weight_kg, data.notes?.trim() || null, existing[0].id],
      );
      return {
        id: existing[0].id,
        date: data.date,
        weight_kg: data.weight_kg,
        notes: data.notes?.trim() || null,
      };
    }
    const result = await db.runAsync(
      'INSERT INTO weight_logs (date, weight_kg, notes) VALUES (?, ?, ?)',
      [data.date, data.weight_kg, data.notes?.trim() || null],
    );
    return {
      id: result.lastInsertRowId,
      date: data.date,
      weight_kg: data.weight_kg,
      notes: data.notes?.trim() || null,
    };
  } catch {
    throw new Error('No se pudo registrar el peso.');
  }
}

export async function getWeightHistory(): Promise<WeightLog[]> {
  const db = getDatabase();
  try {
    return await db.getAllAsync<WeightLog>(
      'SELECT * FROM weight_logs ORDER BY date DESC, id DESC',
    );
  } catch {
    throw new Error('No se pudo cargar el historial de peso.');
  }
}

export async function getLatestWeightLog(): Promise<WeightLog | null> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<WeightLog>(
      'SELECT * FROM weight_logs ORDER BY date DESC, id DESC LIMIT 1',
    );
    return rows[0] ?? null;
  } catch {
    throw new Error('No se pudo cargar el último peso registrado.');
  }
}

export async function updateWeightLog(id: number, data: NewWeightLog): Promise<void> {
  const db = getDatabase();
  try {
    await db.runAsync(
      'UPDATE weight_logs SET date = ?, weight_kg = ?, notes = ? WHERE id = ?',
      [data.date, data.weight_kg, data.notes?.trim() || null, id],
    );
  } catch {
    throw new Error('No se pudo actualizar el registro.');
  }
}

export async function deleteWeightLog(id: number): Promise<void> {
  const db = getDatabase();
  try {
    await db.runAsync('DELETE FROM weight_logs WHERE id = ?', [id]);
  } catch {
    throw new Error('No se pudo eliminar el registro.');
  }
}

export async function evaluateGoalDeadline(userId: number): Promise<GoalDeadlineEvaluation | null> {
  try {
    const profile = await getProfile(userId);
    if (!profile) return null;

    const goalStatus = profile.goal_status ?? 'active';
    const goalDate = profile.goal_date ?? null;
    const targetWeight = profile.target_weight ?? null;

    if (goalStatus !== 'active' || !goalDate || targetWeight === null) {
      return null;
    }

    const today = new Date().toISOString().split('T')[0];
    if (goalDate > today) {
      return null;
    }

    const latestLog = await getLatestWeightLog();
    const currentWeight = latestLog?.weight_kg ?? profile.current_weight ?? null;

    if (currentWeight === null) {
      return null;
    }

    const initialWeight = profile.current_weight ?? currentWeight;

    let direction: 'lose' | 'gain' | 'maintain' = 'maintain';
    if (Math.abs(targetWeight - initialWeight) >= 0.01) {
      direction = targetWeight < initialWeight ? 'lose' : 'gain';
    }

    let reached: boolean;
    if (direction === 'lose') {
      reached = currentWeight <= targetWeight;
    } else if (direction === 'gain') {
      reached = currentWeight >= targetWeight;
    } else {
      reached = Math.abs(currentWeight - targetWeight) <= 0.5;
    }

    await updateGoalStatus(userId, reached ? 'completed' : 'expired');

    return {
      reached,
      currentWeight: Math.round(currentWeight * 10) / 10,
      targetWeight,
      goalDate,
    };
  } catch {
    return null;
  }
}

export async function getGoalSummary(userId: number): Promise<GoalSummary> {
  try {
    const profile = await getProfile(userId);
    const latestLog = await getLatestWeightLog();

    const initialWeight = profile?.current_weight ?? null;
    const targetWeight = profile?.target_weight ?? null;
    const goalDate = profile?.goal_date ?? null;
    const goalWeeks = profile?.goal_weeks ?? null;

    const currentWeight = latestLog?.weight_kg ?? initialWeight;

    let direction: GoalSummary['direction'] = null;
    if (initialWeight !== null && currentWeight !== null && targetWeight !== null) {
      if (Math.abs(targetWeight - initialWeight) < 0.01) {
        direction = 'maintain';
      } else if (targetWeight < initialWeight) {
        direction = 'lose';
      } else {
        direction = 'gain';
      }
    }

    let progressPercent: number | null = null;
    if (initialWeight !== null && currentWeight !== null && targetWeight !== null && direction && direction !== 'maintain') {
      const targetDelta = targetWeight - initialWeight;
      const currentDelta = currentWeight - initialWeight;
      if (Math.abs(targetDelta) > 0.01) {
        const raw = (currentDelta / targetDelta) * 100;
        progressPercent = Math.min(100, Math.max(0, Math.round(raw * 10) / 10));
      }
    }

    let differenceRemaining: number | null = null;
    if (currentWeight !== null && targetWeight !== null) {
      differenceRemaining = Math.round((targetWeight - currentWeight) * 10) / 10;
    }

    return {
      initialWeight,
      currentWeight,
      targetWeight,
      goalDate,
      goalWeeks,
      differenceRemaining,
      progressPercent,
      direction,
    };
  } catch {
    throw new Error('No se pudo cargar el resumen de tu progreso.');
  }
}

export async function getStrengthExerciseRecords(): Promise<ExerciseStrengthRecord[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<{
      exercise_id: number;
      exercise_name: string;
      body_part_name: string;
      set_date: string;
      maxWeightKg: number;
    }>(
      `SELECT e.id AS exercise_id, e.name AS exercise_name, bp.name AS body_part_name,
              sess.date AS set_date, MAX(ws.weight_kg) AS maxWeightKg
       FROM workout_sets ws
       INNER JOIN exercises_v2 e ON e.id = ws.exercise_id
       INNER JOIN body_parts bp ON bp.id = e.body_part_id
       INNER JOIN workout_sessions sess ON sess.id = ws.session_id
       WHERE ws.weight_kg IS NOT NULL
       GROUP BY e.id, e.name, bp.name, sess.date
       ORDER BY e.name, sess.date`,
    );

    const records = new Map<number, ExerciseStrengthRecord>();
    for (const row of rows) {
      let record = records.get(row.exercise_id);
      if (!record) {
        record = {
          exerciseId: row.exercise_id,
          exerciseName: row.exercise_name,
          bodyPartName: row.body_part_name,
          history: [],
        };
        records.set(row.exercise_id, record);
      }
      record.history.push({ date: row.set_date, maxWeightKg: row.maxWeightKg });
    }
    return Array.from(records.values());
  } catch {
    throw new Error('No se pudieron cargar tus marcas de fuerza.');
  }
}

export async function getStrengthHistoryForExercise(exerciseId: number): Promise<StrengthHistoryEntry[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<{ date: string; maxWeightKg: number }>(
      `SELECT sess.date, MAX(ws.weight_kg) as maxWeightKg
       FROM workout_sets ws
       INNER JOIN workout_sessions sess ON sess.id = ws.session_id
       WHERE ws.exercise_id = ? AND ws.weight_kg IS NOT NULL
       GROUP BY sess.date
       ORDER BY sess.date`,
      [exerciseId],
    );
    return rows.map((r) => ({ date: r.date, maxWeightKg: r.maxWeightKg }));
  } catch {
    throw new Error('No se pudo cargar el historial del ejercicio.');
  }
}

export async function getMuscleProgressHistory(bodyPartId: number): Promise<MuscleSessionPoint[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<{
      date: string;
      avgWeightKg: number;
      setCount: number;
    }>(
      `SELECT sess.date,
              COALESCE(AVG(NULLIF(ws.weight_kg, 0)), 0) AS avgWeightKg,
              COUNT(ws.id) AS setCount
       FROM workout_sets ws
       INNER JOIN workout_sessions sess ON sess.id = ws.session_id
       INNER JOIN exercises_v2 e ON e.id = ws.exercise_id
       WHERE e.body_part_id = ?
         AND (ws.reps IS NOT NULL OR ws.time_seconds IS NOT NULL)
       GROUP BY sess.id, sess.date
       ORDER BY sess.date, sess.id`,
      [bodyPartId],
    );
    return rows.map((r) => ({
      date: r.date,
      avgWeightKg: Math.round(r.avgWeightKg * 10) / 10,
      setCount: r.setCount,
    }));
  } catch {
    throw new Error('No se pudo cargar el progreso por sesión del músculo.');
  }
}

export async function getMuscleGroupStrengthHistory(): Promise<MuscleGroupStrengthHistory[]> {
  const db = getDatabase();
  try {
    const rows = await db.getAllAsync<{
      body_part_id: number;
      body_part_name: string;
      set_date: string;
      avgWeightKg: number;
    }>(
      `SELECT bp.id AS body_part_id, bp.name AS body_part_name,
              sess.date AS set_date, AVG(ws.weight_kg) AS avgWeightKg
       FROM workout_sets ws
       INNER JOIN exercises_v2 e ON e.id = ws.exercise_id
       INNER JOIN body_parts bp ON bp.id = e.body_part_id
       INNER JOIN workout_sessions sess ON sess.id = ws.session_id
       WHERE ws.weight_kg IS NOT NULL AND ws.weight_kg > 0
       GROUP BY bp.id, bp.name, sess.date
       ORDER BY bp.name, sess.date`,
    );
    const grouped = new Map<number, MuscleGroupStrengthHistory>();
    for (const row of rows) {
      let entry = grouped.get(row.body_part_id);
      if (!entry) {
        entry = {
          bodyPartId: row.body_part_id,
          bodyPartName: row.body_part_name,
          history: [],
        };
        grouped.set(row.body_part_id, entry);
      }
      entry.history.push({
        date: row.set_date,
        maxWeightKg: Math.round(row.avgWeightKg * 10) / 10,
      });
    }
    return Array.from(grouped.values());
  } catch {
    throw new Error('No se pudo cargar el historial por grupo muscular.');
  }
}