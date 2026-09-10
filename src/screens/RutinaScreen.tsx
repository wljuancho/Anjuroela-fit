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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { SelectorDiasSemana, ModalAgregarMusculo } from '../components/rutina';
import type { RutinaStackParamList } from '../navigation/types';
import { colors as themeColors } from '../theme/colors';
import {
  initWorkoutData,
  getAllDayMuscles,
  addMusclesToDay,
  removeMuscleFromDay,
  resetStaleCompletions,
} from '../services/workoutService';
import { getAllBodyParts } from '../services/exerciseService';
import type { BodyPart } from '../types/exercise';
import {
  DAYS_ORDER,
  DAY_LABELS,
  type DayOfWeek,
  type DayMuscle,
  type WeeklyScheduleEntry,
} from '../types/workout';

type RutinaNav = NativeStackNavigationProp<RutinaStackParamList, 'RutinaHome'>;

function getTodayDayOfWeek(): DayOfWeek {
  const jsDay = new Date().getDay();
  return DAYS_ORDER[jsDay === 0 ? 6 : jsDay - 1];
}

export default function RutinaScreen() {
  const navigation = useNavigation<RutinaNav>();
  const [musclesByDay, setMusclesByDay] = useState<Record<string, DayMuscle[]>>({});
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(getTodayDayOfWeek);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await initWorkoutData();
      await resetStaleCompletions();
      const [all, bp] = await Promise.all([getAllDayMuscles(), getAllBodyParts()]);
      const grouped: Record<string, DayMuscle[]> = {};
      for (const m of all) {
        if (!grouped[m.day_of_week]) grouped[m.day_of_week] = [];
        grouped[m.day_of_week].push(m);
      }
      setMusclesByDay(grouped);
      setBodyParts(bp);
    } catch {
      Alert.alert('Error', 'No se pudo cargar la rutina.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const dayMuscles = musclesByDay[selectedDay] ?? [];
  const completedDays = DAYS_ORDER.filter((day) => {
    const list = musclesByDay[day] ?? [];
    return list.length > 0 && list.every((m) => m.isCompletedInCycle);
  });

  const pseudoSchedule: WeeklyScheduleEntry[] = DAYS_ORDER.map((day) => {
    const list = musclesByDay[day] ?? [];
    const first = list[0];
    let name: string | null = null;
    if (list.length === 1) name = first?.body_part_name ?? null;
    else if (list.length > 1) name = `${list.length} músculos`;
    return {
      id: first?.id ?? -1,
      day_of_week: day,
      body_part_id: first?.body_part_id ?? null,
      body_part_name: name,
    };
  });

  const handleAddMuscles = async (ids: number[]) => {
    setSaving(true);
    try {
      await addMusclesToDay(selectedDay, ids);
      await loadData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudieron agregar.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMuscle = (muscle: DayMuscle) => {
    Alert.alert(
      'Quitar músculo',
      `¿Quitar "${muscle.body_part_name}" de ${DAY_LABELS[selectedDay]}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMuscleFromDay(muscle.id);
              await loadData();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo quitar.');
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <SelectorDiasSemana
          schedule={pseudoSchedule}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          onEditDay={() => setAddModalVisible(true)}
          completedDays={completedDays}
        />

        <View style={styles.dayHeader}>
          <View>
            <Text style={styles.dayHeaderLabel}>Músculos de hoy</Text>
            <Text style={styles.dayTitle}>{DAY_LABELS[selectedDay]}</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {dayMuscles.length === 0 ? (
          <View style={styles.restContainer}>
            <Ionicons name="calendar-outline" size={56} color={colors.cardAlt} />
            <Text style={styles.restTitle}>Día libre</Text>
            <Text style={styles.restSubtitle}>
              Toca + para asignar un grupo muscular a este día
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.muscleList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.muscleContent}
          >
            {dayMuscles.map((muscle) => (
              <MuscleCard
                key={muscle.id}
                muscle={muscle}
                onStart={() =>
                  navigation.navigate('MusclePanel', {
                    day: selectedDay,
                    muscleId: muscle.id,
                    bodyPartId: muscle.body_part_id,
                    bodyPartName: muscle.body_part_name,
                  })
                }
                onRemove={() => handleRemoveMuscle(muscle)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <ModalAgregarMusculo
        visible={addModalVisible}
        day={selectedDay}
        bodyParts={bodyParts}
        excludedIds={dayMuscles.map((m) => m.body_part_id)}
        onClose={() => setAddModalVisible(false)}
        onSave={handleAddMuscles}
      />
    </SafeAreaView>
  );
}

function MuscleCard({
  muscle,
  onStart,
  onRemove,
}: {
  muscle: DayMuscle;
  onStart: () => void;
  onRemove: () => void;
}) {
  const done = muscle.isCompletedInCycle;
  return (
    <TouchableOpacity
      style={[styles.muscleCard, done ? styles.muscleCardDone : null]}
      onPress={onStart}
      activeOpacity={0.75}
    >
      <View style={styles.muscleInfo}>
        <View style={styles.muscleRow}>
          <Text style={[styles.muscleName, done ? styles.muscleNameDone : null]}>
            {muscle.body_part_name}
          </Text>
          {done ? (
            <View style={styles.doneBadge}>
              <Ionicons name="checkmark" size={14} color={colors.success} />
              <Text style={styles.doneBadgeText}>Terminado</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.muscleHint}>
          {done ? 'Listo para el próximo ciclo' : 'Toca para ver o añadir ejercicios'}
        </Text>
      </View>

      <View style={styles.muscleActions}>
        <TouchableOpacity style={styles.playBtn} onPress={onStart} activeOpacity={0.8}>
          <Ionicons
            name={done ? 'checkmark-circle' : 'play'}
            size={26}
            color={colors.text}
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.removeBtn} onPress={onRemove} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: themeColors.background,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  dayHeaderLabel: {
    color: themeColors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  dayTitle: {
    color: themeColors.text,
    fontSize: 22,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: themeColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: themeColors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  restContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  restTitle: {
    color: themeColors.textMuted,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  restSubtitle: {
    color: themeColors.textSubtle,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  muscleList: {
    flex: 1,
  },
  muscleContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  muscleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.card,
    borderWidth: 1,
    borderColor: themeColors.cardAlt,
    borderRadius: 14,
    padding: 16,
  },
  muscleCardDone: {
    backgroundColor: themeColors.successSoft,
    borderColor: themeColors.success,
  },
  muscleInfo: {
    flex: 1,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  muscleName: {
    color: themeColors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  muscleNameDone: {
    color: themeColors.success,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.successSoft,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  doneBadgeText: {
    color: themeColors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  muscleHint: {
    color: themeColors.textSubtle,
    fontSize: 13,
    marginTop: 4,
  },
  muscleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: themeColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: themeColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});