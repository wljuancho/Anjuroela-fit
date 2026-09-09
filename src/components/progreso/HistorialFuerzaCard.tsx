import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import type { ExerciseStrengthRecord } from '../../types/progress';
import { formatNumber } from '../../services/utils';

interface HistorialFuerzaCardProps {
  record: ExerciseStrengthRecord | null;
}

function formatShortDate(date: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date.slice(0, 5);
  return `${parts[2]}/${parts[1]}`;
}

export default function HistorialFuerzaCard({ record }: HistorialFuerzaCardProps) {
  if (!record || record.history.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Registra sesiones y pesos levantados para ver tu evolución de fuerza aquí.
        </Text>
      </View>
    );
  }

  const maxWeight = Math.max(...record.history.map((h) => h.maxWeightKg ?? 0), 0);
  const chartHeight = 80;

  return (
    <View style={styles.container}>
      <Text style={styles.exerciseName}>{record.exerciseName}</Text>
      <Text style={styles.bodyPartName}>{record.bodyPartName}</Text>

      {record.history.length === 1 ? (
        <View style={styles.singleStat}>
          <Text style={styles.singleLabel}>Máximo levantado</Text>
          <Text style={styles.singleValue}>
            {record.history[0].maxWeightKg !== null ? `${formatNumber(record.history[0].maxWeightKg, 1)} kg` : '—'}
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
                const height = maxWeight > 0 && entry.maxWeightKg ? (entry.maxWeightKg / maxWeight) * chartHeight : 0;
                return (
                  <View key={index} style={styles.barColumn}>
                    <Text style={styles.barValue}>
                      {entry.maxWeightKg !== null ? formatNumber(entry.maxWeightKg, 1) : '0'}
                    </Text>
                    <View style={[styles.bar, { height: Math.max(4, height) }]} />
                    <Text style={styles.barDate}>{formatShortDate(entry.date)}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.legendRow}>
            <Text style={styles.legendText}>Máximo actual</Text>
            <Text style={styles.legendValue}>
              {record.history[record.history.length - 1].maxWeightKg !== null
                ? `${formatNumber(record.history[record.history.length - 1].maxWeightKg ?? 0, 1)} kg`
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
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  emptyContainer: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 14,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  emptyText: {
    color: '#a0a0b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  exerciseName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  bodyPartName: {
    color: '#a0a0b8',
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
    color: '#a0a0b8',
    fontSize: 10,
    marginBottom: 4,
  },
  bar: {
    width: 22,
    backgroundColor: '#e94560',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barDate: {
    color: '#7a7a96',
    fontSize: 11,
    marginTop: 6,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a4a',
    paddingTop: 12,
  },
  legendText: {
    color: '#a0a0b8',
    fontSize: 13,
  },
  legendValue: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '700',
  },
  singleStat: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  singleLabel: {
    color: '#a0a0b8',
    fontSize: 13,
    marginBottom: 6,
  },
  singleValue: {
    color: '#e94560',
    fontSize: 26,
    fontWeight: '800',
  },
  singleDate: {
    color: '#7a7a96',
    fontSize: 12,
    marginTop: 4,
  },
});