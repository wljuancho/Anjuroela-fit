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
              color="#e94560"
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
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#ffffff',
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
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  itemDescription: {
    color: '#a0a0b8',
    fontSize: 13,
    lineHeight: 18,
  },
});