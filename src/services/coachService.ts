import { AI_CONFIG } from '../constants/config';
import { getVisionApiKey, detectAiProvider } from './configService';
import { formatDate, formatNumber, calculateBMI, classifyBMI } from './utils';
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
  getLatestWeightLog,
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
  libre: 'contar calorías libremente (sin déficit forzado)',
};

function describeNutritionStrategy(goalType: string, dailyGoal: number | null): string {
  switch (goalType) {
    case 'perder':
      return dailyGoal != null
        ? `Déficit calórico activo de ${Math.round(dailyGoal)} kcal/día (restringiéndote de tu mantenimiento)`
        : 'Déficit calórico activo';
    case 'mantener':
      return 'Mantenimiento sin déficit (TDEE exacto para conservar el peso)';
    case 'ganar':
      return 'Superávit calórico (sumando calorías para ganar masa)';
    case 'libre':
      return 'Libre / sin objetivo de déficit forzado (solo conteo de calorías)';
    default:
      return goalType;
  }
}

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

function getSpanishWeekday(date: Date): string {
  return ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][date.getDay()];
}

const DAY_TO_INDEX: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
};

function nextDateForDay(from: Date, dayName: string): string {
  const target = DAY_TO_INDEX[dayName];
  if (target == null) return formatDate(from);
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (d.getDay() === target) return formatDate(d);
  }
  return formatDate(from);
}

const SYSTEM_PROMPT =
  'Eres "Anjuroela", entrenador personal inteligente de la app de fitness "Anjuroela Fit". ' +
  'Tu misión es guiar, motivar y personalizar la experiencia del usuario.\n\n' +
  'REGLAS:\n' +
  '1. Responde SIEMPRE en español, de forma clara, empática y motivadora. Usa listas simples cuando ayudes.\n' +
  '2. SÓLO responde sobre FITNESS, SALUD GENERAL, RUTINAS DE EJERCICIO, NUTRICIÓN, CALORÍAS e IMC. ' +
  'Si el usuario pregunta por matemáticas puras, política, temas sociales, éticos u otros temas ajenos al fitness, ' +
  'responde cortésmente declinando la solicitud: "Solo puedo ayudarte con temas de fitness, nutrición, rutinas " + ' +
  'y salud en anjuroela-fit."\n' +
  '3. NO eres un médico: no diagnostiques ni trates enfermedades, dolores ni síntomas graves. Ante un problema médico ' +
  'serio recomienda consultar a un profesional de la salud y ofrece solo consejos generales de bienestar.\n' +
  '4. Basa tus recomendaciones en los DATOS REALES del contexto del usuario. Si no tienes un dato, no lo inventes.\n' +
  '5. Adapta la rutina al lugar de entrenamiento que el usuario exprese: ENTRENAMIENTO EN CASA (prioriza ejercicios ' +
  'de peso corporal y mancuernas) o GIMNASIO (máquinas, barras y poleas). Si no lo indica, pregúntalo antes de crear la rutina.\n' +
  '6. Cuando el usuario pida modificar, crear o reorganizar su rutina o sus ejercicios, además de tu explicación ' +
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
  '7. Cuando el usuario pida un plan o menú de comidas semanal o quincenal:\n' +
  '   - Si NO indica para cuántas personas es, para cuántos días, ni sus preferencias (gustos, alergias, objetivo), ' +
  'pregúntale primero en texto y NO añadas bloque JSON.\n' +
  '   - Cuando tengas el número de personas, preferencias y número de días solicitados, genera el menú completo para ' +
  'TODOS los días pedidos iniciando desde el día siguiente a la fecha de hoy. Cada día incluye al menos desayuno, ' +
  'almuerzo y cena (agrega snacks si lo crees conveniente).\n' +
  '   - En la respuesta textual incluye: una breve descripción del plan, la lista CONSOLIDADA de ingredientes para la ' +
  'lista de mercado (agrupados y sumados según el número de personas y días), y la fecha de expiración del plan.\n' +
  '   - Añade además el siguiente bloque JSON con las fechas exactas:\n\n' +
  `${MEAL_OPEN}\n` +
  '{"servings":2,"duration_days":8,"start_date":"2026-09-15","expires_at":"2026-09-22",' +
  '"plan":[{"day":"lunes","date":"2026-09-15","meal_type":"desayuno","title":"...","description":"...",' +
  '"recipe":"Paso 1: ...\\nPaso 2: ...\\nPaso 3: ...","prep_minutes":15,' +
  '"ingredients":[{"name":"Ingrediente","amount":"200 g"}]},...]}\n' +
  `${MEAL_CLOSE}\n\n` +
  '   - "day" es el día de la semana en minúsculas (lunes, martes, miercoles, jueves, viernes, sabado, domingo).\n' +
  '   - "date" es la fecha exacta del platillo en formato YYYY-MM-DD, empezando el día siguiente a HOY y continuando ' +
  'consecutivamente. Si el usuario pide 8 días, genera fechas consecutivas para 8 días.\n' +
  '   - "meal_type" es uno de: desayuno, almuerzo, cena, snack.\n' +
  '   - "ingredients" es un array de objetos con "name" y "amount". Indica el amount para UNA persona; el sistema ' +
  'escalará automáticamente según "servings".\n' +
  '   - "recipe" debe contener el paso a paso detallado y completo de la preparación.\n' +
  '   - "prep_minutes" es el tiempo estimado de preparación en minutos.\n' +
  '   - "start_date" es el día siguiente a la fecha actual y "expires_at" es el último día del plan.\n' +
  '   - El menú debe respetar el objetivo, las preferencias, restricciones y las cantidades adecuadas al número de personas.\n' +
  '8. Fuera de las etiquetas <<<ACCIONES>>>...<<<FIN_ACCIONES>>> o <<<COMIDAS>>>...<<<FIN_COMIDAS>>> NUNCA incluyas JSON.' +
  '9. Si alguna acción no puede aplicarse, indícalo en el texto.\n' +
  '10. Respeta SIEMPRE la estrategia calórica actual del usuario indicada en el contexto (línea "Estrategia calórica"):\n' +
  '   - Si es "Mantenimiento sin déficit" o "Libre", NO sugieras recortes agresivos, ayunos prolongados ni "déficits" ' +
  'a menos que el usuario lo pida explícitamente; recomienda comida equilibrada y sostenible.\n' +
  '   - Si es "Déficit calórico activo", diseña recetas, porciones y ajustes acordes a esa restricción sin caer en extremos riesgosos.\n' +
  '   - Si es "Superávit calórico", enfócate en aumentar consumo de forma saludable para ganar masa.\n' +
  '   - Nunca sugieras dietas peligrosas, ayunos prolongados ni restricciones insostenibles.';

async function buildContext(userId: string): Promise<string> {
  const sections: string[] = ['DATOS ACTUALES DEL USUARIO (usados para recomendar):'];
  const now = new Date();
  sections.push(`- Fecha de hoy: ${formatDate(now)} (${getSpanishWeekday(now)}).`);

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
    const profile = await getProfile(userId);
    const latest = await getLatestWeightLog();
    if (profile?.height != null && profile.height > 0) {
      const bmiWeight = latest?.weight_kg ?? profile.current_weight ?? null;
      if (bmiWeight != null && bmiWeight > 0) {
        const bmi = calculateBMI(bmiWeight, profile.height);
        const category = classifyBMI(bmi) ?? 'no clasificable';
        sections.push(
          `- Altura: ${formatNumber(profile.height, 0)} cm. IMC: ${formatNumber(bmi, 1)} (${category}).`,
        );
      } else {
        sections.push(`- Altura: ${formatNumber(profile.height, 0)} cm.`);
      }
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
          .map((e) => (e.equipment ? `${e.name} (${e.equipment})` : e.name))
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
    sections.push(`- Calorías de hoy: ${current} de ${goalTxt} consumidas.`);
    if (nutritionProfile) {
      const act = ACTIVITY_LABELS[nutritionProfile.activityLevel] ?? nutritionProfile.activityLevel;
      const goal = GOAL_LABELS[nutritionProfile.goalType] ?? nutritionProfile.goalType;
      sections.push(
        `- Estrategia calórica: ${describeNutritionStrategy(
          nutritionProfile.goalType,
          today.goal != null ? today.goal : null,
        )} (actividad ${act}, objetivo ${goal}).`,
      );
    }
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
    const rawPlan = Array.isArray(data.plan) ? data.plan : [];
    if (rawPlan.length === 0) return null;

    const servings = Number(data.servings) > 0 ? Math.round(Number(data.servings)) : 1;
    const tomorrow = addDays(new Date(), 1);
    const validDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const startDateStr = validDate(data.start_date) ? data.start_date as string : formatDate(tomorrow);
    const startDate = new Date(`${startDateStr}T00:00:00`);
    const usedDates: string[] = [];

    const plan: WeeklyPlanRow[] = [];
    for (const item of rawPlan) {
      if (typeof item !== 'object' || item === null) continue;
      const mealType = normalizeMealType(item.meal_type);
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!mealType || !title) continue;

      const day = normalizeDay(item.day);
      let dateStr: string | null = validDate(item.date) ? item.date as string : null;
      if (!dateStr && day) dateStr = nextDateForDay(startDate, day);
      if (!dateStr) dateStr = formatDate(addDays(startDate, usedDates.length));
      usedDates.push(dateStr);

      let ingredients: { name: string; amount: string }[] = [];
      if (Array.isArray(item.ingredients)) {
        ingredients = item.ingredients
          .map((i: any) => ({
            name: typeof i?.name === 'string' ? i.name.trim() : String(i?.name ?? '').trim(),
            amount: typeof i?.amount === 'string' ? i.amount.trim() : String(i?.amount ?? '').trim(),
          }))
          .filter((i: { name: string; amount: string }) => i.name);
      } else if (typeof item.ingredients === 'string' && item.ingredients.trim()) {
        ingredients = item.ingredients
          .split(/[,;\n]+/)
          .map((s: string) => s.trim())
          .filter(Boolean)
          .map((s: string) => ({ name: s, amount: '' }));
      }

      plan.push({
        day: day ?? '',
        date: dateStr,
        meal_type: mealType,
        title,
        description: typeof item.description === 'string' ? item.description.trim() : '',
        recipe: typeof item.recipe === 'string' ? item.recipe.trim() : '',
        ingredients,
      });
    }

    if (plan.length === 0) return null;

    const distinctDates = [...new Set(plan.map((r) => r.date))].sort();
    const expiresAt = validDate(data.expires_at)
      ? data.expires_at as string
      : distinctDates[distinctDates.length - 1] ?? startDateStr;
    const daysCount = distinctDates.length || plan.length;
    const summary = `Plan de comidas para ${servings} ${servings === 1 ? 'persona' : 'personas'} durante ${daysCount} ${daysCount === 1 ? 'día' : 'días'} (expira el ${expiresAt}). ${plan.length} ${plan.length === 1 ? 'platillo' : 'platillos'}.`;

    return {
      kind: 'comidas',
      plan,
      servings,
      startDate: startDateStr,
      expiresAt,
      summary,
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

function cleanHistoryForApi(history: ChatMessage[]): ChatMessage[] {
  const clean = history.filter((m) => m.text?.trim());
  while (clean.length > 0 && clean[0].role !== 'user') {
    clean.shift();
  }
  return clean;
}

function buildContents(userText: string, history: ChatMessage[]) {
  const parts: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  const recent = cleanHistoryForApi(history.slice(-10));
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

function buildMessages(
  systemInstruction: string,
  userText: string,
  history: ChatMessage[],
): { role: 'system' | 'user' | 'assistant'; content: string }[] {
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
  messages.push({ role: 'system', content: systemInstruction });
  const recent = cleanHistoryForApi(history.slice(-10));
  for (const message of recent) {
    if (!message.text?.trim()) continue;
    messages.push({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: message.text,
    });
  }
  messages.push({ role: 'user', content: userText });
  return messages;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 60000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function providerErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json();
    const message: unknown = data?.error?.message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  } catch {
    // El cuerpo no es JSON; se ignora
  }
  return '';
}

function friendlyProviderError(status: number, detail: string): { message: string } {
  if (status === 401 || status === 403) {
    return {
      message: 'Tu API Key de IA no es válida o fue rechazada (403). Verifica la clave en Ajustes.',
    };
  }
  if (status === 404) {
    return { message: 'El modelo de IA solicitado no está disponible (404). Revisa la configuración.' };
  }
  if (status === 400) {
    return {
      message: detail
        ? `La petición a la IA fue rechazada (400): ${detail}`
        : 'La petición a la IA fue rechazada (400). Intenta reformular tu mensaje.',
    };
  }
  if (status === 429) {
    return {
      message: 'Se alcanzó el límite de peticiones de la IA (429). Espera un momento e inténtalo de nuevo.',
    };
  }
  return {
    message: detail
      ? `El servicio de IA no está disponible ahora (HTTP ${status}): ${detail}. Intenta de nuevo.`
      : `El servicio de IA no está disponible ahora (HTTP ${status}). Intenta de nuevo.`,
  };
}

export async function sendCoachMessage(
  userId: string,
  userText: string,
  history: ChatMessage[],
): Promise<CoachOutcome> {
  const apiKey = await getVisionApiKey();
  if (!apiKey) {
    return { message: NO_KEY_MESSAGE, proposal: null };
  }

  const context = await buildContext(userId);
  const systemInstruction = `${SYSTEM_PROMPT}\n\n${context}`;
  const provider = detectAiProvider(apiKey);

  try {
    if (provider === 'openai') {
      const response = await fetchWithTimeout(AI_CONFIG.OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: AI_CONFIG.OPENAI_CHAT_MODEL,
          messages: buildMessages(systemInstruction, userText, history),
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const detail = await providerErrorDetail(response);
        return { message: friendlyProviderError(response.status, detail).message, proposal: null };
      }

      const data = await response.json();
      const text: string | undefined = data?.choices?.[0]?.message?.content;
      if (!text) {
        return { message: 'El asistente no devolvió una respuesta. Intenta reformular tu mensaje.', proposal: null };
      }
      return parseCoachReply(text);
    }

    const contents = buildContents(userText, history);
    const response = await fetchWithTimeout(`${AI_CONFIG.GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents,
        generationConfig: { temperature: 0.7 },
      }),
    });

    if (!response.ok) {
      const detail = await providerErrorDetail(response);
      return { message: friendlyProviderError(response.status, detail).message, proposal: null };
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return { message: 'El asistente no devolvió una respuesta. Intenta reformular tu mensaje.', proposal: null };
    }
    return parseCoachReply(text);
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === 'AbortError';
    return {
      message: isTimeout
        ? 'El servicio de IA tardó demasiado en responder. Intenta de nuevo.'
        : 'No pude responder. Revisa tu conexión e inténtalo de nuevo.',
      proposal: null,
    };
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
  expiresAt?: string,
): Promise<string> {
  const validDate = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const fallbackExpires = validDate(expiresAt)
    ? expiresAt as string
    : (plan.map((p) => p.date).filter((d): d is string => !!d).sort().pop() ?? '');
  const finalExpires = fallbackExpires || formatDate(addDays(new Date(), 7));

  const rows = plan.map((p) => ({
    day_of_week: p.day || '',
    date: p.date ?? '',
    meal_type: p.meal_type,
    title: p.title,
    description: p.description,
    recipe: p.recipe,
    ingredients_list: Array.isArray(p.ingredients) ? p.ingredients : [],
    servings_count: servings,
    expires_at: finalExpires,
  }));
  const inserted = await replaceWeeklyMealPlan(rows);
  return `Plan guardado: ${inserted} recetas para ${servings} ${servings === 1 ? 'persona' : 'personas'}. Ya está disponible en la pestaña Comida.`;
}