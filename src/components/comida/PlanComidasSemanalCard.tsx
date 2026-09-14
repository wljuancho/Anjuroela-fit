import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPlanDate } from '../../services/utils';
import type { PlanMealType, WeeklyMealPlanItem } from '../../types/nutrition';

interface PlanComidasSemanalCardProps {
  plan: WeeklyMealPlanItem[];
  onSelectMeal: (item: WeeklyMealPlanItem) => void;
  onDeleteMeal: (id: number) => void;
  onClearPlan: () => void;
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

const MEAL_TYPE_ORDER: Record<string, number> = {
  desayuno: 0,
  almuerzo: 1,
  cena: 2,
  snack: 3,
};

export default function PlanComidasSemanalCard({
  plan,
  onSelectMeal,
  onDeleteMeal,
  onClearPlan,
}: PlanComidasSemanalCardProps) {
  if (plan.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Plan de Comidas</Text>
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="restaurant-outline" size={40} color={colors.textSubtle} />
          </View>
          <Text style={styles.emptyText}>
            Aún no tienes un plan de comidas. Pídele al Entrenador Anjuroela que te diseñe una dieta
            personalizada.
          </Text>
          <Text style={styles.emptyHint}>
            Ve a la pestaña Entrenador y pide por ejemplo: "Crea un plan de comidas para 2 personas
            durante 8 días".
          </Text>
        </View>
      </View>
    );
  }

  const dates = [...new Set(plan.map((item) => item.date))].sort();
  const expiryDates = plan.map((item) => item.expires_at).filter(Boolean);
  const expiresAt = expiryDates.length > 0 ? expiryDates.sort().pop() : '';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.cardTitle}>Plan de Comidas</Text>
          <Text style={styles.headerMeta}>
            {dates.length} {dates.length === 1 ? 'día' : 'días'} · {plan.length}{' '}
            {plan.length === 1 ? 'platillo' : 'platillos'}
            {expiresAt ? ` · expira el ${formatPlanDate(expiresAt)}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={styles.clearBtn} onPress={onClearPlan} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={15} color={colors.primary} />
          <Text style={styles.clearText}>Limpiar Plan Completo</Text>
        </TouchableOpacity>
      </View>

      {dates.map((date) => {
        const items = plan
          .filter((item) => item.date === date)
          .sort((a, b) => (MEAL_TYPE_ORDER[a.meal_type] ?? 9) - (MEAL_TYPE_ORDER[b.meal_type] ?? 9));
        return (
          <View key={date} style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{formatPlanDate(date)}</Text>
              <Text style={styles.dayCount}>
                {items.length} {items.length === 1 ? 'comida' : 'comidas'}
              </Text>
            </View>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.mealRow}
                onPress={() => onSelectMeal(item)}
                activeOpacity={0.7}
              >
                <View style={styles.mealIconWrap}>
                  <Ionicons
                    name={MEAL_TYPE_ICONS[item.meal_type] ?? 'restaurant-outline'}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.mealInfo}>
                  <View style={styles.mealHeader}>
                    <Text style={styles.mealTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.mealType}>{MEAL_TYPE_LABELS[item.meal_type] ?? item.meal_type}</Text>
                  </View>
                  {item.description ? (
                    <Text style={styles.mealDescription} numberOfLines={2}>{item.description}</Text>
                  ) : null}
                  {item.ingredients_list.length > 0 ? (
                    <Text style={styles.mealIngredients} numberOfLines={1}>
                      {item.ingredients_list.map((i) => i.name).join(', ')}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.servingsBadge}>
                  <Ionicons name="people-outline" size={13} color={colors.success} />
                  <Text style={styles.servingsText}>{item.servings_count} pers.</Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => onDeleteMeal(item.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-bin-outline" size={18} color={colors.textSubtle} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  header: {
    marginBottom: 14,
  },
  headerLeft: {
    marginBottom: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  headerMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyHint: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 8,
  },
  dayBlock: {
    marginBottom: 12,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  dayCount: {
    color: colors.textMuted,
    fontSize: 12,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 8,
  },
  mealIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primarySofter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealInfo: {
    flex: 1,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  mealTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  mealType: {
    color: colors.textMuted,
    fontSize: 11,
  },
  mealDescription: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  mealIngredients: {
    color: colors.textSubtle,
    fontSize: 11,
    marginTop: 2,
  },
  servingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  servingsText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 4,
  },
});