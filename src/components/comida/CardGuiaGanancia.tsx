import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { formatNumber } from '../../services/utils';

interface CardGuiaGananciaProps {
  weightKg: number;
  proteinLoggedG: number;
}

export default function CardGuiaGanancia({ weightKg, proteinLoggedG }: CardGuiaGananciaProps) {
  const low = Math.round(weightKg * 1.4);
  const high = Math.round(weightKg * 2);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="barbell-outline" size={18} color={colors.primary} />
        <Text style={styles.title}>Apoyo para ganar masa muscular</Text>
      </View>
      <Text style={styles.body}>
        Como referencia general para adultos sanos que entrenan fuerza, el rango estudiado es de 1.4–2.0 g de proteína por kg: aproximadamente {formatNumber(low)}–{formatNumber(high)} g al día para tu peso.
      </Text>
      <Text style={styles.logged}>
        Registrado hoy: {formatNumber(proteinLoggedG, 1)} g. Solo cuenta comidas con proteína anotada; lo faltante no equivale a cero.
      </Text>
      <Text style={styles.note}>
        Acompaña la alimentación con fuerza progresiva y descanso. Es una referencia, no una prescripción; consulta a un profesional si tienes enfermedad renal u otra condición de salud.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  body: { color: colors.text, fontSize: 13, lineHeight: 19 },
  logged: { color: colors.primary, fontSize: 12, lineHeight: 17, marginTop: 8 },
  note: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 8 },
});
