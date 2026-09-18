import { colors } from '../../theme/colors';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SessionCaloriesBurned } from '../../types/progress';
import { DAY_LABELS } from '../../types/workout';
import { formatNumber } from '../../services/utils';
import {
  readTodaySteps,
  readLastNightSleepHours,
} from '../../services/healthService';
import { getRecentSessionHealthMetrics } from '../../services/progressService';

interface CardCaloriasQuemadasProps {
  sessions: SessionCaloriesBurned[];
  userId?: string;
}

function formatFriendlyDate(date: string): string {
  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatSleepHours(hours: number | null): string {
  if (hours == null) return '—';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

interface CaloriesBreakdown {
  wearableKcal: number;
  estimateKcal: number;
  steps: number;
  stepsKcal: number | null;
  sleepHours: number | null;
  heartRateAvg: number | null;
}

export default function CardCaloriasQuemadas({ sessions, userId }: CardCaloriasQuemadasProps) {
  const total = sessions.reduce((acc, s) => acc + s.caloriesBurned, 0);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detail, setDetail] = useState<CaloriesBreakdown | null>(null);

  const openDetail = () => {
    setModalVisible(true);
    setLoadingDetail(true);
    setDetail(null);
    void (async () => {
      try {
        const [steps, sleep, metrics] = await Promise.all([
          readTodaySteps(),
          readLastNightSleepHours(),
          userId ? getRecentSessionHealthMetrics(userId, 1) : Promise.resolve([]),
        ]);
        const wearableKcal = sessions
          .filter((s) => s.caloriesSource === 'wearable')
          .reduce((acc, s) => acc + s.caloriesBurned, 0);
        const estimateKcal = sessions
          .filter((s) => s.caloriesSource !== 'wearable')
          .reduce((acc, s) => acc + s.caloriesBurned, 0);
        setDetail({
          wearableKcal,
          estimateKcal,
          steps: steps.steps,
          stepsKcal: steps.caloriesBurned,
          sleepHours: sleep,
          heartRateAvg: metrics[0]?.heartRateAvg ?? null,
        });
      } catch {
        setDetail(null);
      } finally {
        setLoadingDetail(false);
      }
    })();
  };

  const closeDetail = () => {
    setModalVisible(false);
    setDetail(null);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.card}
        onPress={openDetail}
        accessibilityRole="button"
        accessibilityLabel="Ver desglose de calorías quemadas y métricas de salud"
      >
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
                    {' · '}
                    {s.caloriesSource === 'wearable' ? 'Reloj/Salud' : 'Estimado (MET)'}
                  </Text>
                </View>
                <Text style={styles.rowValue}>{formatNumber(s.caloriesBurned)} kcal</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.detailHint}>
          <Ionicons name="trending-up" size={14} color={colors.primary} />
          <Text style={styles.detailHintText}>Toca para ver el desglose de métricas</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={closeDetail}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Desglose de Calorías Quemadas</Text>
              <TouchableOpacity onPress={closeDetail} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {loadingDetail ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>Consultando métricas de salud…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Origen del gasto calórico</Text>
                <View style={styles.payloadRow}>
                  <View style={styles.payloadChip}>
                    <Ionicons name="watch" size={15} color={colors.primary} />
                    <Text style={styles.payloadLabel}>Reloj/Salud</Text>
                    <Text style={styles.payloadValue}>
                      {detail && detail.wearableKcal > 0 ? `${formatNumber(detail.wearableKcal)} kcal` : 'sin registros'}
                    </Text>
                  </View>
                  <View style={styles.payloadChip}>
                    <Ionicons name="calculator" size={15} color={colors.textSubtle} />
                    <Text style={styles.payloadLabel}>Estimación MET</Text>
                    <Text style={styles.payloadValue}>
                      {detail && detail.estimateKcal > 0 ? `${formatNumber(detail.estimateKcal)} kcal` : 'sin registros'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.sectionTitle}>Pasos de hoy</Text>
                <View style={styles.metricRow}>
                  <Ionicons name="footsteps" size={18} color={colors.primary} />
                  <Text style={styles.metricText}>
                    {detail && detail.steps > 0 ? formatNumber(detail.steps) : '—'} pasos
                    {detail && detail.stepsKcal != null && detail.stepsKcal > 0
                      ? ` (≈ ${formatNumber(detail.stepsKcal)} kcal)` : ''}
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>Sueño de la última noche</Text>
                <View style={styles.metricRow}>
                  <Ionicons name="moon" size={18} color={colors.primary} />
                  <Text style={styles.metricText}>
                    {detail ? `${formatSleepHours(detail.sleepHours)} registrados en el dispositivo` : '—'}
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>Ritmo cardíaco promedio</Text>
                <View style={styles.metricRow}>
                  <Ionicons name="heart" size={18} color={colors.primary} />
                  <Text style={styles.metricText}>
                    {detail && detail.heartRateAvg != null
                      ? `${formatNumber(detail.heartRateAvg)} bpm en la última sesión`
                      : 'sin datos en la última sesión'}
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={closeDetail}>
              <Text style={styles.closeBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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
  detailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailHintText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: colors.scrimStrong,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
    paddingRight: 8,
  },
  loadingBox: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 28,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  payloadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  payloadChip: {
    flex: 1,
    backgroundColor: colors.graph,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  payloadLabel: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '600',
  },
  payloadValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.graph,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  metricText: {
    color: colors.text,
    fontSize: 13,
    flex: 1,
  },
  closeBtn: {
    marginTop: 18,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
});