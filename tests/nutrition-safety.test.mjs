import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGoal } from '../src/services/utils/goalValidator.ts';
import { validateCalorieGoal } from '../src/services/utils/nutritionSafety.ts';
import { resolveMealProvenance } from '../src/services/utils/mealProvenance.ts';

test('requiere 18 años para una meta de peso y acepta edad mínima', () => {
  const result = validateGoal({ currentWeightKg: 70, targetWeightKg: 65, weeks: 12, heightCm: 165, age: 17 });
  assert.equal(result.isValid, false);
  assert.match(result.message, /18\+/);
  const resultForNineteen = validateGoal({ currentWeightKg: 70, targetWeightKg: 65, weeks: 12, heightCm: 165, age: 19 });
  assert.equal(resultForNineteen.isValid, true);
  const resultForEighteen = validateGoal({ currentWeightKg: 70, targetWeightKg: 65, weeks: 12, heightCm: 165, age: 18 });
  assert.equal(resultForEighteen.isValid, true);
});

test('rechaza un peso objetivo bajo el IMC adulto de referencia', () => {
  const result = validateGoal({ currentWeightKg: 70, targetWeightKg: 48, weeks: 52, heightCm: 165, age: 30 });
  assert.equal(result.isValid, false);
  assert.match(result.message, /IMC/);
});

test('limita el ritmo semanal y propone un objetivo menos agresivo', () => {
  const result = validateGoal({ currentWeightKg: 80, targetWeightKg: 70, weeks: 4, heightCm: 170, age: 30 });
  assert.equal(result.isValid, false);
  assert.ok(result.suggestedGoalKg > 70);
});

test('acepta una meta adulta gradual dentro de los límites configurados', () => {
  const result = validateGoal({ currentWeightKg: 80, targetWeightKg: 76, weeks: 12, heightCm: 170, age: 30 });
  assert.equal(result.isValid, true);
});

test('rechaza peso, estatura y plazos fuera de rango', () => {
  assert.equal(validateGoal({ currentWeightKg: 80, targetWeightKg: 75, weeks: 12, heightCm: 0, age: 30 }).isValid, false);
  assert.equal(validateGoal({ currentWeightKg: 80, targetWeightKg: 75, weeks: 105, heightCm: 170, age: 30 }).isValid, false);
});

test('rechaza metas calóricas manuales por debajo del límite preventivo', () => {
  const error = validateCalorieGoal({ calories: 500, age: 30, heightCm: 165, weightKg: 70, goalType: 'libre' });
  assert.match(error, /1200/);
});

test('permite metas nutricionales desde los 18 años', () => {
  const adult = validateCalorieGoal({ calories: 1800, age: 18, heightCm: 165, weightKg: 65, goalType: 'mantener' });
  const minor = validateCalorieGoal({ calories: 1800, age: 17, heightCm: 165, weightKg: 65, goalType: 'mantener' });
  assert.equal(adult, null);
  assert.match(minor, /18 años/);
});

test('no recomienda perder peso cuando el IMC actual ya está bajo', () => {
  const error = validateCalorieGoal({ calories: 1800, age: 30, heightCm: 170, weightKg: 52, goalType: 'perder' });
  assert.match(error, /perder peso/);
});

test('acepta una meta de mantenimiento dentro de límites', () => {
  const error = validateCalorieGoal({ calories: 2100, age: 30, heightCm: 170, weightKg: 70, goalType: 'mantener' });
  assert.equal(error, null);
});

test('guarda foto con IA y su confianza como procedencia', () => {
  assert.deepEqual(resolveMealProvenance({
    entryMode: 'photo', hasPhoto: true, estimateApplied: true, selectedCatalogFood: false, confidence: 'baja',
  }), { source: 'photo_ai', confidence: 'baja' });
});

test('marca el catálogo como referencia y el ingreso manual sin confianza automática', () => {
  assert.deepEqual(resolveMealProvenance({
    entryMode: 'catalog', hasPhoto: false, estimateApplied: false, selectedCatalogFood: true, confidence: null,
  }), { source: 'catalog', confidence: 'media' });
  assert.deepEqual(resolveMealProvenance({
    entryMode: 'photo', hasPhoto: true, estimateApplied: false, selectedCatalogFood: false, confidence: null,
  }), { source: 'manual', confidence: null });
});
