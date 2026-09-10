import { colors } from '../theme/colors';
import React from 'react';
import { View, Text, TextInput, TextInputProps, StyleSheet } from 'react-native';

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  accessory?: React.ReactNode;
}

export default function AppTextInput({ label, error, style, accessory, ...rest }: AppTextInputProps) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        <TextInput
          style={[
            styles.input,
            accessory ? styles.inputWithAccessory : null,
            error ? styles.inputError : null,
            style,
          ]}
          placeholderTextColor={colors.textSubtle}
          {...rest}
        />
        {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 6,
    fontWeight: '500',
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardAlt,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  inputWithAccessory: {
    paddingRight: 48,
  },
  accessory: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  inputError: {
    borderColor: colors.primary,
  },
  errorText: {
    color: colors.primary,
    fontSize: 12,
    marginTop: 4,
  },
});
