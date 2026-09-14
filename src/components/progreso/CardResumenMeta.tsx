import { colors } from '../../theme/colors';
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../AppButton';
import type { GoalSummary } from '../../types/progress';
import { formatNumber, formatDate } from '../../services/utils';

interface CardResumenMetaProps {
  summary: GoalSummary;
  onSetNewGoal?: () => void;
}

function formatDateLabel(date: string | null): string {
  if (!date) return '—';
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function MetricBox({
  label,
  value,
  icon,
  accent,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent?: string;
  highlight?: boolean;
}) {
  const iconColor = highlight ? colors.primary : accent ?? colors.textMuted;
  return (
    <View style={[styles.metricBox, highlight ? styles.metricBoxHighlight : null]}>
      <View style={styles.metricHeader}>
        <View style={[styles.metricIconWrap, highlight ? styles.metricIconWrapHighlight : null]}>
          <Ionicons name={icon} size={15} color={iconColor} />
        </View>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, highlight ? styles.metricValueHighlight : null]}>
        {value}
      </Text>
    </View>
  );
}

export default function CardResumenMeta({ summary, onSetNewGoal }: CardResumenMetaProps) {
  const {
    initialWeight,
    currentWeight,
    targetWeight,
    goalDate,
    differenceRemaining,
    progressPercent,
    direction,
  } = summary;

  const goalReached = useMemo(() => {
    if (currentWeight === null || targetWeight === null) return false;
    if (direction === 'lose') return currentWeight <= targetWeight;
    if (direction === 'gain') return currentWeight >= targetWeight;
    if (direction === 'maintain') return Math.abs(currentWeight - targetWeight) <= 0.5;
    return false;
  }, [currentWeight, targetWeight, direction]);

  const reachedEarly = useMemo(() => {
    if (!goalReached || !goalDate) return false;
    return goalDate > formatDate(new Date());
  }, [goalReached, goalDate]);

  const progressWidth =
    progressPercent !== null ? Math.min(100, Math.max(0, progressPercent)) : 0;
  const isComplete = progressPercent !== null && progressWidth >= 99.95;
  const diffAbs = differenceRemaining !== null ? Math.abs(differenceRemaining) : null;
  const faltanteLabel =
    direction === 'lose' ? 'Falta (bajar)' : direction === 'gain' ? 'Falta (subir)' : 'Por lograr';
  const faltanteIcon =
    direction === 'lose'
      ? 'trending-down-outline'
      : direction === 'gain'
        ? 'trending-up-outline'
        : 'swap-horizontal-outline';

  return (
    <View style={styles.card}>
      {goalReached ? (
        <View style={styles.celebrateBanner}>
          <View style={styles.celebrateRow}>
            <Text style={styles.celebrateEmoji}>🎉</Text>
            <Text style={styles.celebrateTitle}>¡Felicidades!</Text>
          </View>
          <Text style={styles.celebrateText}>
            {reachedEarly
              ? 'Alcanzaste tu objetivo de peso antes de tiempo. Has demostrado una constancia increíble.'
              : 'Alcanzaste tu objetivo de peso. Has demostrado una constancia increíble.'}
          </Text>
          {onSetNewGoal ? (
            <AppButton
              title="Establecer Nueva Meta"
              onPress={onSetNewGoal}
              style={styles.newGoalBtn}
            />
          ) : null}
        </View>
      ) : null}

      <Text style={styles.cardTitle}>Resumen de Meta</Text>

      <View style={styles.metricsGrid}>
        <MetricBox
          label="Peso Inicial"
          value={initialWeight !== null ? `${formatNumber(initialWeight, 1)} kg` : '—'}
          icon="flag-outline"
        />
        <MetricBox
          label="Peso Actual"
          value={currentWeight !== null ? `${formatNumber(currentWeight, 1)} kg` : '—'}
          icon="scale-outline"
          highlight
        />
        <MetricBox
          label="Peso Objetivo"
          value={targetWeight !== null ? `${formatNumber(targetWeight, 1)} kg` : '—'}
          icon="locate-outline"
          accent={colors.success}
        />
        <MetricBox
          label={faltanteLabel}
          value={diffAbs !== null ? `${formatNumber(diffAbs, 1)} kg` : '—'}
          icon={faltanteIcon}
          accent={colors.warning}
        />
      </View>

      {direction && direction !== 'maintain' ? (
        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>
              {direction === 'lose' ? 'Avance de pérdida' : 'Avance de ganancia'}
            </Text>
            <Text
              style={[
                styles.progressPercent,
                isComplete ? styles.progressPercentComplete : null,
              ]}
            >
              {progressPercent !== null ? `${formatNumber(progressPercent, 1)}%` : '—'}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                isComplete ? styles.progressFillComplete : null,
                { width: `${progressWidth}%` },
              ]}
            />
          </View>
          {isComplete ? (
            <View style={styles.completeRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.completeText}>¡Meta de peso lograda!</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Fecha estimada de meta</Text>
        <Text style={styles.footerValue}>{formatDateLabel(goalDate)}</Text>
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
  celebrateBanner: {
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  celebrateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  celebrateEmoji: {
    fontSize: 20,
  },
  celebrateTitle: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '800',
  },
  celebrateText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  newGoalBtn: {
    marginTop: 12,
    minHeight: 44,
    paddingVertical: 10,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricBox: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  metricBoxHighlight: {
    borderColor: colors.primary,
    backgroundColor: colors.graph,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metricIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricIconWrapHighlight: {
    backgroundColor: colors.primarySoft,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 11,
    flexShrink: 1,
  },
  metricValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  metricValueHighlight: {
    color: colors.primary,
  },
  progressBlock: {
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  progressPercent: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  progressPercentComplete: {
    color: colors.success,
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
  progressFillComplete: {
    backgroundColor: colors.success,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  completeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.cardAlt,
    paddingTop: 12,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  footerValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});