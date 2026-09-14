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
import type { NutritionVisionInput } from '../../services/nutritionVisionService';
import { getVisionApiKey } from '../../services/configService';
import { formatNumber } from '../../services/utils';

interface ModalEscanearComidaProps {
  visible: boolean;
  date: string;
  onClose: () => void;
  onConfirm: (meal: NewMealLog) => Promise<void>;
  onEstimate?: (input: NutritionVisionInput) => Promise<NutritionEstimate | null>;
}

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

  React.useEffect(() => {
    if (visible) {
      setMealName('');
      setCalories('');
      setMacros('');
      setPhotoUri(null);
      setError('');
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
  };

  const handleImagePicked = async (assetUri: string) => {
    setPhotoUri(assetUri);
    if (!onEstimate) return;
    setEstimating(true);
    setError('');
    try {
      const estimate = await onEstimate({ imageUri: assetUri, description: null });
      if (estimate) applyEstimate(estimate);
      else setError('No se pudo estimar. Ingresa los valores manualmente.');
    } catch {
      setError('No se pudo procesar la imagen');
    } finally {
      setEstimating(false);
    }
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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

            {onEstimate && !hasApiKey ? (
              <View style={styles.aiInfoNote}>
                <Text style={styles.aiInfoText}>
                  Estimación local aproximada. Añade tu API Key en Ajustes para mayor precisión.
                </Text>
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
    marginBottom: 16,
  },
  breakdownText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
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