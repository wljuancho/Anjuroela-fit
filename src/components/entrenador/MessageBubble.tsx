import { colors } from '../../theme/colors';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ChatMessage, RoutineAction } from '../../types/coach';

interface MessageBubbleProps {
  message: ChatMessage;
  onAccept: (message: ChatMessage) => void;
  onCancel: (message: ChatMessage) => void;
}

function describeAction(action: RoutineAction): string {
  switch (action.action) {
    case 'crear_musculo':
      return `Crear músculo "${action.name ?? ''}"`;
    case 'crear_ejercicio':
      return `Crear ejercicio "${action.name ?? ''}" en ${action.body_part_name ?? 'músculo'}`;
    case 'agregar_musculo_dia':
      return `Agregar "${action.body_part_name ?? ''}" al día ${action.day ?? ''}`;
    case 'agregar_ejercicio_dia':
      return `Agregar "${action.exercise_name ?? ''}" al día ${action.day ?? ''}`;
  }
}

function ProposalCard({
  message,
  onAccept,
  onCancel,
}: {
  message: ChatMessage;
  onAccept: () => void;
  onCancel: () => void;
}) {
  const proposal = message.proposal;
  if (!proposal) return null;

  const status = message.proposalStatus ?? 'pending';
  const title =
    proposal.kind === 'rutina'
      ? '¿Deseas aplicar estos cambios a tu rutina?'
      : '¿Guardar este menú semanal?';

  return (
    <View style={styles.proposalCard}>
      <View style={styles.proposalHeader}>
        <Ionicons
          name={proposal.kind === 'rutina' ? 'barbell-outline' : 'restaurant-outline'}
          size={18}
          color={colors.primary}
        />
        <Text style={styles.proposalTitle}>{title}</Text>
      </View>

      {proposal.kind === 'rutina' && proposal.actions ? (
        <View style={styles.actionList}>
          {proposal.actions.map((action, index) => (
            <Text selectable key={`${action.action}-${index}`} style={styles.actionLine}>
              • {describeAction(action)}
            </Text>
          ))}
        </View>
      ) : null}

      {proposal.kind === 'comidas' ? (
        <Text selectable style={styles.proposalSummary}>
          {proposal.summary}
        </Text>
      ) : null}

      {status === 'pending' ? (
        <View style={styles.proposalButtons}>
          <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
            <Ionicons name="checkmark" size={16} color={colors.text} />
            <Text style={styles.acceptText}>Aceptar y Agregar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {status === 'applied' ? (
        <View style={styles.appliedRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.appliedText}>Cambios aplicados</Text>
        </View>
      ) : null}

      {status === 'cancelled' ? (
        <Text style={styles.cancelledText}>Cambios cancelados.</Text>
      ) : null}

      {status === 'error' ? (
        <Text style={styles.errorText}>No se pudieron aplicar los cambios. Inténtalo de nuevo.</Text>
      ) : null}
    </View>
  );
}

export default function MessageBubble({ message, onAccept, onCancel }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowCoach]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.coachBubble]}>
        {!isUser ? <Text style={styles.coachName}>Anjuroela</Text> : null}
        <Text selectable style={isUser ? styles.userText : styles.coachText}>
          {message.text}
        </Text>
        {!isUser && message.proposal ? (
          <ProposalCard
            message={message}
            onAccept={() => onAccept(message)}
            onCancel={() => onCancel(message)}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowCoach: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '86%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  coachBubble: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderBottomLeftRadius: 4,
  },
  coachName: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  userText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  coachText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 20,
  },
  proposalCard: {
    marginTop: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    padding: 12,
  },
  proposalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  proposalTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  actionList: {
    marginBottom: 10,
  },
  actionLine: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  proposalSummary: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  proposalButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
  },
  acceptText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  appliedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  appliedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  cancelledText: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  errorText: {
    color: colors.primary,
    fontSize: 12,
  },
});