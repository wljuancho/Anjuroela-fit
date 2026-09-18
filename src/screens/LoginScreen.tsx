import { colors } from '../theme/colors';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppButton, AppTextInput } from '../components';
import { useAuth } from '../context';
import { isValidEmail } from '../services/utils';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const showLoadingOverlay = submitting;
  const loadingText =
    mode === 'login'
      ? 'Iniciando sesión...'
      : 'Creando cuenta...';

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
    if (next !== 'register') {
      setAcceptedTerms(false);
    }
  }

  function validate(): boolean {
    const next: Record<string, string | undefined> = {};
    if (!isValidEmail(email)) {
      next.email = 'Ingresa un correo válido.';
    }
    if (password.length < 6) {
      next.password = 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (mode === 'register' && !name.trim()) {
      next.name = 'Ingresa tu nombre.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function hasEmptyFields(): boolean {
    if (mode === 'register') {
      return !name.trim() || !email.trim() || !password || !confirmPassword;
    }
    return !email.trim() || !password;
  }

  async function handleSubmit() {
    if (hasEmptyFields()) {
      setErrors({});
      Alert.alert('Campos incompletos', 'Por favor, completa todos los campos.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setErrors({ confirmPassword: 'Las contraseñas no coinciden.' });
      Alert.alert('Contraseñas', 'Las contraseñas no coinciden.');
      return;
    }

    if (mode === 'register' && !acceptedTerms) {
      setErrors({ terms: 'Debes aceptar los Términos y Condiciones para continuar.' });
      Alert.alert(
        'Términos y Condiciones',
        'Debes aceptar los Términos y Condiciones para continuar',
      );
      return;
    }

    if (!validate()) return;

    setSubmitting(true);
    try {
      if (mode === 'register') {
        await signUp(name.trim(), email, password);
        // signUp deja la sesión iniciada con el perfil aún vacío: el
        // RootNavigator redirige automáticamente al Onboarding para completar
        // el cuestionario de metas/calorías (no hace falta un segundo login).
      } else {
        const ok = await signIn(email, password);
        if (!ok) {
          Alert.alert(
            'Error de inicio de sesión',
            'Credenciales incorrectas o usuario no encontrado.',
          );
          return;
        }
        // El RootNavigator redirige automáticamente según estado de sesión/perfil
      }
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.logo}>Anjuroela Fit</Text>
            <Text style={styles.subtitle}>
              {mode === 'login'
                ? 'Inicia sesión para continuar'
                : 'Crea tu cuenta para comenzar'}
            </Text>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' ? styles.tabActive : null]}
              onPress={() => switchMode('login')}
            >
              <Text style={[styles.tabText, mode === 'login' ? styles.tabTextActive : null]}>
                Iniciar sesión
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'register' ? styles.tabActive : null]}
              onPress={() => switchMode('register')}
            >
              <Text style={[styles.tabText, mode === 'register' ? styles.tabTextActive : null]}>
                Registrarse
              </Text>
            </TouchableOpacity>
          </View>

          {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

          {mode === 'register' ? (
            <AppTextInput
              label="Nombre"
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              error={errors.name}
              autoCapitalize="words"
            />
          ) : null}

          <AppTextInput
            label="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            placeholder="tucorreo@ejemplo.com"
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <AppTextInput
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            error={errors.password}
            secureTextEntry
          />

          {mode === 'register' ? (
            <AppTextInput
              label="Confirmar contraseña"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              error={errors.confirmPassword}
              secureTextEntry
            />
          ) : null}

          {mode === 'register' ? (
            <View style={styles.termsRow}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setAcceptedTerms((prev) => !prev)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: acceptedTerms }}
              >
                <Ionicons
                  name={acceptedTerms ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={acceptedTerms ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>
              <Text style={styles.termsLabel}>
                Acepto los{' '}
                <Text style={styles.termsLink} onPress={() => setShowTerms(true)}>
                  Términos y Condiciones de Uso
                </Text>
              </Text>
            </View>
          ) : null}
          {errors.terms ? <Text style={styles.formError}>{errors.terms}</Text> : null}

          <AppButton
            title={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submitButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {showLoadingOverlay ? (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>{loadingText}</Text>
          </View>
        </View>
      ) : null}

      <Modal
        visible={showTerms}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTerms(false)}
      >
        <View style={styles.termsBackdrop}>
          <View style={styles.termsCard}>
            <Text style={styles.termsTitle}>Términos y Condiciones de Uso</Text>
            <ScrollView style={styles.termsScroll}>
              <Text style={styles.termsBody}>
                Al usar Anjuroela Fit aceptas que:{'\n\n'}
                {'\u2022'} La información ofrecida (rutinas, ejercicios y nutrición) es{' '}
                <Text style={styles.termsBold}>informativa y de bienestar</Text>, no sustituye
                consejo médico profesional.{'\n\n'}
                {'\u2022'} Consulta a un profesional de la salud antes de comenzar cualquier
                programa de ejercicio o cambios en tu alimentación.{'\n\n'}
                {'\u2022'} Tus datos (perfil, peso, progreso) se usan únicamente para{' '}
                <Text style={styles.termsBold}>personalizar tu experiencia</Text>, respetando tu
                privacidad conforme a nuestra política de uso.{'\n\n'}
                {'\u2022'} Eres responsable del uso responsable de la app; la plataforma no se
                hace responsable por lesiones o resultados derivados del mal uso.{'\n\n'}
                {'\u2022'} Puedes eliminar tu cuenta y tus datos en cualquier momento desde el
                perfil.
              </Text>
            </ScrollView>
            <AppButton title="Entendido" onPress={() => setShowTerms(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 14,
  },
  loadingText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  flex: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 10,
    marginBottom: 24,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: colors.text,
  },
  formError: {
    color: colors.primary,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 8,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  checkbox: {
    padding: 4,
    marginRight: 4,
  },
  termsLabel: {
    color: colors.textMuted,
    fontSize: 14,
    flex: 1,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
  },
  termsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  termsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    maxHeight: '80%',
  },
  termsTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  termsScroll: {
    marginBottom: 16,
  },
  termsBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  termsBold: {
    color: colors.text,
    fontWeight: '600',
  },
});
