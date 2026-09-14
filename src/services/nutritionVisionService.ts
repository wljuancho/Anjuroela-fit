import * as FileSystem from 'expo-file-system/legacy';
import { AI_CONFIG } from '../constants/config';
import { getVisionApiKey, detectAiProvider } from './configService';
import type { NutritionEstimate } from '../types/nutrition';

export type PortionSize = 'pequena' | 'media' | 'grande';
export type MealTime = 'desayuno' | 'almuerzo' | 'cena' | 'snack';
export type MealOrigin = 'casa' | 'restaurante' | 'empaquetado';
export type CookingMethod =
  | 'frito'
  | 'sarten_rehogado'
  | 'air_fryer'
  | 'plancha_parrilla'
  | 'horno'
  | 'hervido'
  | 'vapor'
  | 'crudo';
export type CookingMethodOption = CookingMethod | 'desconocido';

export interface NutritionVisionInput {
  imageUri?: string | null;
  description?: string | null;
  portionSize?: PortionSize | null;
  mealTime?: MealTime | null;
  origin?: MealOrigin | null;
  cookingMethod?: CookingMethod | null;
  servings?: number | null;
}

export interface NutritionVisionProvider {
  estimate(input: NutritionVisionInput): Promise<NutritionEstimate | null>;
}

const PORTION_LABELS: Record<PortionSize, string> = {
  pequena: 'pequeña (equivale a ~1 cuenco puñado / media palma)',
  media: 'media (equivale a ~1 plato estándar / una palma abierta + un puño)',
  grande: 'grande (equivale a ~1 plato colmado / más de 2 palmas)',
};

const MEAL_TIME_HINTS: Record<MealTime, string> = {
  desayuno: 'desayuno (porciones de mañana, suele ser más ligero)',
  almuerzo: 'almuerzo (comida principal del mediodía)',
  cena: 'cena (comida de la noche, considerar que puede diferir del almuerzo)',
  snack: 'snack / refrigerio (porción pequeña entre comidas)',
};

const ORIGIN_HINTS: Record<MealOrigin, string> = {
  casa: 'preparado en casa (normalmente menos grasas añadidas que en restaurante)',
  restaurante: 'preparado en restaurante o pedido (tiende a usar más aceite, mantequilla, azúcar y salsas)',
  empaquetado: 'alimento empaquetado/preparado comercial (revisar etiquetas típicas, arroz instantáneo, congelados, enlatados)',
};

const COOKING_HINTS: Record<CookingMethod, string> = {
  frito: 'FRITO (freidora de aceite o sartén con abundante aceite): suma muchas calorías, aproximadamente +80 a +120 kcal y +8 a +12 g de grasa por porción comparado con lo crudo o al vapor',
  sarten_rehogado: 'salteado/rehogado en sartén con un poco de aceite: suma moderado, aproximadamente +30 a +60 kcal y +3 a +6 g de grasa por porción',
  air_fryer: 'AIR FRYER (freidora de aire): usa muy poco o nada de aceite, queda más crujiente pero casi SIN grasa añadida; calcúlalo como alimento al horno (+0 a +15 kcal por porción)',
  plancha_parrilla: 'a la plancha o a la parrilla (sin apenas aceite, con sus propios jugos): mínima grasa añadida (+0 a +10 kcal por porción)',
  horno: 'al horno: depende de si se usa aceite o mantequilla; en general moderado (+10 a +40 kcal por porción si se aceita)',
  hervido: 'hervido/cocido en agua: sin grasa añadida, conserva casi las calorías naturales del alimento',
  vapor: 'al vapor: sin grasa añadida, conserva casi las calorías naturales del alimento',
  crudo: 'crudo/sin cocinar: usa los valores naturales del alimento sin nada de grasa añadida',
};

function cookingMethodLine(value: CookingMethod | undefined | null): string | null {
  if (!value) return null;
  const hint = COOKING_HINTS[value];
  if (!hint) return null;
  return `• Método de cocción indicado por el usuario: ${hint}.`;
}

function buildVisionPrompt(input: NutritionVisionInput): string {
  const extras: string[] = [];
  if (input.description?.trim()) {
    extras.push(`• Descripción del usuario: "${input.description.trim()}".`);
  }
  if (input.mealTime) {
    extras.push(`• Momento de la comida: ${MEAL_TIME_HINTS[input.mealTime]}.`);
  }
  if (input.portionSize) {
    extras.push(`• Tamaño de porción señalado: ${PORTION_LABELS[input.portionSize]}.`);
  }
  if (input.origin) {
    extras.push(`• Origen: ${ORIGIN_HINTS[input.origin]}.`);
  }
  const cookingLine = cookingMethodLine(input.cookingMethod);
  if (cookingLine) {
    extras.push(cookingLine);
  }
  if (input.servings != null && input.servings > 0) {
    extras.push(`• La persona indica que esta foto equivale a ${input.servings} porción(es) de alimento.`);
  }
  const contextBlock =
    extras.length > 0 ? extras.join('\n') : '(El usuario no aportó contexto adicional; usa lo visible en la foto).';

  return [
    'Analiza con detalle la siguiente imagen de comida para estimar sus calorías y macronutrientes de la forma más acertada posible.',
    '',
    'CONTEXTO PROPORCIONADO POR EL USUARIO (opcional, úsalo para afinar):',
    contextBlock,
    '',
    'INSTRUCCIONES DE ANÁLISIS:',
    '1. Identifica CADA alimento visible (proteína, carbohidrato, vegetal/ensalada, grasa, salsa, bebida, pan, etc.).',
    '2. Estima las porciones con referencias visuales comunes: usa plato, cubiertos, manos y otros objetos de la foto como escala de tamaño.',
    '3. Considera el método de cocción y aplícalo a TODOS los alimentos: determina si el alimento está frito (capa dorada y crujiente con brillo aceitoso), al air fryer (crujiente pero seco, con poca o ninguna grasa visible), a la parrilla/plancha (marcas de asado), hervido, al vapor u horneado. Esto cambia mucho las calorías. Si las instrucciones te dicen que estás ante un alimento frito, suma la grasa de la fritura; si te dicen air fryer, NO sumes grasa de fritura.',
    '4. Considera también las salsas, aderezos, panes y acompañamientos, ya que aportan calorías extras.',
    '5. Si viene contexto del usuario, respétalo SIEMPRE: el método de cocción, el tamaño de porción, el momento de la comida, si es casero/restaurante/empacado y cuántas porciones representa la foto.',
    '6. Calcula la SUMA de todos los alimentos para el total de porciones indicado. Si no hay indicación de porciones, cuenta las que aparecen en la imagen.',
    '7. Sé realista y no subestimes: las raciones de restaurante y los fritos suelen sumar más de lo que parece.',
    '8. Devuelve UN SOLO objeto JSON (sin texto adicional, ni markdown, ni comentarios) con este esquema EXACTO:',
    '{',
    '  "mealName": "Nombre breve del platillo",',
    '  "calories": 0,',
    '  "protein_g": 0,',
    '  "carbs_g": 0,',
    '  "fat_g": 0,',
    '  "description": "Descripción breve: alimentos identificados y método de cocción real observado o indicado",',
    '  "confidence": "alta" | "media" | "baja",',
    '  "notes": "Breve explicación de cómo calculaste porciones, cocción y valores"',
    '}',
  ].join('\n');
}

function normalizeConfidence(value: unknown): NutritionEstimate['confidence'] {
  if (value === 'alta' || value === 'media' || value === 'baja') {
    return value;
  }
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered.includes('alt')) return 'alta';
    if (lowered.includes('baj')) return 'baja';
    if (lowered.includes('med')) return 'media';
  }
  return undefined;
}

function parseEstimateJson(parsed: Record<string, unknown>): NutritionEstimate {
  return {
    mealName: typeof parsed.mealName === 'string' ? parsed.mealName : undefined,
    description: typeof parsed.description === 'string' ? parsed.description : undefined,
    calories: Number(parsed.calories) || 0,
    proteinG: Number(parsed.protein_g) || 0,
    carbsG: Number(parsed.carbs_g) || 0,
    fatG: Number(parsed.fat_g) || 0,
    confidence: normalizeConfidence(parsed.confidence),
    notes: typeof parsed.notes === 'string' ? parsed.notes : undefined,
  };
}

function extractJsonObject(text: string): unknown {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

function resolveImageMimeType(uri: string): string {
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(uri || '');
  const ext = (extMatch ? extMatch[1] : '').toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    heif: 'image/heif',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return map[ext] ?? 'image/jpeg';
}

export class GeminiVisionProvider implements NutritionVisionProvider {
  async estimate(input: NutritionVisionInput): Promise<NutritionEstimate | null> {
    const apiKey = await getVisionApiKey();
    if (!apiKey || !input.imageUri) {
      return null;
    }

    try {
      const base64 = await FileSystem.readAsStringAsync(input.imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const url = `${AI_CONFIG.GEMINI_API_URL}?key=${apiKey}`;
      const mime = resolveImageMimeType(input.imageUri);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: buildVisionPrompt(input) },
                { inline_data: { mime_type: mime, data: base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.2 },
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;

      const parsed = extractJsonObject(text);
      if (!parsed || typeof parsed !== 'object') return null;

      return parseEstimateJson(parsed as Record<string, unknown>);
    } catch {
      return null;
    }
  }
}

export class OpenAIVisionProvider implements NutritionVisionProvider {
  async estimate(input: NutritionVisionInput): Promise<NutritionEstimate | null> {
    const apiKey = await getVisionApiKey();
    if (!apiKey || !input.imageUri) {
      return null;
    }

    try {
      const base64 = await FileSystem.readAsStringAsync(input.imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const mime = resolveImageMimeType(input.imageUri);

      const response = await fetch(AI_CONFIG.OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: AI_CONFIG.OPENAI_VISION_MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: buildVisionPrompt(input) },
                {
                  type: 'image_url',
                  image_url: { url: `data:${mime};base64,${base64}` },
                },
              ],
            },
          ],
          max_tokens: 700,
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const text: string | undefined = data?.choices?.[0]?.message?.content;
      if (!text) return null;

      const parsed = extractJsonObject(text);
      if (!parsed || typeof parsed !== 'object') return null;

      return parseEstimateJson(parsed as Record<string, unknown>);
    } catch {
      return null;
    }
  }
}

const FOOD_DB: Array<{
  keywords: string[];
  estimate: NutritionEstimate;
}> = [
  {
    keywords: ['pollo', 'grill', 'pechuga', 'pojado'],
    estimate: { calories: 350, proteinG: 40, carbsG: 25, fatG: 12 },
  },
  {
    keywords: ['arroz', 'rice', 'paella'],
    estimate: { calories: 260, proteinG: 6, carbsG: 55, fatG: 1 },
  },
  {
    keywords: ['ensalada', 'salad'],
    estimate: { calories: 180, proteinG: 5, carbsG: 15, fatG: 11 },
  },
  {
    keywords: ['huevo', 'egg', 'huevos'],
    estimate: { calories: 155, proteinG: 13, carbsG: 1, fatG: 11 },
  },
  {
    keywords: ['avena', 'oatmeal', 'oat'],
    estimate: { calories: 250, proteinG: 9, carbsG: 43, fatG: 5 },
  },
  {
    keywords: ['pan', 'tortilla', 'sandwich', 'bread'],
    estimate: { calories: 280, proteinG: 11, carbsG: 45, fatG: 6 },
  },
  {
    keywords: ['pescado', 'fish', 'atun', 'salmón', 'salmon'],
    estimate: { calories: 320, proteinG: 35, carbsG: 8, fatG: 16 },
  },
  {
    keywords: ['fruta', 'frutas', 'banana', 'manzana', 'fruit'],
    estimate: { calories: 120, proteinG: 1, carbsG: 30, fatG: 0 },
  },
  {
    keywords: ['yogur', 'yogurt', 'greek'],
    estimate: { calories: 120, proteinG: 12, carbsG: 10, fatG: 4 },
  },
  {
    keywords: ['batido', 'protein shake', 'smoothie'],
    estimate: { calories: 220, proteinG: 25, carbsG: 22, fatG: 4 },
  },
];

const DEFAULT_ESTIMATE: NutritionEstimate = {
  calories: 300,
  proteinG: 20,
  carbsG: 35,
  fatG: 10,
  confidence: 'baja',
};

const COOKING_FACTORS: Partial<Record<CookingMethod, number>> = {
  frito: 1.35,
  sarten_rehogado: 1.15,
  air_fryer: 1.03,
  plancha_parrilla: 1.02,
  horno: 1.08,
  hervido: 1,
  vapor: 1,
  crudo: 1,
};

function scaleEstimate(base: NutritionEstimate, input: NutritionVisionInput): NutritionEstimate {
  const servings = Math.max(1, Math.round(input.servings ?? 1));
  const portionScale =
    input.portionSize === 'grande' ? 1.3 : input.portionSize === 'pequena' ? 0.7 : 1;
  const cookingScale = (input.cookingMethod && COOKING_FACTORS[input.cookingMethod]) || 1;
  const factor = servings * portionScale * cookingScale;
  return {
    ...base,
    calories: Math.round(base.calories * factor),
    proteinG: Math.round(base.proteinG * factor),
    carbsG: Math.round(base.carbsG * factor),
    fatG: Math.round(base.fatG * factor),
  };
}

export class MockNutritionVisionProvider implements NutritionVisionProvider {
  async estimate(input: NutritionVisionInput): Promise<NutritionEstimate | null> {
    const text = [input.description, input.imageUri]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!text) {
      return null;
    }
    const match = FOOD_DB.find((item) =>
      item.keywords.some((keyword) => text.includes(keyword)),
    );
    const base = match ? match.estimate : DEFAULT_ESTIMATE;
    return scaleEstimate(base, input);
  }
}

let primaryProvider: NutritionVisionProvider | null = null;
const fallbackProvider = new MockNutritionVisionProvider();

export function setNutritionVisionProvider(next: NutritionVisionProvider): void {
  primaryProvider = next;
}

export async function estimateNutrition(
  input: NutritionVisionInput,
): Promise<NutritionEstimate | null> {
  let primary = primaryProvider;
  if (!primary) {
    const apiKey = await getVisionApiKey();
    primary = detectAiProvider(apiKey ?? '') === 'openai'
      ? new OpenAIVisionProvider()
      : new GeminiVisionProvider();
  }

  try {
    const result = await primary.estimate(input);
    if (result) {
      return result;
    }
  } catch {
    // fall through to mock
  }

  return fallbackProvider.estimate(input);
}