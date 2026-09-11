import { colors } from '../theme/colors';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  CardResumenMeta,
  ModalNuevoPeso,
  HistorialPesoLista,
  HistorialFuerzaCard,
  HistorialPromedioMuscularSesionCard,
} from '../components/progreso';
import AppButton from '../components/AppButton';
import { useAuth } from '../context';
import { useProgressData } from '../hooks/useProgressData';
import { evaluateGoalDeadline } from '../services/progressService';
import type { WeightLog, NewWeightLog, GoalDeadlineEvaluation } from '../types/progress';

export default function ProgresoScreen() {
  const { user, clearProfile } = useAuth();
  const {
    summary,
    weightLogs,
    strengthRecords,
    bodyParts,
    selectedMuscleGroupId,
    setSelectedMuscleGroupId,
    muscleSessionHistory,
    selectedExerciseId,
    setSelectedExerciseId,
    loading,
    error,
    refresh,
    saveWeight,
    removeWeight,
  } = useProgressData(user?.id ?? 0);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<WeightLog | null>(null);
  const [goalEvaluation, setGoalEvaluation] = useState<GoalDeadlineEvaluation | null>(null);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const assertedGoal = useRef<number | null>(null);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

  useEffect(() => {
    if (!user?.id) return;
    if (assertedGoal.current === user.id) return;
    evaluateGoalDeadline(user.id).then((evaluation) => {
      // Solo se evalúa una vez por sesión para no re-mostrar el modal.
      assertedGoal.current = user.id;
      if (evaluation) {
        setGoalEvaluation(evaluation);
        setGoalModalVisible(true);
      }
    });
  }, [user?.id]);

  const handleDeleteWeight = (id: number) => {
    Alert.alert(
      'Eliminar registro',
      '¿Seguro que deseas eliminar este registro de peso?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await removeWeight(id);
          },
        },
      ],
    );
  };

  const openNewModal = () => {
    setEditingLog(null);
    setModalVisible(true);
  };

  const openEditModal = (log: WeightLog) => {
    setEditingLog(log);
    setModalVisible(true);
  };

  const selectedRecord =
    strengthRecords.find((r) => r.exerciseId === selectedExerciseId) ?? null;

  const selectedMuscleGroupName =
    bodyParts.find((bp) => bp.id === selectedMuscleGroupId)?.name ??
    bodyParts[0]?.name ??
    'un músculo';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {summary ? <CardResumenMeta summary={summary} /> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Historial de Peso</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openNewModal}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={styles.addBtnText}>Añadir</Text>
          </TouchableOpacity>
        </View>

        <HistorialPesoLista
          logs={weightLogs}
          onDelete={handleDeleteWeight}
          onEdit={openEditModal}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Progreso de Fuerza</Text>
        </View>

        {strengthRecords.length === 0 ? (
          <HistorialFuerzaCard record={null} />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContainer}
            >
              {strengthRecords.map((rec) => (
                <TouchableOpacity
                  key={rec.exerciseId}
                  style={[
                    styles.chip,
                    selectedExerciseId === rec.exerciseId ? styles.chipActive : null,
                  ]}
                  onPress={() => setSelectedExerciseId(rec.exerciseId)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedExerciseId === rec.exerciseId ? styles.chipTextActive : null,
                    ]}
                  >
                    {rec.exerciseName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <HistorialFuerzaCard record={selectedRecord} />
          </>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Promedio de Carga por Sesión</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContainer}
        >
          {bodyParts.map((bp) => (
            <TouchableOpacity
              key={bp.id}
              style={[
                styles.chip,
                selectedMuscleGroupId === bp.id ? styles.chipActive : null,
              ]}
              onPress={() => setSelectedMuscleGroupId(bp.id)}
            >
              <Text
                style={[
                  styles.chipText,
                  selectedMuscleGroupId === bp.id ? styles.chipTextActive : null,
                ]}
              >
                {bp.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <HistorialPromedioMuscularSesionCard
          bodyPartName={selectedMuscleGroupName}
          points={muscleSessionHistory}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <ModalNuevoPeso
        visible={modalVisible}
        editingLog={editingLog}
        onClose={() => setModalVisible(false)}
        onSave={saveWeight}
      />

      {goalEvaluation ? (
        <Modal visible={goalModalVisible} animationType="fade" transparent>
          <View style={styles.goalOverlay}>
            <View style={styles.goalCard}>
              <View
                style={[
                  styles.goalIconWrap,
                  goalEvaluation.reached ? styles.goalIconWrapSuccess : styles.goalIconWrapInfo,
                ]}
              >
                <Text style={styles.goalIcon}>
                  {goalEvaluation.reached ? '🎉' : '💪'}
                </Text>
              </View>
              <Text style={styles.goalTitle}>
                {goalEvaluation.reached
                  ? '¡Felicidades, alcanzaste tu meta de peso! 🎉'
                  : 'Tranquilo, vas por buen camino 💪'}
              </Text>
              <Text style={styles.goalBody}>
                {goalEvaluation.reached
                  ? 'Has demostrado gran constancia. Define tu siguiente objetivo.'
                  : 'Las metas requieren ajuste continuo. Establece una nueva fecha y meta para seguir progresando.'}
              </Text>
              <Text style={styles.goalDetail}>
                {goalEvaluation.reached
                  ? `Meta lograda: ${goalEvaluation.targetWeight} kg al ${goalEvaluation.goalDate}. Peso actual: ${goalEvaluation.currentWeight} kg.`
                  : `Meta: ${goalEvaluation.targetWeight} kg al ${goalEvaluation.goalDate}. Peso actual: ${goalEvaluation.currentWeight} kg.`}
              </Text>
              <AppButton
                title={goalEvaluation.reached ? 'Define tu siguiente objetivo' : 'Definir nueva meta'}
                onPress={async () => {
                  setGoalModalVisible(false);
                  await clearProfile();
                }}
              />
              <AppButton
                title="Continuar"
                variant="outline"
                onPress={() => setGoalModalVisible(false)}
                style={styles.goalSecondaryBtn}
              />
              <Text style={styles.goalNote}>
                Tu historial de peso y entrenamientos se mantiene intacto.
              </Text>
            </View>
          </View>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  addBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.text,
  },
  bottomSpacer: {
    height: 24,
  },
  goalOverlay: {
    flex: 1,
    backgroundColor: colors.scrimStrong,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  goalCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  goalIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  goalIconWrapSuccess: {
    backgroundColor: colors.successSoft,
  },
  goalIconWrapInfo: {
    backgroundColor: colors.primarySoft,
  },
  goalIcon: {
    fontSize: 38,
  },
  goalTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  goalBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  goalDetail: {
    color: colors.textSubtle,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 20,
  },
  goalSecondaryBtn: {
    marginTop: 10,
  },
  goalNote: {
    color: colors.textSubtle,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});