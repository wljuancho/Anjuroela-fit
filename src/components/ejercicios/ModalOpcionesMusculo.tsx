import { colors } from '../../theme/colors';
import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BodyPart } from '../../types/exercise';

interface ModalOpcionesMusculoProps {
  visible: boolean;
  bodyPart: BodyPart | null;
  onClose: () => void;
  onEditName: (bodyPart: BodyPart) => void;
  onDelete: (bodyPart: BodyPart) => void;
}

export default function ModalOpcionesMusculo({
  visible,
  bodyPart,
  onClose,
  onEditName,
  onDelete,
}: ModalOpcionesMusculoProps) {
  const handleEdit = () => {
    if (!bodyPart) return;
    onEditName(bodyPart);
  };

  const handleDelete = () => {
    if (!bodyPart) return;
    onDelete(bodyPart);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Opciones de Músculo</Text>
          <Text style={styles.subtitle}>{bodyPart?.name ?? ''}</Text>

          <TouchableOpacity style={styles.option} onPress={handleEdit}>
            <View style={styles.optionIcon}>
              <Ionicons name="pencil-outline" size={20} color={colors.text} />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionText}>Editar nombre</Text>
              <Text style={styles.optionHint}>Renombrar esta parte del cuerpo</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleDelete}>
            <View style={[styles.optionIcon, styles.optionIconDanger]}>
              <Ionicons name="trash-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionTextDanger}>Eliminar categoría</Text>
              <Text style={styles.optionHint}>
                Se borrará la categoría y sus ejercicios
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.cardAlt,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionIconDanger: {
    backgroundColor: colors.primarySoft,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  optionTextDanger: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  optionHint: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 25,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 16,
    fontWeight: '600',
  },
});