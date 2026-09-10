import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ExerciseWithBodyPart } from '../../types/exercise';

interface CardEjercicioProps {
  exercise: ExerciseWithBodyPart;
}

export default function CardEjercicio({ exercise }: CardEjercicioProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{exercise.name}</Text>
        {exercise.equipment ? (
          <View style={styles.equipmentBadge}>
            <Text style={styles.equipmentText}>{exercise.equipment}</Text>
          </View>
        ) : null}
      </View>
      {exercise.description ? (
        <Text style={styles.description}>{exercise.description}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  equipmentBadge: {
    backgroundColor: colors.cardAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginLeft: 8,
  },
  equipmentText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
