export interface FoodCatalogItem {
  id: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

// Valores orientativos por 100 g; las recetas, marcas y métodos de cocción cambian el resultado.
export const FOOD_CATALOG: FoodCatalogItem[] = [
  { id: 'rice', name: 'Arroz blanco cocido', caloriesPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28.2, fatPer100g: 0.3 },
  { id: 'chicken', name: 'Pechuga de pollo cocida', caloriesPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6 },
  { id: 'egg', name: 'Huevo cocido', caloriesPer100g: 155, proteinPer100g: 13, carbsPer100g: 1.1, fatPer100g: 11 },
  { id: 'beans', name: 'Fríjoles cocidos', caloriesPer100g: 127, proteinPer100g: 8.7, carbsPer100g: 22.8, fatPer100g: 0.5 },
  { id: 'arepa', name: 'Arepa de maíz', caloriesPer100g: 218, proteinPer100g: 5.7, carbsPer100g: 45.9, fatPer100g: 2.6 },
  { id: 'avocado', name: 'Aguacate', caloriesPer100g: 160, proteinPer100g: 2, carbsPer100g: 8.5, fatPer100g: 14.7 },
  { id: 'potato', name: 'Papa cocida', caloriesPer100g: 87, proteinPer100g: 1.9, carbsPer100g: 20.1, fatPer100g: 0.1 },
  { id: 'oats', name: 'Avena cocida en agua', caloriesPer100g: 71, proteinPer100g: 2.5, carbsPer100g: 12, fatPer100g: 1.5 },
  { id: 'plantain', name: 'Plátano maduro cocido', caloriesPer100g: 122, proteinPer100g: 1.3, carbsPer100g: 31.9, fatPer100g: 0.4 },
  { id: 'yogurt', name: 'Yogur natural entero', caloriesPer100g: 61, proteinPer100g: 3.5, carbsPer100g: 4.7, fatPer100g: 3.3 },
  { id: 'tomato', name: 'Tomate crudo', caloriesPer100g: 18, proteinPer100g: 0.9, carbsPer100g: 3.9, fatPer100g: 0.2 },
  { id: 'banana', name: 'Banano', caloriesPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 22.8, fatPer100g: 0.3 },
];
