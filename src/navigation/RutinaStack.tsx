import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import RutinaScreen from '../screens/RutinaScreen';
import MusclePanelScreen from '../screens/MusclePanelScreen';
import ExerciseConfigScreen from '../screens/ExerciseConfigScreen';
import WorkoutActiveScreen from '../screens/WorkoutActiveScreen';
import type { RutinaStackParamList } from './types';

const Stack = createNativeStackNavigator<RutinaStackParamList>();

export default function RutinaStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="RutinaHome" component={RutinaScreen} />
      <Stack.Screen name="MusclePanel" component={MusclePanelScreen} />
      <Stack.Screen name="ExerciseConfig" component={ExerciseConfigScreen} />
      <Stack.Screen name="WorkoutActive" component={WorkoutActiveScreen} />
    </Stack.Navigator>
  );
}