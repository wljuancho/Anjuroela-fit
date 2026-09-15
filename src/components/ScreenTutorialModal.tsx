import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import AppButton from './AppButton';
import { getStoredCurrentUserId } from '../services/sessionStorage';
import { getTutorialCompleted, setTutorialCompleted } from '../services/storage';

export interface ScreenTutorialPoint {
  text: string;
  icon?: keyof typeof Ionicons.glyphMap;
  warning?: boolean;
}

interface ScreenTutorialModalProps {
  screenId: string;
  title: string;
  points: ScreenTutorialPoint[];
  buttonText?: string;
}

// Modal informativo por pantalla. Se muestra automáticamente la primera vez que
// el usuario activo visita la pantalla (clave tutorial_completed_{userId}_{screenId})
// y queda guardado como completado al pulsar "Entendido", de modo que no vuelve
// a aparecer para ese usuario en este dispositivo.
export default function ScreenTutorialModal({
  screenId,
  title,
  points,
  buttonText = '¡Entendido!',
}: ScreenTutorialModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userId = await getStoredCurrentUserId();
      if (userId === null) return;
      const done = await getTutorialCompleted(userId, screenId);
      if (!cancelled && !done) {
        setVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screenId]);

  async function handleComplete() {
    const userId = await getStoredCurrentUserId();
    if (userId !== null) {
      await setTutorialCompleted(userId, screenId);
    }
    setVisible(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="bulb-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <ScrollView
            style={styles.pointsScroll}
            contentContainerStyle={styles.pointsContent}
            showsVerticalScrollIndicator={false}
          >
            {points.map((point, index) => (
              <View
                key={index}
                style={[styles.pointRow, point.warning ? styles.pointRowWarning : null]}
              >
                <View
                  style={[
                    styles.pointBullet,
                    point.warning ? styles.pointBulletWarning : null,
                  ]}
                >
                  <Ionicons
                    name={point.icon ?? (point.warning ? 'alert-circle' : 'checkmark')}
                    size={16}
                    color={point.warning ? colors.warning : colors.primary}
                  />
                </View>
                <Text style={[styles.pointText, point.warning ? styles.pointTextWarning : null]}>
                  {point.text}
                </Text>
              </View>
            ))}
          </ScrollView>
          <AppButton title={buttonText} onPress={handleComplete} style={styles.button} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrimStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '82%',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 18,
    padding: 24,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 18,
  },
  pointsScroll: {
    marginBottom: 20,
  },
  pointsContent: {
    gap: 14,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pointRowWarning: {
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  pointBullet: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  pointBulletWarning: {
    backgroundColor: colors.warningSoft,
  },
  pointText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  pointTextWarning: {
    color: colors.text,
  },
  button: {},
});