import { colors } from '../theme/colors';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context';
import { getCaloriesBurnedHistory } from '../services/progressService';
import { formatNumber } from '../services/utils';
import type { SessionCaloriesBurned } from '../types/progress';

interface WeekGroup {
  start: string;
  sessions: SessionCaloriesBurned[];
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function startOfWeek(value: string): string | null {
  const date = parseDate(value);
  if (!date) return null;
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateKey(date);
}

function shortDate(value: string, includeDay = false): string {
  const date = parseDate(value);
  if (!date) return value;
  return date.toLocaleDateString('es-CO', {
    ...(includeDay ? { weekday: 'short' as const } : {}),
    day: 'numeric',
    month: 'short',
  });
}

function weekLabel(start: string): string {
  const from = parseDate(start);
  if (!from) return start;
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  const today = new Date();
  today.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const prefix = dateKey(today) === start ? 'Esta semana · ' : '';
  return `${prefix}${shortDate(start)} – ${shortDate(dateKey(to))}`;
}

function groupByWeek(sessions: SessionCaloriesBurned[]): WeekGroup[] {
  const groups = new Map<string, SessionCaloriesBurned[]>();
  for (const session of sessions) {
    const start = startOfWeek(session.date);
    if (!start) continue;
    const group = groups.get(start) ?? [];
    group.push(session);
    groups.set(start, group);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([start, items]) => ({ start, sessions: items }));
}

export default function CaloriesHistoryScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SessionCaloriesBurned[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setSessions(await getCaloriesBurnedHistory(user.id));
    } catch {
      setError('No se pudo cargar el historial de entrenamientos.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const weeks = groupByWeek(sessions);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={() => void refresh()} style={styles.retryButton}>
              <Text style={styles.retryText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : weeks.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}><Ionicons name="flame-outline" size={25} color={colors.primary} /></View>
            <Text style={styles.emptyTitle}>Aún no hay entrenamientos</Text>
            <Text style={styles.emptyText}>Cuando completes una sesión, aquí verás sus calorías agrupadas por semana.</Text>
          </View>
        ) : (
          weeks.map((week) => {
            const total = week.sessions.reduce((sum, session) => sum + session.caloriesBurned, 0);
            return (
              <View key={week.start} style={styles.weekSection}>
                <View style={styles.weekHeader}>
                  <View style={styles.weekHeading}>
                    <Text style={styles.weekTitle}>{weekLabel(week.start)}</Text>
                    <Text style={styles.weekMeta}>
                      {week.sessions.length} {week.sessions.length === 1 ? 'entrenamiento' : 'entrenamientos'}
                    </Text>
                  </View>
                  <View style={styles.weekTotal}>
                    <Text style={styles.weekTotalValue}>{formatNumber(total)}</Text>
                    <Text style={styles.weekTotalUnit}>kcal</Text>
                  </View>
                </View>

                <View style={styles.sessionList}>
                  {week.sessions.map((session) => {
                    const fromWearable = session.caloriesSource === 'wearable';
                    const exercises = (session.exerciseNames ?? '').split(',').map((name) => name.trim()).filter(Boolean);
                    return (
                      <View key={session.sessionId} style={styles.sessionCard}>
                        <View style={styles.sessionTop}>
                          <View style={styles.dateWrap}>
                            <Ionicons name="calendar-outline" size={15} color={colors.textSubtle} />
                            <Text style={styles.sessionDate}>{shortDate(session.date, true)}</Text>
                          </View>
                          <View style={[styles.sourceBadge, fromWearable ? styles.wearableBadge : styles.estimateBadge]}>
                            <Text style={[styles.sourceText, fromWearable ? styles.wearableText : styles.estimateText]}>
                              {fromWearable ? 'Wearable' : 'Estimado'}
                            </Text>
                          </View>
                        </View>

                        <Text style={styles.exerciseTitle}>
                          {exercises.length
                            ? exercises.join(' · ')
                            : session.sessionType === 'casual' ? 'Entrenamiento ocasional' : 'Entrenamiento de rutina'}
                        </Text>

                        <View style={styles.sessionBottom}>
                          <Text style={styles.sessionDetail}>
                            {session.setCount} {session.setCount === 1 ? 'serie' : 'series'}
                            {fromWearable && session.heartRateAvg != null
                              ? ` · ${formatNumber(session.heartRateAvg)} bpm promedio`
                              : fromWearable ? ' · calorías del dispositivo' : ' · estimación MET'}
                          </Text>
                          <Text style={styles.sessionCalories}>{formatNumber(session.caloriesBurned)} kcal</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, paddingBottom: 28, gap: 18 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  weekSection: { gap: 10 },
  weekHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  weekHeading: { flex: 1 },
  weekTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  weekMeta: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
  weekTotal: { flexDirection: 'row', alignItems: 'baseline', gap: 4, backgroundColor: colors.primarySofter, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  weekTotalValue: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  weekTotalUnit: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  sessionList: { gap: 8 },
  sessionCard: { backgroundColor: colors.card, borderColor: colors.cardAlt, borderWidth: 1, borderRadius: 14, padding: 14 },
  sessionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionDate: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  estimateBadge: { backgroundColor: colors.warningSoft },
  wearableBadge: { backgroundColor: colors.successSoft },
  sourceText: { fontSize: 10, fontWeight: '800' },
  estimateText: { color: colors.warning },
  wearableText: { color: colors.success },
  exerciseTitle: { color: colors.text, fontSize: 14, fontWeight: '700', lineHeight: 20, marginTop: 10 },
  sessionBottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.border },
  sessionDetail: { color: colors.textSubtle, fontSize: 11, flex: 1 },
  sessionCalories: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  emptyCard: { backgroundColor: colors.card, borderColor: colors.cardAlt, borderWidth: 1, borderRadius: 16, padding: 22, alignItems: 'center', marginTop: 8 },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 6 },
  retryButton: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: colors.primary, borderRadius: 10 },
  retryText: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
