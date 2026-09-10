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
import AppTextInput from '../AppTextInput';
import AppButton from '../AppButton';
import type { MealRecord, MealType, NewMeal, NutritionEstimate } from '../../types/meal';
import type { NutritionVisionInput } from '../../services/nutritionVisionService';
import { getVisionApiKey } from '../../services/configService';

interface ModalAgregarComidaProps {
  visible: boolean;
  userId: number;
  date: string;
  editingMeal?: MealRecord | null;
  onClose: () => void;
  onSave: (data: NewMeal, id?: number) => Promise<void>;
  onEstimate?: (input: NutritionVisionInput) => Promise<NutritionEstimate | null>;
}

const MEAL_TYPES: MealType[] = ['desayuno', 'almuerzo', 'cena', 'snack'];
const MEAL_TYPE_LABELS: Record<MealType, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  cena: 'Cena',
  snack: 'Snack',
};

export default function ModalAgregarComida({
  visible,
  userId,
  date,
  editingMeal,
  onClose,
  onSave,
  onEstimate,
}: ModalAgregarComidaProps) {
  const [mealType, setMealType] = useState<MealType>('desayuno');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [proteinG, setProteinG] = useState('');
  const [carbsG, setCarbsG] = useState('');
  const [fatG, setFatG] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (visible) {
      setMealType(editingMeal?.meal_type ?? 'desayuno');
      setImageUri(editingMeal?.image_uri ?? null);
      setDescription(editingMeal?.description ?? '');
      setCalories(editingMeal ? String(editingMeal.calories) : '');
      setProteinG(editingMeal ? String(editingMeal.protein_g) : '');
      setCarbsG(editingMeal ? String(editingMeal.carbs_g) : '');
      setFatG(editingMeal ? String(editingMeal.fat_g) : '');
      setNotes(editingMeal?.notes ?? '');
      setError('');
      checkApiKey();
    }
  }, [visible, editingMeal]);

  const checkApiKey = async () => {
    const key = await getVisionApiKey();
    setHasApiKey(!!key);
  };

  const resetForm = () => {
    setMealType('desayuno');
    setImageUri(null);
    setDescription('');
    setCalories('');
    setProteinG('');
    setCarbsG('');
    setFatG('');
    setNotes('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const applyEstimate = (estimate: NutritionEstimate) => {
    setCalories(String(estimate.calories));
    setProteinG(String(estimate.proteinG));
    setCarbsG(String(estimate.carbsG));
    setFatG(String(estimate.fatG));
    if (estimate.mealName || estimate.description) {
      const aiDesc = [estimate.mealName, estimate.description]
        .filter(Boolean)
        .join(': ');
      setDescription(aiDesc);
    }
  };

  const pickImage = async (source: 'camera' | 'library') => {
    if (!onEstimate) return;
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
          quality: 0.7,
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
          quality: 0.7,
          allowsEditing: false,
        });
      }
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setEstimating(true);
      setError('');
      try {
        const estimate = await onEstimate({ imageUri: asset.uri, description: description.trim() || null });
        if (estimate) applyEstimate(estimate);
      } finally {
        setEstimating(false);
      }
    } catch {
      setError('No se pudo procesar la imagen');
    }
  };

  const handleEstimateFromDescription = async () => {
    if (!onEstimate) return;
    if (!description.trim()) {
      setError('Escribe una descripción de la comida para estimar');
      return;
    }
    setEstimating(true);
    setError('');
    try {
      const estimate = await onEstimate({ imageUri: imageUri, description: description.trim() });
      if (estimate) applyEstimate(estimate);
    } catch {
      setError('No se pudo estimar la información nutricional');
    } finally {
      setEstimating(false);
    }
  };

  const handleSave = async () => {
    const parsedCalories = parseFloat(calories.replace(',', '.'));
    if (!mealType || isNaN(parsedCalories) || parsedCalories < 0) {
      setError('Ingresa un valor de calorías válido');
      return;
    }
    const parseMacro = (value: string) => {
      const parsed = parseFloat(value.replace(',', '.'));
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    };
    setError('');
    setSaving(true);
    try {
      await onSave(
        {
          user_id: userId,
          date,
          meal_type: mealType,
          image_uri: imageUri,
          description: description.trim() || undefined,
          calories: parsedCalories,
          protein_g: parseMacro(proteinG),
          carbs_g: parseMacro(carbsG),
          fat_g: parseMacro(fatG),
          notes: notes.trim() || undefined,
        },
        editingMeal?.id,
      );
      handleClose();
    } catch {
      setError('Error al guardar la comida');
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
          <Text style={styles.title}>{editingMeal ? 'Editar Comida' : 'Registrar Comida'}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Tipo de comida</Text>
            <View style={styles.chipsContainer}>
              {MEAL_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.chip, mealType === type ? styles.chipActive : null]}
                  onPress={() => setMealType(type)}
                >
                  <Text style={[styles.chipText, mealType === type ? styles.chipTextActive : null]}>
                    {MEAL_TYPE_LABELS[type]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Foto de la comida (opcional)</Text>
            <View style={styles.photoRow}>
              {imageUri ? (
                <View style={styles.photoPreviewWrap}>
                  <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => setImageUri(null)}
                  >
                    <Text style={styles.photoRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {onEstimate ? (
                <>
                  <AppButton
                    title="Cámara"
                    variant="outline"
                    onPress={() => pickImage('camera')}
                    style={styles.photoButton}
                  />
                  <AppButton
                    title="Galería"
                    variant="outline"
                    onPress={() => pickImage('library')}
                    style={styles.photoButton}
                  />
                </>
              ) : null}
            </View>

            <AppTextInput
              label="Descripción (opcional)"
              placeholder="Ej: Pechuga a la plancha con arroz"
              value={description}
              onChangeText={setDescription}
            />

            {onEstimate ? (
              <AppButton
                title={estimating ? 'Analizando...' : 'Estimar con IA'}
                variant="secondary"
                onPress={handleEstimateFromDescription}
                disabled={estimating}
                style={styles.estimateButton}
              />
            ) : null}

            {onEstimate && !hasApiKey ? (
              <View style={styles.aiInfoNote}>
                <Text style={styles.aiInfoText}>
                  Añade tu API Key en Ajustes para activar el reconocimiento
                  inteligente por foto. Mientras tanto se usa la estimación local.
                </Text>
              </View>
            ) : null}

            <AppTextInput
              label="Calorías (kcal)*"
              placeholder="Ej: 350"
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
            />

            <View style={styles.macroRow}>
              <View style={styles.macroInput}>
                <AppTextInput
                  label="Proteína (g)"
                  placeholder="0"
                  value={proteinG}
                  onChangeText={setProteinG}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.macroInput}>
                <AppTextInput
                  label="Carbs (g)"
                  placeholder="0"
                  value={carbsG}
                  onChangeText={setCarbsG}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.macroInput}>
                <AppTextInput
                  label="Grasas (g)"
                  placeholder="0"
                  value={fatG}
                  onChangeText={setFatG}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <AppTextInput
              label="Notas (opcional)"
              placeholder="Ej: Comida ligera"
              value={notes}
              onChangeText={setNotes}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <AppButton
              title={editingMeal ? 'Guardar Cambios' : 'Guardar Comida'}
              onPress={handleSave}
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
    marginBottom: 20,
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  chipTextActive: {
    color: colors.text,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  photoPreviewWrap: {
    position: 'relative',
  },
  photoPreview: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  photoButton: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 12,
  },
  estimateButton: {
    marginBottom: 16,
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
  macroRow: {
    flexDirection: 'row',
    gap: 10,
  },
  macroInput: {
    flex: 1,
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