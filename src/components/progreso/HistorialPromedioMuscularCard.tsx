import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { MuscleGroupStrengthHistory } from '../../types/progress';
import { formatNumber } from '../../services/utils';

interface HistorialPromedioMuscularCardProps {
  record: MuscleGroupStrengthHistory | null;
}

function formatShortDate(date: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date.slice(0, 5);
  return `${parts[2]}/${parts[1]}`;
}

export default function HistorialPromedioMuscularCard({
  record,
}: HistorialPromedioMuscularCardProps) {
  if (!record || record.history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Registra sesiones con peso para ver el promedio por grupo muscular aquí.
        </Text>
      </View>
    );
  }

  const maxWeight = Math.max(...record.history.map((h) => h.maxWeightKg ?? 0), 0);
  const chartHeight = 80;

  return (
    <View style={styles.container}>
      <Text style={styles.groupName}>{record.bodyPartName}</Text>
      <Text style={styles.label}>Promedio de peso por sesión</Text>

      {record.history.length === 1 ? (
        <View style={styles.singleStat}>
          <Text style={styles.singleLabel}>Promedio registrado</Text>
          <Text style={styles.singleValue}>
            {record.history[0].maxWeightKg !== null
              ? `${formatNumber(record.history[0].maxWeightKg, 1)} kg`
              : '—'}
          </Text>
          <Text style={styles.singleDate}>{record.history[0].date}</Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chartScroll}
          >
            <View style={styles.chart}>
              {record.history.map((entry, index) => {
                const height =
                  maxWeight > 0 && entry.maxWeightKg
                    ? (entry.maxWeightKg / maxWeight) * chartHeight
                    : 0;
                return (
                  <View key={index} style={styles.barColumn}>
                    <Text style={styles.barValue}>
                      {entry.maxWeightKg !== null
                        ? formatNumber(entry.maxWeightKg, 1)
                        : '0'}
                    </Text>
                    <View style={[styles.bar, { height: Math.max(4, height) }]} />
                    <Text style={styles.barDate}>{formatShortDate(entry.date)}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.legendRow}>
            <Text style={styles.legendText}>Promedio actual</Text>
            <Text style={styles.legendValue}>
              {record.history[record.history.length - 1].maxWeightKg !== null
                ? `${formatNumber(
                    record.history[record.history.length - 1].maxWeightKg ?? 0,
                    1,
                  )} kg`
                : '—'}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  emptyContainer: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  groupName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
  },
  chartScroll: {
    flexGrow: 0,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingBottom: 4,
    minWidth: '100%',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    minWidth: 44,
  },
  barValue: {
    color: colors.textMuted,
    fontSize: 10,
    marginBottom: 4,
  },
  bar: {
    width: 22,
    backgroundColor: colors.primary,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    opacity: 0.7,
  },
  barDate: {
    color: colors.textSubtle,
    fontSize: 11,
    marginTop: 6,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.cardAlt,
    paddingTop: 12,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  legendValue: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  singleStat: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  singleLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 6,
  },
  singleValue: {
    color: colors.primary,
    fontSize: 26,
    fontWeight: '800',
  },
  singleDate: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 4,
  },
});
