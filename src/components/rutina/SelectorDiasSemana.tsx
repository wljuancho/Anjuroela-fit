import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import type { DayOfWeek, WeeklyScheduleEntry } from '../../types/workout';
import { DAYS_ORDER, DAY_LABELS } from '../../types/workout';

interface SelectorDiasSemanaProps {
  schedule: WeeklyScheduleEntry[];
  selectedDay: DayOfWeek;
  onSelectDay: (day: DayOfWeek) => void;
  onEditDay: (day: DayOfWeek) => void;
  completedDays: DayOfWeek[];
}

export default function SelectorDiasSemana({
  schedule,
  selectedDay,
  onSelectDay,
  onEditDay,
  completedDays,
}: SelectorDiasSemanaProps) {
  const scheduleMap = new Map(schedule.map((e) => [e.day_of_week, e]));

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {DAYS_ORDER.map((day) => {
        const entry = scheduleMap.get(day);
        const isRest = !entry?.body_part_id;
        const isSelected = selectedDay === day;
        const isCompleted = completedDays.includes(day);

        return (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayCard,
              isSelected ? styles.dayCardActive : null,
              isCompleted ? styles.dayCardCompleted : null,
            ]}
            onPress={() => onSelectDay(day)}
            onLongPress={() => onEditDay(day)}
            activeOpacity={0.7}
          >
            <Text style={[styles.dayLabel, isSelected ? styles.dayLabelActive : null]}>
              {DAY_LABELS[day]}
            </Text>
            <View style={[styles.dot, isCompleted ? styles.dotCompleted : null]} />
            <Text
              style={[
                styles.bodyPartLabel,
                isRest ? styles.restLabel : null,
                isSelected ? styles.bodyPartLabelActive : null,
              ]}
              numberOfLines={1}
            >
              {isRest ? 'Descanso' : entry?.body_part_name ?? ''}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 8,
  },
  dayCard: {
    width: 72,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  dayCardActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayCardCompleted: {
    borderColor: colors.success,
  },
  dayLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  dayLabelActive: {
    color: colors.text,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'transparent',
    marginBottom: 6,
  },
  dotCompleted: {
    backgroundColor: colors.success,
  },
  bodyPartLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  bodyPartLabelActive: {
    color: colors.text,
  },
  restLabel: {
    color: colors.textSubtle,
    fontStyle: 'italic',
  },
});
