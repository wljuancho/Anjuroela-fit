import { colors } from '../theme/colors';
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../components/AppButton';
import { ModalAgregarEjercicioRutina } from '../components/rutina';
import type { RutinaStackParamList } from '../navigation/types';
import { DAY_LABELS, type MuscleExercise } from '../types/workout';
import { addExercise } from '../services/exerciseService';
import {
  getOrCreateSession,
  getExercisesForBodyPart,
  getDayExercises,
  addExercisesToDay,
  addRandomExercisesToDay,
  removeExerciseFromDay,
  getDayMuscles,
  markMuscleCompleted,
  completeSession,
  getLastWeightForExercise,
  getAverageWeightForExercise,
  getCompletedExerciseIds,
} from '../services/workoutService';
import type { NewExercise } from '../types/exercise';

type MusclePanelNav = NativeStackNavigationProp<RutinaStackParamList, 'MusclePanel'>;
type MusclePanelRoute = RouteProp<RutinaStackParamList, 'MusclePanel'>;

export default function MusclePanelScreen() {
  const navigation = useNavigation<MusclePanelNav>();
  const route = useRoute<MusclePanelRoute>();
  const { day, muscleId, bodyPartId, bodyPartName } = route.params;

  const [exercises, setExercises] = useState<MuscleExercise[]>([]);
  const [catalogExercises, setCatalogExercises] = useState<
    { id: number; name: string; equipment: string | null }[]
  >([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [completedExerciseIds, setCompletedExerciseIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAddExercise, setShowAddExercise] = useState(false);

  const load = useCallback(async () => {
    try {
      const [session, muscles, catalog] = await Promise.all([
        getOrCreateSession(day),
        getDayMuscles(day),
        getExercisesForBodyPart(bodyPartId),
      ]);
      setSessionId(session.id);
      setCatalogExercises(catalog);
      const completedIds = await getCompletedExerciseIds(session.id);
      setCompletedExerciseIds(completedIds);
      setCompleted(muscles.find((m) => m.id === muscleId)?.isCompleted ?? false);

      const planned = await getDayExercises(day, bodyPartId);
      const withWeights: MuscleExercise[] = await Promise.all(
        planned.map(async (de) => ({
          id: de.exercise_id,
          name: de.exercise_name,
          equipment: de.equipment,
          lastWeightKg: await getLastWeightForExercise(de.exercise_id),
          avgWeightKg: await getAverageWeightForExercise(de.exercise_id),
        })),
      );
      setExercises(withWeights);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los ejercicios.');
    } finally {
      setLoading(false);
    }
  }, [day, muscleId, bodyPartId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleTerminar = () => {
    if (completedExerciseIds.size === 0) {
      Alert.alert(
        'Sin ejercicios registrados',
        'Registra al menos un ejercicio de este músculo hoy antes de terminar.',
      );
      return;
    }
    Alert.alert(
      '¡Terminé!',
      `¿Marcar ${bodyPartName} como terminado para ${DAY_LABELS[day]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Terminé',
          onPress: async () => {
            try {
              await markMuscleCompleted(muscleId);
              if (sessionId) {
                await completeSession(sessionId);
              }
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo marcar.');
            }
          },
        },
      ],
    );
  };

  const handleCreateAndInclude = async (data: NewExercise) => {
    const created = await addExercise(data);
    await addExercisesToDay(day, bodyPartId, [created.id]);
    await load();
  };

  const handleAddExisting = async (exerciseId: number) => {
    await addExercisesToDay(day, bodyPartId, [exerciseId]);
    await load();
  };

  const handleAddRandom = async (): Promise<number> => {
    const count = await addRandomExercisesToDay(day, bodyPartId, 4);
    await load();
    return count;
  };

  const handleRemoveExercise = (exerciseId: number) => {
    const ex = exercises.find((e) => e.id === exerciseId);
    Alert.alert(
      'Quitar ejercicio',
      `¿Deseas quitar "${ex?.name ?? 'este ejercicio'}" de la rutina del día?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeExerciseFromDay(day, bodyPartId, exerciseId);
              await load();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo quitar.');
            }
          },
        },
      ],
    );
  };

  const startExercise = (exercise: MuscleExercise) => {
    if (!sessionId) return;
    navigation.navigate('ExerciseConfig', {
      day,
      exercise,
      sessionId,
      muscleId,
      bodyPartId,
      bodyPartName,
    });
  };

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{bodyPartName}</Text>
          <Text style={styles.headerSubtitle}>{DAY_LABELS[day]}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowAddExercise(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {completed ? (
        <View style={styles.completedBanner}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.completedBannerText}>
            Terminado en este ciclo — puedes revisar tus ejercicios
          </Text>
        </View>
      ) : (
        <View style={styles.termineContainer}>
          <AppButton title="Terminé" variant="outline" onPress={handleTerminar} />
        </View>
      )}

      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      >
        {exercises.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={48} color={colors.cardAlt} />
            <Text style={styles.emptyText}>Sin ejercicios asignados</Text>
            <Text style={styles.emptySubtext}>Toca + para elegir, buscar o sortear al azar</Text>
          </View>
        ) : (
          <>
            {exercises.map((ex) => {
              const isDone = completedExerciseIds.has(ex.id);
              return (
                <View key={ex.id} style={styles.exerciseCard}>
                  <TouchableOpacity
                    style={styles.exerciseMain}
                    onPress={() => startExercise(ex)}
                    onLongPress={() => handleRemoveExercise(ex.id)}
                    delayLongPress={400}
                    activeOpacity={0.75}
                  >
                    <View style={styles.exerciseInfo}>
                      <View style={styles.exerciseNameRow}>
                        <Text style={styles.exerciseName}>{ex.name}</Text>
                        {isDone ? (
                          <View style={styles.doneBadge}>
                            <Ionicons name="checkmark" size={12} color={colors.success} />
                            <Text style={styles.doneBadgeText}>Hoy</Text>
                          </View>
                        ) : null}
                      </View>
                      {ex.equipment ? (
                        <Text style={styles.equipment}>{ex.equipment}</Text>
                      ) : null}
                      <Text style={styles.lastWeight}>
                        {ex.lastWeightKg !== null && ex.lastWeightKg > 0
                          ? `Último peso: ${ex.lastWeightKg} kg`
                          : 'Sin registro de peso aún'}
                        {ex.avgWeightKg !== null && ex.avgWeightKg > 0
                          ? ` · Promedio: ${ex.avgWeightKg} kg`
                          : ''}
                      </Text>
                    </View>
                    <Ionicons
                      name={isDone ? 'checkmark-circle' : 'play-circle'}
                      size={32}
                      color={isDone ? colors.success : colors.primary}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRemoveExercise(ex.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.removeBtn}
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              );
            })}
            <Text style={styles.holdHint}>
              Toca para entrenar · papelera o mantener presionado para quitar
            </Text>
          </>
        )}
      </ScrollView>

      <ModalAgregarEjercicioRutina
        visible={showAddExercise}
        bodyPartId={bodyPartId}
        bodyPartName={bodyPartName}
        catalogExercises={catalogExercises}
        addedExerciseIds={exercises.map((e) => e.id)}
        onCreateExercise={handleCreateAndInclude}
        onAddExisting={handleAddExisting}
        onAddRandom={handleAddRandom}
        onClose={() => setShowAddExercise(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termineContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  completedBannerText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  exerciseMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  removeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  doneBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: '600',
  },
  equipment: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  lastWeight: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 64,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  emptySubtext: {
    color: colors.textSubtle,
    fontSize: 14,
    marginTop: 4,
  },
  holdHint: {
    color: colors.textSubtle,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});