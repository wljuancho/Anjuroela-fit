import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DAYS_ORDER } from '../../types/workout';
import type { PlanMealType, WeeklyMealPlanItem } from '../../types/nutrition';

interface PlanComidasSemanalCardProps {
  plan: WeeklyMealPlanItem[];
}

const DAY_LABELS: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

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

export default function PlanComidasSemanalCard({ plan }: PlanComidasSemanalCardProps) {
  if (plan.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Plan de Comidas Semanal</Text>
        <Text style={styles.emptyText}>El menú semanal vendrá muy pronto.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Plan de Comidas Semanal</Text>

      {DAYS_ORDER.map((day) => {
        const items = plan.filter((item) => item.day_of_week === day);
        if (items.length === 0) return null;
        return (
          <View key={day} style={styles.dayBlock}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{DAY_LABELS[day]}</Text>
              <Text style={styles.dayCount}>{items.length} comidas</Text>
            </View>
            {items.map((item) => (
              <View key={item.id} style={styles.mealRow}>
                <View style={styles.mealIconWrap}>
                  <Ionicons
                    name={MEAL_TYPE_ICONS[item.meal_type]}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.mealInfo}>
                  <View style={styles.mealHeader}>
                    <Text style={styles.mealTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.mealType}>{MEAL_TYPE_LABELS[item.meal_type]}</Text>
                  </View>
                  {item.description ? (
                    <Text style={styles.mealDescription} numberOfLines={2}>{item.description}</Text>
                  ) : null}
                  {item.ingredients ? (
                    <Text style={styles.mealIngredients} numberOfLines={1}>
                      Ingredientes: {item.ingredients}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.servingsBadge}>
                  <Ionicons name="people-outline" size={13} color={colors.success} />
                  <Text style={styles.servingsText}>Para {item.servings}</Text>
                </View>
              </View>
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
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  emptyText: {
    color: colors.textSubtle,
    fontSize: 13,
  },
  dayBlock: {
    marginBottom: 16,
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
    alignItems: 'flex-start',
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
});