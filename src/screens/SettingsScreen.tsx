import { colors } from '../theme/colors';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../components/AppButton';
import AppTextInput from '../components/AppTextInput';
import {
  getVisionApiKey,
  saveVisionApiKey,
  deleteVisionApiKey,
  testVisionApiKey,
} from '../services/configService';

type Status = 'idle' | 'saved' | 'tested-ok' | 'tested-fail' | 'error';

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<Status>('idle');

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
      await saveVisionApiKey(apiKey);
      setHasStoredKey(!!apiKey.trim());
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
    if (!apiKey.trim()) {
      setStatus('tested-fail');
      return;
    }
    setTesting(true);
    setStatus('idle');
    const ok = await testVisionApiKey(apiKey);
    setTesting(false);
    setStatus(ok ? 'tested-ok' : 'tested-fail');
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
            <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
            <Text style={styles.sectionTitle}>Inteligencia Artificial</Text>
          </View>
          <Text style={styles.sectionSubtitle}>
            Configura tu API Key de Google Gemini para activar el reconocimiento
            inteligente de alimentos por foto. La clave se guarda cifrada en el
            dispositivo.
          </Text>

          <View>
            <AppTextInput
              label="API Key de IA (Gemini)"
              placeholder="AIza..."
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
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
                No se pudo validar la clave o la conexión falló.
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
            <Ionicons name="information-circle-outline" size={22} color={colors.textMuted} />
            <Text style={styles.sectionTitle}>Proveedores compatibles</Text>
          </View>
          <Text style={styles.infoText}>
            • Google Gemini (por defecto) — modelo{' '}
            <Text style={styles.mono}>gemini-2.0-flash</Text>
          </Text>
          <Text style={styles.infoText}>
            • OpenAI GPT-4o-mini — compatible, configura tu clave en el mismo campo.
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
  mono: {
    color: colors.text,
    fontFamily: 'monospace',
  },
});