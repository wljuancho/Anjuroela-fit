import { getDatabase } from './database';
import { syncLocalToRemote } from './syncService';
import type {
  BodyPart,
  ExerciseWithBodyPart,
  NewBodyPart,
  NewExercise,
  UpdateBodyPart,
  UpdateExercise,
} from '../types/exercise';

export async function getAllBodyParts(): Promise<BodyPart[]> {
  const db = getDatabase();
  return db.getAllAsync<BodyPart>('SELECT * FROM body_parts WHERE is_active = 1 ORDER BY name');
}

export async function addBodyPart(data: NewBodyPart): Promise<BodyPart> {
  const db = getDatabase();
  const existing = await db.getAllAsync<{ id: number; is_active: number }>(
    'SELECT id, is_active FROM body_parts WHERE LOWER(name) = LOWER(?) LIMIT 1',
    [data.name.trim()],
  );
  if (existing[0]) {
    if (existing[0].is_active) {
      throw new Error('Ya existe una categoría con ese nombre.');
    }
    await db.runAsync('UPDATE body_parts SET is_active = 1, icon = ? WHERE id = ?', [
      data.icon ?? null,
      existing[0].id,
    ]);
    const rows = await db.getAllAsync<BodyPart>('SELECT * FROM body_parts WHERE id = ?', [
      existing[0].id,
    ]);
    void syncLocalToRemote('body_parts');
    return rows[0];
  }
  const result = await db.runAsync(
    'INSERT INTO body_parts (name, icon) VALUES (?, ?)',
    [data.name.trim(), data.icon ?? null],
  );
  void syncLocalToRemote('body_parts');
  return { id: result.lastInsertRowId, name: data.name.trim(), icon: data.icon ?? null };
}

export async function deleteBodyPart(bodyPartId: number): Promise<void> {
  const db = getDatabase();
  try {
    // Borrado SOLO VISUAL (reset visual): el músculo y sus ejercicios se
    // ocultan (is_active = 0) pero sus filas PERMANECEN en la BD — ejercicio y
    // rutina incluidos (day_exercises/day_muscles intactos). Así el histórico
    // de series y peso sigue contando en Progreso y, si el usuario vuelve a
    // crear el músculo con el mismo nombre, reaparece con su rutina. Solo la
    // eliminación de la cuenta (users) borra todo lo relacionado con él.
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE exercises_v2 SET is_active = 0 WHERE body_part_id = ?', [
        bodyPartId,
      ]);
      await db.runAsync('UPDATE weekly_schedule SET body_part_id = NULL WHERE body_part_id = ?', [
        bodyPartId,
      ]);
      await db.runAsync('UPDATE body_parts SET is_active = 0 WHERE id = ?', [bodyPartId]);
    });
    void syncLocalToRemote();
  } catch {
    throw new Error('No se pudo eliminar la categoría.');
  }
}

export async function updateBodyPart(data: UpdateBodyPart): Promise<BodyPart> {
  const db = getDatabase();
  const existing = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM body_parts WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1',
    [data.name.trim(), data.id],
  );
  if (existing[0]) {
    throw new Error('Ya existe una categoría con ese nombre.');
  }
  await db.runAsync('UPDATE body_parts SET name = ? WHERE id = ?', [data.name.trim(), data.id]);
  void syncLocalToRemote('body_parts');
  const rows = await db.getAllAsync<BodyPart>('SELECT * FROM body_parts WHERE id = ?', [data.id]);
  return rows[0];
}

export async function getBodyPartExerciseCount(bodyPartId: number): Promise<number> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM exercises_v2 WHERE body_part_id = ? AND is_active = 1',
    [bodyPartId],
  );
  return rows[0]?.cnt ?? 0;
}

export async function getExercisesByBodyPart(bodyPartId: number): Promise<ExerciseWithBodyPart[]> {
  const db = getDatabase();
  return db.getAllAsync<ExerciseWithBodyPart>(
    `SELECT e.*, bp.name as body_part_name
     FROM exercises_v2 e
     INNER JOIN body_parts bp ON bp.id = e.body_part_id
     WHERE e.body_part_id = ? AND e.is_active = 1
     ORDER BY e.name`,
    [bodyPartId],
  );
}

export async function getAllExercises(): Promise<ExerciseWithBodyPart[]> {
  const db = getDatabase();
  return db.getAllAsync<ExerciseWithBodyPart>(
    `SELECT e.*, bp.name as body_part_name
     FROM exercises_v2 e
     INNER JOIN body_parts bp ON bp.id = e.body_part_id
     WHERE e.is_active = 1
     ORDER BY bp.name, e.name`,
  );
}

export async function addExercise(data: NewExercise): Promise<ExerciseWithBodyPart> {
  const db = getDatabase();
  const existing = await db.getAllAsync<{ id: number; is_active: number }>(
    'SELECT id, is_active FROM exercises_v2 WHERE body_part_id = ? AND LOWER(name) = LOWER(?) LIMIT 1',
    [data.body_part_id, data.name.trim()],
  );
  if (existing[0]) {
    if (existing[0].is_active) {
      throw new Error('Ya existe un ejercicio con ese nombre en esta parte del cuerpo.');
    }
    await db.runAsync(
      'UPDATE exercises_v2 SET is_active = 1, description = ?, equipment = ?, mode = ? WHERE id = ?',
      [data.description?.trim() ?? null, data.equipment?.trim() ?? null, data.mode ?? null, existing[0].id],
    );
    void syncLocalToRemote('exercises_v2');
    const rows = await db.getAllAsync<ExerciseWithBodyPart>(
      `SELECT e.*, bp.name as body_part_name
       FROM exercises_v2 e
       INNER JOIN body_parts bp ON bp.id = e.body_part_id
       WHERE e.id = ?`,
      [existing[0].id],
    );
    return rows[0];
  }
  const result = await db.runAsync(
    'INSERT INTO exercises_v2 (name, body_part_id, description, equipment, mode) VALUES (?, ?, ?, ?, ?)',
    [data.name.trim(), data.body_part_id, data.description?.trim() ?? null, data.equipment?.trim() ?? null, data.mode ?? null],
  );
  void syncLocalToRemote('exercises_v2');
  const rows = await db.getAllAsync<ExerciseWithBodyPart>(
    `SELECT e.*, bp.name as body_part_name
     FROM exercises_v2 e
     INNER JOIN body_parts bp ON bp.id = e.body_part_id
     WHERE e.id = ?`,
    [result.lastInsertRowId],
  );
  return rows[0];
}

export async function updateExercise(data: UpdateExercise): Promise<ExerciseWithBodyPart> {
  const db = getDatabase();
  const existing = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM exercises_v2 WHERE body_part_id = ? AND LOWER(name) = LOWER(?) AND id <> ? LIMIT 1',
    [data.body_part_id, data.name.trim(), data.id],
  );
  if (existing[0]) {
    throw new Error('Ya existe un ejercicio con ese nombre en esta parte del cuerpo.');
  }
  await db.runAsync(
    'UPDATE exercises_v2 SET name = ?, body_part_id = ?, description = ?, equipment = ?, mode = ? WHERE id = ?',
    [
      data.name.trim(),
      data.body_part_id,
      data.description?.trim() ?? null,
      data.equipment?.trim() ?? null,
      data.mode ?? null,
      data.id,
    ],
  );
  void syncLocalToRemote('exercises_v2');
  const rows = await db.getAllAsync<ExerciseWithBodyPart>(
    `SELECT e.*, bp.name as body_part_name
     FROM exercises_v2 e
     INNER JOIN body_parts bp ON bp.id = e.body_part_id
     WHERE e.id = ?`,
    [data.id],
  );
  return rows[0];
}

export async function deleteExercise(exerciseId: number): Promise<void> {
  const db = getDatabase();
  try {
    // Borrado SOLO VISUAL: el ejercicio se oculta (is_active = 0) en el
    // catálogo y en la rutina del día, pero sus filas (day_exercises) y su
    // histórico de series y peso PERMANECEN en la BD para no perder Progreso.
    await db.runAsync('UPDATE exercises_v2 SET is_active = 0 WHERE id = ?', [exerciseId]);
    void syncLocalToRemote('exercises_v2');
  } catch {
    throw new Error('No se pudo eliminar el ejercicio.');
  }
}
