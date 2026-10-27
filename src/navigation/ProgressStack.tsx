import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import ProgresoScreen from '../screens/ProgresoScreen';
import CaloriesHistoryScreen from '../screens/CaloriesHistoryScreen';
import type { ProgressStackParamList } from './types';

const Stack = createNativeStackNavigator<ProgressStackParamList>();

export default function ProgressStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="ProgressHome"
        component={ProgresoScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CaloriesHistory"
        component={CaloriesHistoryScreen}
        options={{ title: 'Calorías por semana' }}
      />
    </Stack.Navigator>
  );
}
