import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SessionCaloriesBurned } from '../../types/progress';
import { formatNumber } from '../../services/utils';

interface CardCaloriasQuemadasProps {
  sessions: SessionCaloriesBurned[];
  onPress: () => void;
}

function getMonday(dateValue: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CardCaloriasQuemadas({ sessions, onPress }: CardCaloriasQuemadasProps) {
  const today = new Date();
  today.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const currentWeek = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const weekSessions = sessions.filter((session) => getMonday(session.date) === currentWeek);
  const weekCalories = weekSessions.reduce((sum, session) => sum + session.caloriesBurned, 0);
  const wearableSessions = weekSessions.filter((session) => session.caloriesSource === 'wearable').length;

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Abrir historial semanal de calorías quemadas"
    >
      <View style={styles.topRow}>
        <View style={styles.iconWrap}>
          <Ionicons name="flame" size={19} color={colors.primary} />
        </View>
        <View style={styles.heading}>
          <Text style={styles.title}>Calorías quemadas</Text>
          <Text style={styles.subtitle}>Resumen de esta semana</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.value}>{formatNumber(weekCalories)}</Text>
        <Text style={styles.unit}>kcal</Text>
        <View style={styles.separator} />
        <Text style={styles.sessionCount}>
          {weekSessions.length} {weekSessions.length === 1 ? 'sesión' : 'sesiones'}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {weekSessions.length === 0
            ? 'Tus entrenamientos aparecerán aquí.'
            : `${wearableSessions} con wearable · ${weekSessions.length - wearableSessions} estimadas`}
        </Text>
        <Text style={styles.link}>Ver semanas</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 18,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 16,
  },
  value: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  separator: {
    width: 1,
    height: 18,
    backgroundColor: colors.border,
    marginHorizontal: 12,
    alignSelf: 'center',
  },
  sessionCount: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 12,
    paddingTop: 10,
    gap: 8,
  },
  footerText: {
    color: colors.textSubtle,
    fontSize: 11,
    flex: 1,
  },
  link: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
});
