import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Navigation from './src/navigation';
import { AuthProvider, OnboardingProvider } from './src/context';
import { initDatabase } from './src/services/database';

initDatabase().catch((error) => {
  console.error('Error inicializando la base de datos:', error);
});

export default function App() {
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
