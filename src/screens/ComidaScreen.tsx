import { colors } from '../theme/colors';
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
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../components/AppButton';
import { ScreenTutorialModal } from '../components';
import type { ScreenTutorialPoint } from '../components/ScreenTutorialModal';
import {
  CardCaloriasDiarias,
  CardComidaItem,
  CardListaMercado,
  ModalEscanearComida,
  ModalOnboardingNutricional,
  ModalRecetaComida,
  PlanComidasSemanalCard,
} from '../components/comida';
import { estimateNutrition } from '../services/nutritionVisionService';
import {
  aggregateMarketList,
  clearWeeklyMealPlan,
  deleteWeeklyMealPlanItem,
  getNutritionProfile,
  getWeeklyMealPlan,
} from '../services/nutritionService';
import { useAuth } from '../context';
import { useNutritionData } from '../hooks/useNutritionData';
import { formatDate } from '../services/utils';
import type { NewMealLog, NutritionProfile, NutritionProfileInput, WeeklyMealPlanItem } from '../types/nutrition';

export default function ComidaScreen() {
  const { user, profile, reloadProfile } = useAuth();
  const [date, setDate] = useState(() => formatDate(new Date()));
  const { data, loading, error, reload, saveMeal, removeMeal, saveProfile } = useNutritionData(
    user?.id ?? '',
    date,
  );
  const [scanVisible, setScanVisible] = useState(false);
  const [nutriVisible, setNutriVisible] = useState(false);
  const [plan, setPlan] = useState<WeeklyMealPlanItem[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<WeeklyMealPlanItem | null>(null);
  const [nutritionProfile, setNutritionProfile] = useState<NutritionProfile | null>(null);

  useEffect(() => {
    if (user?.id) {
      getNutritionProfile(user.id)
        .then(setNutritionProfile)
        .catch(() => {});
    }
  }, [user?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      const today = formatDate(new Date());
      setDate((prev) => (prev === today ? prev : today));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const refreshPlan = useCallback(() => {
    getWeeklyMealPlan()
      .then(setPlan)
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshPlan();
    }, [refreshPlan]),
  );

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
    }
  }, [error]);

  const handleDeleteMeal = (id: number) => {
    Alert.alert('Eliminar comida', '¿Seguro que deseas eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await removeMeal(id); } },
    ]);
  };

  const handleConfirmMeal = async (meal: NewMealLog) => {
    await saveMeal(meal);
  };

  const handleSaveNutritionProfile = async (tdeeInput: NutritionProfileInput) => {
    await saveProfile(tdeeInput);
    await reloadProfile();
    if (user?.id) {
      try {
        setNutritionProfile(await getNutritionProfile(user.id));
      } catch {}
    }
  };

  const handleDeletePlanMeal = (id: number) => {
    Alert.alert('Eliminar platillo', '¿Seguro que deseas eliminar este platillo del plan?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          await deleteWeeklyMealPlanItem(id);
          refreshPlan();
        },
      },
    ]);
  };

  const handleClearPlan = () => {
    Alert.alert(
      'Limpiar Plan Completo',
      '¿Eliminar todas las comidas programadas del plan actual?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpiar',
          style: 'destructive',
          onPress: async () => {
            await clearWeeklyMealPlan();
            refreshPlan();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const needNutriProfile = !data || data.goal === null;
  const weightKg = profile?.currentWeight ?? 70;
  const marketItems = aggregateMarketList(plan);
  const planStart =
    plan.length > 0
      ? plan.reduce((min, r) => (r.date && r.date < min ? r.date : min), plan[0].date)
      : '';
  const planExpires =
    plan.length > 0
      ? plan.reduce((max, r) => (r.expires_at && r.expires_at > max ? r.expires_at : max), plan[0].expires_at)
      : '';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Comida</Text>
            <Text style={styles.headerSubtitle}>{date}</Text>
          </View>
        </View>

        {needNutriProfile ? (
          <View style={styles.onboardCard}>
            <View style={styles.onboardIconWrap}>
              <Ionicons name="calculator-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.onboardInfo}>
              <Text style={styles.onboardTitle}>Configura tu contador de calorías</Text>
              <Text style={styles.onboardText}>
                Responde unas preguntas y calcularemos tu meta diaria de calorías (TDEE).
              </Text>
              <AppButton
                title="Realizar test"
                onPress={() => setNutriVisible(true)}
                style={styles.onboardBtn}
              />
            </View>
          </View>
        ) : null}

        {data ? (
          <CardCaloriasDiarias data={data} onEditStrategy={() => setNutriVisible(true)} />
        ) : null}

        <TouchableOpacity
          style={styles.scanCard}
          onPress={() => setScanVisible(true)}
          activeOpacity={0.8}
        >
          <View style={styles.scanIconWrap}>
            <Ionicons name="camera-outline" size={22} color={colors.text} />
          </View>
          <View style={styles.scanInfo}>
            <Text style={styles.scanTitle}>Escanear Comida con Foto</Text>
            <Text style={styles.scanSubtitle}>La IA estimará las calorías de tu plato</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Comidas del día</Text>
        </View>

        {data && data.meals.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={40} color={colors.cardAlt} />
            <Text style={styles.emptyText}>Sin comidas registradas hoy</Text>
            <Text style={styles.emptySubtext}>
              Escanea tu comida o registra tus calorías para llevar el control del día
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {data?.meals.map((meal) => (
              <CardComidaItem key={meal.id} meal={meal} onDelete={handleDeleteMeal} />
            ))}
          </View>
        )}

        <PlanComidasSemanalCard
          plan={plan}
          onSelectMeal={setSelectedMeal}
          onDeleteMeal={handleDeletePlanMeal}
          onClearPlan={handleClearPlan}
        />

        {plan.length > 0 && marketItems.length > 0 ? (
          <CardListaMercado items={marketItems} startDate={planStart} expiresAt={planExpires} />
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <ModalEscanearComida
        visible={scanVisible}
        date={date}
        onClose={() => setScanVisible(false)}
        onConfirm={handleConfirmMeal}
        onEstimate={estimateNutrition}
      />

      <ModalRecetaComida
        meal={selectedMeal}
        visible={!!selectedMeal}
        onClose={() => setSelectedMeal(null)}
      />

      <ModalOnboardingNutricional
        visible={nutriVisible}
        weightKg={weightKg}
        heightCm={profile?.heightCm ?? 0}
        prefill={{
          age: profile?.age,
          heightCm: profile?.heightCm,
          activityLevel: nutritionProfile?.activityLevel,
          goalType: nutritionProfile?.goalType,
          dailyCaloriesGoal: nutritionProfile?.dailyCaloriesGoal,
        }}
        onClose={() => setNutriVisible(false)}
        onSave={async (tdeeInput) => {
          await handleSaveNutritionProfile(tdeeInput);
          await reload();
        }}
      />

      <ScreenTutorialModal
        screenId="comida"
        title="¿Cómo funciona Comida?"
        points={COMIDA_TUTORIAL_POINTS}
      />
    </SafeAreaView>
  );
}

const COMIDA_TUTORIAL_POINTS: ScreenTutorialPoint[] = [
  {
    text: 'Para habilitar el scanner con IA, primero crea tu API Key gratuita en Google AI Studio (https://aistudio.google.com/api-keys?project=gen-lang-client-0135307545), ve a Ajustes, pégala, prueba la conexión y guárdala.',
    icon: 'key-outline',
  },
  {
    text: 'Realiza el test de déficit calórico para conocer tu consumo meta diario.',
    icon: 'calculator-outline',
  },
  {
    text: 'Si configuraste la API Key, tómale foto a tu plato para recibir un aproximado estimado (no verídico) de tus calorías.',
    icon: 'camera-outline',
  },
];

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  onboardCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  onboardIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primarySofter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onboardInfo: {
    flex: 1,
  },
  onboardTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  onboardText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 10,
  },
  onboardBtn: {
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingVertical: 8,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  scanIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanInfo: {
    flex: 1,
  },
  scanTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  scanSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: colors.text,
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
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  emptySubtext: {
    color: colors.textSubtle,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 24,
  },
});