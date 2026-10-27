import type { NutritionConfidence, NutritionDataSource } from '../../types/nutrition';

export interface MealProvenanceInput {
  entryMode: 'manual' | 'catalog' | 'photo';
  hasPhoto: boolean;
  estimateApplied: boolean;
  selectedCatalogFood: boolean;
  confidence: NutritionConfidence | null;
}

export interface MealProvenance {
  source: NutritionDataSource;
  confidence: NutritionConfidence | null;
}

export function resolveMealProvenance(input: MealProvenanceInput): MealProvenance {
  if (input.entryMode === 'photo' && input.hasPhoto && input.estimateApplied) {
    return { source: 'photo_ai', confidence: input.confidence };
  }
  if (input.entryMode === 'catalog' && input.selectedCatalogFood) {
    return { source: 'catalog', confidence: 'media' };
  }
  return { source: 'manual', confidence: null };
}
