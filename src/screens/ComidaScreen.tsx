import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  CardResumenCalorias,
  CardComidaItem,
  ModalAgregarComida,
  RecomendacionesAlimentacionCard,
} from '../components/comida';
import {
  getDailySummary,
  addMeal,
  updateMeal,
  deleteMeal,
} from '../services/mealService';
import { estimateNutrition } from '../services/nutritionVisionService';
import { useAuth } from '../context';
import { formatDate } from '../services/utils';
import type {
  DailyMealSummary,
  MealRecord,
  NewMeal,
} from '../types/meal';

export default function ComidaScreen() {
  const { user } = useAuth();
  const [date] = useState(() => formatDate(new Date()));
  const [summary, setSummary] = useState<DailyMealSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealRecord | null>(null);

  const reloadAll = useCallback(async () => {
    if (!user) return;
    const daily = await getDailySummary(user.id, date);
    setSummary(daily);
  }, [user, date]);

  useEffect(() => {
    (async () => {
      try {
        await reloadAll();
      } finally {
        setLoading(false);
      }
    })();
  }, [reloadAll]);

  const handleSaveMeal = async (data: NewMeal, id?: number) => {
    if (id) {
      await updateMeal(id, data);
    } else {
      await addMeal(data);
    }
    await reloadAll();
  };

  const handleDeleteMeal = (id: number) => {
    Alert.alert(
      'Eliminar comida',
      '¿Seguro que deseas eliminar este registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteMeal(id);
            await reloadAll();
          },
        },
      ],
    );
  };

  const openNewModal = () => {
    setEditingMeal(null);
    setModalVisible(true);
  };

  const openEditModal = (meal: MealRecord) => {
    setEditingMeal(meal);
    setModalVisible(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#e94560" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Comida</Text>
            <Text style={styles.headerSubtitle}>{date}</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={openNewModal}>
            <Ionicons name="add" size={18} color="#e94560" />
            <Text style={styles.addBtnText}>Añadir</Text>
          </TouchableOpacity>
        </View>

        {summary ? <CardResumenCalorias summary={summary} /> : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Comidas del día</Text>
        </View>

        {summary && summary.meals.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={40} color="#2a2a4a" />
            <Text style={styles.emptyText}>Sin comidas registradas</Text>
            <Text style={styles.emptySubtext}>
              Añade tu primera comida para llevar el control de calorías y macronutrientes
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {summary?.meals.map((meal) => (
              <CardComidaItem
                key={meal.id}
                meal={meal}
                onEdit={openEditModal}
                onDelete={handleDeleteMeal}
              />
            ))}
          </View>
        )}

        {summary ? (
          <RecomendacionesAlimentacionCard goal={summary.goal} />
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <ModalAgregarComida
        visible={modalVisible}
        userId={user?.id ?? 0}
        date={date}
        editingMeal={editingMeal}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveMeal}
        onEstimate={estimateNutrition}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  content: {
    paddingTop: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#a0a0b8',
    fontSize: 13,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
  },
  addBtnText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#a0a0b8',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  emptySubtext: {
    color: '#7a7a96',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 24,
  },
});