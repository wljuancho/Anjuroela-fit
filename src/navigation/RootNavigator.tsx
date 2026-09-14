import { colors } from '../theme/colors';
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import TutorialScreen from '../screens/TutorialScreen';
import MainTabs from './MainTabs';
import { useAuth, useTutorial } from '../context';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function RootNavigator() {
  const { isAuthenticated, hasProfileCompleted, isLoading } = useAuth();
  const { hasSeenTutorial } = useTutorial();

  if (isLoading) {
    return <LoadingScreen />;
  }

  const initialRoute: keyof RootStackParamList = !isAuthenticated
    ? 'Login'
    : !hasProfileCompleted
      ? 'Onboarding'
      : !hasSeenTutorial
        ? 'Tutorial'
        : 'MainTabs';

  // Las pantallas se montan/desmontan según el estado de auth. Cuando el estado
  // cambia (login/registro completado), la pantalla activa se elimina y React
  // Navigation redirige automáticamente a la primera pantalla disponible,
  // garantizando la transición Login -> Onboarding -> Tutorial -> MainTabs.
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          {!hasProfileCompleted ? (
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          ) : null}
          {!hasProfileCompleted || !hasSeenTutorial ? (
            <Stack.Screen name="Tutorial" component={TutorialScreen} />
          ) : null}
          <Stack.Screen name="MainTabs" component={MainTabs} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
