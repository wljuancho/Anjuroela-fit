import { colors } from '../../theme/colors';
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AppTextInput from '../AppTextInput';
import AppButton from '../AppButton';
import type { NewBodyPart } from '../../types/exercise';

interface ModalNuevaCategoriaProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: NewBodyPart) => Promise<void>;
}

export default function ModalNuevaCategoria({
  visible,
  onClose,
  onSave,
}: ModalNuevaCategoriaProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setName('');
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await onSave({ name: name.trim() });
      resetForm();
      onClose();
    } catch {
      setError('Error al guardar la categoría');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Nueva Categoría</Text>

          <AppTextInput
            label="Nombre de la parte del cuerpo"
            placeholder="Ej: Antebrazos"
            value={name}
            onChangeText={setName}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <AppButton
            title="Guardar Categoría"
            onPress={handleSave}
            loading={saving}
            style={styles.saveButton}
          />

          <AppButton
            title="Cancelar"
            variant="outline"
            onPress={handleClose}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.cardAlt,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  errorText: {
    color: colors.primary,
    fontSize: 13,
    marginBottom: 12,
  },
  saveButton: {
    marginBottom: 12,
  },
});
