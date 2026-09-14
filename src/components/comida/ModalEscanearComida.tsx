import { colors } from '../../theme/colors';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import AppTextInput from '../AppTextInput';
import AppButton from '../AppButton';
import type { NewMealLog, NutritionEstimate } from '../../types/nutrition';
import type {
  CookingMethod,
  MealOrigin,
  MealTime,
  NutritionVisionInput,
  PortionSize,
} from '../../services/nutritionVisionService';
import { getVisionApiKey } from '../../services/configService';
import { formatNumber } from '../../services/utils';

interface ModalEscanearComidaProps {
  visible: boolean;
  date: string;
  onClose: () => void;
  onConfirm: (meal: NewMealLog) => Promise<void>;
  onEstimate?: (input: NutritionVisionInput) => Promise<NutritionEstimate | null>;
}

interface ChipOption<T extends string> {
  label: string;
  value: T;
}

function ChipRow<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: ChipOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, selected ? styles.chipSelected : null]}
            onPress={() => onChange(opt.value)}
            disabled={disabled}
          >
            <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const PORTION_OPTIONS: ChipOption<PortionSize>[] = [
  { label: 'Pequeña', value: 'pequena' },
  { label: 'Media', value: 'media' },
  { label: 'Grande', value: 'grande' },
];

const MEAL_TIME_OPTIONS: ChipOption<MealTime>[] = [
  { label: 'Desayuno', value: 'desayuno' },
  { label: 'Almuerzo', value: 'almuerzo' },
  { label: 'Cena', value: 'cena' },
  { label: 'Snack', value: 'snack' },
];

const ORIGIN_OPTIONS: ChipOption<MealOrigin>[] = [
  { label: 'En casa', value: 'casa' },
  { label: 'Restaurante', value: 'restaurante' },
  { label: 'Empaquetado', value: 'empaquetado' },
];

const COOKING_OPTIONS: ChipOption<CookingMethod>[] = [
  { label: 'Frito', value: 'frito' },
  { label: 'Sartén', value: 'sarten_rehogado' },
  { label: 'Air fryer', value: 'air_fryer' },
  { label: 'Plancha/Parrilla', value: 'plancha_parrilla' },
  { label: 'Horno', value: 'horno' },
  { label: 'Hervido', value: 'hervido' },
  { label: 'Vapor', value: 'vapor' },
  { label: 'Crudo', value: 'crudo' },
];

export default function ModalEscanearComida({
  visible,
  date,
  onClose,
  onConfirm,
  onEstimate,
}: ModalEscanearComidaProps) {
  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [macros, setMacros] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [error, setError] = useState('');
  const [confident, setConfident] = useState<string | null>(null);
  const [descOverride, setDescOverride] = useState('');
  const [portion, setPortion] = useState<PortionSize | null>(null);
  const [mealTime, setMealTime] = useState<MealTime | null>(null);
  const [origin, setOrigin] = useState<MealOrigin | null>(null);
  const [cookingMethod, setCookingMethod] = useState<CookingMethod | null>(null);
  const [servings, setServings] = useState(1);

  React.useEffect(() => {
    if (visible) {
      setMealName('');
      setCalories('');
      setMacros('');
      setPhotoUri(null);
      setError('');
      setConfident(null);
      setDescOverride('');
      setPortion(null);
      setMealTime(null);
      setOrigin(null);
      setCookingMethod(null);
      setServings(1);
      checkApiKey();
    }
  }, [visible]);

  const checkApiKey = async () => {
    const key = await getVisionApiKey();
    setHasApiKey(!!key);
  };

  const handleClose = () => {
    setEstimating(false);
    setSaving(false);
    onClose();
  };

  const applyEstimate = (estimate: NutritionEstimate) => {
    setMealName(estimate.mealName ?? 'Comida');
    setCalories(String(Math.round(estimate.calories)));
    setMacros(
      `Proteínas ${formatNumber(estimate.proteinG, 1)}g · Carbs ${formatNumber(estimate.carbsG)}g · Grasas ${formatNumber(estimate.fatG)}g`,
    );
    if (estimate.confidence) {
      const label =
        estimate.confidence === 'alta'
          ? 'Alta confianza: la estimación es bastante acertada.'
          : estimate.confidence === 'media'
            ? 'Confiabilidad media: el cálculo puede variar.'
            : 'Estimación aproximada: el cálculo de las porciones no fue muy preciso.';
      setConfident(label);
    } else {
      setConfident(null);
    }
  };

  const buildInput = (uri: string): NutritionVisionInput => ({
    imageUri: uri,
    description: descOverride.trim() || mealName.trim() || null,
    portionSize: portion,
    mealTime,
    origin,
    cookingMethod,
    servings: servings > 0 ? servings : 1,
  });

  const runEstimate = async (uri: string | null = photoUri) => {
    if (!onEstimate || !uri) return;
    setEstimating(true);
    setError('');
    setConfident(null);
    try {
      const estimate = await onEstimate(buildInput(uri));
      if (estimate) {
        applyEstimate(estimate);
      } else {
        setError('No se pudo estimar. Ingresa los valores manualmente.');
      }
    } catch {
      setError('No se pudo procesar la imagen');
    } finally {
      setEstimating(false);
    }
  };

  const handleImagePicked = async (assetUri: string) => {
    setPhotoUri(assetUri);
    await runEstimate(assetUri);
  };

  const pickImage = async (source: 'camera' | 'library') => {
    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          setError('Permiso de cámara denegado');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: false,
        });
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setError('Permiso de galería denegado');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: false,
        });
      }
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      await handleImagePicked(result.assets[0].uri);
    } catch {
      setError('No se pudo acceder a la imagen');
    }
  };

  const handleConfirm = async () => {
    const parsedCalories = parseFloat(calories.replace(',', '.'));
    if (!mealName.trim()) {
      setError('Escribe el nombre de la comida');
      return;
    }
    if (isNaN(parsedCalories) || parsedCalories <= 0) {
      setError('Ingresa un valor de calorías válido');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onConfirm({
        date,
        meal_name: mealName.trim(),
        calories: parsedCalories,
        photo_uri: photoUri,
      });
      handleClose();
    } catch {
      setError('Error al guardar la comida');
    } finally {
      setSaving(false);
    }
  };

  const hasAnsweredContext =
    portion != null ||
    mealTime != null ||
    origin != null ||
    cookingMethod != null ||
    descOverride.trim() !== '';

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Escanear Comida con Foto</Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.sourceRow}>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={() => pickImage('camera')}
                disabled={estimating}
              >
                <Ionicons name="camera-outline" size={24} color={colors.text} />
                <Text style={styles.sourceText}>Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sourceBtn}
                onPress={() => pickImage('library')}
                disabled={estimating}
              >
                <Ionicons name="images-outline" size={24} color={colors.text} />
                <Text style={styles.sourceText}>Galería</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Toma una foto de tu plato y la IA estimará las calorías</Text>

            {photoUri ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: photoUri }} style={styles.preview} />
                <TouchableOpacity
                  style={styles.previewRemove}
                  onPress={() => setPhotoUri(null)}
                  disabled={estimating}
                >
                  <Text style={styles.previewRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {macros ? (
              <View style={styles.breakdownCard}>
                <Ionicons name="nutrition-outline" size={18} color={colors.success} />
                <Text style={styles.breakdownText}>{macros}</Text>
              </View>
            ) : null}

            {confident ? (
              <Text style={styles.confidenceText}>{confident}</Text>
            ) : null}

            {onEstimate && !hasApiKey ? (
              <View style={styles.aiInfoNote}>
                <Text style={styles.aiInfoText}>
                  Estimación local aproximada. Añade tu API Key en Ajustes para mayor precisión.
                </Text>
              </View>
            ) : null}

            {photoUri && onEstimate ? (
              <View style={styles.contextSection}>
                <Text style={styles.contextTitle}>
                  Cuéntale más a la IA <Text style={styles.contextOptional}>(opcional)</Text>
                </Text>
                <Text style={styles.contextHint}>
                  Responder ayuda a que el conteo de calorías sea más acertado. Luego pulsa
                  &quot;Estimar de nuevo&quot;.
                </Text>

                <AppTextInput
                  label="¿Qué contiene tu plato?"
                  placeholder="Ej: pollo asado, arroz y ensalada"
                  value={descOverride}
                  onChangeText={setDescOverride}
                />

                <Text style={styles.optLabel}>Tamaño de la porción</Text>
                <ChipRow options={PORTION_OPTIONS} value={portion} onChange={setPortion} disabled={estimating} />

                <Text style={styles.optLabel}>¿Qué comida es?</Text>
                <ChipRow options={MEAL_TIME_OPTIONS} value={mealTime} onChange={setMealTime} disabled={estimating} />

                <Text style={styles.optLabel}>¿Cómo se preparó?</Text>
                <ChipRow options={ORIGIN_OPTIONS} value={origin} onChange={setOrigin} disabled={estimating} />

                <Text style={styles.optLabel}>¿Cómo se cocinó? <Text style={styles.contextOptional}>(cambia mucho las calorías)</Text></Text>
                <ChipRow options={COOKING_OPTIONS} value={cookingMethod} onChange={setCookingMethod} disabled={estimating} />

                <Text style={styles.optLabel}>Número de porciones (esta foto equivale a)</Text>
                <View style={styles.servRow}>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setServings((s) => Math.max(1, s - 1))}
                    disabled={estimating}
                  >
                    <Text style={styles.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.servValue}>{servings}</Text>
                  <TouchableOpacity
                    style={styles.stepBtn}
                    onPress={() => setServings((s) => Math.min(9, s + 1))}
                    disabled={estimating}
                  >
                    <Text style={styles.stepBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <AppButton
                  title={hasAnsweredContext ? 'Estimar de nuevo' : 'Estimar con IA'}
                  onPress={() => runEstimate()}
                  loading={estimating}
                  style={styles.estimateButton}
                />
              </View>
            ) : null}

            <AppTextInput
              label="Nombre de la comida"
              placeholder="Ej: Pechuga con arroz"
              value={mealName}
              onChangeText={setMealName}
            />

            <AppTextInput
              label="Calorías (kcal)"
              placeholder="Ej: 350"
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              title="Confirmar registro"
              onPress={handleConfirm}
              loading={saving}
              style={styles.saveButton}
            />

            <AppButton title="Cancelar" variant="outline" onPress={handleClose} />
          </ScrollView>

          {estimating ? (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingCard}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Analizando platillo con IA...</Text>
              </View>
            </View>
          ) : null}
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
    maxHeight: '90%',
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
  sourceRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  sourceBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 6,
  },
  sourceText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 14,
    textAlign: 'center',
  },
  previewWrap: {
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 16,
  },
  preview: {
    width: 160,
    height: 160,
    borderRadius: 14,
  },
  previewRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRemoveText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  breakdownCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  breakdownText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  confidenceText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 14,
    textAlign: 'center',
  },
  aiInfoNote: {
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  aiInfoText: {
    color: colors.primary,
    fontSize: 13,
    lineHeight: 18,
  },
  contextSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 16,
    marginBottom: 8,
  },
  contextTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  contextOptional: {
    color: colors.textMuted,
    fontWeight: '500',
    fontSize: 13,
  },
  contextHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 14,
  },
  optLabel: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    backgroundColor: colors.card,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: colors.primary,
  },
  servRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  servValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'center',
  },
  estimateButton: {
    marginBottom: 4,
  },
  errorText: {
    color: colors.primary,
    fontSize: 13,
    marginBottom: 12,
  },
  saveButton: {
    marginBottom: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrimStrong,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});