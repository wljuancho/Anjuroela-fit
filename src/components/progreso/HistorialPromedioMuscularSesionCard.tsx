import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MuscleSessionPoint } from '../../types/progress';
import { formatNumber } from '../../services/utils';

interface HistorialPromedioMuscularSesionCardProps {
  bodyPartName: string;
  points: MuscleSessionPoint[];
}

function formatShortDate(date: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date.slice(0, 5);
  return `${parts[2]}/${parts[1]}`;
}

export default function HistorialPromedioMuscularSesionCard({
  bodyPartName,
  points,
}: HistorialPromedioMuscularSesionCardProps) {
  if (points.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          Aún no has registrado sesiones completadas para este músculo.
        </Text>
        <Text style={styles.emptySubtext}>
          Completa un entrenamiento de {bodyPartName} y presiona "Terminé" para ver su evolución.
        </Text>
      </View>
    );
  }

  const last = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : null;

  let evolution: 'up' | 'down' | 'same' | 'first' = 'first';
  let diff = 0;
  if (prev) {
    diff = Math.round((last.avgWeightKg - prev.avgWeightKg) * 10) / 10;
    if (diff > 0.05) evolution = 'up';
    else if (diff < -0.05) evolution = 'down';
    else evolution = 'same';
  }

  const maxWeight = Math.max(...points.map((p) => p.avgWeightKg), 0);
  const chartHeight = 84;

  return (
    <View style={styles.container}>
      <Text style={styles.groupName}>{bodyPartName}</Text>
      <Text style={styles.label}>Promedio de peso por sesión</Text>

      <View style={[styles.evolutionBanner, styles.evolutionBannerColor]}>
        <Ionicons
          name={evolution === 'up' ? 'trending-up' : evolution === 'down' ? 'trending-down' : 'remove'}
          size={18}
          color={
            evolution === 'up' ? colors.success : evolution === 'down' ? colors.primary : colors.textMuted
          }
        />
        <Text style={[styles.evolutionText, styles.evolutionTextColor]}>
          {evolution === 'first'
            ? `Primera sesión registrada — ${formatNumber(last.avgWeightKg, 1)} kg`
            : evolution === 'up'
              ? `Subiste ${formatNumber(diff, 1)} kg respecto a tu sesión anterior`
              : evolution === 'down'
                ? `Bajaste ${formatNumber(Math.abs(diff), 1)} kg respecto a tu sesión anterior`
                : 'Mantuviste el mismo promedio que tu sesión anterior'}
        </Text>
      </View>

      {points.length === 1 ? (
        <View style={styles.singleStat}>
          <Text style={styles.singleLabel}>Promedio de la sesión</Text>
          <Text style={styles.singleValue}>{formatNumber(last.avgWeightKg, 1)} kg</Text>
          <Text style={styles.singleDate}>
            {last.date} · {last.setCount} serie{last.setCount > 1 ? 's' : ''}
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chartScroll}
          >
            <View style={styles.chart}>
              {points.map((point, index) => {
                let trend: 'up' | 'down' | 'same' | null = null;
                if (index > 0) {
                  const prevPoint = points[index - 1];
                  if (point.avgWeightKg - prevPoint.avgWeightKg > 0.05) trend = 'up';
                  else if (point.avgWeightKg - prevPoint.avgWeightKg < -0.05) trend = 'down';
                  else trend = 'same';
                }
                const height = maxWeight > 0 ? (point.avgWeightKg / maxWeight) * chartHeight : 0;
                return (
                  <View key={`${point.date}-${index}`} style={styles.barColumn}>
                    <Ionicons
                      name={
                        trend === 'up'
                          ? 'caret-up'
                          : trend === 'down'
                            ? 'caret-down'
                            : 'remove'
                      }
                      size={14}
                      color={
                        trend === 'up'
                          ? colors.success
                          : trend === 'down'
                            ? colors.primary
                            : 'transparent'
                      }
                    />
                    <Text style={styles.barValue}>{formatNumber(point.avgWeightKg, 1)}</Text>
                    <View style={[styles.bar, { height: Math.max(4, height) }]} />
                    <Text style={styles.barDate}>{formatShortDate(point.date)}</Text>
                    <Text style={styles.barSets}>
                      {point.setCount} serie{point.setCount > 1 ? 's' : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
          <View style={styles.legendRow}>
            <Text style={styles.legendText}>Promedio actual</Text>
            <Text style={styles.legendValue}>{formatNumber(last.avgWeightKg, 1)} kg</Text>
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
  emptySubtext: {
    color: colors.textSubtle,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 6,
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
    marginBottom: 12,
  },
  evolutionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  evolutionBannerColor: {
    backgroundColor: colors.primarySoft,
  },
  evolutionText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  evolutionTextColor: {
    color: colors.text,
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
    marginTop: 2,
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
  barSets: {
    color: colors.textSubtle,
    fontSize: 10,
    marginTop: 2,
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