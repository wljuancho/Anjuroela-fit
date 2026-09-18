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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../components/AppButton';
import type { RutinaStackParamList } from '../navigation/types';
import {
  DAYS_ORDER,
  DAY_LABELS,
  type DayOfWeek,
  type ExerciseWithSets,
  type MuscleExercise,
  type WorkoutSession,
  type WorkoutSet,
} from '../types/workout';
import {
  getOrCreateCasualSession,
  getSessionById,
  getExercisesWithSets,
  getCasualBodyPartExercises,
  deleteCasualSession,
  deleteExerciseSetsFromSession,
  deleteSetFromSession,
  updateCasualSessionNote,
} from '../services/workoutService';
import { getAllBodyParts } from '../services/exerciseService';
import type { BodyPart } from '../types/exercise';

type CasualNav = NativeStackNavigationProp<RutinaStackParamList, 'CasualWorkout'>;
type CasualRoute = RouteProp<RutinaStackParamList, 'CasualWorkout'>;

function getTodayDayOfWeek(): DayOfWeek {
  const jsDay = new Date().getDay();
  return DAYS_ORDER[jsDay === 0 ? 6 : jsDay - 1];
}

function formatDateLabel(dateStr: string): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date.getTime() - now.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === -1) return 'Ayer';
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function setLabel(s: WorkoutSet): string {
  if (s.set_type === 'time' && s.time_seconds) return `${s.time_seconds}s`;
  if (s.reps) return s.weight_kg ? `${s.reps} × ${s.weight_kg} kg` : `${s.reps} reps`;
  return '—';
}

export default function CasualWorkoutScreen() {
  const navigation = useNavigation<CasualNav>();
  const route = useRoute<CasualRoute>();
  const { sessionId: sessionIdParam } = route.params;

  const [sessionId, setSessionId] = useState<number | null>(sessionIdParam ?? null);
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithSets[]>([]);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [loading, setLoading] = useState(true);

  const [addVisible, setAddVisible] = useState(false);
  const [pickedMuscle, setPickedMuscle] = useState<BodyPart | null>(null);
  const [muscleExercises, setMuscleExercises] = useState<MuscleExercise[]>([]);
  const [loadingMuscle, setLoadingMuscle] = useState(false);

  const [noteVisible, setNoteVisible] = useState(false);
  const [noteText, setNoteText] = useState('');

  const load = useCallback(async () => {
    try {
      let sid = sessionId;
      if (!sid) {
        const created = await getOrCreateCasualSession();
        sid = created.id;
        setSessionId(sid);
      }
      const [s, ex, bp] = await Promise.all([
        getSessionById(sid),
        getExercisesWithSets(sid),
        getAllBodyParts(),
      ]);
      setSession(s);
      setExercises(ex);
      setBodyParts(bp);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el entrenamiento ocasional.');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openAdd = () => {
    setPickedMuscle(null);
    setMuscleExercises([]);
    setAddVisible(true);
  };

  const pickBodyPart = async (bp: BodyPart) => {
    setPickedMuscle(bp);
    setLoadingMuscle(true);
    setMuscleExercises([]);
    try {
      const list = await getCasualBodyPartExercises(bp.id);
      setMuscleExercises(list);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los ejercicios.');
    } finally {
      setLoadingMuscle(false);
    }
  };

  const startExercise = (exercise: MuscleExercise) => {
    if (!sessionId || !pickedMuscle) return;
    setAddVisible(false);
    setPickedMuscle(null);
    navigation.navigate('ExerciseConfig', {
      day: session?.day_of_week ?? getTodayDayOfWeek(),
      exercise,
      sessionId,
      muscleId: -1,
      bodyPartId: pickedMuscle.id,
      bodyPartName: pickedMuscle.name,
      muscleExercises,
      sessionType: 'casual',
    });
  };

  const openNoteEditor = () => {
    setNoteText(session?.note ?? '');
    setNoteVisible(true);
  };

  const saveNote = async () => {
    if (!sessionId) return;
    try {
      await updateCasualSessionNote(sessionId, noteText);
      setNoteVisible(false);
      await load();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo guardar la nota.');
    }
  };

  const handleDeleteExercise = (exercise: ExerciseWithSets) => {
    Alert.alert(
      'Quitar ejercicio',
      `¿Quitar "${exercise.exercise_name}" de este entrenamiento ocasional?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (sessionId) {
                await deleteExerciseSetsFromSession(sessionId, exercise.exercise_id);
                await load();
              }
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo quitar.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteSet = (set: WorkoutSet) => {
    Alert.alert(
      'Quitar serie',
      `¿Quitar esta serie del ejercicio "${set.exercise_name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (sessionId) {
                await deleteSetFromSession(sessionId, set.id);
                await load();
              }
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo quitar la serie.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteSession = () => {
    Alert.alert(
      'Eliminar entrenamiento',
      '¿Eliminar todo este entrenamiento ocasional? También se quitará de tu Progreso.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              if (sessionId) {
                await deleteCasualSession(sessionId);
              }
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar.');
            }
          },
        },
      ],
    );
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

  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0);
  const dayLabel = session ? `${DAY_LABELS[session.day_of_week]} · ${formatDateLabel(session.date)}` : '';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Entreno ocasional</Text>
          <Text style={styles.headerSubtitle}>{dayLabel}</Text>
        </View>
        <TouchableOpacity onPress={handleDeleteSession} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.noteRow}>
          <View style={styles.noteInfo}>
            <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
            <Text style={[styles.noteText, !session?.note ? styles.notePlaceholder : null]}>
              {session?.note || 'Sin etiqueta (ej: Cardio)'}
            </Text>
          </View>
          <TouchableOpacity onPress={openNoteEditor} style={styles.noteEdit} activeOpacity={0.7}>
            <Ionicons name="pencil" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <SummaryChip icon="barbell-outline" label={`${exercises.length}`} sub="ejercicios" />
          <SummaryChip icon="reload" label={`${totalSets}`} sub="series" />
          <SummaryChip icon="flame-outline" label={`${Math.round(session?.calories_burned ?? 0)}`} sub="kcal" />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Ejercicios registrados</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.7}>
            <Ionicons name="add" size={20} color={colors.text} />
            <Text style={styles.addBtnText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        {exercises.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="flash-outline" size={48} color={colors.cardAlt} />
            <Text style={styles.emptyTitle}>Nada registrado aún</Text>
            <Text style={styles.emptyText}>
              Este entreno ocasional no reemplaza tu rutina de la semana ni reaparece la
              próxima semana, pero sí cuenta en tu Progreso.
            </Text>
            <AppButton title="Agregar ejercicio" onPress={openAdd} style={styles.emptyBtn} />
          </View>
        ) : (
          exercises.map((exercise) => (
            <View key={exercise.exercise_id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <TouchableOpacity
                  style={styles.exerciseInfo}
                  activeOpacity={0.7}
                  onPress={openAdd}
                >
                  <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                  <Text style={styles.exerciseMuscle}>{exercise.body_part_name}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteExercise(exercise)}
                  style={styles.rowAction}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {exercise.sets.map((set) => (
                <View key={set.id} style={styles.setRow}>
                  <Text style={styles.setNumber}>#{set.set_number}</Text>
                  <Text style={styles.setLabel}>{setLabel(set)}</Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteSet(set)}
                    style={styles.setDelete}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={16} color={colors.textSubtle} />
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity style={styles.rerunBtn} onPress={openAdd} activeOpacity={0.7}>
                <Ionicons name="play" size={16} color={colors.primary} />
                <Text style={styles.rerunText}>Agregar otra serie</Text>
              </TouchableOpacity>
            </View>
          ))
        )}

        {exercises.length > 0 ? (
          <AppButton
            title="Agregar ejercicio"
            onPress={openAdd}
            style={styles.addMoreBtn}
          />
        ) : null}

        <AppButton
          title="Eliminar entrenamiento"
          variant="outline"
          onPress={handleDeleteSession}
          style={styles.deleteSessionBtn}
        />
      </ScrollView>

      <Modal visible={addVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => {
              setAddVisible(false);
              setPickedMuscle(null);
            }}
          />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {!pickedMuscle ? (
              <>
                <Text style={styles.sheetTitle}>Elegir músculo</Text>
                <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetList}>
                  {bodyParts.length === 0 ? (
                    <Text style={styles.emptySheetText}>
                      Crea primero un grupo muscular en la pestaña Ejercicios.
                    </Text>
                  ) : (
                    bodyParts.map((bp) => (
                      <TouchableOpacity
                        key={bp.id}
                        style={styles.option}
                        onPress={() => pickBodyPart(bp)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.optionText}>{bp.name}</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </>
            ) : (
              <>
                <View style={styles.sheetHeaderRow}>
                  <TouchableOpacity onPress={() => setPickedMuscle(null)} style={styles.sheetBack}>
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={styles.sheetTitle}>{pickedMuscle.name}</Text>
                  <View style={styles.sheetBack} />
                </View>
                {loadingMuscle ? (
                  <View style={styles.sheetLoading}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetList}>
                    {muscleExercises.length === 0 ? (
                      <Text style={styles.emptySheetText}>
                        Este músculo aún no tiene ejercicios. Agrégalos en la pestaña
                        Ejercicios.
                      </Text>
                    ) : (
                      muscleExercises.map((exercise) => (
                        <TouchableOpacity
                          key={exercise.id}
                          style={styles.option}
                          onPress={() => startExercise(exercise)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.optionText}>{exercise.name}</Text>
                          <Ionicons name="play-circle" size={20} color={colors.primary} />
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={noteVisible} animationType="slide" transparent>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setNoteVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Etiqueta del entreno</Text>
            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Ej: Cardio rápido, Bici..."
              placeholderTextColor={colors.textSubtle}
              maxLength={60}
            />
            <AppButton title="Guardar" onPress={saveNote} style={styles.noteSave} />
            <AppButton title="Cancelar" variant="outline" onPress={() => setNoteVisible(false)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryChip({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <View style={styles.summaryChip}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.primary} />
      <Text style={styles.summaryValue}>{label}</Text>
      <Text style={styles.summaryLabel}>{sub}</Text>
    </View>
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
    textAlign: 'center',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  noteInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  notePlaceholder: {
    color: colors.textSubtle,
    fontStyle: 'italic',
  },
  noteEdit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  summaryChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 2,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  summaryLabel: {
    color: colors.textSubtle,
    fontSize: 11,
    textTransform: 'capitalize',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  emptyText: {
    color: colors.textSubtle,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyBtn: {
    width: '100%',
    marginTop: 12,
  },
  exerciseCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  exerciseMuscle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  rowAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 6,
    gap: 12,
  },
  setNumber: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    width: 24,
  },
  setLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  setDelete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rerunBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  rerunText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  addMoreBtn: {
    marginTop: 4,
  },
  deleteSessionBtn: {
    marginTop: 12,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.cardAlt,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  sheetTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sheetBack: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetList: {
    maxHeight: 480,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  optionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  emptySheetText: {
    color: colors.textSubtle,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  sheetLoading: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  noteInput: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  noteSave: {
    marginBottom: 12,
  },
});