import { colors } from '../theme/colors';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AppButton from '../components/AppButton';
import AppTextInput from '../components/AppTextInput';
import { useAuth } from '../context';
import type { RootStackParamList } from '../navigation/types';
import {
  getVisionApiKey,
  saveVisionApiKey,
  deleteVisionApiKey,
  testVisionApiKey,
} from '../services/configService';
import {
  isHealthSyncEnabled,
  setHealthSyncEnabled,
  isWearableAvailable,
  requestWearablePermissions,
  hasWearablePermissions,
  revokeWearableAccess,
  getAndroidHealthConnectStatus,
  openHealthConnectPlayStore,
} from '../services/healthService';

type Status = 'idle' | 'saved' | 'tested-ok' | 'tested-fail' | 'error';

type WearableStatus = 'checking' | 'available' | 'unavailable';

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [testDetail, setTestDetail] = useState<string | null>(null);
  const { signOut, deleteAccount, user } = useAuth();

  const [deletingAccount, setDeletingAccount] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [wearableStatus, setWearableStatus] = useState<WearableStatus>('checking');
  const [wearableAuthed, setWearableAuthed] = useState(false);
  const [wearableEnabled, setWearableEnabled] = useState(false);
  const [linkingHealth, setLinkingHealth] = useState(false);
  const [unlinkingHealth, setUnlinkingHealth] = useState(false);
  const storageUserId = user?.id ?? user?.email ?? null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enabled = await isHealthSyncEnabled(storageUserId);
      const available = await isWearableAvailable();
      const authed = enabled
        ? await hasWearablePermissions().catch(() => false)
        : false;
      if (cancelled) return;
      setWearableEnabled(enabled);
      setWearableAuthed(authed);
      setWearableStatus(available ? 'available' : 'unavailable');
    })();
    return () => {
      cancelled = true;
    };
  }, [storageUserId]);

  const handleLinkWearable = async () => {
    if (!storageUserId) return;
    setLinkingHealth(true);
    try {
      if (Platform.OS === 'android') {
        const hcStatus = await getAndroidHealthConnectStatus();
        if (hcStatus === 'not-installed') {
          Alert.alert(
            'Instala Health Connect',
            'Health Connect no está instalado en tu dispositivo. Descarga la aplicación oficial de Google para vincular tus dispositivos (Samsung, Xiaomi, Garmin, Fitbit, etc.).',
            [
              {
                text: 'Descargar Health Connect',
                onPress: () => void openHealthConnectPlayStore(),
              },
              { text: 'Cancelar', style: 'cancel' },
            ],
          );
          return;
        }
        if (hcStatus === 'update-required') {
          Alert.alert(
            'Actualiza Health Connect',
            'Health Connect está desactualizado. Actualiza la aplicación oficial de Google desde Play Store para poder vincular tus dispositivos (Samsung, Xiaomi, Garmin, Fitbit, etc.).',
            [
              {
                text: 'Actualizar Health Connect',
                onPress: () => void openHealthConnectPlayStore(),
              },
              { text: 'Cancelar', style: 'cancel' },
            ],
          );
          return;
        }
      }

      // En Android el flujo abre la pantalla del sistema de Health Connect
      // para conceder lectura de Ritmo Cardíaco y Calorías Activas.
      await requestWearablePermissions();
      const authed = await hasWearablePermissions().catch(() => false);
      if (!authed) {
        Alert.alert(
          'Permiso no concedido',
          'Para sincronizar latidos y calorías, concede el acceso al reloj, pulsera o anillo.',
        );
        return;
      }
      await setHealthSyncEnabled(storageUserId, true);
      setWearableEnabled(true);
      setWearableAuthed(true);
      Alert.alert(
        'Dispositivo vinculado',
        'El ritmo cardíaco y las calorías de tus sesiones se combinarán con tus series, rondas y descansos, y se registrarán automáticamente en tu Progreso.',
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'No se pudo vincular el dispositivo.';
      Alert.alert('No se pudo vincular', message);
    } finally {
      setLinkingHealth(false);
    }
  };

  const handleUnlinkWearable = async () => {
    if (!storageUserId) return;
    Alert.alert(
      'Desvincular dispositivo',
      'Se detendrá la sincronización de latidos y calorías del wearable. Tu historial permanece guardado.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            setUnlinkingHealth(true);
            const result = await revokeWearableAccess().catch(
              () => ({ message: undefined }) as { message?: string; requiresRestart?: boolean },
            );
            await setHealthSyncEnabled(storageUserId, false);
            setWearableEnabled(false);
            setWearableAuthed(false);
            setUnlinkingHealth(false);
            Alert.alert('Dispositivo desvinculado', result?.message ?? '');
          },
        },
      ],
    );
  };

  const handleOpenProfile = () => {
    navigation.navigate('Perfil');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que deseas cerrar sesión? Tu historial permanece guardado en la nube y tu cuenta se purgará de forma segura del dispositivo. Al volver a iniciar sesión se descargará de nuevo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', style: 'destructive', onPress: () => signOut() },
      ],
    );
  };

  useEffect(() => {
    (async () => {
      const stored = await getVisionApiKey();
      setHasStoredKey(!!stored);
      if (stored) {
        setApiKey(stored);
      }
    })();
  }, []);

const handleSave = async () => {
    setSaving(true);
    setStatus('idle');
    try {
      const trimmed = apiKey.trim();
      setApiKey(trimmed);
      await saveVisionApiKey(trimmed);
      setHasStoredKey(!!trimmed);
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteVisionApiKey();
    setApiKey('');
    setHasStoredKey(false);
    setStatus('idle');
  };

const handleTest = async () => {
    const trimmed = apiKey.trim();
    setApiKey(trimmed);
    if (!trimmed) {
      setTestDetail('Ingresa una API Key para poder probarla.');
      setStatus('tested-fail');
      return;
    }
    setTesting(true);
    setStatus('idle');
    setTestDetail(null);
    const result = await testVisionApiKey(trimmed);
    setTesting(false);
    setStatus(result.ok ? 'tested-ok' : 'tested-fail');
    setTestDetail(result.ok ? null : result.detail);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar mi cuenta',
      'Se borrarán permanentemente tu cuenta y todos tus datos (rutinas, entrenamientos, peso, comidas y progreso) tanto en la nube como en este dispositivo. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar definitivamente',
          style: 'destructive',
          onPress: () => void performDeleteAccount(),
        },
      ],
    );
  };

  const performDeleteAccount = async () => {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      // El provider purga los datos y cierra la sesión; la pantalla se desmonta.
    } catch {
      Alert.alert(
        'Error',
        'No se pudo eliminar la cuenta. Revisa tu conexión e inténtalo de nuevo.',
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Perfil</Text>
          </View>
          <TouchableOpacity style={styles.profileRow} onPress={handleOpenProfile}>
            <View style={styles.profileRowIcon}>
              <Ionicons name="person" size={20} color={colors.text} />
            </View>
            <View style={styles.profileRowTextWrap}>
              <Text style={styles.profileRowTitle}>Mi Perfil</Text>
              <Text style={styles.profileRowSubtitle}>
                Completa tu información y cambia tu contraseña
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Inteligencia Artificial</Text>
          </View>
<Text style={styles.sectionSubtitle}>
            Configura tu API Key de Google Gemini o de OpenAI para activar el
            reconocimiento inteligente de alimentos por foto y al Entrenador. La
            app detecta el proveedor automáticamente (Gemini: 'AIza...',
            OpenAI: 'sk-...') y la clave se guarda cifrada en el dispositivo.
          </Text>

          <View>
            <AppTextInput
              label="API Key de IA (Gemini u OpenAI)"
              placeholder="AIza... o sk-..."
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              selectTextOnFocus
              secureTextEntry={!showKey}
              accessory={
                <TouchableOpacity
                  onPress={() => setShowKey((prev) => !prev)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showKey ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              }
            />
          </View>

          <View style={styles.row}>
            <AppButton
              title="Guardar Clave"
              onPress={handleSave}
              loading={saving}
              style={styles.saveBtn}
            />
            <AppButton
              title="Probar Conexión"
              variant="outline"
              onPress={handleTest}
              loading={testing}
              style={styles.testBtn}
            />
          </View>

          {status === 'saved' ? (
            <View style={[styles.statusBox, styles.statusOk]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.statusText, styles.statusTextOk]}>
                Clave guardada correctamente.
              </Text>
            </View>
          ) : null}

          {status === 'tested-ok' ? (
            <View style={[styles.statusBox, styles.statusOk]}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[styles.statusText, styles.statusTextOk]}>
                Conexión exitosa. La API Key es válida.
              </Text>
            </View>
          ) : null}

{status === 'tested-fail' ? (
            <View style={[styles.statusBox, styles.statusFail]}>
              <Ionicons name="alert-circle" size={18} color={colors.primary} />
              <Text style={[styles.statusText, styles.statusTextFail]}>
                {testDetail ?? 'No se pudo validar la clave o la conexión falló.'}
              </Text>
            </View>
          ) : null}

          {status === 'error' ? (
            <View style={[styles.statusBox, styles.statusFail]}>
              <Ionicons name="alert-circle" size={18} color={colors.primary} />
              <Text style={[styles.statusText, styles.statusTextFail]}>
                Error al guardar la clave. Inténtalo de nuevo.
              </Text>
            </View>
          ) : null}

          {hasStoredKey && !testing && !saving ? (
            <TouchableOpacity style={styles.deleteRow} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={16} color={colors.primary} />
              <Text style={styles.deleteText}>Eliminar clave guardada</Text>
            </TouchableOpacity>
          ) : null}
        </View>

<View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="heart-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Dispositivos y Salud</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Vincula tu reloj, pulsera o anillo (Salud/HealthKit en iPhone, Health
            Connect en Android) para que Anjuroela Fit registre el ritmo cardíaco
            y las calorías de tus sesiones combinándolos con tus series, rondas y
            descansos.
          </Text>
          <Text style={styles.infoText}>
            Sincroniza con cualquier marca (Samsung, Xiaomi, Garmin, Fitbit, Oura,
            etc.) que envíe datos a Health Connect o Apple Health.
          </Text>

          {wearableStatus === 'checking' ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.statusText}>Revisando dispositivo…</Text>
            </View>
          ) : wearableStatus === 'unavailable' ? (
            <>
              <View style={[styles.statusBox, styles.statusFail]}>
                <Ionicons name="phone-portrait-outline" size={18} color={colors.primary} />
                <Text style={[styles.statusText, styles.statusTextFail]}>
                  {Platform.OS === 'android'
                    ? 'Health Connect no está instalado en este dispositivo.'
                    : 'Tu dispositivo no admite la sincronización de salud.'}
                </Text>
              </View>
              {Platform.OS === 'android' ? (
                <AppButton
                  title="Vincular mi reloj / pulsera"
                  onPress={handleLinkWearable}
                  loading={linkingHealth}
                  disabled={linkingHealth}
                />
              ) : null}
            </>
          ) : wearableEnabled && wearableAuthed ? (
            <>
              <View style={[styles.statusBox, styles.statusOk]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text style={[styles.statusText, styles.statusTextOk]}>
                  Conectado · {Platform.OS === 'ios' ? 'Salud (HealthKit)' : 'Health Connect'}
                </Text>
              </View>
              <AppButton
                title="Desvincular dispositivo"
                variant="outline"
                onPress={handleUnlinkWearable}
                loading={unlinkingHealth}
                disabled={unlinkingHealth}
              />
            </>
          ) : (
            <>
              <View style={[styles.statusBox, styles.statusFail]}>
                <Ionicons name="heart-dislike-outline" size={18} color={colors.primary} />
                <Text style={[styles.statusText, styles.statusTextFail]}>
                  No vinculado. Las calorías se estiman localmente hasta que
                  sincronices tu wearable.
                </Text>
              </View>
              <AppButton
                title="Vincular mi reloj / pulsera"
                onPress={handleLinkWearable}
                loading={linkingHealth}
                disabled={linkingHealth}
              />
            </>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="log-out-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Sesión</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Tu sesión se mantiene activa al cerrar o reiniciar la app. Al cerrar
            sesión, tu cuenta se purga de forma segura de este dispositivo, pero tu
            historial permanece intacto en la nube y se descarga de nuevo al volver
            a iniciar sesión.
          </Text>
          <AppButton title="Cerrar Sesión" variant="outline" onPress={handleSignOut} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trash-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Zona de peligro</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Elimina tu cuenta de forma permanente. Se borrará todo tu historial en la nube
            y en este dispositivo, y no podrás recuperarlo.
          </Text>
          <AppButton
            title={deletingAccount ? 'Eliminando cuenta…' : 'Eliminar mi cuenta'}
            variant="outline"
            onPress={handleDeleteAccount}
            loading={deletingAccount}
            disabled={deletingAccount}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
            <Text style={styles.sectionTitle}>Proveedores compatibles</Text>
          </View>
<Text style={styles.infoText}>
            • Google Gemini (por defecto) — modelo{' '}
            <Text style={styles.mono}>gemini-3.6-flash</Text>
          </Text>
          <Text style={styles.infoText}>
            • OpenAI GPT-4o-mini — compatible, usa una clave 'sk-…' en el mismo campo.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.infoText}>
            {testing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : null}
            Si no hay una clave configurada, la app usa automáticamente el
            procesador local (sin conexión).
          </Text>
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
    marginBottom: 16,
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  saveBtn: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 12,
  },
  testBtn: {
    flex: 1,
    minHeight: 0,
    paddingVertical: 12,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  statusOk: {
    backgroundColor: colors.successSoft,
  },
  statusFail: {
    backgroundColor: colors.primarySoft,
  },
  statusText: {
    fontSize: 13,
    flex: 1,
  },
  statusTextOk: {
    color: colors.success,
  },
  statusTextFail: {
    color: colors.primary,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    paddingVertical: 8,
  },
  deleteText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  infoText: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: 6,
    lineHeight: 19,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  profileRowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySofter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRowTextWrap: {
    flex: 1,
  },
  profileRowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  profileRowSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  mono: {
    color: colors.text,
    fontFamily: 'monospace',
  },
});