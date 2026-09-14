import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MealLog } from '../../types/nutrition';
import { formatNumber } from '../../services/utils';

interface CardComidaItemProps {
  meal: MealLog;
  onDelete: (id: number) => void;
}

function extractTime(createdAt?: string): string {
  if (!createdAt) return '';
  const match = createdAt.match(/(\d{1,2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
}

export default function CardComidaItem({ meal, onDelete }: CardComidaItemProps) {
  const time = extractTime(meal.created_at);
  return (
    <View style={styles.row}>
      {meal.photo_uri ? (
        <Image source={{ uri: meal.photo_uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="restaurant-outline" size={22} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{meal.meal_name}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={12} color={colors.textSubtle} />
          <Text style={styles.time}>{time || '—'}</Text>
        </View>
      </View>
      <Text style={styles.calories}>{formatNumber(meal.calories)} kcal</Text>
      <TouchableOpacity style={styles.action} onPress={() => onDelete(meal.id)}>
        <Ionicons name="trash-outline" size={20} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 8,
  },
  thumbPlaceholder: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  time: {
    color: colors.textSubtle,
    fontSize: 12,
  },
  calories: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  action: {
    padding: 4,
  },
});