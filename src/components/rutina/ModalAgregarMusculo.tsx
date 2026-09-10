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
import AppButton from '../AppButton';
import type { BodyPart } from '../../types/exercise';
import type { DayOfWeek } from '../../types/workout';
import { DAY_LABELS } from '../../types/workout';

interface ModalAgregarMusculoProps {
  visible: boolean;
  day: DayOfWeek;
  bodyParts: BodyPart[];
  excludedIds: number[];
  onClose: () => void;
  onSave: (bodyPartIds: number[]) => Promise<void>;
}

export default function ModalAgregarMusculo({
  visible,
  day,
  bodyParts,
  excludedIds,
  onClose,
  onSave,
}: ModalAgregarMusculoProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedIds([]);
      setError('');
    }
  }, [visible]);

  const available = bodyParts.filter((bp) => !excludedIds.includes(bp.id));

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (selectedIds.length === 0) {
      setError('Selecciona al menos un grupo muscular.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave(selectedIds);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar.');
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
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Agregar músculo a {DAY_LABELS[day]}</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {available.length === 0 ? (
              <Text style={styles.emptyText}>
                Todos los grupos musculares ya están asignados a este día.
              </Text>
            ) : (
              available.map((bp) => {
                const active = selectedIds.includes(bp.id);
                return (
                  <TouchableOpacity
                    key={bp.id}
                    style={[styles.option, active ? styles.optionActive : null]}
                    onPress={() => toggle(bp.id)}
                  >
                    <Text style={[styles.optionText, active ? styles.optionTextActive : null]}>
                      {bp.name}
                    </Text>
                    <Text style={[styles.check, active ? styles.checkActive : null]}>
                      {active ? '✓' : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <AppButton
            title="Agregar"
            onPress={handleSave}
            loading={saving}
            style={styles.saveButton}
          />

          <AppButton title="Cancelar" variant="outline" onPress={onClose} />
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
    marginBottom: 16,
  },
  list: {
    maxHeight: 320,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  check: {
    color: colors.success,
    fontSize: 18,
    fontWeight: '700',
  },
  checkActive: {
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