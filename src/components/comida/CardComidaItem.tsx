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
  const mealType = {
    desayuno: 'Desayuno',
    almuerzo: 'Almuerzo',
    cena: 'Cena',
    snack: 'Snack',
  }[meal.meal_type ?? 'snack'];
  const macros = [
    meal.protein_g != null ? `P ${formatNumber(meal.protein_g, 1)} g` : null,
    meal.carbs_g != null ? `C ${formatNumber(meal.carbs_g, 1)} g` : null,
    meal.fat_g != null ? `G ${formatNumber(meal.fat_g, 1)} g` : null,
  ].filter(Boolean).join(' · ');
  const sourceLabel = {
    manual: 'Dato ingresado por ti',
    catalog: 'Catálogo · referencia aproximada',
    photo_ai: `Foto con IA · confianza ${meal.nutrition_confidence ?? 'no indicada'}`,
    unknown: 'Origen no registrado',
  }[meal.nutrition_source ?? 'unknown'];
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
          <Text style={styles.mealType}>{mealType}</Text>
          {time ? <Text style={styles.metaDivider}>·</Text> : null}
          <Ionicons name="time-outline" size={12} color={colors.textSubtle} />
          <Text style={styles.time}>{time || 'Sin hora'}</Text>
        </View>
        {macros ? <Text style={styles.macros} numberOfLines={1}>{macros}</Text> : null}
        <Text style={styles.source} numberOfLines={1}>{sourceLabel}</Text>
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
  mealType: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  metaDivider: {
    color: colors.textSubtle,
    fontSize: 11,
  },
  macros: {
    color: colors.success,
    fontSize: 11,
    marginTop: 4,
  },
  source: {
    color: colors.textSubtle,
    fontSize: 10,
    marginTop: 3,
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
