import { colors } from '../../theme/colors';
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WeightLog } from '../../types/progress';
import { formatNumber } from '../../services/utils';

interface GraficaEvolucionPesoCardProps {
  logs: WeightLog[];
  targetWeight?: number | null;
}

function formatShortDate(date: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date.slice(0, 5);
  return `${parts[2]}/${parts[1]}`;
}

const Y_AXIS_W = 34;
const PLOT_LEFT = Y_AXIS_W + 8;
const RIGHT_PAD = 10;
const PLOT_HEIGHT = 130;
const TOP_PAD = 26;
const BOTTOM_PAD = 30;
const MIN_SPACING = 48;
const LINE_WIDTH = 2;
const DOT_SIZE = 9;
const LABEL_WIDTH = 44;
const DATE_WIDTH = 60;

export default function GraficaEvolucionPesoCard({
  logs,
  targetWeight,
}: GraficaEvolucionPesoCardProps) {
  const { width } = useWindowDimensions();

  const sorted = useMemo(
    () =>
      [...logs].sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1)),
    [logs],
  );

  const cardInnerWidth = width - 32 - 36;

  const geometry = useMemo(() => {
    if (sorted.length === 0) return null;
    const values = sorted.map((l) => l.weight_kg);
    if (targetWeight !== null && targetWeight !== undefined) {
      values.push(targetWeight);
    }
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const span = Math.max(rawMax - rawMin, 1);
    const padY = span * 0.18;
    const yMin = rawMin - padY;
    const yMax = rawMax + padY;

    const count = sorted.length;
    const available = Math.max(cardInnerWidth - PLOT_LEFT - RIGHT_PAD, MIN_SPACING);
    const spacing =
      count > 1 ? Math.max(MIN_SPACING, available / (count - 1)) : available / 2;

    const toX = (index: number) => PLOT_LEFT + index * spacing;
    const toY = (weight: number) =>
      TOP_PAD + PLOT_HEIGHT - ((weight - yMin) / (yMax - yMin)) * PLOT_HEIGHT;

    const plotSpan = count > 1 ? spacing * (count - 1) : spacing;
    const contentWidth = count > 1
      ? PLOT_LEFT + spacing * (count - 1) + RIGHT_PAD
      : PLOT_LEFT + spacing + RIGHT_PAD;
    const targetY =
      targetWeight !== null && targetWeight !== undefined ? toY(targetWeight) : null;

    const ticks = [
      { y: toY(yMax), label: `${Math.round(yMax)} kg` },
      { y: toY((yMin + yMax) / 2), label: `${Math.round((yMin + yMax) / 2)} kg` },
      { y: toY(yMin), label: `${Math.round(yMin)} kg` },
    ];

    return { count, spacing, toX, toY, contentWidth, plotSpan, targetY, ticks };
  }, [sorted, targetWeight, cardInnerWidth]);

  if (sorted.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Evolución de Peso</Text>
        <View style={styles.emptyState}>
          <Ionicons name="pulse-outline" size={36} color={colors.cardAlt} />
          <Text style={styles.emptyTitle}>Aún no hay registros de peso</Text>
          <Text style={styles.emptyText}>
            Añade un nuevo registro de peso para trazar tu gráfica de tendencia.
          </Text>
        </View>
      </View>
    );
  }

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const delta = Math.round((last.weight_kg - first.weight_kg) * 10) / 10;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Evolución de Peso</Text>
          <Text style={styles.subtitle}>Registros por fecha</Text>
        </View>
        <View style={styles.deltaBadge}>
          <Ionicons
            name={delta > 0.05 ? 'trending-up' : delta < -0.05 ? 'trending-down' : 'remove'}
            size={14}
            color={delta < -0.05 ? colors.success : delta > 0.05 ? colors.primary : colors.textMuted}
          />
          <Text style={styles.deltaText}>
            {delta > 0 ? '+' : ''}
            {formatNumber(delta, 1)} kg
          </Text>
        </View>
      </View>

      {sorted.length === 1 ? (
        <View style={styles.singleWrap}>
          <Text style={styles.singleValue}>{formatNumber(first.weight_kg, 1)} kg</Text>
          <Text style={styles.singleDate}>{formatShortDate(first.date)}</Text>
          <Text style={styles.singleHint}>
            Añade un nuevo registro de peso para trazar tu gráfica de tendencia.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View
            style={[
              styles.plot,
              {
                width: geometry!.contentWidth,
                height: TOP_PAD + PLOT_HEIGHT + BOTTOM_PAD,
              },
            ]}
          >
            {geometry!.ticks.map((tick, idx) => (
              <View key={`tick-${idx}`}>
                <View
                  style={[
                    styles.gridLine,
                    {
                      top: tick.y,
                      width: geometry!.plotSpan,
                    },
                  ]}
                />
                <Text style={[styles.axisLabel, { top: tick.y - 7 }]}>{tick.label}</Text>
              </View>
            ))}

            {geometry!.targetY !== null ? (
              <>
                <View
                  style={[
                    styles.targetLine,
                    {
                      top: geometry!.targetY,
                      width: geometry!.plotSpan,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.targetLabel,
                    {
                      top: geometry!.targetY - 8,
                      left: PLOT_LEFT + geometry!.plotSpan - 96,
                    },
                  ]}
                >
                  <Text style={styles.targetLabelText}>
                    Meta {formatNumber(targetWeight ?? 0, 1)} kg
                  </Text>
                </View>
              </>
            ) : null}

            {sorted.slice(1).map((log, i) => {
              const prev = sorted[i];
              const x1 = geometry!.toX(i);
              const y1 = geometry!.toY(prev.weight_kg);
              const x2 = geometry!.toX(i + 1);
              const y2 = geometry!.toY(log.weight_kg);
              const dx = x2 - x1;
              const dy = y2 - y1;
              const length = Math.sqrt(dx * dx + dy * dy);
              const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
              return (
                <View
                  key={`seg-${log.id}`}
                  style={[
                    styles.segment,
                    {
                      left: x1,
                      top: y1 - LINE_WIDTH / 2,
                      width: length,
                      transform: [{ rotate: `${angleDeg}deg` }],
                    },
                  ]}
                />
              );
            })}

            {sorted.map((log, i) => {
              const x = geometry!.toX(i);
              const y = geometry!.toY(log.weight_kg);
              return (
                <View key={`pt-${log.id}`} style={[styles.pointWrap, { left: x, top: y }]}>
                  <View style={[styles.dot, i === sorted.length - 1 ? styles.dotLast : null]} />
                  <Text style={[styles.valueLabel, { left: -LABEL_WIDTH / 2, top: -18 }]}>
                    {formatNumber(log.weight_kg, 1)}
                  </Text>
                  <Text style={[styles.dateLabel, { left: -DATE_WIDTH / 2, top: DOT_SIZE + 5 }]}>
                    {formatShortDate(log.date)}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendText}>Tu evolución</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendDash} />
          <Text style={styles.legendText}>Meta</Text>
        </View>
      </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deltaText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  plot: {
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: PLOT_LEFT,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardAlt,
    opacity: 0.55,
  },
  axisLabel: {
    position: 'absolute',
    left: 0,
    width: Y_AXIS_W - 6,
    textAlign: 'right',
    color: colors.textSubtle,
    fontSize: 9,
  },
  segment: {
    position: 'absolute',
    height: LINE_WIDTH,
    backgroundColor: colors.primary,
    borderRadius: LINE_WIDTH / 2,
    opacity: 0.9,
    transformOrigin: 'left center',
  },
  pointWrap: {
    position: 'absolute',
    width: 0,
    height: 0,
  },
  dot: {
    position: 'absolute',
    left: -DOT_SIZE / 2,
    top: -DOT_SIZE / 2,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  dotLast: {
    backgroundColor: colors.text,
    borderColor: colors.primary,
  },
  valueLabel: {
    position: 'absolute',
    width: LABEL_WIDTH,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  dateLabel: {
    position: 'absolute',
    width: DATE_WIDTH,
    textAlign: 'center',
    color: colors.textSubtle,
    fontSize: 10,
  },
  targetLine: {
    position: 'absolute',
    left: PLOT_LEFT,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.success,
    opacity: 0.85,
  },
  targetLabel: {
    position: 'absolute',
    backgroundColor: colors.successSoft,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  targetLabelText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: '700',
  },
  singleWrap: {
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardAlt,
  },
  singleValue: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  singleDate: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 4,
  },
  singleHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.cardAlt,
    paddingTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendDash: {
    width: 16,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.success,
  },
  legendText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  emptyText: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
});