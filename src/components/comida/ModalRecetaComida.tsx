import { colors } from '../../theme/colors';
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../AppButton';
import AppTextInput from '../AppTextInput';
import { formatPlanDate } from '../../services/utils';
import type { MealIngredient, PlanMealType, WeeklyMealPlanItem } from '../../types/nutrition';

interface ModalRecetaComidaProps {
  meal: WeeklyMealPlanItem | null;
  visible: boolean;
  onClose: () => void;
  onSave?: (id: number, updates: Pick<WeeklyMealPlanItem, 'title' | 'description' | 'recipe' | 'ingredients_list' | 'servings_count'>) => Promise<void>;
}

const MEAL_TYPE_LABELS: Record<PlanMealType, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  cena: 'Cena',
  snack: 'Snack',
};

const MEAL_TYPE_ICONS: Record<PlanMealType, keyof typeof Ionicons.glyphMap> = {
  desayuno: 'sunny-outline',
  almuerzo: 'restaurant-outline',
  cena: 'moon-outline',
  snack: 'cafe-outline',
};

function extractPrepMinutes(recipe?: string | null): number | null {
  if (!recipe) return null;
  const targeted = recipe.match(/tiempo(?:\s*de)?\s*preparaci[oó]n\s*(?:aprox\.?\s*)?[:.\-]?\s*(\d+)\s*min/i);
  if (targeted) return Number(targeted[1]);
  const generic = recipe.match(/(\d+)\s*min/);
  return generic ? Number(generic[1]) : null;
}

function extractSteps(recipe?: string | null): string[] {
  if (!recipe) return [];
  return recipe
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^\s*(?:paso\s*\d+[:.\-)]*|step\s*\d+[:.\-)]*|\d+[.)\]]?)\s*/i, ''))
    .filter(Boolean);
}

export default function ModalRecetaComida({ meal, visible, onClose, onSave }: ModalRecetaComidaProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(meal?.title ?? '');
  const [description, setDescription] = useState(meal?.description ?? '');
  const [recipe, setRecipe] = useState(meal?.recipe ?? '');
  const [ingredientsText, setIngredientsText] = useState(
    meal?.ingredients_list.map((item) => `${item.name} | ${item.amount}`).join('\n') ?? '',
  );
  const [servings, setServings] = useState(String(meal?.servings_count ?? 1));

  if (!meal) return null;

  const prepMinutes = extractPrepMinutes(meal.recipe);
  const steps = extractSteps(meal.recipe);
  const iconName = MEAL_TYPE_ICONS[meal.meal_type] ?? 'restaurant-outline';
  const mealTypeLabel = MEAL_TYPE_LABELS[meal.meal_type] ?? meal.meal_type;

  const handleSave = async () => {
    const count = Number(servings);
    if (!title.trim() || !Number.isFinite(count) || count < 1 || !onSave) return;
    const ingredients: MealIngredient[] = ingredientsText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, ...amount] = line.split('|');
        return { name: name.trim(), amount: amount.join('|').trim() };
      })
      .filter((item) => item.name.length > 0);
    setSaving(true);
    try {
      await onSave(meal.id, {
        title: title.trim(),
        description,
        recipe,
        ingredients_list: ingredients,
        servings_count: Math.round(count),
      });
      setEditing(false);
    } catch {
      Alert.alert('No se guardaron los cambios', 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setTitle(meal.title);
    setDescription(meal.description ?? '');
    setRecipe(meal.recipe ?? '');
    setIngredientsText(meal.ingredients_list.map((item) => `${item.name} | ${item.amount}`).join('\n'));
    setServings(String(meal.servings_count));
    setEditing(true);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.imageWrap}>
              <Ionicons name={iconName} size={40} color={colors.text} />
            </View>
            <View style={styles.headerInfo}>
              {editing ? (
                <AppTextInput label="Nombre" value={title} onChangeText={setTitle} />
              ) : <Text style={styles.title} numberOfLines={2}>{meal.title}</Text>}
              <Text style={styles.meta}>
                {mealTypeLabel} · {meal.date ? formatPlanDate(meal.date) : ''}
              </Text>
              <Text style={styles.servings}>
                Raciones para {meal.servings_count} {meal.servings_count === 1 ? 'persona' : 'personas'}
              </Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
            {editing ? (
              <>
                <AppTextInput label="Descripción" value={description} onChangeText={setDescription} multiline />
                <AppTextInput
                  label="Ingredientes (uno por línea: nombre | cantidad)"
                  placeholder={'Arroz | 100 g\nPollo | 150 g'}
                  value={ingredientsText}
                  onChangeText={setIngredientsText}
                  multiline
                  style={styles.editMultiline}
                />
                <AppTextInput
                  label="Preparación"
                  value={recipe}
                  onChangeText={setRecipe}
                  multiline
                  style={styles.editMultiline}
                />
                <AppTextInput label="Porciones" value={servings} onChangeText={setServings} keyboardType="number-pad" />
              </>
            ) : <>
            {meal.description ? <Text style={styles.description}>{meal.description}</Text> : null}

            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <Ionicons name="time-outline" size={13} color={colors.warning} />
                <Text style={styles.chipText}>
                  {prepMinutes != null ? `Tiempo aprox. ${prepMinutes} min` : 'Tiempo estimado'}
                </Text>
              </View>
            </View>

            {meal.ingredients_list.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ingredientes por porción</Text>
                {meal.ingredients_list.map((ing, index) => (
                  <View key={`${ing.name}-${index}`} style={styles.ingredientRow}>
                    <View style={styles.bullet}>
                      <View style={styles.bulletDot} />
                    </View>
                    <Text style={styles.ingredientName}>{ing.name}</Text>
                    {ing.amount ? <Text style={styles.ingredientAmount}>{ing.amount}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}

            {steps.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Receta paso a paso</Text>
                {steps.map((step, index) => (
                  <View key={`${step}-${index}`} style={styles.stepRow}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Receta</Text>
                <Text style={styles.stepText}>{meal.recipe || 'Sin receta detallada.'}</Text>
              </View>
            )}
            </>}
          </ScrollView>

          {editing ? (
            <View style={styles.footerActions}>
              <AppButton title="Guardar cambios" onPress={handleSave} loading={saving} style={styles.closeButton} />
              <AppButton title="Cancelar edición" variant="outline" onPress={() => setEditing(false)} />
            </View>
          ) : (
            <View style={styles.footerActions}>
              {onSave ? <AppButton title="Editar platillo" variant="outline" onPress={startEditing} style={styles.closeButton} /> : null}
              <AppButton title="Cerrar" onPress={onClose} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: '88%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.cardAlt,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  imageWrap: {
    width: 74,
    height: 74,
    borderRadius: 14,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  servings: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  body: {
    flexGrow: 0,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  bullet: {
    width: 16,
    alignItems: 'center',
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
  ingredientName: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  ingredientAmount: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  closeButton: {
    marginTop: 8,
  },
  footerActions: {
    gap: 8,
  },
  editMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
