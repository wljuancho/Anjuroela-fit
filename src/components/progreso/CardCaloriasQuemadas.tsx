import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SessionCaloriesBurned } from '../../types/progress';
import { DAY_LABELS } from '../../types/workout';
import { formatNumber } from '../../services/utils';

interface CardCaloriasQuemadasProps {
  sessions: SessionCaloriesBurned[];
}

function formatFriendlyDate(date: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function CardCaloriasQuemadas({ sessions }: CardCaloriasQuemadasProps) {
  const total = sessions.reduce((acc, s) => acc + s.caloriesBurned, 0);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.cardTitle}>Calorías Quemadas</Text>
        {sessions.length > 0 ? (
          <View style={styles.totalChip}>
            <Text style={styles.totalValue}>{formatNumber(total)}</Text>
            <Text style={styles.totalLabel}>kcal</Text>
          </View>
        ) : null}
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyRow}>
          <Ionicons name="flame-outline" size={18} color={colors.textSubtle} />
          <Text style={styles.emptyText}>
            Al completar un entrenamiento, aquí verás las kcal que quemaste (estimación
            aproximada).
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {sessions.map((s) => (
            <View key={s.sessionId} style={styles.row}>
              <View style={styles.rowIcon}>
                <Ionicons name="flame" size={16} color={colors.primary} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={styles.rowDate}>
                  {formatFriendlyDate(s.date)} · {DAY_LABELS[s.dayOfWeek as keyof typeof DAY_LABELS] ?? s.dayOfWeek}
                </Text>
                <Text style={styles.rowMeta}>
                  {s.setCount} {s.setCount === 1 ? 'serie' : 'series'}
                </Text>
              </View>
              <Text style={styles.rowValue}>{formatNumber(s.caloriesBurned)} kcal</Text>
            </View>
          ))}
        </View>
      )}
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
    marginBottom: 12,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  totalChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: colors.primarySofter,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 3,
  },
  totalValue: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  totalLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  emptyText: {
    color: colors.textSubtle,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
  },
  rowDate: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  rowValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});