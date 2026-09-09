import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MealRecord, MealType } from '../../types/meal';
import { formatNumber } from '../../services/utils';

interface CardComidaItemProps {
  meal: MealRecord;
  onEdit: (meal: MealRecord) => void;
  onDelete: (id: number) => void;
}

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  desayuno: 'Desayuno',
  almuerzo: 'Almuerzo',
  cena: 'Cena',
  snack: 'Snack',
};

const MEAL_TYPE_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
  desayuno: 'sunny-outline',
  almuerzo: 'restaurant-outline',
  cena: 'moon-outline',
  snack: 'cafe-outline',
};

export default function CardComidaItem({ meal, onEdit, onDelete }: CardComidaItemProps) {
  return (
    <View style={styles.row}>
      {meal.image_uri ? (
        <Image source={{ uri: meal.image_uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name={MEAL_TYPE_ICONS[meal.meal_type]} size={22} color="#a0a0b8" />
        </View>
      )}
      <View style={styles.info}>
        <View style={styles.infoTop}>
          <Text style={styles.title}>{MEAL_TYPE_LABELS[meal.meal_type]}</Text>
          <Text style={styles.calories}>{formatNumber(meal.calories)} kcal</Text>
        </View>
        {meal.description ? (
          <Text style={styles.subtitle} numberOfLines={1}>{meal.description}</Text>
        ) : null}
        <Text style={styles.macros}>
          P {formatNumber(meal.protein_g, 1)}g · C {formatNumber(meal.carbs_g)}g · G {formatNumber(meal.fat_g)}g
        </Text>
      </View>
      <TouchableOpacity style={styles.action} onPress={() => onEdit(meal)}>
        <Ionicons name="create-outline" size={20} color="#a0a0b8" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.action} onPress={() => onDelete(meal.id)}>
        <Ionicons name="trash-outline" size={20} color="#e94560" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
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
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  infoTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  calories: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: '#a0a0b8',
    fontSize: 12,
    marginTop: 2,
  },
  macros: {
    color: '#7a7a96',
    fontSize: 12,
    marginTop: 2,
  },
  action: {
    padding: 4,
  },
});