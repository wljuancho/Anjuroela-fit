import { colors } from '../theme/colors';
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Linking,
  AppState,
  AppStateStatus,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from './AppButton';
import { checkForRemoteUpdate } from '../services/versionService';
import type { RemoteUpdateInfo } from '../services/versionService';

// Verifica en Supabase (tabla app_versions) si existe una versión superior a la
// instalada. Si la hay, muestra un modal casi inbloqueable con "Actualizar
// ahora" que redirige a Google Drive. Solo se vuelve a solicitar con una nueva
// versión distinta (se evita el aviso repetido en el mismo build).
export default function RemoteUpdateManager() {
  const [info, setInfo] = useState<RemoteUpdateInfo | null>(null);
  const lastShownRef = useRef<string | null>(null);

  async function runCheck() {
    try {
      const result = await checkForRemoteUpdate();
      if (!result) return;
      if (lastShownRef.current === result.downloadUrl) return;
      lastShownRef.current = result.downloadUrl;
      setInfo(result);
    } catch {
      // Fallo no letal: el check nunca debe bloquear la app.
    }
  }

  function onAppStateChange(state: AppStateStatus) {
    if (state === 'active') {
      void runCheck();
    }
  }

  useEffect(() => {
    void runCheck();
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  function handleUpdate() {
    if (!info) return;
    Linking.openURL(info.downloadUrl).catch(() => {
      // Sin acción: el usuario reintentará o cerrará desde el sistema.
    });
  }

  return (
    <Modal
      visible={info != null}
      transparent
      animationType="fade"
      // Evita cerrar con el botón atrás de Android (se fuerza a actualizar).
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-download-outline" size={32} color={colors.primary} />
          </View>

          <Text style={styles.title}>Nueva versión disponible</Text>
          <Text style={styles.message}>{info?.message}</Text>

          <AppButton
            title="Actualizar ahora"
            onPress={handleUpdate}
            style={styles.primaryButton}
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
  message: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  primaryButton: {
    width: '100%',
  },
});