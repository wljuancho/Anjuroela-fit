import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CardEjercicio, ModalNuevoEjercicio, ModalNuevaCategoria } from '../components/ejercicios';
import {
  initExerciseData,
  getAllBodyParts,
  getExercisesByBodyPart,
  addExercise,
  addBodyPart,
} from '../services/exerciseService';
import type { BodyPart, ExerciseWithBodyPart, NewExercise, NewBodyPart } from '../types/exercise';

export default function EjerciciosScreen() {
  const [bodyParts, setBodyParts] = useState<BodyPart[]>([]);
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart | null>(null);
  const [exercises, setExercises] = useState<ExerciseWithBodyPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const loadBodyParts = useCallback(async () => {
    await initExerciseData();
    const parts = await getAllBodyParts();
    setBodyParts(parts);
    if (parts.length > 0 && !selectedBodyPart) {
      setSelectedBodyPart(parts[0]);
    }
  }, [selectedBodyPart]);

  const loadExercises = useCallback(async (bodyPartId: number) => {
    const items = await getExercisesByBodyPart(bodyPartId);
    setExercises(items);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await loadBodyParts();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedBodyPart) {
      loadExercises(selectedBodyPart.id);
    }
  }, [selectedBodyPart]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadBodyParts();
      if (selectedBodyPart) {
        await loadExercises(selectedBodyPart.id);
      }
    } finally {
      setRefreshing(false);
    }
  }, [loadBodyParts, loadExercises, selectedBodyPart]);

  const handleSaveExercise = async (data: NewExercise) => {
    await addExercise(data);
    if (selectedBodyPart) {
      await loadExercises(selectedBodyPart.id);
    }
  };

  const handleSaveCategory = async (data: NewBodyPart) => {
    await addBodyPart(data);
    await loadBodyParts();
  };

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {bodyParts.map((bp) => (
            <TouchableOpacity
              key={bp.id}
              style={[styles.tab, selectedBodyPart?.id === bp.id ? styles.tabActive : null]}
              onPress={() => setSelectedBodyPart(bp)}
            >
              <Text style={[styles.tabText, selectedBodyPart?.id === bp.id ? styles.tabTextActive : null]}>
                {bp.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.tab, styles.tabAdd]}
            onPress={() => setShowCategoryModal(true)}
          >
            <Ionicons name="add" size={18} color="#e94560" />
          </TouchableOpacity>
        </ScrollView>

        <ScrollView
          style={styles.exercisesList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e94560"
            />
          }
        >
          {exercises.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={48} color="#2a2a4a" />
              <Text style={styles.emptyText}>No hay ejercicios aún</Text>
              <Text style={styles.emptySubtext}>Toca + para añadir uno</Text>
            </View>
          ) : (
            exercises.map((ex) => <CardEjercicio key={ex.id} exercise={ex} />)
          )}
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={() => setShowExerciseModal(true)}>
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ModalNuevoEjercicio
        visible={showExerciseModal}
        bodyParts={bodyParts}
        onClose={() => setShowExerciseModal(false)}
        onSave={handleSaveExercise}
      />

      <ModalNuevaCategoria
        visible={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSave={handleSaveCategory}
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
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabActive: {
    backgroundColor: '#e94560',
    borderColor: '#e94560',
  },
  tabAdd: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    color: '#a0a0b8',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  exercisesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 64,
  },
  emptyText: {
    color: '#a0a0b8',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  emptySubtext: {
    color: '#7a7a96',
    fontSize: 14,
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#e94560',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#e94560',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
