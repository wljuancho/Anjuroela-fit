import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { DailyMealSummary } from '../../types/meal';
import { formatNumber } from '../../services/utils';

interface CardResumenCaloriasProps {
  summary: DailyMealSummary;
}

export default function CardResumenCalorias({ summary }: CardResumenCaloriasProps) {
  const goalCalories = summary.goal?.calories ?? null;
  const remaining =
    goalCalories !== null ? Math.max(0, goalCalories - summary.totalCalories) : null;
  const consumedPercent =
    goalCalories !== null && goalCalories > 0
      ? Math.min(100, (summary.totalCalories / goalCalories) * 100)
      : 0;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Calorías de hoy</Text>

      <View style={styles.ringRow}>
        <View style={styles.ring}>
          <Text style={styles.ringValue}>{formatNumber(summary.totalCalories)}</Text>
          <Text style={styles.ringLabel}>kcal</Text>
        </View>
        <View style={styles.goalBox}>
          <Text style={styles.goalLabel}>Objetivo diario</Text>
          <Text style={styles.goalValue}>
            {goalCalories !== null ? `${formatNumber(goalCalories)} kcal` : '—'}
          </Text>
          <Text style={styles.remainingLabel}>
            {remaining !== null ? `Restantes: ${formatNumber(remaining)} kcal` : 'Meta no disponible'}
          </Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${consumedPercent}%` }]} />
      </View>

      <View style={styles.macrosRow}>
        <View style={styles.macroBox}>
          <Text style={styles.macroValue}>{formatNumber(summary.totalProteinG, 1)} g</Text>
          <Text style={styles.macroLabel}>Proteína</Text>
        </View>
        <View style={styles.macroBox}>
          <Text style={styles.macroValue}>{formatNumber(summary.totalCarbsG)} g</Text>
          <Text style={styles.macroLabel}>Carbohidratos</Text>
        </View>
        <View style={styles.macroBox}>
          <Text style={styles.macroValue}>{formatNumber(summary.totalFatG)} g</Text>
          <Text style={styles.macroLabel}>Grasas</Text>
        </View>
      </View>
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
  ringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ring: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 6,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  ringValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  ringLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  goalBox: {
    flex: 1,
  },
  goalLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 4,
  },
  goalValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  remainingLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.background,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  macrosRow: {
    flexDirection: 'row',
    gap: 10,
  },
  macroBox: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  macroValue: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  macroLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
});