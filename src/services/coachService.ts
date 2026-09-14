import { AI_CONFIG } from '../constants/config';
import { getVisionApiKey } from './configService';
import { formatDate, formatNumber } from './utils';
import { getProfile } from './authService';
import {
  getAllBodyParts,
  addBodyPart,
  getAllExercises,
  addExercise,
} from './exerciseService';
import {
  addMusclesToDay,
  addExercisesToDay,
  getWeeklySchedule,
} from './workoutService';
import {
  getWeightHistory,
  getGoalSummary,
  getStrengthExerciseRecords,
} from './progressService';
import {
  getNutritionProfile,
  getNutritionDayData,
  replaceWeeklyMealPlan,
} from './nutritionService';
import { DAYS_ORDER } from '../types/workout';
import type { DayOfWeek } from '../types/workout';
import type {
  ChatMessage,
  CoachProposal,
  RoutineAction,
  RoutineActionType,
  WeeklyPlanRow,
} from '../types/coach';

export interface CoachOutcome {
  message: string;
  proposal: CoachProposal | null;
}

const ACTION_OPEN = '<<<ACCIONES>>>';
const ACTION_CLOSE = '<<<FIN_ACCIONES>>>';
const MEAL_OPEN = '<<<COMIDAS>>>';
const MEAL_CLOSE = '<<<FIN_COMIDAS>>>';

const ACTION_TYPES: RoutineActionType[] = [
  'crear_musculo',
  'crear_ejercicio',
  'agregar_musculo_dia',
  'agregar_ejercicio_dia',
];

const NO_KEY_MESSAGE =
  'Aún no tengo mi clave de IA configurada. Entra a la pestaña Ajustes, añade tu API Key y vuelve para activarme.';

const DAY_MAP: Record<string, string> = {
  lunes: 'lunes',
  martes: 'martes',
  miercoles: 'miercoles',
  jueves: 'jueves',
  viernes: 'viernes',
  sabado: 'sabado',
  domingo: 'domingo',
};

const MEAL_MAP: Record<string, string> = {
  desayuno: 'desayuno',
  almuerzo: 'almuerzo',
  comida: 'almuerzo',
  cena: 'cena',
  snack: 'snack',
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentario: 'sedentaria',
  moderado: 'moderada',
  activo: 'activa',
};

const GOAL_LABELS: Record<string, string> = {
  perder: 'perder grasa',
  ganar: 'ganar masa',
  mantener: 'mantener',
};

function normalizeDay(value: string): string | null {
  const key = (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  return DAY_MAP[key] ?? null;
}

function normalizeMealType(value: string): string | null {
  const key = (value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return MEAL_MAP[key] ?? null;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const SYSTEM_PROMPT =
  'Eres "Anjuroela", entrenador personal inteligente de la app de fitness "Anjuroela Fit". ' +
  'Tu misión es guiar, motivar y personalizar la experiencia del usuario.\n\n' +
  'REGLAS:\n' +
  '1. Responde SIEMPRE en español, de forma clara, empática y motivadora. Usa listas simples cuando ayudes.\n' +
  '2. Basa tus recomendaciones en los DATOS REALES del contexto del usuario. Si no tienes un dato, no lo inventes.\n' +
  '3. Cuando el usuario pida modificar, crear o reorganizar su rutina o sus ejercicios, además de tu explicación ' +
  'añade un bloque JSON con las ACCIONES concretas que propones para la base de datos, con este formato exacto:\n\n' +
  `${ACTION_OPEN}\n` +
  '{"actions":[{"action":"crear_musculo","name":"Nombre","icon":"fitness"},' +
  '{"action":"crear_ejercicio","body_part_name":"Nombre del músculo","name":"Nombre del ejercicio","description":"...","equipment":"..."},' +
  '{"action":"agregar_musculo_dia","day":"lunes","body_part_name":"Nombre del músculo"},' +
  '{"action":"agregar_ejercicio_dia","day":"lunes","body_part_name":"Nombre del músculo","exercise_name":"Nombre del ejercicio"}]}\n' +
  `${ACTION_CLOSE}\n\n` +
  '   - Acciones permitidas: "crear_musculo", "crear_ejercicio", "agregar_musculo_dia", "agregar_ejercicio_dia".\n' +
  '   - "day" es uno de: lunes, martes, miercoles, jueves, viernes, sabado, domingo.\n' +
  '   - Reutiliza los nombres de músculos y ejercicios que ya existen en el contexto; crea nuevos solo cuando el usuario lo pida. ' +
  'Cuando crees un ejercicio incluye siempre su "body_part_name".\n' +
  '   - El bloque JSON debe ser válido y completo. Fuera del bloque escribe tu explicación en texto plano.\n' +
  '4. Cuando el usuario pida un plan o menú de comidas semanal:\n' +
  '   - Si NO indica para cuántas personas es ni sus preferencias (gustos, alergias, objetivo), pregúntale primero en texto y NO añadas bloque JSON.\n' +
  '   - Cuando tengas el número de personas y sus preferencias, genera un menú para TODA la semana (lunes a domingo) con al menos ' +
  'desayuno, almuerzo y cena cada día, y añade:\n\n' +
  `${MEAL_OPEN}\n` +
  '{"servings":2,"plan":[{"day":"lunes","meal_type":"desayuno","title":"...","description":"...","ingredients":"..."},...]}\n' +
  `${MEAL_CLOSE}\n\n` +
  '   - "meal_type" es uno de: desayuno, almuerzo, cena, snack.\n' +
  '   - El menú debe respetar el objetivo, las preferencias y las cantidades adecuadas al número de personas.\n' +
  '5. Fuera de las etiquetas <<<ACCIONES>>>...<<<FIN_ACCIONES>>> o <<<COMIDAS>>>...<<<FIN_COMIDAS>>> NUNCA incluyas JSON.' +
  '6. Si alguna acción no puede aplicarse, indícalo en el texto.';

async function buildContext(userId: number): Promise<string> {
  const sections: string[] = ['DATOS ACTUALES DEL USUARIO (usados para recomendar):'];

  try {
    const profile = await getProfile(userId);
    if (profile) {
      const weight =
        profile.current_weight != null ? `${formatNumber(profile.current_weight, 1)} kg` : '—';
      const target =
        profile.target_weight != null ? `${formatNumber(profile.target_weight, 1)} kg` : '—';
      sections.push(`- Peso actual: ${weight}. Peso objetivo: ${target}.`);
      if (profile.goal_weeks != null) sections.push(`- Meta planteada para ${profile.goal_weeks} semanas.`);
      if (profile.goal_status) sections.push(`- Estado de la meta: ${profile.goal_status}.`);
    }
  } catch {}

  try {
    const goal = await getGoalSummary(userId);
    if (goal && goal.direction) {
      sections.push(`- Dirección de la meta: ${goal.direction}.`);
    }
  } catch {}

  try {
    const logs = await getWeightHistory();
    const cutoff = formatDate(addDays(new Date(), -30));
    const recent = logs.filter((log) => log.date >= cutoff);
    if (recent.length === 0) {
      sections.push('- Historial de peso (últimos 30 días): sin registros.');
    } else {
      const lines = recent
        .map((log) => `${log.date}: ${formatNumber(log.weight_kg, 1)} kg`)
        .join('; ');
      sections.push(`- Historial de peso (últimos 30 días): ${lines}.`);
    }
  } catch {}

  try {
    const records = await getStrengthExerciseRecords();
    const withResults = records.filter((r) => r.history.length > 0).slice(0, 12);
    if (withResults.length === 0) {
      sections.push('- Fuerza registrada: sin datos todavía.');
    } else {
      const lines = withResults
        .map((r) => {
          const max = Math.max(...r.history.map((h) => h.maxWeightKg ?? 0));
          return `${r.bodyPartName} / ${r.exerciseName}: máx ${max} kg`;
        })
        .join('; ');
      sections.push(`- Fuerza registrada: ${lines}.`);
    }
  } catch {}

  try {
    const bodyParts = await getAllBodyParts();
    const exercises = await getAllExercises();
    if (bodyParts.length === 0) {
      sections.push('- Músculos / ejercicios configurados: ninguno todavía.');
    } else {
      const lines = bodyParts.map((bp) => {
        const names = exercises
          .filter((e) => e.body_part_name === bp.name)
          .map((e) => e.name)
          .join(', ');
        return `${bp.name}: ${names || 'sin ejercicios'}`;
      });
      sections.push(`- Músculos y ejercicios configurados: ${lines.join(' | ')}.`);
    }
  } catch {}

  try {
    const schedule = await getWeeklySchedule();
    const entries = schedule.filter((s) => s.body_part_name);
    if (entries.length === 0) {
      sections.push('- Rutina semanal actual: no hay músculos asignados a días.');
    } else {
      const lines = entries.map((s) => `${s.day_of_week}: ${s.body_part_name}`).join(' | ');
      sections.push(`- Rutina semanal actual: ${lines}.`);
    }
  } catch {}

  try {
    const nutritionProfile = await getNutritionProfile(userId);
    const today = await getNutritionDayData(userId, formatDate(new Date()));
    const goalTxt = today.goal != null ? `${today.goal} kcal` : 'sin meta configurada';
    const current = today.caloriesConsumed != null ? `${Math.round(today.caloriesConsumed)} kcal` : '0 kcal';
    let calLine = `- Calorías de hoy: ${current} de ${goalTxt} consumidas.`;
    if (nutritionProfile) {
      const act = ACTIVITY_LABELS[nutritionProfile.activityLevel] ?? nutritionProfile.activityLevel;
      const goal = GOAL_LABELS[nutritionProfile.goalType] ?? nutritionProfile.goalType;
      calLine += ` (actividad ${act}, objetivo ${goal}).`;
    }
    sections.push(calLine);
  } catch {}

  return sections.join('\n');
}

function extractBlock(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open);
  if (start === -1) return null;
  const from = start + open.length;
  const end = text.indexOf(close, from);
  if (end === -1) return null;
  const block = text.substring(from, end).trim();
  const jsonMatch = block.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : null;
}

function stripBlock(text: string, open: string, close: string): string {
  let result = text;
  const start = result.indexOf(open);
  if (start === -1) return result;
  const end = result.indexOf(close, start);
  if (end === -1) return result;
  result = result.slice(0, start) + result.slice(end + close.length);
  return result;
}

function describeRoutineActions(actions: RoutineAction[]): string {
  return actions
    .map((a) => {
      switch (a.action) {
        case 'crear_musculo':
          return `Crear músculo "${a.name ?? ''}"`;
        case 'crear_ejercicio':
          return `Crear ejercicio "${a.name ?? ''}" en ${a.body_part_name ?? 'músculo'}`;
        case 'agregar_musculo_dia':
          return `Agregar "${a.body_part_name ?? ''}" al día ${a.day ?? ''}`;
        case 'agregar_ejercicio_dia':
          return `Agregar "${a.exercise_name ?? ''}" al día ${a.day ?? ''}`;
      }
    })
    .filter(Boolean)
    .join('\n');
}

function parseRoutineProposal(jsonString: string): CoachProposal | null {
  try {
    const data = JSON.parse(jsonString);
    const actions: RoutineAction[] = [];
    if (Array.isArray(data.actions)) {
      for (const item of data.actions) {
        if (typeof item?.action !== 'string') continue;
        if (!ACTION_TYPES.includes(item.action)) continue;
        actions.push({
          action: item.action,
          name: typeof item.name === 'string' ? item.name : undefined,
          icon: typeof item.icon === 'string' ? item.icon : undefined,
          body_part_name: typeof item.body_part_name === 'string' ? item.body_part_name : undefined,
          exercise_name: typeof item.exercise_name === 'string' ? item.exercise_name : undefined,
          day: typeof item.day === 'string' ? item.day : undefined,
          description: typeof item.description === 'string' ? item.description : undefined,
          equipment: typeof item.equipment === 'string' ? item.equipment : undefined,
        });
      }
    }
    if (actions.length === 0) return null;
    return { kind: 'rutina', actions, summary: describeRoutineActions(actions) };
  } catch {
    return null;
  }
}

function parseMealProposal(jsonString: string): CoachProposal | null {
  try {
    const data = JSON.parse(jsonString);
    const plan: WeeklyPlanRow[] = [];
    if (Array.isArray(data.plan)) {
      for (const item of data.plan) {
        if (typeof item !== 'object' || item === null) continue;
        const day = normalizeDay(item.day);
        const mealType = normalizeMealType(item.meal_type);
        const title = typeof item.title === 'string' ? item.title.trim() : '';
        if (!day || !mealType || !title) continue;
        plan.push({
          day,
          meal_type: mealType,
          title,
          description: typeof item.description === 'string' ? item.description : '',
          ingredients: typeof item.ingredients === 'string' ? item.ingredients : '',
        });
      }
    }
    if (plan.length === 0) return null;
    const servings = Number(data.servings) > 0 ? Number(data.servings) : 1;
    return {
      kind: 'comidas',
      plan,
      servings,
      summary: `Menú semanal para ${servings} ${servings === 1 ? 'persona' : 'personas'} con ${plan.length} recetas.`,
    };
  } catch {
    return null;
  }
}

function parseCoachReply(raw: string): CoachOutcome {
  const actionsJson = extractBlock(raw, ACTION_OPEN, ACTION_CLOSE);
  if (actionsJson) {
    const text = stripBlock(raw, ACTION_OPEN, ACTION_CLOSE).trim();
    return { message: text, proposal: parseRoutineProposal(actionsJson) };
  }
  const mealJson = extractBlock(raw, MEAL_OPEN, MEAL_CLOSE);
  if (mealJson) {
    const text = stripBlock(raw, MEAL_OPEN, MEAL_CLOSE).trim();
    return { message: text, proposal: parseMealProposal(mealJson) };
  }
  return { message: raw.trim(), proposal: null };
}

function buildContents(userText: string, history: ChatMessage[]) {
  const parts: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  const recent = history.slice(-10);
  for (const message of recent) {
    if (!message.text?.trim()) continue;
    parts.push({
      role: message.role === 'user' ? 'user' : 'model',
      parts: [{ text: message.text }],
    });
  }
  parts.push({ role: 'user', parts: [{ text: userText }] });
  return parts;
}

export async function sendCoachMessage(
  userId: number,
  userText: string,
  history: ChatMessage[],
): Promise<CoachOutcome> {
  const apiKey = await getVisionApiKey();
  if (!apiKey) {
    return { message: NO_KEY_MESSAGE, proposal: null };
  }

  const context = await buildContext(userId);
  const systemInstruction = `${SYSTEM_PROMPT}\n\n${context}`;
  const contents = buildContents(userText, history);

  try {
    const response = await fetch(`${AI_CONFIG.GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemInstruction }] },
        contents,
      }),
    });

    if (!response.ok) {
      return { message: 'El servicio de IA no está disponible ahora (error de conexión). Intenta de nuevo.', proposal: null };
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { message: 'El asistente no devolvió una respuesta. Intenta reformular tu mensaje.', proposal: null };
    }
    return parseCoachReply(text);
  } catch {
    return { message: 'No pude responder. Revisa tu conexión e inténtalo de nuevo.', proposal: null };
  }
}

interface MapExercise {
  id: number;
  name: string;
  body_part_id: number;
}

interface MapBodyPart {
  id: number;
  name: string;
  icon?: string | null;
}

export async function executeRoutineProposal(actions: RoutineAction[]): Promise<string> {
  const notes: string[] = [];
  const bodyParts = await getAllBodyParts();
  const exercises = await getAllExercises();

  const bodyPartMap = new Map<string, MapBodyPart>();
  for (const bp of bodyParts) bodyPartMap.set(bp.name.toLowerCase(), bp);

  const exerciseMap = new Map<string, MapExercise>();
  for (const ex of exercises) {
    exerciseMap.set(`${ex.body_part_id}|${ex.name.toLowerCase()}`, ex);
  }

  const resolveBodyPart = async (name?: string): Promise<number | null> => {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return null;
    const existing = bodyPartMap.get(trimmed.toLowerCase());
    if (existing) return existing.id;
    const created = await addBodyPart({ name: trimmed, icon: 'fitness' });
    bodyPartMap.set(created.name.toLowerCase(), created);
    notes.push(`Creado el músculo "${created.name}".`);
    return created.id;
  };

  const resolveExercise = async (
    bodyPartId: number,
    name?: string,
    description?: string,
    equipment?: string,
  ): Promise<number | null> => {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return null;
    const key = `${bodyPartId}|${trimmed.toLowerCase()}`;
    const existing = exerciseMap.get(key);
    if (existing) return existing.id;
    const created = await addExercise({
      name: trimmed,
      body_part_id: bodyPartId,
      description,
      equipment,
    });
    exerciseMap.set(`${created.body_part_id}|${created.name.toLowerCase()}`, created);
    notes.push(`Creado el ejercicio "${created.name}".`);
    return created.id;
  };

  for (const action of actions) {
    try {
      const day = action.day ? normalizeDay(action.day) : null;
      const validDay = day && DAYS_ORDER.includes(day as DayOfWeek) ? (day as DayOfWeek) : null;

      switch (action.action) {
        case 'crear_musculo':
          await resolveBodyPart(action.name);
          break;
        case 'crear_ejercicio':
          {
            const bodyPartId = await resolveBodyPart(action.body_part_name);
            if (bodyPartId !== null) {
              await resolveExercise(bodyPartId, action.name, action.description, action.equipment);
            }
          }
          break;
        case 'agregar_musculo_dia':
          {
            const bodyPartId = await resolveBodyPart(action.body_part_name);
            if (validDay && bodyPartId !== null) {
              await addMusclesToDay(validDay, [bodyPartId]);
              notes.push(`"${action.body_part_name}" agregado al día ${validDay}.`);
            }
          }
          break;
        case 'agregar_ejercicio_dia':
          {
            const bodyPartId = await resolveBodyPart(action.body_part_name);
            if (validDay && bodyPartId !== null) {
              const exerciseId = await resolveExercise(
                bodyPartId,
                action.exercise_name,
                action.description,
                action.equipment,
              );
              if (exerciseId !== null) {
                await addExercisesToDay(validDay, bodyPartId, [exerciseId]);
                notes.push(`"${action.exercise_name}" agregado al día ${validDay}.`);
              }
            }
          }
          break;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'acción fallida';
      notes.push(`No se pudo aplicar una de las acciones (${message}).`);
    }
  }

  if (notes.length === 0) return 'No se detectaron cambios que aplicar.';
  return `Cambios aplicados a tu rutina:\n• ${notes.join('\n• ')}`;
}

export async function executeWeeklyMealProposal(
  plan: WeeklyPlanRow[],
  servings: number,
): Promise<string> {
  const rows = plan.map((p) => ({
    day_of_week: p.day,
    meal_type: p.meal_type,
    title: p.title,
    description: p.description,
    ingredients: p.ingredients,
    servings,
  }));
  const inserted = await replaceWeeklyMealPlan(rows);
  return `Plan guardado: ${inserted} recetas semanales para ${servings} ${servings === 1 ? 'persona' : 'personas'}. Ya está disponible en la pestaña Comida.`;
}