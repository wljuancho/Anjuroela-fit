import { colors } from '../../theme/colors';
import React, { useState } from 'react';
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
import AppButton from '../AppButton';
import type { BodyPart } from '../../types/exercise';
import type { DayOfWeek } from '../../types/workout';
import { DAY_LABELS } from '../../types/workout';

interface ModalEditarDiaProps {
  visible: boolean;
  day: DayOfWeek | null;
  bodyParts: BodyPart[];
  currentBodyPartId: number | null;
  onClose: () => void;
  onSave: (day: DayOfWeek, bodyPartId: number | null) => Promise<void>;
}

export default function ModalEditarDia({
  visible,
  day,
  bodyParts,
  currentBodyPartId,
  onClose,
  onSave,
}: ModalEditarDiaProps) {
  const [selectedId, setSelectedId] = useState<number | null>(currentBodyPartId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    setSelectedId(currentBodyPartId);
  }, [currentBodyPartId, visible]);

  const handleClose = () => {
    setError('');
    onClose();
  };

  const handleSave = async () => {
    if (!day) return;
    setError('');
    setSaving(true);
    try {
      await onSave(day, selectedId);
      onClose();
    } catch {
      setError('Error al guardar');
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
          <Text style={styles.title}>
            {day ? `Editar ${DAY_LABELS[day]}` : 'Editar día'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Selecciona el grupo muscular</Text>

            <TouchableOpacity
              style={[styles.option, selectedId === null ? styles.optionActive : null]}
              onPress={() => setSelectedId(null)}
            >
              <Text style={[styles.optionText, selectedId === null ? styles.optionTextActive : null]}>
                Descanso
              </Text>
            </TouchableOpacity>

            {bodyParts.map((bp) => (
              <TouchableOpacity
                key={bp.id}
                style={[styles.option, selectedId === bp.id ? styles.optionActive : null]}
                onPress={() => setSelectedId(bp.id)}
              >
                <Text style={[styles.optionText, selectedId === bp.id ? styles.optionTextActive : null]}>
                  {bp.name}
                </Text>
              </TouchableOpacity>
            ))}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              title="Guardar"
              onPress={handleSave}
              loading={saving}
              style={styles.saveButton}
            />

            <AppButton
              title="Cancelar"
              variant="outline"
              onPress={handleClose}
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
    marginBottom: 10,
    fontWeight: '500',
  },
  option: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  optionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '500',
  },
  optionTextActive: {
    color: colors.text,
  },
  errorText: {
    color: colors.primary,
    fontSize: 13,
    marginBottom: 12,
    marginTop: 4,
  },
  saveButton: {
    marginBottom: 12,
    marginTop: 12,
  },
});
