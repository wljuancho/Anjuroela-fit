/* eslint-disable react-hooks/set-state-in-effect -- Intentional lifecycle sync: these effects reset form/timer state when their visibility or input props change. */
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
import type {
  ActivityLevel,
  NutritionGoalType,
  NutritionProfileInput,
  SexForFormula,
} from '../../types/nutrition';
import { formatNumber } from '../../services/utils';
import { validateCalorieGoal, MIN_DAILY_CALORIES_GOAL, MAX_DAILY_CALORIES_GOAL, MIN_NUTRITION_GOAL_AGE } from '../../services/utils/nutritionSafety';

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
    sexForFormula?: SexForFormula;
  };
  onClose: () => void;
  onSave: (profile: NutritionProfileInput) => Promise<void>;
}

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'sedentario', label: 'Sedentario', hint: 'Poco o nada de ejercicio', icon: 'bed-outline' },
  { value: 'ligero', label: 'Ligero', hint: 'Ejercicio ligero 1-3 dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as/semana', icon: 'footsteps-outline' },
  { value: 'moderado', label: 'Moderado', hint: 'Ejercicio 3-5 dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as/semana', icon: 'walk-outline' },
  { value: 'activo', label: 'Activo', hint: 'Entrenamiento intenso frecuente', icon: 'barbell-outline' },
];

const GOAL_OPTIONS: { value: NutritionGoalType; label: string; hint: string }[] = [
  { value: 'perder', label: 'DÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ficit calÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rico', hint: 'Perder grasa ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· resta kcal' },
  { value: 'mantener', label: 'Mantenimiento', hint: 'Conservar peso ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· TDEE exacto' },
  { value: 'ganar', label: 'SuperÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡vit calÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rico', hint: 'Aumentar masa ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· suma kcal' },
  { value: 'libre', label: 'Libre / Sin objetivo', hint: 'Contar calorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as sin dÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©ficit forzado' },
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
  // La edad debe ser adulta y valida para mostrar y guardar la estimacion.

  const effectiveAge = ageNum;
  const canPreview = Number.isFinite(ageNum) && ageNum >= 18 && ageNum <= 100 && heightNum >= 120 && heightNum <= 250 && activity !== null && goalType !== null;
  const previewGoal = useMemo(() => {
    if (!canPreview) return null;
    const base = calculateTDEE({
      age: effectiveAge,
      weightKg,
      heightCm: heightNum,
      activityLevel: activity!,
      goalType: goalType!,
      sexForFormula: prefill?.sexForFormula,
    });
    if (goalType === 'libre' && manualGoalNum > 0) return manualGoalNum;
    return base;
  }, [canPreview, effectiveAge, weightKg, heightNum, activity, goalType, manualGoalNum, prefill?.sexForFormula]);

  const previewSafetyError = previewGoal == null ? null : validateCalorieGoal({
    calories: previewGoal,
    age: effectiveAge,
    heightCm: heightNum,
    weightKg,
    goalType: goalType ?? 'mantener',
  });

  const handleSave = async () => {
    if (!heightNum || heightNum < 120 || heightNum > 250) {
      setError('Ingresa tu estatura en centímetros (entre 120 y 250 cm)');
      return;
    }
    if (!activity) {
      setError('Selecciona tu nivel de actividad');
      return;
    }
    if (!goalType) {
      setError('Selecciona tu estrategia calÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rica');
      return;
    }
    if (!Number.isFinite(ageNum) || ageNum < MIN_NUTRITION_GOAL_AGE || ageNum > 100) {
      setError('Ingresa una edad vÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida entre 18 y 100 aÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â±os para definir una meta nutricional.');
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
        sexForFormula: prefill?.sexForFormula,
      });
      const dailyCaloriesGoal = goalType === 'libre' && manualGoalNum > 0 ? manualGoalNum : baseTdee;
      const safetyError = validateCalorieGoal({
        calories: dailyCaloriesGoal,
        age: effectiveAge,
        heightCm: heightNum,
        weightKg,
        goalType,
      });
      if (safetyError) {
        setError(safetyError);
        return;
      }
      await onSave({
        dailyCaloriesGoal,
        activityLevel: activity,
        goalType,
        age: ageNum,
        heightCm: heightNum,
      });
      onClose();
    } catch {
      setError('No se pudo guardar la meta de calorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as');
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
          <Text style={styles.title}>Contador de CalorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as Inteligente</Text>
          <Text style={styles.subtitle}>
            Responde brevemente e ingresaremos tu altura para calcular tu meta diaria de calorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as
            (TDEE).
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <AppTextInput
              label="Edad (obligatoria, 18+)"
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
                  Dejala vacia para usar el mantenimiento estimado. Rango manual: {MIN_DAILY_CALORIES_GOAL}-{MAX_DAILY_CALORIES_GOAL} kcal. Limite preventivo de la app; no es recomendacion medica.
                </Text>
              </View>
            ) : null}

            {previewGoal !== null && !previewSafetyError ? (
              <View style={styles.previewCard}>
                <Ionicons name="flame-outline" size={20} color={colors.warning} />
                <View style={styles.previewInfo}>
                  <Text style={styles.previewLabel}>Tu meta diaria estimada</Text>
                  <Text style={styles.previewValue}>{formatNumber(previewGoal)} kcal</Text>
                </View>
              </View>
            ) : null}

            {previewSafetyError ? (
              <Text style={styles.errorText}>{previewSafetyError}</Text>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              title="Guardar meta de calorÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­as"
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
