import { colors } from '../../theme/colors';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppTextInput from '../AppTextInput';
import AppButton from '../AppButton';
import { calculateBMI, classifyBMI, formatNumber } from '../../services/utils';

interface ModalEditarEstadoFisicoProps {
  visible: boolean;
  initialAge?: number | null;
  initialHeightCm?: number | null;
  initialWeightKg?: number | null;
  onClose: () => void;
  onSave: (data: { age: string; heightCm: string; weightKg: string }) => Promise<void>;
}

export default function ModalEditarEstadoFisico({
  visible,
  initialAge,
  initialHeightCm,
  initialWeightKg,
  onClose,
  onSave,
}: ModalEditarEstadoFisicoProps) {
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setAge(initialAge && initialAge > 0 ? String(initialAge) : '');
      setHeight(
        initialHeightCm && initialHeightCm > 0 ? String(Math.round(initialHeightCm)) : '',
      );
      setWeight(initialWeightKg && initialWeightKg > 0 ? String(initialWeightKg) : '');
      setError('');
      setSaving(false);
    }
  }, [visible, initialAge, initialHeightCm, initialWeightKg]);

  const ageNum = parseInt(age, 10) || 0;
  const heightNum = parseFloat(height.replace(',', '.')) || 0;
  const weightNum = parseFloat(weight.replace(',', '.')) || 0;
  const preview = useMemo(() => {
    if (!heightNum || !weightNum || heightNum < 100 || heightNum > 250 || weightNum < 40 || weightNum > 300) {
      return null;
    }
    const value = calculateBMI(weightNum, heightNum);
    if (value <= 0) return null;
    return { value, category: classifyBMI(value) };
  }, [heightNum, weightNum]);

  const handleSave = async () => {
    if (age.trim() !== '' && (!ageNum || ageNum < 10 || ageNum > 120)) {
      setError('Ingresa una edad válida (entre 10 y 120 años)');
      return;
    }
    if (height.trim() !== '' && (!heightNum || heightNum < 100 || heightNum > 250)) {
      setError('Ingresa una altura válida (entre 100 y 250 cm)');
      return;
    }
    if (weight.trim() !== '' && (!weightNum || weightNum < 40 || weightNum > 300)) {
      setError('Ingresa un peso válido (entre 40 y 300 kg)');
      return;
    }
    if (age.trim() === '' && height.trim() === '' && weight.trim() === '') {
      setError('Edita al menos uno de tus datos (edad, altura o peso)');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave({ age: age.trim(), heightCm: height.trim(), weightKg: weight.trim() });
      onClose();
    } catch {
      setError('No se pudieron guardar tus datos físicos');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setSaving(false);
    onClose();
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
          <Text style={styles.title}>Datos físicos</Text>
          <Text style={styles.subtitle}>
            Ajusta tu edad, altura y peso actual para recalcular tu IMC al instante.
          </Text>

          <AppTextInput
            label="Edad"
            placeholder="Ej: 30"
            value={age}
            onChangeText={(t) => {
              setAge(t);
              setError('');
            }}
            keyboardType="number-pad"
          />

          <View style={styles.row}>
            <View style={styles.field}>
              <AppTextInput
                label="Altura (cm)"
                placeholder="Ej: 175"
                value={height}
                onChangeText={(t) => {
                  setHeight(t);
                  setError('');
                }}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.field}>
              <AppTextInput
                label="Peso (kg)"
                placeholder="Ej: 70"
                value={weight}
                onChangeText={(t) => {
                  setWeight(t);
                  setError('');
                }}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {preview ? (
            <View
              style={[
                styles.previewCard,
                preview.category === 'Normal' ? styles.previewNormal : null,
              ]}
            >
              <Ionicons name="body-outline" size={22} color={colors.primary} />
              <View style={styles.previewInfo}>
                <Text style={styles.previewLabel}>IMC calculado</Text>
                <Text style={styles.previewValue}>
                  {formatNumber(preview.value, 1)} · {preview.category}
                </Text>
              </View>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <AppButton title="Guardar" onPress={handleSave} loading={saving} style={styles.saveButton} />
          <AppButton title="Cancelar" variant="outline" onPress={handleClose} />
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
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  field: {
    flex: 1,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.warningSoft,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  previewNormal: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  previewInfo: {
    flex: 1,
  },
  previewLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  previewValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
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