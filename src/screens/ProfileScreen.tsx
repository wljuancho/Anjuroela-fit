import { colors } from '../theme/colors';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AppButton, AppTextInput } from '../components';
import { useAuth } from '../context';
import type { AuthUser, UserProfile } from '../context/AuthContext';
import type { GenderValue } from '../services/authService';
import type { RootStackParamList } from '../navigation/types';

interface ProfileField {
  key: keyof ProfileCheckItem;
  label: string;
  value?: string | number | null;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ProfileCheckItem {
  gender?: string;
  age?: number;
  heightCm?: number;
  currentWeight?: number;
  targetWeight?: number;
  goalWeeks?: number;
  goalDate?: string;
}

function isGender(value: string | undefined | null): value is GenderValue {
  return value === 'mujer' || value === 'hombre';
}

const GENDER_OPTIONS: { value: GenderValue; label: string; icon: 'female' | 'male' }[] = [
  { value: 'mujer', label: 'Mujer', icon: 'female' },
  { value: 'hombre', label: 'Hombre', icon: 'male' },
];

function toISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Firma que identifica el estado del perfil: al cambiar (p. ej. al guardar o
// tras editar datos desde otra pantalla), el formulario se reconstruye con los
// valores frescos sin necesidad de un effect que resincronice estado local.
function profileSignature(user: AuthUser | null, profile: UserProfile | null): string {
  return JSON.stringify({
    name: user?.name ?? null,
    gender: isGender(profile?.gender) ? profile.gender : null,
    age: profile?.age ?? null,
    heightCm: profile?.heightCm ?? null,
    currentWeight: profile?.currentWeight ?? null,
    targetWeight: profile?.targetWeight ?? null,
    goalWeeks: profile?.goalWeeks ?? null,
    goalDate: profile?.goalDate ?? null,
  });
}

function ProfileForm({ user, profile }: { user: AuthUser | null; profile: UserProfile | null }) {
  const { updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [gender, setGender] = useState<GenderValue | null>(
    isGender(profile?.gender) ? profile.gender : null,
  );
  const [age, setAge] = useState(
    profile?.age != null && profile.age > 0 ? String(profile.age) : '',
  );
  const [heightCm, setHeightCm] = useState(
    profile?.heightCm != null && profile.heightCm > 0
      ? String(Math.round(profile.heightCm))
      : '',
  );
  const [currentWeight, setCurrentWeight] = useState(
    profile?.currentWeight != null && profile.currentWeight > 0
      ? String(profile.currentWeight)
      : '',
  );
  const [targetWeight, setTargetWeight] = useState(
    profile?.targetWeight != null && profile.targetWeight > 0
      ? String(profile.targetWeight)
      : '',
  );
  const [goalWeeks, setGoalWeeks] = useState(
    profile?.goalWeeks != null && profile.goalWeeks > 0 ? String(profile.goalWeeks) : '',
  );
  const [goalDate, setGoalDate] = useState(profile?.goalDate ? profile.goalDate : '');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);

  function parseNumber(raw: string): number | null {
    const normalized = raw.replace(',', '.');
    const value = parseFloat(normalized);
    return Number.isFinite(value) ? value : null;
  }

  function isValidISODate(raw: string): boolean {
    const match = /^\d{4}-\d{2}-\d{2}$/.exec(raw.trim());
    if (!match) return false;
    const parsed = new Date(`${raw.trim()}T00:00:00`);
    return !Number.isNaN(parsed.getTime()) && toISO(parsed) === raw.trim();
  }

  async function handleSave() {
    const next: Record<string, string | undefined> = {};

    const ageNum = age.trim() ? parseNumber(age) : null;
    if (age.trim() && (ageNum === null || ageNum < 10 || ageNum > 120)) {
      next.age = 'Ingresa una edad válida (10-120).';
    }
    const heightNum = heightCm.trim() ? parseNumber(heightCm) : null;
    if (heightCm.trim() && (heightNum === null || heightNum < 100 || heightNum > 250)) {
      next.heightCm = 'Ingresa una altura válida en cm (100-250).';
    }
    const currentNum = currentWeight.trim() ? parseNumber(currentWeight) : null;
    if (currentWeight.trim() && (currentNum === null || currentNum < 30 || currentNum > 400)) {
      next.currentWeight = 'Ingresa un peso válido en kg (30-400).';
    }
    const targetNum = targetWeight.trim() ? parseNumber(targetWeight) : null;
    if (targetWeight.trim() && (targetNum === null || targetNum < 30 || targetNum > 400)) {
      next.targetWeight = 'Ingresa un peso válido en kg (30-400).';
    }
    const weeksNum = goalWeeks.trim() ? parseInt(goalWeeks, 10) : null;
    if (goalWeeks.trim() && (weeksNum === null || weeksNum <= 0 || weeksNum > 104)) {
      next.goalWeeks = 'Ingresa un plazo válido en semanas (1-104).';
    }
    if (goalDate.trim() && !isValidISODate(goalDate)) {
      next.goalDate = 'Usa el formato AAAA-MM-DD (p. ej. 2026-12-31).';
    }
    if (targetNum !== null && currentNum !== null && Math.abs(targetNum - currentNum) < 0.01) {
      next.targetWeight = 'El peso objetivo debe diferir del actual.';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const fields: {
        name?: string;
        gender?: GenderValue;
        age?: number;
        heightCm?: number;
        currentWeight?: number;
        targetWeight?: number;
        goalWeeks?: number;
        goalDate?: string;
      } = {};
      if (name.trim() && name.trim() !== user?.name) fields.name = name.trim();
      if (gender) fields.gender = gender;
      if (ageNum != null) fields.age = ageNum;
      if (heightNum != null) fields.heightCm = heightNum;
      if (currentNum != null) fields.currentWeight = currentNum;
      if (targetNum != null) fields.targetWeight = targetNum;
      if (weeksNum != null) fields.goalWeeks = weeksNum;
      if (goalDate.trim() && goalDate.trim() !== profile?.goalDate) {
        fields.goalDate = goalDate.trim();
      }

      if (Object.keys(fields).length === 0) {
        Alert.alert('Sin cambios', 'No hay cambios que guardar en esta información.');
        return;
      }
      await updateProfile(fields);
      setErrors({});
      Alert.alert('Perfil actualizado', 'Tu información se guardó correctamente.');
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'No se pudieron guardar los datos del perfil.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="create-outline" size={22} color={colors.primary} />
        <Text style={styles.sectionTitle}>Completa tu información</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        Llena los campos que falten y guarda: el resto de tu información se conserva
        automáticamente.
      </Text>

      <AppTextInput
        label="Nombre"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setErrors((prev) => ({ ...prev, name: undefined }));
        }}
        placeholder="Tu nombre"
        error={errors.name}
        autoCapitalize="words"
      />

      <Text style={styles.fieldLabel}>Género</Text>
      <View style={styles.genderRow}>
        {GENDER_OPTIONS.map((option) => {
          const selected = gender === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.genderOption, selected ? styles.genderOptionActive : null]}
              onPress={() => setGender(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Género ${option.label}`}
            >
              <Ionicons name={option.icon} size={20} color={selected ? colors.text : colors.textMuted} />
              <Text style={[styles.genderOptionText, selected ? styles.genderOptionTextActive : null]}>
                {option.label}
              </Text>
              <Ionicons
                name={selected ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={selected ? colors.primary : colors.textSubtle}
              />
            </Pressable>
          );
        })}
      </View>

      <AppTextInput
        label="Edad (años)"
        value={age}
        onChangeText={(t) => {
          setAge(t);
          setErrors((prev) => ({ ...prev, age: undefined }));
        }}
        placeholder="Ej: 30"
        keyboardType="number-pad"
        error={errors.age}
      />

      <AppTextInput
        label="Altura (cm)"
        value={heightCm}
        onChangeText={(t) => {
          setHeightCm(t);
          setErrors((prev) => ({ ...prev, heightCm: undefined }));
        }}
        placeholder="Ej: 175"
        keyboardType="number-pad"
        error={errors.heightCm}
      />

      <AppTextInput
        label="Peso actual (kg)"
        value={currentWeight}
        onChangeText={(t) => {
          setCurrentWeight(t);
          setErrors((prev) => ({ ...prev, currentWeight: undefined }));
        }}
        placeholder="Ej: 78.5"
        keyboardType="decimal-pad"
        error={errors.currentWeight}
      />

      <AppTextInput
        label="Peso objetivo (kg)"
        value={targetWeight}
        onChangeText={(t) => {
          setTargetWeight(t);
          setErrors((prev) => ({ ...prev, targetWeight: undefined }));
        }}
        placeholder="Ej: 72.0"
        keyboardType="decimal-pad"
        error={errors.targetWeight}
      />

      <AppTextInput
        label="Plazo (semanas)"
        value={goalWeeks}
        onChangeText={(t) => {
          setGoalWeeks(t);
          setErrors((prev) => ({ ...prev, goalWeeks: undefined }));
        }}
        placeholder="Ej: 12"
        keyboardType="number-pad"
        error={errors.goalWeeks}
      />

      <AppTextInput
        label="Fecha meta (opcional, AAAA-MM-DD)"
        value={goalDate}
        onChangeText={(t) => {
          setGoalDate(t);
          setErrors((prev) => ({ ...prev, goalDate: undefined }));
        }}
        placeholder="Ej: 2026-12-31"
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.goalDate}
      />

      <AppButton title="Guardar cambios" onPress={handleSave} loading={saving} />
    </View>
  );
}

export default function ProfileScreen() {
  const { user, profile, changePassword } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const checkItems: ProfileField[] = [
    {
      key: 'gender',
      label: 'Género',
      value: isGender(profile?.gender) ? (profile.gender === 'mujer' ? 'Mujer' : 'Hombre') : null,
      icon: 'people-outline',
    },
    { key: 'age', label: 'Edad', value: profile?.age, icon: 'calendar-outline' },
    {
      key: 'heightCm',
      label: 'Altura',
      value: profile?.heightCm ? `${profile.heightCm} cm` : null,
      icon: 'resize-outline',
    },
    {
      key: 'currentWeight',
      label: 'Peso actual',
      value: profile?.currentWeight ? `${profile.currentWeight} kg` : null,
      icon: 'scale-outline',
    },
    {
      key: 'targetWeight',
      label: 'Peso objetivo',
      value: profile?.targetWeight ? `${profile.targetWeight} kg` : null,
      icon: 'flag-outline',
    },
    {
      key: 'goalWeeks',
      label: 'Plazo',
      value: profile?.goalWeeks ? `${profile.goalWeeks} semanas` : null,
      icon: 'time-outline',
    },
    {
      key: 'goalDate',
      label: 'Fecha meta',
      value: profile?.goalDate ? profile.goalDate : null,
      icon: 'calendar-number-outline',
    },
  ];

  const filledCount = checkItems.filter((item) => item.value != null && item.value !== '').length;
  const pendingCount = checkItems.length - filledCount;

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Campos incompletos', 'Completa todos los campos de la contraseña.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Contraseñas', 'Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Contraseña', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Contraseña actualizada', 'Tu contraseña se cambió correctamente.');
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.',
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBackBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Volver a Ajustes"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Perfil</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={30} color={colors.text} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{user?.name ?? 'Usuario'}</Text>
            <Text style={styles.email}>{user?.email ?? ''}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="list-circle-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Estado de tu perfil</Text>
          </View>
          <View style={styles.progressRow}>
            <View style={styles.progressPill}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.progressPillText}>Completados: {filledCount}</Text>
            </View>
            <View style={styles.progressPill}>
              <Ionicons name="alert-circle" size={16} color={colors.warning} />
              <Text style={styles.progressPillText}>Pendientes: {pendingCount}</Text>
            </View>
          </View>
          {checkItems.map((item) => {
            const filled = item.value != null && item.value !== '';
            return (
              <View key={item.key} style={styles.checkRow}>
                <Ionicons
                  name={filled ? 'checkmark-circle' : 'alert-circle-outline'}
                  size={20}
                  color={filled ? colors.success : colors.warning}
                />
                <Text style={styles.checkLabel}>{item.label}</Text>
                <View style={styles.checkMetaWrap}>
                  <Text style={filled ? styles.checkValue : styles.checkMissing}>
                    {filled ? item.value : 'Por completar'}
                  </Text>
                  <Ionicons
                    name={filled ? 'chevron-forward' : 'arrow-forward-circle-outline'}
                    size={16}
                    color={filled ? colors.textMuted : colors.warning}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <ProfileForm key={profileSignature(user, profile)} user={user} profile={profile} />

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Cambiar contraseña</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Ingresa tu contraseña actual y define una nueva para tu cuenta.
          </Text>
          <AppTextInput
            label="Contraseña actual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          <AppTextInput
            label="Nueva contraseña"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          <AppTextInput
            label="Confirmar nueva contraseña"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="••••••••"
            secureTextEntry
          />
          <AppButton
            title="Cambiar contraseña"
            variant="outline"
            onPress={handleChangePassword}
            loading={savingPassword}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  email: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    padding: 18,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  progressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  progressPillText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardAlt,
  },
  checkLabel: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  checkMetaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkValue: {
    color: colors.textMuted,
    fontSize: 13,
  },
  checkMissing: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '500',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  genderOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  genderOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  genderOptionText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '500',
  },
  genderOptionTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
});