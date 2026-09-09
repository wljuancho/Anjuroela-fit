import { getDatabase } from './database';
import type { BodyPart, ExerciseWithBodyPart, NewBodyPart, NewExercise } from '../types/exercise';

interface SeedBodyPart {
  name: string;
  exercises: { name: string; description: string; equipment?: string }[];
}

const SEED_DATA: SeedBodyPart[] = [
  {
    name: 'Piernas',
    exercises: [
      { name: 'Sentadilla', description: 'Baja flexionando caderas y rodillas, espalda recta.', equipment: 'Barra, mancuerna' },
      { name: 'Prensa de piernas', description: 'Empuja la plataforma con las piernas desde una posición sentado.', equipment: 'Prensa' },
      { name: 'Zancada', description: 'Da un paso largo hacia adelante y baja la cadera.', equipment: 'Mancuernas' },
      { name: 'Extensión de cuádriceps', description: 'Extiende la rodilla contra resistencia desde sentado.', equipment: 'Máquina' },
      { name: 'Curl femoral', description: 'Flexiona la rodilla llevando el talón hacia los glúteos.', equipment: 'Máquina' },
      { name: 'Peso muerto rumano', description: 'Inclina el torso hacia adelante con piernas casi rectas.', equipment: 'Barra' },
    ],
  },
  {
    name: 'Hombros',
    exercises: [
      { name: 'Press militar', description: 'Empuja peso desde los hombros por encima de la cabeza.', equipment: 'Barra, mancuernas' },
      { name: 'Elevaciones laterales', description: 'Levanta los brazos a los lados hasta la altura de los hombros.', equipment: 'Mancuernas' },
      { name: 'Elevaciones frontales', description: 'Levanta los brazos al frente hasta la altura de los hombros.', equipment: 'Mancuernas' },
      { name: 'Pájaros (rear delt fly)', description: 'Inclina el torso y abre los brazos hacia atrás.', equipment: 'Mancuernas' },
    ],
  },
  {
    name: 'Espalda',
    exercises: [
      { name: 'Dominadas', description: 'Tira de tu cuerpo hacia arriba agarra una barra.', equipment: 'Barra de dominadas' },
      { name: 'Remo con barra', description: 'Tira de la barra hacia el abdomen estando inclinado.', equipment: 'Barra' },
      { name: 'Remo con mancuerna', description: 'Tira de una mancuerna hacia el torso con una mano.', equipment: 'Mancuerna' },
      { name: 'Jalón al pecho', description: 'Tira de la barra hacia el pecho sentado en la máquina.', equipment: 'Polea' },
    ],
  },
  {
    name: 'Abdomen',
    exercises: [
      { name: 'Crunch', description: 'Contrae el abdomen elevando los hombros del suelo.', equipment: 'Ninguno' },
      { name: 'Plancha', description: 'Mantén el cuerpo recto apoyado en antebrazos y puntas de pies.', equipment: 'Ninguno' },
      { name: 'Elevación de piernas', description: 'Acostado, levanta las piernas hasta 90 grados.', equipment: 'Ninguno' },
      { name: 'Russian twist', description: 'Gira el torso sentado con los pies elevados.', equipment: 'Pesa rusa' },
    ],
  },
  {
    name: 'Pecho',
    exercises: [
      { name: 'Press de banca', description: 'Empuja la barra desde el pecho estando acostado.', equipment: 'Barra, banca' },
      { name: 'Press con mancuernas', description: 'Empuja mancuernas desde el pecho acostado en banca.', equipment: 'Mancuernas, banca' },
      { name: 'Aperturas (flyes)', description: 'Abre los brazos lateralmente desde el pecho.', equipment: 'Mancuernas, banca' },
      { name: 'Flexiones', description: 'Empuja el suelo alejando el cuerpo de él.', equipment: 'Ninguno' },
    ],
  },
  {
    name: 'Bíceps',
    exercises: [
      { name: 'Curl con barra', description: 'Flexiona los codos levantando la barra hacia los hombros.', equipment: 'Barra' },
      { name: 'Curl con mancuernas', description: 'Flexiona los codos alternando cada brazo.', equipment: 'Mancuernas' },
      { name: 'Curl martillo', description: 'Flexiona los codos con agarre neutro.', equipment: 'Mancuernas' },
      { name: 'Curl concentrado', description: 'Flexiona un codo apoyando el brazo en el muslo.', equipment: 'Mancuerna' },
    ],
  },
  {
    name: 'Tríceps',
    exercises: [
      { name: 'Extensión de tríceps en polea', description: 'Empuja la barra hacia abajo extendiendo los codos.', equipment: 'Polea' },
      { name: 'Press francés', description: 'Flexiona los codos bajando la barra hacia la frente acostado.', equipment: 'Barra, banca' },
      { name: 'Fondos en paralelas', description: 'Baja el cuerpo flexionando los codos en barras paralelas.', equipment: 'Barras paralelas' },
      { name: 'Extensión con mancuerna', description: 'Extiende un brazo por encima de la cabeza.', equipment: 'Mancuerna' },
    ],
  },
];

async function ensureSeed(): Promise<void> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM body_parts');
  if (rows[0]?.cnt > 0) return;

  for (const part of SEED_DATA) {
    const result = await db.runAsync(
      'INSERT INTO body_parts (name) VALUES (?)',
      [part.name],
    );
    const bodyPartId = result.lastInsertRowId;
    for (const ex of part.exercises) {
      await db.runAsync(
        'INSERT INTO exercises_v2 (name, body_part_id, description, equipment) VALUES (?, ?, ?, ?)',
        [ex.name, bodyPartId, ex.description, ex.equipment ?? null],
      );
    }
  }
}

export async function initExerciseData(): Promise<void> {
  await ensureSeed();
}

export async function getAllBodyParts(): Promise<BodyPart[]> {
  const db = getDatabase();
  return db.getAllAsync<BodyPart>('SELECT * FROM body_parts ORDER BY name');
}

export async function addBodyPart(data: NewBodyPart): Promise<BodyPart> {
  const db = getDatabase();
  const result = await db.runAsync(
    'INSERT INTO body_parts (name, icon) VALUES (?, ?)',
    [data.name.trim(), data.icon ?? null],
  );
  return { id: result.lastInsertRowId, name: data.name.trim(), icon: data.icon ?? null };
}

export async function getExercisesByBodyPart(bodyPartId: number): Promise<ExerciseWithBodyPart[]> {
  const db = getDatabase();
  return db.getAllAsync<ExerciseWithBodyPart>(
    `SELECT e.*, bp.name as body_part_name
     FROM exercises_v2 e
     INNER JOIN body_parts bp ON bp.id = e.body_part_id
     WHERE e.body_part_id = ?
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
     ORDER BY bp.name, e.name`,
  );
}

export async function addExercise(data: NewExercise): Promise<ExerciseWithBodyPart> {
  const db = getDatabase();
  const result = await db.runAsync(
    'INSERT INTO exercises_v2 (name, body_part_id, description, equipment) VALUES (?, ?, ?, ?)',
    [data.name.trim(), data.body_part_id, data.description?.trim() ?? null, data.equipment?.trim() ?? null],
  );
  const rows = await db.getAllAsync<ExerciseWithBodyPart>(
    `SELECT e.*, bp.name as body_part_name
     FROM exercises_v2 e
     INNER JOIN body_parts bp ON bp.id = e.body_part_id
     WHERE e.id = ?`,
    [result.lastInsertRowId],
  );
  return rows[0];
}
