import { colors } from '../theme/colors';
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import MainTabs from './MainTabs';
import { useAuth } from '../context';
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

  if (isLoading) {
    return <LoadingScreen />;
  }

  const initialRoute: keyof RootStackParamList = !isAuthenticated
    ? 'Login'
    : !hasProfileCompleted
      ? 'Onboarding'
      : 'MainTabs';

  // La key fuerza el remontaje del Stack cuando el flujo de auth cambia,
  // aplicando así el nuevo initialRouteName (Login -> Onboarding -> MainTabs).
  const flowKey = isAuthenticated
    ? hasProfileCompleted
      ? 'main'
      : 'onboarding'
    : 'login';

  return (
    <Stack.Navigator
      key={flowKey}
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
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
