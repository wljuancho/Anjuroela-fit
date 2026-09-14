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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  CardEjercicio,
  ModalNuevoEjercicio,
  ModalNuevaCategoria,
  ModalOpcionesMusculo,
} from '../components/ejercicios';
import {
  getAllBodyParts,
  getExercisesByBodyPart,
  getBodyPartExerciseCount,
  addExercise,
  updateExercise,
  deleteExercise,
  addBodyPart,
  updateBodyPart,
  deleteBodyPart,
} from '../services/exerciseService';
import { useLoadOnMount } from '../hooks/useLoadOnMount';
import type {
  BodyPart,
  ExerciseWithBodyPart,
  NewExercise,
  NewBodyPart,
  UpdateExercise,
  UpdateBodyPart,
} from '../types/exercise';

export default function EjerciciosScreen() {
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseWithBodyPart | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingBodyPart, setEditingBodyPart] = useState<BodyPart | null>(null);
  const [optionsBodyPart, setOptionsBodyPart] = useState<BodyPart | null>(null);

  const selectedRef = useRef<BodyPart | null>(null);
  selectedRef.current = selectedBodyPart;

  const { data: bodyParts, loading, reload: reloadBodyParts } = useLoadOnMount<BodyPart[]>(
    useCallback(async () => {
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

  const handleSaveExercise = useCallback(async (data: NewExercise) => {
    try {
      const created = await addExercise(data);
      if (created.body_part_id === selectedRef.current?.id) {
        await reloadExercises();
      } else {
        const parts = await reloadBodyParts();
        const target = (parts ?? []).find((p) => p.id === created.body_part_id);
        if (target) {
          setSelectedBodyPart(target);
        }
      }
    } catch {
      throw new Error('No se pudo guardar el ejercicio.');
    }
  }, [reloadBodyParts, reloadExercises]);

  const handleUpdateExercise = useCallback(async (data: UpdateExercise) => {
    try {
      await updateExercise(data);
      if (data.body_part_id !== selectedRef.current?.id) {
        const parts = await reloadBodyParts();
        const target = (parts ?? []).find((p) => p.id === data.body_part_id);
        if (target) {
          setSelectedBodyPart(target);
          return;
        }
      }
      await reloadExercises();
    } catch {
      throw new Error('No se pudo actualizar el ejercicio.');
    }
  }, [reloadBodyParts, reloadExercises]);

  const handleDeleteExercise = useCallback(
    (exercise: ExerciseWithBodyPart) => {
      Alert.alert(
        'Eliminar ejercicio',
        `¿Deseas eliminar "${exercise.name}" del catálogo?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteExercise(exercise.id);
                await reloadExercises();
              } catch (e) {
                Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar el ejercicio.');
              }
            },
          },
        ],
      );
    },
    [reloadExercises],
  );

  const handleSaveCategory = useCallback(
    async (data: NewBodyPart) => {
      try {
        const created = await addBodyPart(data);
        await reloadBodyParts();
        setSelectedBodyPart(created);
      } catch {
        throw new Error('No se pudo crear la categoría.');
      }
    },
    [reloadBodyParts],
  );

  const handleUpdateCategory = useCallback(
    async (data: UpdateBodyPart) => {
      try {
        await updateBodyPart(data);
        await reloadBodyParts();
      } catch {
        throw new Error('No se pudo actualizar la categoría.');
      }
    },
    [reloadBodyParts],
  );

  const handleDeleteBodyPart = useCallback(
    (bodyPart: BodyPart) => {
      setOptionsBodyPart(null);
      getBodyPartExerciseCount(bodyPart.id)
        .then((count) => {
          const exercisesLabel =
            count === 1 ? '1 ejercicio asociado' : `${count} ejercicios asociados`;
          Alert.alert(
            '¿Eliminar categoría?',
            `Se eliminará la categoría "${bodyPart.name}" y ${exercisesLabel}. Esta acción no se puede deshacer.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteBodyPart(bodyPart.id);
                    const parts = await reloadBodyParts();
                    const remaining = parts ?? [];
                    if (selectedRef.current?.id === bodyPart.id) {
                      setSelectedBodyPart(remaining[0] ?? null);
                    }
                  } catch (e) {
                    Alert.alert('Error', e instanceof Error ? e.message : 'No se pudo eliminar la categoría.');
                  }
                },
              },
            ],
          );
        })
        .catch(() => {
          Alert.alert('Error', 'No se pudo cargar la información de la categoría.');
        });
    },
    [reloadBodyParts],
  );

  const openNewExercise = useCallback(() => {
    setEditingExercise(null);
    setShowExerciseModal(true);
  }, []);

  const openEditExercise = useCallback((exercise: ExerciseWithBodyPart) => {
    setEditingExercise(exercise);
    setShowExerciseModal(true);
  }, []);

  const closeExerciseModal = useCallback(() => {
    setShowExerciseModal(false);
    setEditingExercise(null);
  }, []);

  const openNewCategory = useCallback(() => {
    setEditingBodyPart(null);
    setShowCategoryModal(true);
  }, []);

  const openEditCategory = useCallback((bodyPart: BodyPart) => {
    setOptionsBodyPart(null);
    setEditingBodyPart(bodyPart);
    setShowCategoryModal(true);
  }, []);

  const closeCategoryModal = useCallback(() => {
    setShowCategoryModal(false);
    setEditingBodyPart(null);
  }, []);

  const openMuscleOptions = useCallback((bodyPart: BodyPart) => {
    setOptionsBodyPart(bodyPart);
  }, []);

  const closeMuscleOptions = useCallback(() => {
    setOptionsBodyPart(null);
  }, []);

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
            <View
              key={bp.id}
              style={[
                styles.muscleCard,
                selectedBodyPart?.id === bp.id ? styles.muscleCardActive : null,
              ]}
            >
              <TouchableOpacity
                style={styles.muscleOptionsBtn}
                onPress={() => openMuscleOptions(bp)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name="ellipsis-vertical"
                  size={16}
                  color={selectedBodyPart?.id === bp.id ? colors.text : colors.textSubtle}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.muscleCardBody}
                onPress={() => setSelectedBodyPart(bp)}
                onLongPress={() => openMuscleOptions(bp)}
                delayLongPress={500}
              >
                <Text
                  style={[
                    styles.muscleName,
                    selectedBodyPart?.id === bp.id ? styles.muscleNameActive : null,
                  ]}
                >
                  {bp.name}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addCard} onPress={openNewCategory}>
            <View style={styles.addPlus}>
              <Ionicons name="add" size={18} color={colors.text} />
            </View>
            <Text style={styles.addText}>Nuevo Músculo</Text>
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
            (exercises ?? []).map((ex) => (
              <CardEjercicio
                key={ex.id}
                exercise={ex}
                onPress={() => openEditExercise(ex)}
                onEdit={() => openEditExercise(ex)}
                onDelete={() => handleDeleteExercise(ex)}
              />
            ))
          )}
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={openNewExercise}>
          <Ionicons name="add" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ModalNuevoEjercicio
        visible={showExerciseModal}
        bodyParts={bodyParts ?? []}
        editingExercise={editingExercise}
        initialBodyPartId={selectedBodyPart?.id ?? null}
        onClose={closeExerciseModal}
        onSave={handleSaveExercise}
        onUpdate={handleUpdateExercise}
      />

      <ModalNuevaCategoria
        visible={showCategoryModal}
        editingBodyPart={editingBodyPart}
        onClose={closeCategoryModal}
        onSave={handleSaveCategory}
        onUpdate={handleUpdateCategory}
      />

      <ModalOpcionesMusculo
        visible={optionsBodyPart !== null}
        bodyPart={optionsBodyPart}
        onClose={closeMuscleOptions}
        onEditName={openEditCategory}
        onDelete={handleDeleteBodyPart}
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
    gap: 10,
  },
  muscleCard: {
    position: 'relative',
    minWidth: 84,
    minHeight: 56,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muscleCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  muscleCardBody: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  muscleOptionsBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  muscleName: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  muscleNameActive: {
    color: colors.text,
  },
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 136,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  addPlus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
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