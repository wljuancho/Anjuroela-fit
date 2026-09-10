import * as FileSystem from 'expo-file-system';
import { AI_CONFIG } from '../constants/config';
import { getVisionApiKey } from './configService';
import type { NutritionEstimate } from '../types/meal';

export interface NutritionVisionInput {
  imageUri?: string | null;
  description?: string | null;
}

export interface NutritionVisionProvider {
  estimate(input: NutritionVisionInput): Promise<NutritionEstimate | null>;
}

const GEMINI_PROMPT =
  'Analiza la siguiente imagen de comida. Identifica los alimentos presentes, detecta ' +
  'detalles de cocción (ej. si es frito, hervido, a la plancha, etc.) y devuelve un JSON ' +
  'estricto con: { "mealName": string, "calories": number, "protein_g": number, ' +
  '"carbs_g": number, "fat_g": number, "description": string }. ' +
  'Solo devuelve el JSON sin texto adicional.';

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

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: GEMINI_PROMPT },
                { inline_data: { mime_type: 'image/jpeg', data: base64 } },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const text: string | undefined =
        data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        return null;
      }

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        mealName: parsed.mealName ?? undefined,
        description: parsed.description ?? undefined,
        calories: Number(parsed.calories) || 0,
        proteinG: Number(parsed.protein_g) || 0,
        carbsG: Number(parsed.carbs_g) || 0,
        fatG: Number(parsed.fat_g) || 0,
      };
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
};

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
    return match ? match.estimate : DEFAULT_ESTIMATE;
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
  const primary = primaryProvider ?? new GeminiVisionProvider();

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
