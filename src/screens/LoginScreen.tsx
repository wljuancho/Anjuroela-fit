import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton, AppTextInput } from '../components';
import { useAuth } from '../context';
import { isValidEmail } from '../services/utils';

type Mode = 'login' | 'register';

export default function LoginScreen() {
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
  }

  function validate(): boolean {
    const next: Record<string, string | undefined> = {};
    if (!isValidEmail(email)) {
      next.email = 'Ingresa un correo válido.';
    }
    if (password.length < 6) {
      next.password = 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (mode === 'register') {
      if (!name.trim()) {
        next.name = 'Ingresa tu nombre.';
      }
      if (password !== confirmPassword) {
        next.confirmPassword = 'Las contraseñas no coinciden.';
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await signUp(name.trim(), email, password);
      } else {
        const ok = await signIn(email, password);
        if (!ok) {
          setErrors({ password: 'Correo o contraseña incorrectos.' });
          setSubmitting(false);
          return;
        }
      }
      // El RootNavigator redirige automáticamente según estado de sesión/perfil
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'Ocurrió un error inesperado.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setLoadingSession(true);
    try {
      // Mock local de Google Sign-In:
      // Reemplazar con expo-auth-session + Google cuando haya cliente configurado.
      await signInWithGoogle('Usuario Google', 'usuario.google@gmail.com', 'google-mock-1234');
    } catch (error) {
      setErrors({
        form: error instanceof Error ? error.message : 'Error al iniciar sesión con Google.',
      });
    } finally {
      setLoadingSession(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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

          <AppButton
            title={mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            onPress={handleSubmit}
            loading={submitting}
            style={styles.submitButton}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          <AppButton
            title="Continuar con Google"
            variant="secondary"
            onPress={handleGoogleSignIn}
            loading={loadingSession}
            style={styles.googleButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a1a2e',
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
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#a0a0b8',
    fontSize: 15,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#16213e',
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
    backgroundColor: '#e94560',
  },
  tabText: {
    color: '#a0a0b8',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  formError: {
    color: '#e94560',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  submitButton: {
    marginTop: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a2a4a',
  },
  dividerText: {
    color: '#a0a0b8',
    marginHorizontal: 12,
    fontSize: 13,
  },
  googleButton: {
    flexDirection: 'row',
  },
});
