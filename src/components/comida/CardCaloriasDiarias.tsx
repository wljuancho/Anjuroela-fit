import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NutritionDayData } from '../../types/nutrition';
import { formatNumber } from '../../services/utils';

interface CardCaloriasDiariasProps {
  data: NutritionDayData;
  onEditStrategy?: () => void;
}

export default function CardCaloriasDiarias({ data, onEditStrategy }: CardCaloriasDiariasProps) {
  const { caloriesConsumed, goal, remaining, percentage } = data;
  const hasGoal = goal !== null && goal > 0;
  const overGoal = hasGoal && remaining !== null && remaining < 0;
  const fillColor = overGoal ? colors.warning : colors.primary;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.cardTitle}>Calorías de hoy</Text>
        {onEditStrategy ? (
          <TouchableOpacity style={styles.editButton} onPress={onEditStrategy} hitSlop={8}>
            <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
            <Text style={styles.editLabel}>Meta</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.ringRow}>
        <View style={[styles.ring, overGoal ? styles.ringOver : null]}>
          <Text style={styles.ringValue}>{formatNumber(caloriesConsumed)}</Text>
          <Text style={styles.ringLabel}>kcal</Text>
        </View>
        <View style={styles.goalBox}>
          <Text style={styles.goalLabel}>Meta diaria</Text>
          <Text style={styles.goalValue}>
            {hasGoal ? `${formatNumber(goal!)} kcal` : '—'}
          </Text>
          {hasGoal ? (
            <Text style={[styles.remainingLabel, overGoal ? styles.remainingOver : null]}>
              {remaining !== null && remaining < 0
                ? `Excedido +${formatNumber(Math.abs(remaining))} kcal`
                : `Restantes: ${formatNumber(remaining ?? 0)} kcal`}
            </Text>
          ) : (
            <Text style={styles.noGoalText}>Completa el test para activar tu contador</Text>
          )}
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            overGoal ? styles.progressFillOver : null,
            { width: `${percentage}%` },
          ]}
        />
      </View>

      {hasGoal ? (
        <View style={styles.percentRow}>
          <Text style={styles.percentText}>{formatNumber(percentage, 1)}% de tu meta consumida</Text>
        </View>
      ) : null}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  editLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
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
  ringOver: {
    borderColor: colors.warning,
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
  remainingOver: {
    color: colors.warning,
  },
  noGoalText: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  progressFillOver: {
    backgroundColor: colors.warning,
  },
  percentRow: {
    marginTop: 8,
  },
  percentText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});