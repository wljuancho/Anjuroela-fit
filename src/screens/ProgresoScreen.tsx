import { colors } from '../theme/colors';
import React, { useState, useEffect } from 'react';
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
import { useAuth } from '../context';
import { useProgressData } from '../hooks/useProgressData';
import type { WeightLog, NewWeightLog } from '../types/progress';

export default function ProgresoScreen() {
  const { user } = useAuth();
  const {
    summary,
    weightLogs,
    strengthRecords,
    selectedExerciseId,
    setSelectedExerciseId,
    loading,
    error,
    saveWeight,
    removeWeight,
  } = useProgressData(user?.id ?? 0);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<WeightLog | null>(null);

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

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
            await removeWeight(id);
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
          <ActivityIndicator size="large" color={colors.primary} />
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
            <Ionicons name="add" size={18} color={colors.primary} />
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
        onSave={saveWeight}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
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
    color: colors.text,
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
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  chipsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.text,
  },
  bottomSpacer: {
    height: 24,
  },
});