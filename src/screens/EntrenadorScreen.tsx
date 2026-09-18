import { colors } from '../theme/colors';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
  Alert,
  type KeyboardEvent,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MessageBubble } from '../components/entrenador';
import { ScreenTutorialModal } from '../components';
import type { ScreenTutorialPoint } from '../components/ScreenTutorialModal';
import {
  sendCoachMessage,
  executeRoutineProposal,
  executeWeeklyMealProposal,
} from '../services/coachService';
import { getVisionApiKey } from '../services/configService';
import {
  getStoredChat,
  storeChat,
  appendChatMessage,
  clearStoredChat,
} from '../services/chatStorage';
import { useAuth } from '../context';
import { uuid } from '../services/utils';
import type { ChatMessage } from '../types/coach';

const WELCOME_MESSAGE =
  '¡Hola! Soy Anjuroela, tu entrenador personal.\n\n' +
  'Te conozco: peso, progreso, rutina, ejercicios y calorías. Puedo ayudarte a:\n' +
  '• Crear o ajustar tu rutina y ejercicios semana a semana.\n' +
  '• Generar un plan de comidas semanal.\n' +
  '• Resolver dudas sobre entrenamiento y alimentación.\n\n' +
  '¿Qué hacemos hoy?';

export default function EntrenadorScreen() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [keyboardScreenY, setKeyboardScreenY] = useState<number | null>(null);
  const [composerBottom, setComposerBottom] = useState(0);
  const scrollRef = useRef<FlatList<ChatMessage>>(null);
  const userId = user?.id;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: KeyboardEvent) => {
      setKeyboardScreenY(event.endCoordinates.screenY);
    };
    const onHide = () => {
      setKeyboardScreenY(null);
    };
    const show = Keyboard.addListener(showEvent, onShow);
    const hide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (userId == null) return;
    let active = true;
    (async () => {
      const stored = await getStoredChat(userId);
      if (!active) return;
      if (stored && stored.length > 0) {
        setMessages(stored);
      } else {
        setMessages([{ id: uuid(), role: 'coach', text: WELCOME_MESSAGE }]);
      }
      setChatLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const navigation = useNavigation();

  // Persistencia del historial (cada vez que cambian los mensajes se guarda)
  useEffect(() => {
    if (userId == null || !chatLoaded || messages.length === 0) return;
    const timer = setTimeout(() => {
      storeChat(userId, messages);
    }, 250);
    return () => clearTimeout(timer);
  }, [messages, userId, chatLoaded]);

  const handleClearChat = useCallback(async () => {
    if (userId == null) return;
    try {
      await clearStoredChat(userId);
    } finally {
      setMessages([{ id: uuid(), role: 'coach', text: WELCOME_MESSAGE }]);
    }
  }, [userId]);

  const confirmClearChat = useCallback(() => {
    Alert.alert(
      'Limpiar historial de conversación',
      'Se vaciará todo el historial del chat con tu entrenador. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpiar', style: 'destructive', onPress: () => void handleClearChat() },
      ],
    );
  }, [handleClearChat]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={confirmClearChat}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Limpiar historial de conversación"
        >
          <Ionicons name="trash-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, confirmClearChat]);

  // Al enfocar la pestaña se re-verifica la API Key, así el banner desaparece
  // en cuanto el usuario guarda o borra la clave en Ajustes.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getVisionApiKey()
        .then((key) => {
          if (active) setHasApiKey(!!key);
        })
        .catch(() => {
          if (active) setHasApiKey(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const scrollToEnd = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
  }, []);

  useEffect(() => {
    scrollToEnd();
  }, [messages, sending, scrollToEnd]);

  const pushMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending || !user) return;
    setInput('');
    setSending(true);
    const userMsg: ChatMessage = { id: uuid(), role: 'user', text };
    pushMessage(userMsg);
    // Se guarda el mensaje del usuario de inmediato: aunque cierres la pantalla
    // o la app, el mensaje enviado queda en el historial.
    await appendChatMessage(user.id, userMsg);

    try {
      const outcome = await sendCoachMessage(user.id, text, messages);
      const coachMsg: ChatMessage = {
        id: uuid(),
        role: 'coach',
        text: outcome.message,
        proposal: outcome.proposal,
        proposalStatus: outcome.proposal ? 'pending' : undefined,
      };
      pushMessage(coachMsg);
      await appendChatMessage(user.id, coachMsg);
    } catch {
      const errorMsg: ChatMessage = {
        id: uuid(),
        role: 'coach',
        text: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
      };
      pushMessage(errorMsg);
      await appendChatMessage(user.id, errorMsg);
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async (message: ChatMessage) => {
    const proposal = message.proposal;
    if (!proposal) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id ? { ...m, proposalStatus: 'applied' } : m,
      ),
    );

    try {
      const resultText =
        proposal.kind === 'rutina'
          ? await executeRoutineProposal(proposal.actions ?? [])
          : await executeWeeklyMealProposal(
              proposal.plan ?? [],
              proposal.servings ?? 1,
              proposal.expiresAt,
            );
      pushMessage({ id: uuid(), role: 'coach', text: resultText });
    } catch (e) {
      const detail = e instanceof Error ? e.message : 'error inesperado';
      pushMessage({
        id: uuid(),
        role: 'coach',
        text: `No se pudieron aplicar los cambios: ${detail}`,
      });
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, proposalStatus: 'error' } : m,
        ),
      );
    }
  };

  const handleCancel = (message: ChatMessage) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id ? { ...m, proposalStatus: 'cancelled' } : m,
      ),
    );
  };

  const keyboardGap =
    keyboardScreenY == null ? 0 : Math.max(composerBottom - keyboardScreenY, 0);

  return (
    <View style={styles.safe}>
      {hasApiKey === false ? (
        <View style={styles.keyBanner}>
          <Ionicons name="key-outline" size={16} color={colors.warning} />
          <Text style={styles.keyBannerText}>
            Configura tu API Key en Ajustes para activar el entrenador de IA.
          </Text>
        </View>
      ) : null}

      <FlatList
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        data={messages}
        keyExtractor={(message) => message.id}
        renderItem={({ item }) => (
          <MessageBubble
            key={item.id}
            message={item}
            onAccept={handleAccept}
            onCancel={handleCancel}
          />
        )}
        ListFooterComponent={
          sending ? (
            <View style={styles.typingRow}>
              <View style={[styles.bubble, styles.typingBubble]}>
                <Text style={styles.coachName}>Anjuroela</Text>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            </View>
          ) : null
        }
      />

      <View
        style={[styles.composer, keyboardGap > 0 ? { marginBottom: keyboardGap } : null]}
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          const absoluteY = (event.nativeEvent.layout as { screenY?: number }).screenY ?? y;
          setComposerBottom(absoluteY + height);
        }}
      >
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Escribe tu mensaje..."
          placeholderTextColor={colors.textSubtle}
          multiline
          maxLength={500}
          onFocus={scrollToEnd}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) ? styles.sendBtnDisabled : null]}
          onPress={sendMessage}
          disabled={!input.trim() || sending}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje"
        >
          <Ionicons name="send" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScreenTutorialModal
        screenId="entrenador"
        title="¿Cómo funciona el Entrenador?"
        points={ENTRENADOR_TUTORIAL_POINTS}
      />
    </View>
  );
}

const ENTRENADOR_TUTORIAL_POINTS: ScreenTutorialPoint[] = [
  {
    text: 'Configura tu API Key en Ajustes. Una vez activa, habla con la IA como tu entrenador personal para pedirle rutinas o planes de comida adaptados a tus metas.',
    icon: 'chatbubbles-outline',
  },
];

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  keyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.warningSoft,
    borderBottomWidth: 1,
    borderBottomColor: colors.warning,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  keyBannerText: {
    color: colors.warning,
    fontSize: 12,
    flex: 1,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  typingRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  typingBubble: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  bubble: {
    maxWidth: '86%',
  },
  coachName: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});