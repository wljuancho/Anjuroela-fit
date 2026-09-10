import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Navigation from './src/navigation';
import { AuthProvider, OnboardingProvider } from './src/context';
import { initDatabase } from './src/services/database';

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

  if (!appReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OnboardingProvider>
          <NavigationContainer>
            <Navigation />
          </NavigationContainer>
          <StatusBar style="light" />
        </OnboardingProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
