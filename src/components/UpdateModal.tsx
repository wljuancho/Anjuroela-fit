import { colors } from '../theme/colors';
import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from './AppButton';
import {
  downloadApk,
  openApkInstaller,
  ensureUnknownSourcesPermission,
} from '../services/updateService';
import type { UpdateInfo } from '../services/updateService';

interface UpdateModalProps {
  visible: boolean;
  info: UpdateInfo | null;
  onClose: () => void;
}

export default function UpdateModal({ visible, info, onClose }: UpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');

  async function handleUpdate() {
    if (!info) return;
    setError('');
    setDownloading(true);
    try {
      await ensureUnknownSourcesPermission();
      const apkUri = await downloadApk(info);
      setDownloading(false);
      setInstalling(true);
      await openApkInstaller(apkUri);
    } catch {
      setError('No se pudo descargar el APK. Revisa tu conexión e intenta de nuevo.');
    } finally {
      setDownloading(false);
      setInstalling(false);
    }
  }

  return (
    <Modal
      visible={visible && info != null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-download-outline" size={32} color={colors.primary} />
          </View>

          <Text style={styles.title}>Nueva versión disponible</Text>
          <Text style={styles.version}>v{info?.latestVersion ?? ''}</Text>

          {info?.notes ? <Text style={styles.notes}>{info.notes}</Text> : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {downloading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Descargando actualización...</Text>
            </View>
          ) : null}
          {installing ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Abriendo el instalador...</Text>
            </View>
          ) : null}

          <AppButton
            title="Actualizar ahora"
            onPress={handleUpdate}
            loading={downloading || installing}
            style={styles.primaryButton}
          />
          <AppButton
            title="Más tarde"
            variant="secondary"
            onPress={onClose}
            disabled={downloading || installing}
            style={styles.secondaryButton}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrimStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  version: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 12,
  },
  notes: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 16,
  },
  error: {
    color: colors.warning,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  primaryButton: {
    width: '100%',
    marginBottom: 10,
  },
  secondaryButton: {
    width: '100%',
  },
});