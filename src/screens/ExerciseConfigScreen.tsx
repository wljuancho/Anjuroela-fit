import { colors } from '../theme/colors';
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../components/AppButton';
import AppTextInput from '../components/AppTextInput';
import type { RutinaStackParamList } from '../navigation/types';
import { DAY_LABELS } from '../types/workout';
import { getLastWeightForExercise } from '../services/workoutService';

type ConfigNav = NativeStackNavigationProp<RutinaStackParamList, 'ExerciseConfig'>;
type ConfigRoute = RouteProp<RutinaStackParamList, 'ExerciseConfig'>;

type Mode = 'reps' | 'time' | 'circuit';

export default function ExerciseConfigScreen() {
  const navigation = useNavigation<ConfigNav>();
  const route = useRoute<ConfigRoute>();
  const { day, exercise, sessionId, muscleId, bodyPartId, bodyPartName, muscleExercises } =
    route.params;

  const [mode, setMode] = useState<Mode>(exercise.mode === 'time' ? 'time' : 'reps');
  const [series, setSeries] = useState('3');
  const [reps, setReps] = useState('10');
  const [workSeconds, setWorkSeconds] = useState('30');
  const [restSeconds, setRestSeconds] = useState('60');
  const [rounds, setRounds] = useState('4');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastWeightKg, setLastWeightKg] = useState<number | null>(exercise.lastWeightKg ?? null);
  const [error, setError] = useState('');

  useEffect(() => {
    getLastWeightForExercise(exercise.id)
      .then((weight) => setLastWeightKg(weight))
      .catch(() => setLastWeightKg(null));
  }, [exercise.id]);

  const parsePositive = (v: string): number => parseInt(v, 10);
  const parseNonNegative = (v: string): number => parseInt(v, 10);

  const validateReps = () => {
    if (parsePositive(series) <= 0 || parsePositive(reps) <= 0) {
      setError('Indica un número de series y repeticiones mayor a 0.');
      return false;
    }
    if (parseNonNegative(restSeconds) < 0) {
      setError('El tiempo de descanso no puede ser negativo.');
      return false;
    }
    return true;
  };

  const validateTime = () => {
    if (
      parsePositive(series) <= 0 ||
      parsePositive(workSeconds) <= 0 ||
      parseNonNegative(restSeconds) < 0
    ) {
      setError('Series y tiempo de trabajo deben ser mayores a 0.');
      return false;
    }
    return true;
  };

  const startReps = () => {
    if (!validateReps()) return;
    navigation.navigate('WorkoutActive', {
      day,
      exercise,
      sessionId,
      muscleId,
      bodyPartId,
      bodyPartName,
      plan: { mode: 'reps', series: parsePositive(series), reps: parsePositive(reps), restSeconds: parsePositive(restSeconds) || 60 },
    });
  };

  const startTime = () => {
    if (!validateTime()) return;
    navigation.navigate('WorkoutActive', {
      day,
      exercise,
      sessionId,
      muscleId,
      bodyPartId,
      bodyPartName,
      plan: { mode: 'time', series: parsePositive(series), workSeconds: parsePositive(workSeconds), restSeconds: parseNonNegative(restSeconds) },
    });
  };

  const toggleExercise = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setError('');
  };

  const startCircuit = () => {
    const exercises = (muscleExercises ?? []).filter((e) => selectedIds.has(e.id));
    if (exercises.length === 0) {
      setError('Elige al menos un ejercicio para el circuito.');
      return;
    }
    if (parsePositive(workSeconds) <= 0 || parsePositive(rounds) <= 0) {
      setError('El tiempo de trabajo y las rondas deben ser mayores a 0.');
      return;
    }
    if (parseNonNegative(restSeconds) < 0) {
      setError('El tiempo de descanso no puede ser negativo.');
      return;
    }
    navigation.navigate('WorkoutActive', {
      day,
      exercise,
      sessionId,
      muscleId,
      bodyPartId,
      bodyPartName,
      plan: {
        mode: 'circuit',
        name: `Circuito · ${exercises.map((e) => e.name).join(', ')}`,
        exercises: exercises.map((e) => ({ exerciseId: e.id, name: e.name })),
        rounds: parsePositive(rounds),
        workSeconds: parsePositive(workSeconds),
        restSeconds: parseNonNegative(restSeconds),
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{exercise.name}</Text>
          <Text style={styles.headerSubtitle}>{DAY_LABELS[day]}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.lastWeightBox}>
          <Ionicons name="trending-up" size={16} color={colors.primary} />
          <Text style={styles.lastWeightText}>
            {lastWeightKg !== null && lastWeightKg > 0
              ? `Último peso en este ejercicio: ${lastWeightKg} kg`
              : 'Aún no tienes peso registrado en este ejercicio'}
          </Text>
        </View>

        <Text style={styles.label}>Modo de serie</Text>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'reps' ? styles.modeTabActive : null]}
            onPress={() => {
              setMode('reps');
              setError('');
            }}
          >
            <Ionicons name="reload" size={16} color={mode === 'reps' ? colors.text : colors.textMuted} />
            <Text style={[styles.modeTabText, mode === 'reps' ? styles.modeTabTextActive : null]}>
              Repeticiones
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'time' ? styles.modeTabActive : null]}
            onPress={() => {
              setMode('time');
              setError('');
            }}
          >
            <Ionicons name="timer-outline" size={16} color={mode === 'time' ? colors.text : colors.textMuted} />
            <Text style={[styles.modeTabText, mode === 'time' ? styles.modeTabTextActive : null]}>
              Tiempo
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeTab, mode === 'circuit' ? styles.modeTabActive : null]}
            onPress={() => {
              setMode('circuit');
              setError('');
            }}
          >
            <Ionicons name="repeat" size={16} color={mode === 'circuit' ? colors.text : colors.textMuted} />
            <Text style={[styles.modeTabText, mode === 'circuit' ? styles.modeTabTextActive : null]}>
              Circuito
            </Text>
          </TouchableOpacity>
        </View>

        {mode !== 'circuit' ? (
          <AppTextInput
            label="Número de series"
            value={series}
            onChangeText={(t) => setSeries(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="Ej: 3"
          />
        ) : null}

        {mode === 'reps' ? (
          <>
            <AppTextInput
              label="Repeticiones por serie"
              value={reps}
              onChangeText={(t) => setReps(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Ej: 10"
            />
            <AppTextInput
              label="Tiempo de descanso (segundos)"
              value={restSeconds}
              onChangeText={(t) => setRestSeconds(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Ej: 60"
            />
          </>
        ) : (
          <>
            <AppTextInput
              label="Tiempo de trabajo (segundos)"
              value={workSeconds}
              onChangeText={(t) => setWorkSeconds(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Ej: 30"
            />
            <AppTextInput
              label="Tiempo de descanso (segundos)"
              value={restSeconds}
              onChangeText={(t) => setRestSeconds(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Ej: 45"
            />
          </>
        )}

        {mode === 'circuit' ? (
          <>
            <Text style={styles.label}>Ejercicios del circuito</Text>
            {(muscleExercises ?? []).length === 0 ? (
              <View style={styles.emptyCircuit}>
                <Text style={styles.emptyCircuitText}>
                  Este músculo aún no tiene ejercicios asignados hoy. Regresa y agrégalos para
                  armar un circuito.
                </Text>
              </View>
            ) : (
              (muscleExercises ?? []).map((ex) => {
                const selected = selectedIds.has(ex.id);
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.pickRow, selected ? styles.pickRowSelected : null]}
                    onPress={() => toggleExercise(ex.id)}
                  >
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                    <Text style={[styles.pickText, selected ? styles.pickTextSelected : null]}>
                      {ex.name}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
            <AppTextInput
              label="Tiempo de trabajo por ejercicio (s)"
              value={workSeconds}
              onChangeText={(t) => setWorkSeconds(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Ej: 30"
            />
            <AppTextInput
              label="Descanso entre ejercicios (s)"
              value={restSeconds}
              onChangeText={(t) => setRestSeconds(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Ej: 60"
            />
            <AppTextInput
              label="Rondas (repeticiones del circuito)"
              value={rounds}
              onChangeText={(t) => setRounds(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder="Ej: 4"
            />
          </>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actions}>
          {mode === 'reps' ? (
            <>
              <AppButton title="Comenzar" onPress={startReps} />
              <AppButton
                title="Ver demás ejercicios"
                variant="outline"
                onPress={() => navigation.goBack()}
                style={styles.secondaryBtn}
              />
            </>
          ) : mode === 'time' ? (
            <>
              <AppButton title="Comenzar ya" onPress={startTime} />
              <AppButton
                title="Regresar al panel del músculo"
                variant="outline"
                onPress={() => navigation.goBack()}
                style={styles.secondaryBtn}
              />
            </>
          ) : (
            <>
              <AppButton title="Comenzar circuito" onPress={startCircuit} />
              <AppButton
                title="Regresar al panel del músculo"
                variant="outline"
                onPress={() => navigation.goBack()}
                style={styles.secondaryBtn}
              />
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
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
  },
  lastWeightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  lastWeightText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingVertical: 12,
  },
  modeTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modeTabText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: colors.text,
  },
  errorText: {
    color: colors.primary,
    fontSize: 13,
    marginBottom: 12,
  },
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  pickRowSelected: {
    borderColor: colors.primary,
  },
  pickText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  pickTextSelected: {
    color: colors.text,
  },
  emptyCircuit: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  emptyCircuitText: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    marginTop: 12,
  },
  secondaryBtn: {
    marginTop: 10,
  },
});