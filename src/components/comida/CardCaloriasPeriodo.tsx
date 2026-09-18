import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CaloriasPeriodoResumen } from '../../types/nutrition';
import { formatNumber } from '../../services/utils';

interface CardCaloriasPeriodoProps {
  period: CaloriasPeriodoResumen;
}

function PeriodRow({
  icon,
  label,
  consumed,
  days,
  goal,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  consumed: number;
  days: number;
  goal: number;
}) {
  const percentage = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;
  return (
    <View style={styles.periodRow}>
      <View style={styles.periodHeader}>
        <View style={styles.periodTitleWrap}>
          <View style={styles.periodIcon}>
            <Ionicons name={icon} size={14} color={colors.primary} />
          </View>
          <Text style={styles.periodLabel}>{label}</Text>
        </View>
        <Text style={styles.periodValue}>{formatNumber(consumed)} kcal</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percentage}%` }]} />
      </View>
      <Text style={styles.periodMeta}>
        {formatNumber(consumed)} de {formatNumber(goal)} kcal consumidas · {days}{' '}
        {days === 1 ? 'día registrado' : 'días registrados'}
      </Text>
    </View>
  );
}

export default function CardCaloriasPeriodo({ period }: CardCaloriasPeriodoProps) {
  const { weekConsumed, weekDays, monthConsumed, monthDays, goal } = period;
  const hasGoal = goal !== null && goal > 0;
  const weekGoal = hasGoal ? goal * 7 : 1;
  const monthGoal = hasGoal ? goal * 30 : 1;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.cardTitle}>Calorías de la semana y el mes</Text>
      </View>
      <PeriodRow
        icon="calendar"
        label="Esta semana"
        consumed={weekConsumed}
        days={weekDays}
        goal={weekGoal}
      />
      <View style={styles.divider} />
      <PeriodRow
        icon="calendar-number"
        label="Este mes"
        consumed={monthConsumed}
        days={monthDays}
        goal={monthGoal}
      />
      {!hasGoal ? (
        <Text style={styles.noGoalText}>
          Configura tu meta diaria para ver el avance semanal y mensual.
        </Text>
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
    marginBottom: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  periodRow: {
    marginBottom: 4,
  },
  periodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  periodTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  periodIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  periodValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  periodMeta: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardAlt,
    marginVertical: 12,
  },
  noGoalText: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 10,
  },
});