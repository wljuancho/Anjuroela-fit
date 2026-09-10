import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { GoalSummary } from '../../types/progress';
import { formatNumber } from '../../services/utils';

interface CardResumenMetaProps {
  summary: GoalSummary;
}

function MetricBox({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.metricBox, highlight ? styles.metricBoxHighlight : null]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, highlight ? styles.metricValueHighlight : null]}>{value}</Text>
    </View>
  );
}

function formatDateLabel(date: string | null): string {
  if (!date) return '—';
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function CardResumenMeta({ summary }: CardResumenMetaProps) {
  const {
    initialWeight,
    currentWeight,
    targetWeight,
    goalDate,
    differenceRemaining,
    progressPercent,
    direction,
  } = summary;

  const progressWidth = progressPercent !== null ? Math.min(100, Math.max(0, progressPercent)) : 0;
  const diffAbs = differenceRemaining !== null ? Math.abs(differenceRemaining) : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Resumen de Meta</Text>

      <View style={styles.metricsGrid}>
        <MetricBox
          label="Peso Inicial"
          value={initialWeight !== null ? `${formatNumber(initialWeight, 1)} kg` : '—'}
        />
        <MetricBox
          label="Peso Actual"
          value={currentWeight !== null ? `${formatNumber(currentWeight, 1)} kg` : '—'}
          highlight
        />
        <MetricBox
          label="Peso Objetivo"
          value={targetWeight !== null ? `${formatNumber(targetWeight, 1)} kg` : '—'}
        />
        <MetricBox
          label={diffAbs !== null && differenceRemaining !== null && differenceRemaining > 0 ? 'Falta (bajar)' : 'Falta (subir)'}
          value={diffAbs !== null ? `${formatNumber(diffAbs, 1)} kg` : '—'}
        />
      </View>

      {direction && direction !== 'maintain' ? (
        <View style={styles.progressBlock}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>{direction === 'lose' ? 'Avance de pérdida' : 'Avance de ganancia'}</Text>
            <Text style={styles.progressPercent}>
              {progressPercent !== null ? `${formatNumber(progressPercent, 1)}%` : '—'}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressWidth}%` }]} />
          </View>
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
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
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