import { colors } from '../theme/colors';
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SelectorDiasSemana, CardEjercicioRutina, ModalEditarDia } from '../components/rutina';
import AppButton from '../components/AppButton';
import { useWorkoutSession } from '../hooks/useWorkoutSession';
import type { DayOfWeek, WorkoutSetInput } from '../types/workout';

export default function RutinaScreen() {
  const {
    schedule,
    selectedDay,
    setSelectedDay,
    bodyParts,
    sessionExercises,
    completedDays,
    setsMap,
    setSetsMap,
    loading,
    saving,
    handleSaveWorkout,
    saveDayEdit,
  } = useWorkoutSession();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editDay, setEditDay] = useState<DayOfWeek | null>(null);

  const handleSetsChange = (exerciseId: number, sets: WorkoutSetInput[]) => {
    setSetsMap((prev) =>
      new Map(prev).set(exerciseId, sets),
    );
  };

  const handleEditDay = (day: DayOfWeek) => {
    setEditDay(day);
    setEditModalVisible(true);
  };

  const currentEntry = schedule.find((e) => e.day_of_week === selectedDay);
  const isRestDay = !currentEntry?.body_part_id;

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
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => handleEditDay(selectedDay)}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {isRestDay ? (
          <View style={styles.restContainer}>
            <Ionicons name="bed-outline" size={56} color={colors.cardAlt} />
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
                <Ionicons name="barbell-outline" size={48} color={colors.cardAlt} />
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
        onSave={saveDayEdit}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
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
    color: colors.text,
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
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  restSubtitle: {
    color: colors.textSubtle,
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
    color: colors.textMuted,
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