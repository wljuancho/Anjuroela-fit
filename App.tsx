import React, { useEffect, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import Navigation from './src/navigation';
import { AuthProvider, OnboardingProvider, TutorialProvider } from './src/context';
import { initDatabase } from './src/services/database';
import { syncLocalToRemote } from './src/services/syncService';
import UpdateCheckManager from './src/components/UpdateCheckManager';
import RemoteUpdateManager from './src/components/RemoteUpdateManager';

SplashScreen.preventAutoHideAsync();

const WARM_KEY = 'anjuroela_fit:warmup';

async function warmNativeModules() {
  try {
    await Promise.all([
      Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, 'anjuroela-fit-warmup'),
      SecureStore.getItemAsync(WARM_KEY),
    ]);
  } catch {
    // Pre-warm best effort; ignore failures
  }
}

// Comprueba en caliente si hay una actualización OTA disponible al abrir la app.
// Solo se vuelve a avisar una vez por sesión para no interrumpir al usuario.
function UpdatesManager() {
  const { isUpdateAvailable, isUpdatePending, isDownloading } = Updates.useUpdates();
  const warnedRef = useRef(false);

  // Aplica la actualización OTA. Se protege por si 'expo-updates' no expone el
  // método o su módulo nativo no está disponible (dev client / emulador), que
  // es cuando el error llega como 'Cannot read property reload of undefined'.
  const applyReload = () => {
    try {
      void Updates.reloadAsync?.();
    } catch {
      // Se ignora: sin soporte nativo de expo-updates no se puede recargar.
    }
  };

  useEffect(() => {
    if (!warnedRef.current && isUpdateAvailable && !isUpdatePending && !isDownloading) {
      warnedRef.current = true;
      Alert.alert(
        'Actualización disponible',
        'Nueva actualización disponible. Reiniciando para aplicar cambios...',
        [{ text: 'Aplicar', onPress: applyReload }],
        { cancelable: false },
      );
    }
  }, [isUpdateAvailable, isUpdatePending, isDownloading]);

  return null;
}

export default function App() {
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      warmNativeModules();
      try {
        await initDatabase();
      } catch (error) {
        console.error('Error inicializando la base de datos:', error);
      } finally {
        setAppReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  // Al abrir la app o volver al primer plano se sincroniza en segundo plano
  // con Supabase si está configurado; nunca bloquea la UI ni la base local.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncLocalToRemote();
      }
    });
    return () => sub.remove();
  }, []);

  if (!appReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <UpdatesManager />
      <UpdateCheckManager />
      <RemoteUpdateManager />
      <AuthProvider>
        <OnboardingProvider>
          <TutorialProvider>
            <NavigationContainer>
              <Navigation />
            </NavigationContainer>
            <StatusBar style="light" />
          </TutorialProvider>
        </OnboardingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
