import { colors } from '../../theme/colors';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import DateTimePicker, { DateTimePickerChangeEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import AppTextInput from '../AppTextInput';
import AppButton from '../AppButton';
import type { NewWeightLog } from '../../types/progress';
import { formatDate } from '../../services/utils';

interface ModalNuevoPesoProps {
  visible: boolean;
  initialDate?: string;
  editingLog?: { id: number; date: string; weight_kg: number; notes?: string | null } | null;
  onClose: () => void;
  onSave: (data: NewWeightLog, id?: number) => Promise<void>;
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function ModalNuevoPeso({
  visible,
  initialDate,
  editingLog,
  onClose,
  onSave,
}: ModalNuevoPesoProps) {
  const [date, setDate] = useState(initialDate ?? formatDate(new Date()));
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setDate(editingLog?.date ?? initialDate ?? formatDate(new Date()));
      setWeight(editingLog ? String(editingLog.weight_kg) : '');
      setNotes(editingLog?.notes ?? '');
      setError('');
      setShowDatePicker(false);
    }
  }, [visible, editingLog, initialDate]);

  function onDateChange(event: DateTimePickerChangeEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (!selected) {
      return;
    }
    setDate(toISODate(selected));
    setError('');
  }

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (!date.trim()) {
      setError('La fecha es obligatoria');
      return;
    }
    const parsed = parseFloat(weight.replace(',', '.'));
    if (!weight.trim() || isNaN(parsed) || parsed <= 0) {
      setError('Ingresa un peso válido');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave(
        {
          date: date.trim(),
          weight_kg: parsed,
          notes: notes.trim() || undefined,
        },
        editingLog?.id,
      );
      onClose();
    } catch {
      setError('Error al guardar el peso');
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
          <Text style={styles.title}>{editingLog ? 'Editar Peso' : 'Registrar Peso'}</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Fecha del registro</Text>
            <Pressable
              style={({ pressed }) => [styles.dateField, pressed ? styles.dateFieldPressed : null]}
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Seleccionar fecha del registro"
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
              <Text style={styles.dateFieldText}>{formatDisplayDate(date)}</Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </Pressable>

            {showDatePicker ? (
              <DateTimePicker
                value={new Date(`${date}T00:00:00`)}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onValueChange={onDateChange}
                onDismiss={() => setShowDatePicker(false)}
              />
            ) : null}

            <AppTextInput
              label="Peso (kg)"
              placeholder="Ej: 75.5"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
            />

            <AppTextInput
              label="Notas (opcional)"
              placeholder="Ej: Por la mañana, en ayunas"
              value={notes}
              onChangeText={setNotes}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              title={editingLog ? 'Guardar Cambios' : 'Guardar Peso'}
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
    maxHeight: '88%',
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
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '500',
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    marginBottom: 16,
  },
  dateFieldPressed: {
    opacity: 0.7,
  },
  dateFieldText: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  errorText: {
    color: colors.primary,
    fontSize: 13,
    marginBottom: 12,
  },
  saveButton: {
    marginBottom: 12,
  },
});