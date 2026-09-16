import { colors } from '../../theme/colors';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppTextInput from '../AppTextInput';
import AppButton from '../AppButton';
import { calculateTDEE } from '../../services/nutritionService';
import type { ActivityLevel, NutritionGoalType, NutritionProfileInput } from '../../types/nutrition';
import { formatNumber } from '../../services/utils';

interface ModalOnboardingNutricionalProps {
  visible: boolean;
  weightKg: number;
  heightCm?: number;
  prefill?: {
    age?: number;
    heightCm?: number;
    activityLevel?: ActivityLevel;
    goalType?: NutritionGoalType;
    dailyCaloriesGoal?: number;
  };
  onClose: () => void;
  onSave: (profile: NutritionProfileInput) => Promise<void>;
}

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'sedentario', label: 'Sedentario', hint: 'Poco o nada de ejercicio', icon: 'bed-outline' },
  { value: 'moderado', label: 'Moderado', hint: 'Ejercicio 3-5 días/semana', icon: 'walk-outline' },
  { value: 'activo', label: 'Activo', hint: 'Entrenamiento intenso frecuente', icon: 'barbell-outline' },
];

const GOAL_OPTIONS: { value: NutritionGoalType; label: string; hint: string }[] = [
  { value: 'perder', label: 'Déficit calórico', hint: 'Perder grasa · resta kcal' },
  { value: 'mantener', label: 'Mantenimiento', hint: 'Conservar peso · TDEE exacto' },
  { value: 'ganar', label: 'Superávit calórico', hint: 'Aumentar masa · suma kcal' },
  { value: 'libre', label: 'Libre / Sin objetivo', hint: 'Contar calorías sin déficit forzado' },
];

export default function ModalOnboardingNutricional({
  visible,
  weightKg,
  heightCm,
  prefill,
  onClose,
  onSave,
}: ModalOnboardingNutricionalProps) {
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [goalType, setGoalType] = useState<NutritionGoalType | null>(null);
  const [manualGoal, setManualGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setAge(prefill?.age != null && prefill.age > 0 ? String(prefill.age) : '');
      setHeight(
        prefill?.heightCm && prefill.heightCm > 0
          ? String(Math.round(prefill.heightCm))
          : heightCm && heightCm > 0
            ? String(Math.round(heightCm))
            : '',
      );
      setActivity(prefill?.activityLevel ?? null);
      setGoalType(prefill?.goalType ?? null);
      setManualGoal(prefill?.goalType === 'libre' && prefill?.dailyCaloriesGoal != null ? String(prefill.dailyCaloriesGoal) : '');
      setError('');
    }
  }, [visible, heightCm, prefill]);

  const ageNum = parseInt(age, 10);
  const heightNum = parseFloat(height.replace(',', '.')) || 0;
  const manualGoalNum =
    goalType === 'libre' && manualGoal.trim() !== '' ? parseFloat(manualGoal.replace(',', '.')) || 0 : 0;
  // La edad es OPCIONAL: si no se ha ingresado (o no es válida) se usa 30 años
  // como valor por defecto para la estimación, sin bloquear el guardado.
  const effectiveAge = ageNum >= 10 && ageNum <= 120 ? ageNum : 30;
  const canPreview = heightNum >= 100 && heightNum <= 250 && activity !== null && goalType !== null;
  const previewGoal = useMemo(() => {
    if (!canPreview) return null;
    const base = calculateTDEE({
      age: effectiveAge,
      weightKg,
      heightCm: heightNum,
      activityLevel: activity!,
      goalType: goalType!,
    });
    if (goalType === 'libre' && manualGoalNum > 0) return manualGoalNum;
    return base;
  }, [canPreview, effectiveAge, weightKg, heightNum, activity, goalType, manualGoalNum]);

  const handleSave = async () => {
    if (!heightNum || heightNum < 100 || heightNum > 250) {
      setError('Ingresa tu altura en centímetros (entre 100 y 250 cm)');
      return;
    }
    if (!activity) {
      setError('Selecciona tu nivel de actividad');
      return;
    }
    if (!goalType) {
      setError('Selecciona tu estrategia calórica');
      return;
    }
    if (goalType === 'libre' && manualGoal.trim() !== '' && (!manualGoalNum || manualGoalNum < 500 || manualGoalNum > 8000)) {
      setError('Ingresa una meta diaria manual válida (entre 500 y 8000 kcal)');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const baseTdee = calculateTDEE({
        age: effectiveAge,
        weightKg,
        heightCm: heightNum,
        activityLevel: activity,
        goalType,
      });
      await onSave({
        dailyCaloriesGoal: goalType === 'libre' && manualGoalNum > 0 ? manualGoalNum : baseTdee,
        activityLevel: activity,
        goalType,
        age: ageNum >= 10 && ageNum <= 120 ? ageNum : undefined,
        heightCm: heightNum,
      });
      onClose();
    } catch {
      setError('No se pudo guardar la meta de calorías');
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
          <Text style={styles.title}>Contador de Calorías Inteligente</Text>
          <Text style={styles.subtitle}>
            Responde brevemente e ingresaremos tu altura para calcular tu meta diaria de calorías
            (TDEE).
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <AppTextInput
              label="Edad (opcional)"
              placeholder="Ej: 30"
              value={age}
              onChangeText={(t) => {
                setAge(t);
                setError('');
              }}
              keyboardType="number-pad"
            />

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

            <Text style={styles.label}>Nivel de actividad</Text>
            <View style={styles.optionsWrap}>
              {ACTIVITY_OPTIONS.map((option) => {
                const selected = activity === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, selected ? styles.optionActive : null]}
                    onPress={() => setActivity(option.value)}
                  >
                    <Ionicons
                      name={option.icon}
                      size={20}
                      color={selected ? colors.text : colors.textMuted}
                    />
                    <View style={styles.optionInfo}>
                      <Text style={[styles.optionLabel, selected ? styles.optionLabelActive : null]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionHint}>{option.hint}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.label}>Objetivo</Text>
            <View style={styles.optionsWrap}>
              {GOAL_OPTIONS.map((option) => {
                const selected = goalType === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.option, selected ? styles.optionActive : null]}
                    onPress={() => setGoalType(option.value)}
                  >
                    <View style={styles.optionInfo}>
                      <Text style={[styles.optionLabel, selected ? styles.optionLabelActive : null]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionHint}>{option.hint}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {goalType === 'libre' ? (
              <View style={styles.manualGoalWrap}>
                <AppTextInput
                  label="Meta diaria manual (opcional)"
                  placeholder="Ej: 2000"
                  value={manualGoal}
                  onChangeText={(t) => {
                    setManualGoal(t);
                    setError('');
                  }}
                  keyboardType="number-pad"
                />
                <Text style={styles.manualHint}>
                  Déjala vacía para usar tu mantenimiento calculado (TDEE sin déficit).
                </Text>
              </View>
            ) : null}

            {previewGoal !== null ? (
              <View style={styles.previewCard}>
                <Ionicons name="flame-outline" size={20} color={colors.warning} />
                <View style={styles.previewInfo}>
                  <Text style={styles.previewLabel}>Tu meta diaria estimada</Text>
                  <Text style={styles.previewValue}>{formatNumber(previewGoal)} kcal</Text>
                </View>
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              title="Guardar meta de calorías"
              onPress={handleSave}
              loading={saving}
              style={styles.saveButton}
            />
            <AppButton title="Cancelar" variant="outline" onPress={handleClose} />
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
    marginBottom: 6,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  optionsWrap: {
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  optionLabelActive: {
    color: colors.text,
  },
  optionHint: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 2,
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
  manualGoalWrap: {
    marginBottom: 16,
  },
  manualHint: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
  previewInfo: {
    flex: 1,
  },
  previewLabel: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  previewValue: {
    color: colors.text,
    fontSize: 20,
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