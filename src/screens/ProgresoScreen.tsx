import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  CardResumenMeta,
  ModalNuevoPeso,
  HistorialPesoLista,
  HistorialFuerzaCard,
} from '../components/progreso';
import {
  getGoalSummary,
  getWeightHistory,
  addWeightLog,
  updateWeightLog,
  deleteWeightLog,
  getStrengthExerciseRecords,
} from '../services/progressService';
import { useAuth } from '../context';
import type {
  GoalSummary,
  WeightLog,
  NewWeightLog,
  ExerciseStrengthRecord,
} from '../types/progress';

export default function ProgresoScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<GoalSummary | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [strengthRecords, setStrengthRecords] = useState<ExerciseStrengthRecord[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<WeightLog | null>(null);

  const reloadAll = useCallback(async () => {
    if (!user) return;
    const [goal, logs, records] = await Promise.all([
      getGoalSummary(user.id),
      getWeightHistory(),
      getStrengthExerciseRecords(),
    ]);
    setSummary(goal);
    setWeightLogs(logs);
    setStrengthRecords(records);
    setSelectedExerciseId((prev) => {
      if (records.length === 0) return null;
      if (prev && records.some((r) => r.exerciseId === prev)) return prev;
      return records[0].exerciseId;
    });
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        await reloadAll();
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadAll]);

  const handleNewWeight = async (data: NewWeightLog, id?: number) => {
    if (id) {
      await updateWeightLog(id, data);
    } else {
      await addWeightLog(data);
    }
    await reloadAll();
  };

  const handleDeleteWeight = (id: number) => {
    Alert.alert(
      'Eliminar registro',
      '¿Seguro que deseas eliminar este registro de peso?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteWeightLog(id);
            await reloadAll();
          },
        },
      ],
    );
  };

  const openNewModal = () => {
    setEditingLog(null);
    setModalVisible(true);
  };

  const openEditModal = (log: WeightLog) => {
    setEditingLog(log);
    setModalVisible(true);
  };

  const selectedRecord =
    strengthRecords.find((r) => r.exerciseId === selectedExerciseId) ?? null;

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {summary ? <CardResumenMeta summary={summary} /> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Historial de Peso</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openNewModal}>
            <Ionicons name="add" size={18} color="#e94560" />
            <Text style={styles.addBtnText}>Añadir</Text>
          </TouchableOpacity>
        </View>

        <HistorialPesoLista
          logs={weightLogs}
          onDelete={handleDeleteWeight}
          onEdit={openEditModal}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Progreso de Fuerza</Text>
        </View>

        {strengthRecords.length === 0 ? (
          <HistorialFuerzaCard record={null} />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContainer}
            >
              {strengthRecords.map((rec) => (
                <TouchableOpacity
                  key={rec.exerciseId}
                  style={[
                    styles.chip,
                    selectedExerciseId === rec.exerciseId ? styles.chipActive : null,
                  ]}
                  onPress={() => setSelectedExerciseId(rec.exerciseId)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedExerciseId === rec.exerciseId ? styles.chipTextActive : null,
                    ]}
                  >
                    {rec.exerciseName}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <HistorialFuerzaCard record={selectedRecord} />
          </>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <ModalNuevoPeso
        visible={modalVisible}
        editingLog={editingLog}
        onClose={() => setModalVisible(false)}
        onSave={handleNewWeight}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    paddingTop: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  addBtnText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '600',
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  chipText: {
    color: '#a0a0b8',
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  bottomSpacer: {
    height: 24,
  },
});