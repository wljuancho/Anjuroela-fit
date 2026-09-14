import { colors } from '../theme/colors';
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppButton } from '../components';
import { useTutorial } from '../context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Tutorial'>;

interface TutorialStep {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  badge?: string;
}

const STEPS: TutorialStep[] = [
  {
    icon: 'sparkles-outline',
    title: '1. Activa el Poder de la IA',
    description:
      'Para usar el Entrenador Inteligente y el Escáner de Comidas, ve a Ajustes e ingresa tu API Key gratuita de Google Gemini o de OpenAI.',
    badge: 'Paso obligatorio para la IA',
  },
  {
    icon: 'restaurant-outline',
    title: '2. Controla tus Calorías Diarias',
    description:
      'Calcula tu TDEE (déficit, mantenimiento o superávit) y tómale una foto a tu plato para que la IA registre automáticamente tus calorías y macronutrientes.',
  },
  {
    icon: 'barbell-outline',
    title: '3. Crea Rutinas con tu Entrenador IA',
    description:
      'Chatea con el Entrenador para diseñar rutinas para casa o gimnasio y generar planes de comida. Cada cambio requerirá tu autorización antes de guardarse.',
  },
];

export default function TutorialScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const initialIndex = useRef(0);
  const listRef = useRef<FlatList<TutorialStep>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const { completeTutorial } = useTutorial();

  const isLastStep = activeIndex === STEPS.length - 1;
  const totalWidth = Math.min(width, 720);

  function goNext() {
    if (isLastStep) {
      completeTutorial();
      return;
    }
    listRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
  }

  function goToSettings() {
    navigation.navigate('MainTabs', { screen: 'Ajustes' });
    completeTutorial();
  }

  function onMomentumEnd(event: {
    nativeEvent: { contentOffset: { x: number } };
  }) {
    const next = Math.round(event.nativeEvent.contentOffset.x / totalWidth);
    setActiveIndex(Math.max(0, Math.min(next, STEPS.length - 1)));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.skipRow}>
        <Pressable
          onPress={() => completeTutorial()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Omitir tutorial"
        >
          <Text style={styles.skipText}>Omitir</Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={STEPS}
        keyExtractor={(item) => item.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex.current}
        getItemLayout={(_, index) => ({
          length: totalWidth,
          offset: totalWidth * index,
          index,
        })}
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ width: undefined }}
        renderItem={({ item }) => (
          <View style={[styles.step, { width: totalWidth }]}>
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name={item.icon} size={54} color={colors.primary} />
              </View>
            </View>
            {item.badge ? (
              <View style={styles.badge}>
                <Ionicons name="key-outline" size={14} color={colors.warning} />
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            ) : null}
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {STEPS.map((step, index) => (
            <View
              key={step.title}
              style={[styles.dot, index === activeIndex ? styles.dotActive : null]}
            />
          ))}
        </View>

        {activeIndex === 0 && !isLastStep ? (
          <AppButton
            title="Ir a Ajustes ahora"
            variant="outline"
            onPress={goToSettings}
            style={styles.secondaryButton}
          />
        ) : null}
        <AppButton
          title={isLastStep ? '¡Empezar a Entrenar!' : 'Siguiente'}
          onPress={goNext}
          style={styles.primaryButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  skipText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  step: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 16,
  },
  badgeText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  description: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.cardAlt,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 22,
  },
  secondaryButton: {
    marginBottom: 10,
  },
  primaryButton: {},
});