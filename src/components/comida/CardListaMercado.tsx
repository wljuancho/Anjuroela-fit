import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPlanDate } from '../../services/utils';
import type { MarketIngredient } from '../../services/nutritionService';

interface CardListaMercadoProps {
  items: MarketIngredient[];
  startDate?: string;
  expiresAt?: string;
}

export default function CardListaMercado({ items, startDate, expiresAt }: CardListaMercadoProps) {
  if (items.length === 0) return null;

  const dateRange =
    startDate && expiresAt ? `del ${formatPlanDate(startDate)} al ${formatPlanDate(expiresAt)}` : '';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="cart-outline" size={20} color={colors.primary} />
          <Text style={styles.title}>Lista de Mercado / Ingredientes</Text>
        </View>
        {dateRange ? <Text style={styles.subtitle}>{dateRange}</Text> : null}
      </View>

      {items.map((item, index) => (
        <View key={`${item.name}-${index}`} style={styles.row}>
          <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
          <Text style={styles.quantity}>{item.quantity}</Text>
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
  header: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardAlt,
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  quantity: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});