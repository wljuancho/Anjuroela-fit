import { colors } from '../theme/colors';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { Ionicons } from '@expo/vector-icons';
import { MessageBubble } from '../components/entrenador';
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
  const headerHeight = useHeaderHeight();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [chatLoaded, setChatLoaded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const userId = user?.id;

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

  // Persistencia del historial (cada vez que cambian los mensajes se guarda)
  useEffect(() => {
    if (userId == null || !chatLoaded || messages.length === 0) return;
    const timer = setTimeout(() => {
      storeChat(userId, messages);
    }, 250);
    return () => clearTimeout(timer);
  }, [messages, userId, chatLoaded]);

  useEffect(() => {
    getVisionApiKey().then((key) => setHasApiKey(!!key)).catch(() => setHasApiKey(false));
  }, []);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        {hasApiKey === false ? (
          <View style={styles.keyBanner}>
            <Ionicons name="key-outline" size={16} color={colors.warning} />
            <Text style={styles.keyBannerText}>
              Configura tu API Key en Ajustes para activar el entrenador de IA.
            </Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onAccept={handleAccept}
              onCancel={handleCancel}
            />
          ))}
          {sending ? (
            <View style={styles.typingRow}>
              <View style={[styles.bubble, styles.typingBubble]}>
                <Text style={styles.coachName}>Anjuroela</Text>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Escribe tu mensaje..."
            placeholderTextColor={colors.textSubtle}
            multiline
            maxLength={500}
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
    paddingHorizontal: 12,
    paddingVertical: 10,
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