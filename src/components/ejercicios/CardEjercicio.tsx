import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ExerciseWithBodyPart } from '../../types/exercise';

interface CardEjercicioProps {
  exercise: ExerciseWithBodyPart;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function CardEjercicio({ exercise, onPress, onEdit, onDelete }: CardEjercicioProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
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
      <View style={styles.actions}>
        {onEdit ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
        {onDelete ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.cardAlt,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
