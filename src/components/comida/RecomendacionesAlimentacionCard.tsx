import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FoodRecommendation, DailyCalorieGoal } from '../../types/meal';
import { getFoodRecommendations } from '../../services/mealService';

interface RecomendacionesAlimentacionCardProps {
  goal: DailyCalorieGoal | null;
}

export default function RecomendacionesAlimentacionCard({ goal }: RecomendacionesAlimentacionCardProps) {
  const recommendations = getFoodRecommendations(goal);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Recomendaciones para tu objetivo</Text>
      {recommendations.map((rec) => (
        <View key={rec.id} style={styles.item}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={rec.icon as keyof typeof Ionicons.glyphMap}
              size={20}
              color={colors.primary}
            />
          </View>
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle}>{rec.title}</Text>
            <Text style={styles.itemDescription}>{rec.description}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});