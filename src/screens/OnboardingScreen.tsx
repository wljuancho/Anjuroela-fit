import { colors } from '../theme/colors';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppButton, AppTextInput } from '../components';
import { useAuth } from '../context';
import {
  validateGoal,
  MAX_WEEKLY_LOSS_KG,
  MAX_WEEKLY_GAIN_KG,
} from '../services/utils/goalValidator';

interface FormWarnings {
  weight?: string;
  targetWeight?: string;
  weeks?: string;
  goal?: string;
}

function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

export default function OnboardingScreen() {
  const { user, saveHealthProfile } = useAuth();

  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [weeks, setWeeks] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalDateLabel, setGoalDateLabel] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [warnings, setWarnings] = useState<FormWarnings>({});
  const [suggestedTarget, setSuggestedTarget] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentWeightNum = parseFloat(currentWeight);
  const targetWeightNum = parseFloat(targetWeight);
  const weeksNum = parseInt(weeks, 10);

  function handleGoalValidation() {
    const nextWarnings: FormWarnings = {};
    let nextSuggested: number | null = null;

    if (currentWeightNum > 0 && targetWeightNum > 0 && weeksNum > 0) {
      const result = validateGoal({
        currentWeightKg: currentWeightNum,
        targetWeightKg: targetWeightNum,
        weeks: weeksNum,
      });

      if (!result.isValid) {
        nextWarnings.goal = result.message;
        if (result.suggestedGoalKg) {
          nextSuggested = result.suggestedGoalKg;
          setTargetWeight(String(result.suggestedGoalKg.toFixed(1)));
        }
      }
    }

    if (currentWeightNum && currentWeightNum < 30) {
      nextWarnings.weight = 'El peso debe ser un valor razonable (mín. 30 kg).';
    }

    if (targetWeightNum && targetWeightNum < 30) {
      nextWarnings.targetWeight = 'El peso objetivo debe ser un valor razonable (mín. 30 kg).';
    }

    setWarnings(nextWarnings);
    setSuggestedTarget(nextSuggested);
  }

  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'dismissed' || !selected) {
      return;
    }

    setGoalDate(toISODate(selected));
    setGoalDateLabel(formatDisplayDate(selected));
    setErrors((prev) => ({ ...prev, goal: undefined, weeks: undefined }));
    setWarnings((prev) => ({ ...prev, goal: undefined }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(selected);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    const weeksCalc = Math.max(1, Math.round(diffDays / 7));
    setWeeks(String(weeksCalc));
  }

  function validateInputs(): boolean {
    const next: Record<string, string | undefined> = {};

    if (!currentWeightNum || currentWeightNum <= 0) {
      next.currentWeight = 'Ingresa tu peso actual.';
    }
    if (!targetWeightNum || targetWeightNum <= 0) {
      next.targetWeight = 'Ingresa tu peso objetivo.';
    }
    if (targetWeightNum === currentWeightNum && currentWeightNum > 0) {
      next.targetWeight = 'El peso objetivo debe diferir del actual.';
    }
    if (!weeksNum || weeksNum <= 0) {
      next.weeks = 'Ingresa el número de semanas.';
    } else if (weeksNum > 104) {
      next.weeks = 'El plazo máximo sugerido es de 2 años (104 semanas).';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSave() {
    if (!validateInputs()) return;

    // Re-valida la meta antes de guardar
    const result = validateGoal({
      currentWeightKg: currentWeightNum,
      targetWeightKg: targetWeightNum,
      weeks: weeksNum,
    });

    if (!result.isValid) {
      setWarnings({
        goal:
          result.message ??
          'La meta no es saludable para este plazo. Ajusta tus valores.',
      });
      if (result.suggestedGoalKg) {
        setSuggestedTarget(result.suggestedGoalKg);
        setTargetWeight(String(result.suggestedGoalKg.toFixed(1)));
      }
      return;
    }

    setSubmitting(true);
    try {
      const weeksToDate = weeksNum;
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + weeksToDate * 7);
      const dateStr = estimatedDate.toISOString().split('T')[0];

      const finalDate = goalDate.trim() || dateStr;

      await saveHealthProfile({
        currentWeight: currentWeightNum,
        targetWeight: targetWeightNum,
        goalWeeks: weeksNum,
        goalDate: finalDate,
      });

      // El RootNavigator redirige automáticamente a MainTabs
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'No se pudieron guardar los datos.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Completa tu perfil</Text>
            <Text style={styles.subtitle}>
              Hola {user?.name ?? ''}, cuéntanos sobre tu objetivo para personalizar tu plan.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <Text style={styles.infoText}>
              Cambio saludable: máx. {MAX_WEEKLY_LOSS_KG} kg/sem en pérdida o{' '}
              {MAX_WEEKLY_GAIN_KG} kg/sem en ganancia.
            </Text>
          </View>

          {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

          <AppTextInput
            label="Peso actual (kg)"
            value={currentWeight}
            onChangeText={(t) => {
              setCurrentWeight(t);
              setErrors((prev) => ({ ...prev, currentWeight: undefined }));
              setWarnings((prev) => ({ ...prev, weight: undefined }));
            }}
            placeholder="Ej: 78.5"
            keyboardType="decimal-pad"
            error={errors.currentWeight || warnings.weight}
            onBlur={handleGoalValidation}
          />

          <AppTextInput
            label="Peso objetivo (kg)"
            value={targetWeight}
            onChangeText={(t) => {
              setTargetWeight(t);
              setErrors((prev) => ({ ...prev, targetWeight: undefined }));
              setWarnings((prev) => ({ ...prev, targetWeight: undefined, goal: undefined }));
              setSuggestedTarget(null);
            }}
            placeholder="Ej: 72.0"
            keyboardType="decimal-pad"
            error={errors.targetWeight || warnings.targetWeight}
            onBlur={handleGoalValidation}
          />

          <AppTextInput
            label="Plazo (semanas)"
            value={weeks}
            onChangeText={(t) => {
              setWeeks(t);
              setErrors((prev) => ({ ...prev, weeks: undefined }));
              setWarnings((prev) => ({ ...prev, goal: undefined }));
            }}
            placeholder="Ej: 12"
            keyboardType="number-pad"
            error={errors.weeks}
            onBlur={handleGoalValidation}
          />

          <View style={styles.fieldContainer}>
            <Text style={styles.fieldLabel}>Fecha meta {goalDateLabel ? '' : '(opcional)'}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.dateField,
                errors.goal ? styles.dateFieldError : null,
                pressed ? styles.dateFieldPressed : null,
              ]}
              onPress={() => setShowDatePicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Seleccionar fecha meta"
            >
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
              <Text
                style={goalDateLabel ? styles.dateFieldText : styles.dateFieldPlaceholder}
                numberOfLines={1}
              >
                {goalDateLabel || 'Selecciona una fecha límite'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </Pressable>
            {errors.goal ? <Text style={styles.dateFieldErrorText}>{errors.goal}</Text> : null}
          </View>

          {showDatePicker ? (
            <DateTimePicker
              value={goalDate ? new Date(`${goalDate}T00:00:00`) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={new Date()}
              onChange={onDateChange}
            />
          ) : null}

          {warnings.goal ? (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color={colors.warning} />
              <Text style={styles.warningText}>{warnings.goal}</Text>
            </View>
          ) : null}

          {suggestedTarget !== null && (
            <Text style={styles.hintText}>
              Puedes guardar el objetivo sugerido o ajustar manualmente tus valores.
            </Text>
          )}

          <AppButton
            title="Guardar y comenzar"
            onPress={handleSave}
            loading={submitting}
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    color: colors.info,
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  formError: {
    color: colors.primary,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  warningText: {
    color: colors.warning,
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
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
  dateFieldError: {
    borderColor: colors.primary,
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
  dateFieldErrorText: {
    color: colors.primary,
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    marginTop: 8,
  },
});
