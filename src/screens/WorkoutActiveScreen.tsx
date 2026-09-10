import { colors } from '../theme/colors';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Vibration,
  Alert,
  TextInput,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import AppButton from '../components/AppButton';
import type { RutinaStackParamList } from '../navigation/types';
import { DAY_LABELS, type WorkoutSetInput } from '../types/workout';
import { upsertSets } from '../services/workoutService';

type ActiveNav = NativeStackNavigationProp<RutinaStackParamList, 'WorkoutActive'>;
type ActiveRoute = RouteProp<RutinaStackParamList, 'WorkoutActive'>;

type Phase = 'series' | 'rest' | 'work' | 'done';

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, '0');
  const ss = (s % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function WorkoutActiveScreen() {
  const navigation = useNavigation<ActiveNav>();
  const route = useRoute<ActiveRoute>();
  const { day, exercise, sessionId, plan, muscleId, bodyPartId, bodyPartName } = route.params;

  const [phase, setPhase] = useState<Phase>(
    plan.mode === 'reps' ? 'series' : 'work',
  );
  const [seconds, setSeconds] = useState<number>(plan.mode === 'reps' ? 0 : plan.workSeconds);
  const [currentSeries, setCurrentSeries] = useState(1);
  const [workDone, setWorkDone] = useState(0);
  const [running, setRunning] = useState(true);

  const [weightInput, setWeightInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [finishError, setFinishError] = useState('');

  const vibrate = useCallback(() => Vibration.vibrate(400), []);

  const advance = useCallback(() => {
    if (plan.mode === 'reps') {
      if (phase === 'rest') {
        if (currentSeries < plan.series) {
          setCurrentSeries((s) => s + 1);
          setPhase('series');
          setSeconds(0);
          setRunning(false);
        } else {
          vibrate();
          setPhase('done');
          setRunning(false);
        }
      }
    } else if (plan.mode === 'time') {
      if (phase === 'work') {
        const done = workDone + 1;
        setWorkDone(done);
        if (done >= plan.series) {
          vibrate();
          setPhase('done');
          setRunning(false);
        } else {
          vibrate();
          setPhase('rest');
          setSeconds(plan.restSeconds);
        }
      } else if (phase === 'rest') {
        vibrate();
        setPhase('work');
        setSeconds(plan.workSeconds);
      }
    }
  }, [plan, phase, currentSeries, workDone, vibrate]);

  useEffect(() => {
    if (phase === 'done' || !running) return;
    const timer = setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, running]);

  useEffect(() => {
    if ((phase !== 'rest' && phase !== 'work') || seconds !== 0) return;
    advance();
  }, [seconds, phase, advance]);

  const startRest = () => {
    if (plan.mode !== 'reps') return;
    setPhase('rest');
    setSeconds(plan.restSeconds);
    setRunning(true);
  };

  const skipRest = () => {
    if (phase !== 'rest') return;
    setSeconds(0);
    advance();
  };

  const cancel = () => {
    Alert.alert('Abandonar', '¿Salir sin guardar las series actuales?', [
      { text: 'Seguir', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const handleFinish = async () => {
    const weight = weightInput.trim() ? parseFloat(weightInput) : null;
    if (plan.mode === 'reps' && (!weight || weight <= 0)) {
      setFinishError('Ingresa el peso cargado (kg) para comenzar la siguiente.');
      return;
    }
    const totalSeries = plan.mode === 'reps' ? plan.series : Math.max(plan.series, workDone);
    const sets: WorkoutSetInput[] = [];
    for (let i = 1; i <= totalSeries; i += 1) {
      if (plan.mode === 'reps') {
        sets.push({
          exercise_id: exercise.id,
          set_number: i,
          weight_kg: weight,
          reps: plan.reps,
          set_type: 'reps',
          time_seconds: null,
        });
      } else {
        sets.push({
          exercise_id: exercise.id,
          set_number: i,
          weight_kg: weight && weight > 0 ? weight : null,
          reps: null,
          set_type: 'time',
          time_seconds: plan.workSeconds,
        });
      }
    }
    setSaving(true);
    try {
      await upsertSets(sessionId, sets);
      navigation.popTo('MusclePanel', {
        day,
        muscleId,
        bodyPartId,
        bodyPartName,
      });
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'No se pudieron guardar las series.');
    } finally {
      setSaving(false);
    }
  };

  const isCounting = phase === 'work' || phase === 'rest';
  const label = phase === 'work' ? 'TRABAJO' : phase === 'rest' ? 'DESCANSO' : 'SERIE';
  const labelColor = phase === 'rest' ? colors.success : colors.primary;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={cancel} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{exercise.name}</Text>
          <Text style={styles.headerSubtitle}>{DAY_LABELS[day]}</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {phase === 'done' ? (
        <View style={styles.doneContainer}>
          <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          <Text style={styles.doneTitle}>¡Series completadas!</Text>
          <Text style={styles.doneSubtitle}>
            {plan.mode === 'reps'
              ? `Completaste ${plan.series} series de ${plan.reps} repeticiones.`
              : `Completaste ${Math.max(plan.series, workDone)} series de ${plan.workSeconds}s de trabajo.`}
          </Text>

          <View style={styles.weightBox}>
            <Text style={styles.weightLabel}>Peso cargado (kg)</Text>
            <View style={styles.weightInputWrap}>
              <TextInput
                style={styles.weightInput}
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder="Ej: 40"
                placeholderTextColor={colors.textSubtle}
                keyboardType="decimal-pad"
              />
              <Text style={styles.weightUnit}>kg</Text>
            </View>
            {plan.mode === 'time' ? (
              <Text style={styles.weightHint}>Opcional en modo tiempo.</Text>
            ) : null}
            {finishError ? <Text style={styles.errorText}>{finishError}</Text> : null}
          </View>

          <AppButton title="Guardar" onPress={handleFinish} loading={saving} style={styles.finishBtn} />
        </View>
      ) : (
        <View style={styles.activeContainer}>
          <Text style={[styles.phaseLabel, { color: labelColor }]}>{label}</Text>

          {plan.mode === 'reps' && phase === 'series' ? (
            <View style={styles.seriesInfo}>
              <Text style={styles.seriesCount}>
                Serie {currentSeries} de {plan.series}
              </Text>
              <Text style={styles.bigValue}>{plan.reps}</Text>
              <Text style={styles.bigUnit}>
                repeticiones
              </Text>
              <Text style={styles.lastWeightHint}>
                {exercise.lastWeightKg && exercise.lastWeightKg > 0
                  ? `Último peso: ${exercise.lastWeightKg} kg`
                  : ''}
              </Text>
            </View>
          ) : (
            <View style={styles.seriesInfo}>
              {plan.mode === 'time' && phase === 'work' ? (
                <Text style={styles.seriesCount}>
                  Trabajo {workDone + 1} de {plan.series}
                </Text>
              ) : null}
              {plan.mode === 'time' && phase === 'rest' ? (
                <Text style={styles.seriesCount}>
                  Descanso después de {workDone} de {plan.series}
                </Text>
              ) : null}
              {plan.mode === 'reps' && phase === 'rest' ? (
                <Text style={styles.seriesCount}>Descanso — Serie {currentSeries}</Text>
              ) : null}
              <Text style={[styles.timerValue, !running ? styles.timerPaused : null]}>
                {formatCountdown(seconds)}
              </Text>
              <Text style={styles.bigUnit}>segundos</Text>
            </View>
          )}

          {isCounting ? (
            <TouchableOpacity style={styles.pauseBtn} onPress={() => setRunning((r) => !r)}>
              <Ionicons name={running ? 'pause' : 'play'} size={20} color={colors.text} />
              <Text style={styles.pauseText}>{running ? 'Pausar' : 'Reanudar'}</Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.actionArea}>
            {plan.mode === 'reps' && phase === 'series' ? (
              <AppButton title="Continuar" onPress={startRest} style={styles.primaryAction} />
            ) : null}
            {phase === 'rest' ? (
              <AppButton
                title="Omitir descanso"
                variant="outline"
                onPress={skipRest}
                style={styles.primaryAction}
              />
            ) : null}
          </View>
        </View>
      )}
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
  activeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  phaseLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 12,
  },
  seriesInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  seriesCount: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: 8,
  },
  bigValue: {
    color: colors.text,
    fontSize: 96,
    fontWeight: '800',
  },
  timerValue: {
    color: colors.text,
    fontSize: 84,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timerPaused: {
    opacity: 0.5,
  },
  bigUnit: {
    color: colors.textMuted,
    fontSize: 16,
    marginTop: 4,
  },
  lastWeightHint: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 16,
  },
  pauseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 16,
  },
  pauseText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  actionArea: {
    width: '100%',
    paddingHorizontal: 8,
  },
  primaryAction: {
    width: '100%',
  },
  doneContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  doneTitle: {
    color: colors.success,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 6,
  },
  doneSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  weightBox: {
    width: '100%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 16,
    marginTop: 24,
  },
  weightLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  weightInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weightInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  weightUnit: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
  weightHint: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 6,
  },
  errorText: {
    color: colors.primary,
    fontSize: 13,
    marginTop: 8,
  },
  finishBtn: {
    width: '100%',
    marginTop: 24,
  },
});