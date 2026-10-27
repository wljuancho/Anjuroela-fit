import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { formatNumber } from '../../services/utils';
import { calculateWeightTrend, getWeightTrendGuidance } from '../../services/utils/weightTrend';
import type { GoalDirection, WeightLog } from '../../types/progress';

export default function CardTendenciaPeso({ logs, goal }: { logs: WeightLog[]; goal: GoalDirection }) {
  const trend = calculateWeightTrend(logs);
  if (!trend) return null;

  const trendLabel = trend.direction === 'down' ? 'bajando' : trend.direction === 'up' ? 'subiendo' : 'estable';
  const signedChange = `${trend.changeKgPerWeek > 0 ? '+' : ''}${formatNumber(trend.changeKgPerWeek, 2)} kg/semana`;
  return (
    <View style={styles.card} accessibilityLabel={`Tendencia de peso ${trendLabel}`}>
      <View style={styles.header}>
        <Ionicons name="analytics-outline" size={19} color={colors.primary} />
        <Text style={styles.title}>Tendencia reciente</Text>
      </View>
      <Text style={styles.value}>{trendLabel} · {signedChange}</Text>
      <Text style={styles.caption}>
        Promedio reciente: {formatNumber(trend.recentAverageKg, 1)} kg. {getWeightTrendGuidance(trend, goal)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  value: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  caption: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6 },
});
