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
import { Ionicons } from '@expo/vector-icons';
import type { BodyPart, NewExercise } from '../../types/exercise';

interface ModalNuevoEjercicioProps {
  visible: boolean;
  bodyParts: BodyPart[];
  existingExercises?: { id: number; name: string }[];
  initialName?: string;
  onClose: () => void;
  onSave: (data: NewExercise) => Promise<void>;
  onSelectExisting?: (exerciseId: number) => void;
}

export default function ModalNuevoEjercicio({
  visible,
  bodyParts,
  existingExercises,
  initialName,
  onClose,
  onSave,
  onSelectExisting,
}: ModalNuevoEjercicioProps) {
  const [name, setName] = useState('');
  const [selectedBodyPartId, setSelectedBodyPartId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [equipment, setEquipment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible && initialName) {
      setName(initialName);
    }
  }, [visible, initialName]);

  const trimmedName = name.trim();
  const matchedExisting =
    trimmedName.length > 1 && existingExercises && existingExercises.length > 0
      ? existingExercises.filter((e) => e.name.toLowerCase().includes(trimmedName.toLowerCase()))
      : [];

  const resetForm = () => {
    setName('');
    setSelectedBodyPartId(null);
    setDescription('');
    setEquipment('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

const handleSave = async () => {
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    if (!selectedBodyPartId) {
      setError('Selecciona una parte del cuerpo');
      return;
    }
    const exactMatch = existingExercises?.find(
      (e) => e.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (exactMatch && onSelectExisting) {
      resetForm();
      onClose();
      onSelectExisting(exactMatch.id);
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        body_part_id: selectedBodyPartId,
        description: description.trim() || undefined,
        equipment: equipment.trim() || undefined,
      });
      resetForm();
      onClose();
    } catch {
      setError('Error al guardar el ejercicio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Nuevo Ejercicio</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <AppTextInput
              label="Nombre del ejercicio"
              placeholder="Ej: Sentadilla con peso"
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Parte del cuerpo</Text>
            <View style={styles.chipsContainer}>
              {bodyParts.map((bp) => (
                <TouchableOpacity
                  key={bp.id}
                  style={[
                    styles.chip,
                    selectedBodyPartId === bp.id ? styles.chipActive : null,
                  ]}
                  onPress={() => setSelectedBodyPartId(bp.id)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedBodyPartId === bp.id ? styles.chipTextActive : null,
                    ]}
                  >
                    {bp.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {existingExercises && existingExercises.length > 0 && matchedExisting.length > 0 ? (
              <View style={styles.catalogSection}>
                <Text style={styles.catalogLabel}>Ejercicios en el catálogo</Text>
                {matchedExisting.map((ex) => (
                  <TouchableOpacity
                    key={ex.id}
                    style={styles.catalogItem}
                    onPress={() => {
                      resetForm();
                      onClose();
                      onSelectExisting?.(ex.id);
                    }}
                  >
                    <Text style={styles.catalogItemText}>{ex.name}</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
                <Text style={styles.catalogHint}>
                  Selecciona uno existente o cambia el nombre para crear uno nuevo
                </Text>
              </View>
            ) : null}

            {trimmedName.length > 2 &&
            existingExercises &&
            existingExercises.some(
              (e) => e.name.toLowerCase() === trimmedName.toLowerCase(),
            ) ? (
              <Text style={styles.catalogWarning}>
                Ya existe un ejercicio con ese nombre en el catálogo
              </Text>
            ) : null}

            <AppTextInput
              label="Descripción (opcional)"
              placeholder="Instrucciones breves..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              style={styles.textArea}
            />

            <AppTextInput
              label="Equipo necesario (opcional)"
              placeholder="Ej: Barra, mancuerna..."
              value={equipment}
              onChangeText={setEquipment}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              title="Guardar Ejercicio"
              onPress={handleSave}
              loading={saving}
              style={styles.saveButton}
            />

            <AppButton
              title="Cancelar"
              variant="outline"
              onPress={handleClose}
              style={styles.cancelButton}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: 20,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
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
  },
  chipTextActive: {
    color: colors.text,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  catalogSection: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  catalogLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  catalogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardAlt,
  },
  catalogItemText: {
    color: colors.text,
    fontSize: 14,
  },
  catalogHint: {
    color: colors.textSubtle,
    fontSize: 11,
    marginTop: 8,
  },
  catalogWarning: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  errorText: {
    color: colors.primary,
    fontSize: 13,
    marginBottom: 12,
  },
  saveButton: {
    marginBottom: 12,
  },
  cancelButton: {
    marginBottom: 12,
  },
});
