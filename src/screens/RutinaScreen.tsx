import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SelectorDiasSemana, CardEjercicioRutina, ModalEditarDia } from '../components/rutina';
import AppButton from '../components/AppButton';
import { getAllBodyParts } from '../services/exerciseService';
import {
  initWorkoutData,
  getWeeklySchedule,
  updateScheduleDay,
  getOrCreateSession,
  completeSession,
  upsertSets,
  getExercisesForBodyPart,
} from '../services/workoutService';
import type { BodyPart } from '../types/exercise';
import type {
  DayOfWeek,
  WeeklyScheduleEntry,
  WorkoutSetInput,
} from '../types/workout';
import { DAYS_ORDER } from '../types/workout';

function getTodayDayOfWeek(): DayOfWeek {
  const jsDay = new Date().getDay();
  return DAYS_ORDER[jsDay === 0 ? 6 : jsDay - 1];
}

export default function RutinaScreen() {
  const [schedule, setSchedule] = useState<WeeklyScheduleEntry[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getTodayDayOfWeek);
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [sessionExercises, setSessionExercises] = useState<{ id: number; name: string; equipment: string | null }[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [completedDays, setCompletedDays] = useState<DayOfWeek[]>([]);
  const [setsMap, setSetsMap] = useState<Map<number, WorkoutSetInput[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editDay, setEditDay] = useState<DayOfWeek | null>(null);

  const loadSchedule = useCallback(async () => {
    await initWorkoutData();
    const s = await getWeeklySchedule();
    setSchedule(s);
    const bp = await getAllBodyParts();
    setBodyParts(bp);
    return s;
  }, []);

  const loadDayExercises = useCallback(async (day: DayOfWeek, scheduleData?: WeeklyScheduleEntry[]) => {
    const s = scheduleData ?? schedule;
    const entry = s.find((e) => e.day_of_week === day);
    if (!entry?.body_part_id) {
      setSessionExercises([]);
      setSessionId(null);
      setSetsMap(new Map());
      return;
    }
    const exercises = await getExercisesForBodyPart(entry.body_part_id);
    setSessionExercises(exercises);
    const session = await getOrCreateSession(day);
    setSessionId(session.id);
    const initialMap = new Map<number, WorkoutSetInput[]>();
    for (const ex of exercises) {
      if (!initialMap.has(ex.id)) {
        initialMap.set(ex.id, []);
      }
    }
    setSetsMap(initialMap);
  }, [schedule]);

  useEffect(() => {
    (async () => {
      try {
        const s = await loadSchedule();
        await loadDayExercises(getTodayDayOfWeek(), s);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    loadDayExercises(selectedDay);
  }, [selectedDay]);

  const handleSetsChange = useCallback((exerciseId: number, sets: WorkoutSetInput[]) => {
    setSetsMap((prev) => {
      const next = new Map(prev);
      next.set(exerciseId, sets);
      return next;
    });
  }, []);

  const handleSaveWorkout = async () => {
    if (!sessionId) {
      Alert.alert('Sin ejercicio', 'No hay ejercicios para guardar este día.');
      return;
    }
    const allSets: WorkoutSetInput[] = [];
    for (const [, sets] of setsMap) {
      allSets.push(...sets);
    }
    if (allSets.length === 0) {
      Alert.alert('Sin series', 'Añade al menos una serie para guardar.');
      return;
    }
    setSaving(true);
    try {
      await upsertSets(sessionId, allSets);
      await completeSession(sessionId);
      if (!completedDays.includes(selectedDay)) {
        setCompletedDays((prev) => [...prev, selectedDay]);
      }
      Alert.alert('Guardado', 'Entrenamiento registrado correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudo guardar el entrenamiento.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditDay = (day: DayOfWeek) => {
    const entry = schedule.find((e) => e.day_of_week === day);
    setEditDay(day);
    setEditModalVisible(true);
  };

  const handleSaveDayEdit = async (day: DayOfWeek, bodyPartId: number | null) => {
    await updateScheduleDay(day, bodyPartId);
    const s = await loadSchedule();
    if (day === selectedDay) {
      await loadDayExercises(day, s);
    }
  };

  const currentEntry = schedule.find((e) => e.day_of_week === selectedDay);
  const isRestDay = !currentEntry?.body_part_id;

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <SelectorDiasSemana
          schedule={schedule}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onEditDay={handleEditDay}
          completedDays={completedDays}
        />

        <View style={styles.dayHeader}>
          <View style={styles.dayHeaderLeft}>
            <Text style={styles.dayTitle}>{currentEntry?.body_part_name ?? 'Descanso'}</Text>
            {isRestDay ? (
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => handleEditDay(selectedDay)}
              >
                <Ionicons name="create-outline" size={20} color="#e94560" />
              </TouchableOpacity>
            ) : null}
          </View>
          {!isRestDay && sessionId ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => handleEditDay(selectedDay)}
            >
              <Ionicons name="create-outline" size={20} color="#e94560" />
            </TouchableOpacity>
          ) : null}
        </View>

        {isRestDay ? (
          <View style={styles.restContainer}>
            <Ionicons name="bed-outline" size={56} color="#2a2a4a" />
            <Text style={styles.restTitle}>Día de descanso</Text>
            <Text style={styles.restSubtitle}>Toca el lápiz para asignar un grupo muscular</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.exercisesList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.exercisesContent}
          >
            {sessionExercises.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="barbell-outline" size={48} color="#2a2a4a" />
                <Text style={styles.emptyText}>No hay ejercicios</Text>
              </View>
            ) : (
              sessionExercises.map((ex) => (
                <CardEjercicioRutina
                  key={ex.id}
                  exerciseId={ex.id}
                  exerciseName={ex.name}
                  equipment={ex.equipment}
                  sets={[]}
                  onSetsChange={handleSetsChange}
                />
              ))
            )}
          </ScrollView>
        )}

        {!isRestDay && sessionExercises.length > 0 ? (
          <View style={styles.footer}>
            <AppButton
              title={completedDays.includes(selectedDay) ? 'Actualizar entrenamiento' : 'Finalizar entrenamiento'}
              onPress={handleSaveWorkout}
              loading={saving}
            />
          </View>
        ) : null}
      </View>

      <ModalEditarDia
        visible={editModalVisible}
        day={editDay}
        bodyParts={bodyParts}
        currentBodyPartId={currentEntry?.body_part_id ?? null}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveDayEdit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  dayHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dayTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
  },
  editBtn: {
    padding: 6,
  },
  restContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  restTitle: {
    color: '#a0a0b8',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  restSubtitle: {
    color: '#7a7a96',
    fontSize: 14,
    marginTop: 6,
  },
  exercisesList: {
    flex: 1,
  },
  exercisesContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 48,
  },
  emptyText: {
    color: '#a0a0b8',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
});
