import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setDate(editingLog?.date ?? initialDate ?? formatDate(new Date()));
      setWeight(editingLog ? String(editingLog.weight_kg) : '');
      setNotes(editingLog?.notes ?? '');
      setError('');
    }
  }, [visible, editingLog, initialDate]);

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (!date.trim()) {
      setError('La fecha es obligatoria (YYYY-MM-DD)');
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

          <ScrollView showsVerticalScrollIndicator={false}>
            <AppTextInput
              label="Fecha (YYYY-MM-DD)"
              placeholder="2026-09-09"
              value={date}
              onChangeText={setDate}
              autoCapitalize="none"
            />

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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#2a2a4a',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  errorText: {
    color: '#e94560',
    fontSize: 13,
    marginBottom: 12,
  },
  saveButton: {
    marginBottom: 12,
  },
});