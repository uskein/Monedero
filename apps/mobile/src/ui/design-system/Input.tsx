/**
 * Input (móvil) — manual SSOT §7.4. Label SIEMPRE visible; error con role=alert.
 * RN: accessibilityLabel + accessibilityState invalid; font ≥16 (anti-zoom iOS).
 */
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { csColors, csRadius, csSpace } from '@monedero/tokens';

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
        placeholderTextColor={csColors.placeholder}
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

const styles = StyleSheet.create({
  field: { gap: csSpace.s2 },
  label: { fontSize: 13, fontWeight: '600', color: csColors.textMuted },
  input: {
    minHeight: 54,
    paddingHorizontal: csSpace.s4,
    backgroundColor: csColors.surfaceSunken,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: csRadius.input,
    fontSize: 16,
    color: csColors.textPrimary,
  },
  inputError: { borderColor: csColors.danger },
  disabled: { color: csColors.placeholder },
  error: { fontSize: 12, color: csColors.danger },
});
