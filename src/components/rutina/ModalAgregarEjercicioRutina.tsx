import { colors } from '../../theme/colors';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AppTextInput from '../AppTextInput';
import AppButton from '../AppButton';
import ModalNuevoEjercicio from '../ejercicios/ModalNuevoEjercicio';
import { Ionicons } from '@expo/vector-icons';
import type { NewExercise } from '../../types/exercise';

interface ExerciseOption {
  id: number;
  name: string;
  equipment: string | null;
}

interface ModalAgregarEjercicioRutinaProps {
  visible: boolean;
  bodyPartId: number;
  bodyPartName: string;
  catalogExercises: ExerciseOption[];
  addedExerciseIds: number[];
  onCreateExercise: (data: NewExercise) => Promise<void>;
  onAddExisting: (exerciseId: number) => Promise<void>;
  onAddRandom: () => Promise<number>;
  onClose: () => void;
}

export default function ModalAgregarEjercicioRutina({
  visible,
  bodyPartId,
  bodyPartName,
  catalogExercises,
  addedExerciseIds,
  onCreateExercise,
  onAddExisting,
  onAddRandom,
  onClose,
}: ModalAgregarEjercicioRutinaProps) {
  const [view, setView] = useState<'menu' | 'search'>('menu');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [randomBusy, setRandomBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (visible) {
      setView('menu');
      setQuery('');
      setBusyId(null);
      setRandomBusy(false);
      setMessage('');
      setShowCreate(false);
    }
  }, [visible]);

  const added = new Set(addedExerciseIds);
  const trimmedQuery = query.trim().toLowerCase();
  const filtered = catalogExercises.filter(
    (e) => !trimmedQuery || e.name.toLowerCase().includes(trimmedQuery),
  );
  const hasMatchingItem = catalogExercises.some(
    (e) => e.name.toLowerCase().includes(trimmedQuery),
  );
  const canCreate = trimmedQuery.length >= 2 && !hasMatchingItem;

  const handleAdd = async (exerciseId: number) => {
    setBusyId(exerciseId);
    try {
      await onAddExisting(exerciseId);
      setMessage('Ejercicio agregado a la rutina.');
    } finally {
      setBusyId(null);
    }
  };

  const handleRandom = async () => {
    setRandomBusy(true);
    try {
      const addedCount = await onAddRandom();
      if (addedCount === 0) {
        setMessage('Todos los ejercicios ya estaban en la rutina.');
      } else {
        setMessage(`${addedCount} ejercicio${addedCount > 1 ? 's' : ''} agregado${addedCount > 1 ? 's' : ''} al azar.`);
      }
    } finally {
      setRandomBusy(false);
    }
  };

  const handleCreate = async (data: NewExercise) => {
    await onCreateExercise(data);
    setShowCreate(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {view === 'menu' ? (
            <>
              <Text style={styles.title}>Agregar ejercicios</Text>
              <Text style={styles.subtitle}>{bodyPartName}</Text>

              <TouchableOpacity
                style={styles.option}
                onPress={() => setView('search')}
                activeOpacity={0.8}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="search" size={22} color={colors.primary} />
                </View>
                <View style={styles.optionBody}>
                  <Text style={styles.optionTitle}>Seleccionar / Buscar</Text>
                  <Text style={styles.optionDescription}>
                    Elige ejercicios del catálogo o crea uno nuevo
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.option}
                onPress={handleRandom}
                disabled={randomBusy}
                activeOpacity={0.8}
              >
                <View style={styles.optionIcon}>
                  <Ionicons
                    name={randomBusy ? 'hourglass-outline' : 'dice-outline'}
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.optionBody}>
                  <Text style={styles.optionTitle}>Elegir al Azar (4)</Text>
                  <Text style={styles.optionDescription}>
                    Selecciona 4 ejercicios aleatorios del catálogo
                  </Text>
                </View>
                {randomBusy ? (
                  <Text style={styles.loadingText}>…</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                )}
              </TouchableOpacity>

              {message ? <Text style={styles.messageText}>{message}</Text> : null}

              <AppButton title="Cancelar" variant="outline" onPress={onClose} />
            </>
          ) : (
            <>
              <View style={styles.searchHeader}>
                <TouchableOpacity
                  onPress={() => {
                    setView('menu');
                    setQuery('');
                  }}
                  style={styles.backBtn}
                  hitSlop={8}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.searchTitle}>Buscar ejercicio</Text>
              </View>

              <AppTextInput
                value={query}
                onChangeText={setQuery}
                placeholder={`Buscar en ${bodyPartName}…`}
                accessory={<Ionicons name="search" size={18} color={colors.textMuted} />}
                style={styles.inlineInput}
              />

              {canCreate ? (
                <TouchableOpacity
                  style={styles.createBtn}
                  onPress={() => setShowCreate(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.text} />
                  <Text style={styles.createBtnText}>Crear e incluir “{query.trim()}”</Text>
                </TouchableOpacity>
              ) : null}

              <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
                {filtered.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Sin resultados. Usa “Crear e incluir” para agregarlo.
                  </Text>
                ) : (
                  filtered.map((ex) => {
                    const isAdded = added.has(ex.id);
                    return (
                      <TouchableOpacity
                        key={ex.id}
                        style={[styles.item, isAdded ? styles.itemAdded : null]}
                        disabled={isAdded || busyId === ex.id}
                        onPress={() => handleAdd(ex.id)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.itemBody}>
                          <Text style={styles.itemName}>{ex.name}</Text>
                          {ex.equipment ? (
                            <Text style={styles.itemEquipment}>{ex.equipment}</Text>
                          ) : null}
                        </View>
                        {isAdded ? (
                          <View style={styles.addedBadge}>
                            <Ionicons name="checkmark" size={14} color={colors.success} />
                            <Text style={styles.addedBadgeText}>Agregado</Text>
                          </View>
                        ) : busyId === ex.id ? (
                          <Text style={styles.loadingText}>…</Text>
                        ) : (
                          <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              {message ? <Text style={styles.messageText}>{message}</Text> : null}

              <AppButton title="Listo" onPress={onClose} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <ModalNuevoEjercicio
        visible={showCreate}
        bodyParts={[{ id: bodyPartId, name: bodyPartName }]}
        initialName={query}
        existingExercises={catalogExercises.map((e) => ({ id: e.id, name: e.name }))}
        onClose={() => setShowCreate(false)}
        onSave={handleCreate}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.cardAlt,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionDescription: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    marginRight: 12,
  },
  searchTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  inlineInput: {
    flex: 1,
    borderWidth: 0,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 10,
  },
  createBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  list: {
    maxHeight: 260,
    marginBottom: 8,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  itemAdded: {
    opacity: 0.55,
  },
  itemBody: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  itemEquipment: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addedBadgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  messageText: {
    color: colors.success,
    fontSize: 13,
    marginBottom: 12,
    marginTop: 4,
  },
});