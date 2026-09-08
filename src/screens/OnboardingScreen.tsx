import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
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

export default function OnboardingScreen() {
  const { user, saveHealthProfile } = useAuth();

  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [weeks, setWeeks] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  function validateInputs(): boolean {
    const next: Record<string, string> = {};

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
            <Ionicons name="information-circle" size={18} color="#e94560" />
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

          <AppTextInput
            label="Fecha meta (opcional, YYYY-MM-DD)"
            value={goalDate}
            onChangeText={setGoalDate}
            placeholder="Ej: 2026-12-31"
            autoCapitalize="none"
          />

          {warnings.goal ? (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={20} color="#ffd166" />
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
    backgroundColor: '#1a1a2e',
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
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    color: '#a0a0b8',
    fontSize: 15,
    textAlign: 'center',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    color: '#e0e0f0',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  formError: {
    color: '#e94560',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 209, 102, 0.1)',
    borderColor: '#ffd166',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  warningText: {
    color: '#ffd166',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  hintText: {
    color: '#a0a0b8',
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 8,
  },
});
