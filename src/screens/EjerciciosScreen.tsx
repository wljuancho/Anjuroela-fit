import { colors } from '../theme/colors';
import React, { useState, useCallback, useRef } from 'react';
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
import { useLoadOnMount } from '../hooks/useLoadOnMount';
import type { BodyPart, ExerciseWithBodyPart, NewExercise, NewBodyPart } from '../types/exercise';

export default function EjerciciosScreen() {
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const selectedRef = useRef<BodyPart | null>(null);
  selectedRef.current = selectedBodyPart;

  const { data: bodyParts, loading, reload: reloadBodyParts } = useLoadOnMount<BodyPart[]>(
    useCallback(async () => {
      await initExerciseData();
      const parts = await getAllBodyParts();
      if (!selectedRef.current && parts.length > 0) {
        setSelectedBodyPart(parts[0]);
      }
      return parts;
    }, []),
    [],
  );

  const { data: exercises, reload: reloadExercises } = useLoadOnMount<ExerciseWithBodyPart[]>(
    useCallback(
      () =>
        selectedRef.current
          ? getExercisesByBodyPart(selectedRef.current.id)
          : Promise.resolve(null),
      [],
    ),
    [selectedBodyPart?.id],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadBodyParts();
      await reloadExercises();
    } finally {
      setRefreshing(false);
    }
  }, [reloadBodyParts, reloadExercises]);

  const handleSaveExercise = async (data: NewExercise) => {
    await addExercise(data);
    if (selectedBodyPart) {
      await reloadExercises();
    }
  };

  const handleSaveCategory = async (data: NewBodyPart) => {
    await addBodyPart(data);
    await reloadBodyParts();
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {(bodyParts ?? []).map((bp) => (
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
            <Ionicons name="add" size={18} color={colors.primary} />
          </TouchableOpacity>
        </ScrollView>

        <ScrollView
          style={styles.exercisesList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {(exercises ?? []).length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={48} color={colors.cardAlt} />
              <Text style={styles.emptyText}>No hay ejercicios aún</Text>
              <Text style={styles.emptySubtext}>Toca + para añadir uno</Text>
            </View>
          ) : (
            (exercises ?? []).map((ex) => <CardEjercicio key={ex.id} exercise={ex} />)
          )}
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={() => setShowExerciseModal(true)}>
          <Ionicons name="add" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ModalNuevoEjercicio
        visible={showExerciseModal}
        bodyParts={bodyParts ?? []}
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
  tabsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabAdd: {
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.text,
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});