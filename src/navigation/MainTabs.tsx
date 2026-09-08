import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import RutinaScreen from '../screens/RutinaScreen';
import EjerciciosScreen from '../screens/EjerciciosScreen';
import ProgresoScreen from '../screens/ProgresoScreen';
import ComidaScreen from '../screens/ComidaScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const icons: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Rutina: 'fitness',
  Ejercicios: 'barbell',
  Progreso: 'trending-up',
  Comida: 'restaurant',
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: true,
        tabBarActiveTintColor: '#e94560',
        tabBarInactiveTintColor: '#a0a0b8',
        tabBarStyle: {
          backgroundColor: '#16213e',
          borderTopColor: '#222244',
        },
        headerStyle: {
          backgroundColor: '#1a1a2e',
        },
        headerTintColor: '#ffffff',
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name]} color={color} size={size} />
        ),
      })}
    >
      <Tab.Screen name="Rutina" component={RutinaScreen} />
      <Tab.Screen name="Ejercicios" component={EjerciciosScreen} />
      <Tab.Screen name="Progreso" component={ProgresoScreen} />
      <Tab.Screen name="Comida" component={ComidaScreen} />
    </Tab.Navigator>
  );
}
