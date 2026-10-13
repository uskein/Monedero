/**
 * Input (móvil) — manual SSOT §7.4. Label SIEMPRE visible; error con role=alert.
 * RN: accessibilityLabel + accessibilityState invalid; font ≥16 (anti-zoom iOS).
 */
import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { csRadius, csSpace } from '@monedero/tokens';
import { useThemeColors } from '../theme';

export interface InputProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  secureTextEntry?: boolean;
}

export function Input({ label, value, onValueChange, placeholder, error, disabled, secureTextEntry }: InputProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.field}>
      <Text style={styles.label} nativeID={`${label}-label`}>
        {label}
      </Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, disabled ? styles.disabled : null]}
        value={value}
        onChangeText={onValueChange}
        placeholder={placeholder}
        placeholderTextColor={c.placeholder}
        editable={!disabled}
        secureTextEntry={secureTextEntry}
        accessibilityLabel={label}
        accessibilityState={{ disabled: Boolean(disabled) }}
        aria-invalid={Boolean(error) || undefined}
        accessibilityHint={error}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert">
          ⚠ {error}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    field: { gap: csSpace.s2 },
    label: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    input: {
      minHeight: 54,
      paddingHorizontal: csSpace.s4,
      backgroundColor: c.surfaceSunken,
      borderWidth: 2,
      borderColor: 'transparent',
      borderRadius: csRadius.input,
      fontSize: 16,
      color: c.textPrimary,
    },
    inputError: { borderColor: c.danger },
    disabled: { color: c.placeholder },
    error: { fontSize: 12, color: c.danger },
  });
}
