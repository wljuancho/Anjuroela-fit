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
import type { NuevoMetaData } from '../../services/progressService';
import { formatNumber } from '../../services/utils';

interface ModalEstablecerNuevaMetaProps {
  visible: boolean;
  currentWeight: number | null;
  targetWeight?: number | null;
  onClose: () => void;
  onSave: (data: NuevoMetaData) => Promise<void>;
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

function computeGoalWeeks(goalDate: string): number {
  const target = new Date(`${goalDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  return Math.max(1, Math.round(diffDays / 7));
}

export default function ModalEstablecerNuevaMeta({
  visible,
  currentWeight,
  targetWeight,
  onClose,
  onSave,
}: ModalEstablecerNuevaMetaProps) {
  const [target, setTarget] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setTarget(targetWeight ? String(targetWeight) : '');
      setGoalDate('');
      setError('');
      setShowDatePicker(false);
    }
  }, [visible, targetWeight]);

  function onDateChange(event: DateTimePickerChangeEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (!selected) {
      return;
    }
    setGoalDate(toISODate(selected));
    setError('');
  }

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    if (currentWeight === null) {
      setError('Registra tu peso actual antes de definir una nueva meta.');
      return;
    }
    const parsed = parseFloat(target.replace(',', '.'));
    if (!target.trim() || isNaN(parsed) || parsed <= 0) {
      setError('Ingresa un peso objetivo válido.');
      return;
    }
    if (parsed < 30) {
      setError('El peso objetivo debe ser un valor razonable (mín. 30 kg).');
      return;
    }
    if (Math.abs(parsed - currentWeight) < 0.05) {
      setError('El peso objetivo debe diferir de tu peso actual.');
      return;
    }

    const dateStr = goalDate || toISODate(new Date());
    setError('');
    setSaving(true);
    try {
      await onSave({
        initialWeight: Math.round(currentWeight * 10) / 10,
        targetWeight: Math.round(parsed * 10) / 10,
        goalWeeks: computeGoalWeeks(dateStr),
        goalDate: dateStr,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la nueva meta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior="padding"
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Establecer Nueva Meta</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {currentWeight !== null ? (
              <View style={styles.infoCard}>
                <Ionicons name="information-circle" size={18} color={colors.info} />
                <Text style={styles.infoText}>
                  Nuevo Peso Inicial: <Text style={styles.infoStrong}>{formatNumber(currentWeight, 1)} kg</Text>.
                  La barra de progreso se reiniciará desde 0%.
                </Text>
              </View>
            ) : null}

            <AppTextInput
              label="Nuevo Peso Objetivo (kg)"
              placeholder="Ej: 72.0"
              value={target}
              onChangeText={(t) => {
                setTarget(t);
                setError('');
              }}
              keyboardType="decimal-pad"
            />

            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Nueva Fecha Meta</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.dateField,
                  pressed ? styles.dateFieldPressed : null,
                ]}
                onPress={() => setShowDatePicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Seleccionar fecha meta"
              >
                <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                <Text
                  style={goalDate ? styles.dateFieldText : styles.dateFieldPlaceholder}
                  numberOfLines={1}
                >
                  {goalDate ? formatDisplayDate(goalDate) : 'Selecciona una fecha (por defecto hoy)'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            {showDatePicker ? (
              <DateTimePicker
                value={goalDate ? new Date(`${goalDate}T00:00:00`) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                onValueChange={onDateChange}
                onDismiss={() => setShowDatePicker(false)}
              />
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              title="Guardar Nueva Meta"
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
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
  infoStrong: {
    color: colors.text,
    fontWeight: '700',
  },
  fieldContainer: {
    marginBottom: 16,
    width: '100%',
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
  },
  dateFieldPressed: {
    opacity: 0.7,
  },
  dateFieldText: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
  },
  dateFieldPlaceholder: {
    flex: 1,
    color: colors.textSubtle,
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