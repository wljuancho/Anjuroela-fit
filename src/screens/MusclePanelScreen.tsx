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
import { ModalNuevoEjercicio } from '../components/ejercicios';
import type { RutinaStackParamList } from '../navigation/types';
import { DAY_LABELS, type MuscleExercise } from '../types/workout';
import { addExercise } from '../services/exerciseService';
import {
  getOrCreateSession,
  getExercisesForBodyPart,
  getDayMuscles,
  markMuscleCompleted,
  getLastWeightForExercise,
} from '../services/workoutService';
import type { NewExercise } from '../types/exercise';

type MusclePanelNav = NativeStackNavigationProp<RutinaStackParamList, 'MusclePanel'>;
type MusclePanelRoute = RouteProp<RutinaStackParamList, 'MusclePanel'>;

export default function MusclePanelScreen() {
  const navigation = useNavigation<MusclePanelNav>();
  const route = useRoute<MusclePanelRoute>();
  const { day, muscleId, bodyPartId, bodyPartName } = route.params;

  const [exercises, setExercises] = useState<MuscleExercise[]>([]);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddExercise, setShowAddExercise] = useState(false);

  const load = useCallback(async () => {
    try {
      const [session, muscles] = await Promise.all([
        getOrCreateSession(day),
        getDayMuscles(day),
      ]);
      setSessionId(session.id);
      setCompleted(muscles.find((m) => m.id === muscleId)?.isCompletedInCycle ?? false);

      const raw = await getExercisesForBodyPart(bodyPartId);
      const withWeights: MuscleExercise[] = await Promise.all(
        raw.map(async (ex) => ({
          id: ex.id,
          name: ex.name,
          equipment: ex.equipment,
          lastWeightKg: await getLastWeightForExercise(ex.id),
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
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo marcar.');
            }
          },
        },
      ],
    );
  };

  const handleSaveExercise = async (data: NewExercise) => {
    await addExercise(data);
    await load();
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
            <Text style={styles.emptyText}>No hay ejercicios para este grupo</Text>
            <Text style={styles.emptySubtext}>Toca + para añadir uno</Text>
          </View>
        ) : (
          exercises.map((ex) => (
            <TouchableOpacity
              key={ex.id}
              style={styles.exerciseCard}
              onPress={() => startExercise(ex)}
              activeOpacity={0.75}
            >
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{ex.name}</Text>
                {ex.equipment ? (
                  <Text style={styles.equipment}>{ex.equipment}</Text>
                ) : null}
                <Text style={styles.lastWeight}>
                  {ex.lastWeightKg !== null && ex.lastWeightKg > 0
                    ? `Último peso: ${ex.lastWeightKg} kg`
                    : 'Sin registro de peso aún'}
                </Text>
              </View>
              <Ionicons name="play-circle" size={32} color={colors.primary} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <ModalNuevoEjercicio
        visible={showAddExercise}
        bodyParts={[{ id: bodyPartId, name: bodyPartName }]}
        onClose={() => setShowAddExercise(false)}
        onSave={handleSaveExercise}
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
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: colors.text,
    fontSize: 16,
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
});