import { colors } from '../../theme/colors';
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { SetType, WorkoutSet, WorkoutSetInput } from '../../types/workout';

interface TimerControlsProps {
  targetSeconds: number;
}

function TimerControls({ targetSeconds }: TimerControlsProps) {
  const [remaining, setRemaining] = useState(targetSeconds);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) {
      setRemaining(targetSeconds);
    }
  }, [targetSeconds, running]);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const id = setTimeout(() => setRemaining((prev) => prev - 1), 1000);
    return () => clearTimeout(id);
  }, [running, remaining]);

  useEffect(() => {
    if (running && remaining <= 0) {
      setRunning(false);
      Vibration.vibrate([0, 400, 200, 400]);
      Alert.alert('Tiempo completado', '¡Serie finalizada! Descansa y continúa.');
    }
  }, [running, remaining]);

  const format = (secs: number) => {
    const s = Math.max(0, secs);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
  };

  const reset = () => {
    setRunning(false);
    setRemaining(targetSeconds);
  };

  return (
    <View style={styles.timerWrap}>
      <Text style={[styles.timerText, running ? styles.timerTextRunning : null]}>
        {format(remaining)}
      </Text>
      <View style={styles.timerButtons}>
        {running ? (
          <TouchableOpacity style={[styles.timerBtn, styles.timerBtnPause]} onPress={() => setRunning(false)}>
            <Ionicons name="pause" size={16} color={colors.text} />
            <Text style={styles.timerBtnText}>Pausar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.timerBtn, styles.timerBtnStart]}
            onPress={() => setRunning(true)}
            disabled={targetSeconds <= 0}
          >
            <Ionicons name="play" size={16} color={colors.text} />
            <Text style={styles.timerBtnText}>Iniciar</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.timerBtn, styles.timerBtnReset]} onPress={reset}>
          <Ionicons name="refresh" size={16} color={colors.text} />
          <Text style={styles.timerBtnText}>Reiniciar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface CardEjercicioRutinaProps {
  exerciseId: number;
  exerciseName: string;
  equipment: string | null;
  sets: WorkoutSet[];
  onSetsChange: (exerciseId: number, sets: WorkoutSetInput[]) => void;
}

export default function CardEjercicioRutina({
  exerciseId,
  exerciseName,
  equipment,
  sets,
  onSetsChange,
}: CardEjercicioRutinaProps) {
  const [localSets, setLocalSets] = useState<WorkoutSetInput[]>(
    sets.length > 0
      ? sets.map((s) => ({
          exercise_id: s.exercise_id,
          set_number: s.set_number,
          weight_kg: s.weight_kg,
          reps: s.reps,
          set_type: s.set_type ?? 'reps',
          time_seconds: s.time_seconds ?? null,
        }))
      : [
          {
            exercise_id: exerciseId,
            set_number: 1,
            weight_kg: null,
            reps: null,
            set_type: 'reps',
            time_seconds: null,
          },
        ],
  );

  const updateSet = (index: number, field: 'weight_kg' | 'reps' | 'time_seconds', value: string) => {
    const updated = [...localSets];
    const parsed = value === '' ? null : parseFloat(value);
    const numVal = parsed !== null && isNaN(parsed) ? null : parsed;
    updated[index] = { ...updated[index], [field]: numVal };
    setLocalSets(updated);
    onSetsChange(exerciseId, updated);
  };

  const setSetType = (index: number, setType: SetType) => {
    const updated = [...localSets];
    const current = updated[index];
    updated[index] = {
      ...current,
      set_type: setType,
      reps: setType === 'reps' ? current.reps : null,
      time_seconds: setType === 'time' ? current.time_seconds : null,
    };
    setLocalSets(updated);
    onSetsChange(exerciseId, updated);
  };

  const addSet = () => {
    const updated = [
      ...localSets,
      {
        exercise_id: exerciseId,
        set_number: localSets.length + 1,
        weight_kg: null,
        reps: null,
        set_type: 'reps' as SetType,
        time_seconds: null,
      },
    ];
    setLocalSets(updated);
    onSetsChange(exerciseId, updated);
  };

  const removeSet = (index: number) => {
    if (localSets.length <= 1) return;
    const updated = localSets.filter((_, i) => i !== index).map((s, i) => ({ ...s, set_number: i + 1 }));
    setLocalSets(updated);
    onSetsChange(exerciseId, updated);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.name}>{exerciseName}</Text>
          {equipment ? <Text style={styles.equipment}>{equipment}</Text> : null}
        </View>
      </View>

      {localSets.map((s, index) => {
        const isTime = s.set_type === 'time';
        return (
          <View key={`${exerciseId}-${index}`} style={styles.setCard}>
            <View style={styles.setHeader}>
              <Text style={styles.setNumberLabel}>Serie {s.set_number}</Text>
              <View style={styles.modeTabs}>
                <TouchableOpacity
                  style={[styles.modeTab, !isTime ? styles.modeTabActive : null]}
                  onPress={() => setSetType(index, 'reps')}
                >
                  <Text style={[styles.modeTabText, !isTime ? styles.modeTabTextActive : null]}>
                    Reps
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeTab, isTime ? styles.modeTabActive : null]}
                  onPress={() => setSetType(index, 'time')}
                >
                  <Text style={[styles.modeTabText, isTime ? styles.modeTabTextActive : null]}>
                    Tiempo
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => removeSet(index)}
                disabled={localSets.length <= 1}
              >
                <Ionicons
                  name="close-circle"
                  size={22}
                  color={localSets.length <= 1 ? colors.cardAlt : colors.primary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.setBody}>
              <View style={styles.fieldCol}>
                <Text style={styles.fieldLabel}>Peso (kg)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSubtle}
                  value={s.weight_kg !== null ? String(s.weight_kg) : ''}
                  onChangeText={(v) => updateSet(index, 'weight_kg', v)}
                />
              </View>

              {isTime ? (
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Tiempo (s)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="30"
                    placeholderTextColor={colors.textSubtle}
                    value={s.time_seconds !== null && s.time_seconds !== undefined ? String(s.time_seconds) : ''}
                    onChangeText={(v) => updateSet(index, 'time_seconds', v)}
                  />
                </View>
              ) : (
                <View style={styles.fieldCol}>
                  <Text style={styles.fieldLabel}>Reps</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textSubtle}
                    value={s.reps !== null ? String(s.reps) : ''}
                    onChangeText={(v) => updateSet(index, 'reps', v)}
                  />
                </View>
              )}
            </View>

            {isTime ? <TimerControls targetSeconds={s.time_seconds ?? 0} /> : null}
          </View>
        );
      })}

      <TouchableOpacity style={styles.addSetBtn} onPress={addSet}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.addSetText}>Añadir serie</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  headerText: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  equipment: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  setCard: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.cardAlt,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  setNumberLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 2,
  },
  modeTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeTabActive: {
    backgroundColor: colors.primary,
  },
  modeTabText: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: colors.text,
  },
  removeBtn: {
    padding: 4,
  },
  setBody: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldCol: {
    flex: 1,
  },
  fieldLabel: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    textAlign: 'center',
  },
  timerWrap: {
    marginTop: 12,
    alignItems: 'center',
  },
  timerText: {
    color: colors.textMuted,
    fontSize: 34,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginBottom: 10,
  },
  timerTextRunning: {
    color: colors.primary,
  },
  timerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  timerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timerBtnStart: {
    backgroundColor: colors.success,
  },
  timerBtnPause: {
    backgroundColor: colors.primary,
  },
  timerBtnReset: {
    backgroundColor: colors.cardAlt,
  },
  timerBtnText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  addSetText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
});