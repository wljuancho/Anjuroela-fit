import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutSet, WorkoutSetInput } from '../../types/workout';

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
      ? sets.map((s) => ({ exercise_id: s.exercise_id, set_number: s.set_number, weight_kg: s.weight_kg, reps: s.reps }))
      : [{ exercise_id: exerciseId, set_number: 1, weight_kg: null, reps: null }],
  );

  const updateSet = (index: number, field: 'weight_kg' | 'reps', value: string) => {
    const updated = [...localSets];
    const parsed = value === '' ? null : parseFloat(value);
    const numVal = parsed !== null && isNaN(parsed) ? null : parsed;
    updated[index] = { ...updated[index], [field]: numVal };
    setLocalSets(updated);
    onSetsChange(exerciseId, updated);
  };

  const addSet = () => {
    const updated = [...localSets, { exercise_id: exerciseId, set_number: localSets.length + 1, weight_kg: null, reps: null }];
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

      <View style={styles.setHeader}>
        <Text style={styles.setHeaderText}>Serie</Text>
        <Text style={styles.setHeaderText}>Peso (kg)</Text>
        <Text style={styles.setHeaderText}>Reps</Text>
        <View style={styles.setHeaderAction} />
      </View>

      {localSets.map((s, index) => (
        <View key={`${exerciseId}-${index}`} style={styles.setRow}>
          <View style={styles.setNumber}>
            <Text style={styles.setNumberText}>{s.set_number}</Text>
          </View>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#7a7a96"
            value={s.weight_kg !== null ? String(s.weight_kg) : ''}
            onChangeText={(v) => updateSet(index, 'weight_kg', v)}
          />
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#7a7a96"
            value={s.reps !== null ? String(s.reps) : ''}
            onChangeText={(v) => updateSet(index, 'reps', v)}
          />
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={() => removeSet(index)}
            disabled={localSets.length <= 1}
          >
            <Ionicons name="close-circle" size={22} color={localSets.length <= 1 ? '#2a2a4a' : '#e94560'} />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={styles.addSetBtn} onPress={addSet}>
        <Ionicons name="add-circle-outline" size={18} color="#e94560" />
        <Text style={styles.addSetText}>Añadir serie</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
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
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  equipment: {
    color: '#a0a0b8',
    fontSize: 12,
    marginTop: 2,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
    marginBottom: 8,
  },
  setHeaderText: {
    color: '#7a7a96',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  setHeaderAction: {
    width: 30,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  setNumber: {
    width: 28,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  setNumberText: {
    color: '#a0a0b8',
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
    textAlign: 'center',
  },
  removeBtn: {
    width: 30,
    alignItems: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  addSetText: {
    color: '#e94560',
    fontSize: 13,
    fontWeight: '500',
  },
});
