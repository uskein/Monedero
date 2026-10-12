/**
 * Button (móvil) — manual SSOT §7.1. Altura 52 (toque), radio 18, primario único por vista.
 * Texto SIEMPRE via props (i18n en caller).
 */
import { Pressable, StyleSheet, Text } from 'react-native';
import type { PressableProps } from 'react-native';
import { csColors, csRadius, csSpace } from '@monedero/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  label: string;
}

export function Button({ variant = 'primary', label, disabled, ...rest }: ButtonProps) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : variant === 'secondary' ? styles.secondary : styles.ghost,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.label,
          isPrimary ? styles.labelPrimary : variant === 'ghost' ? styles.labelGhost : styles.labelSecondary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: csSpace.s5,
    borderRadius: csRadius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: csColors.primary },
  secondary: { backgroundColor: csColors.surface },
  ghost: { backgroundColor: 'transparent', minHeight: 48 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  disabled: { backgroundColor: csColors.surfaceSunken },
  label: { fontSize: 15, fontWeight: '600' },
  labelPrimary: { color: csColors.textOnPrimary },
  labelSecondary: { color: csColors.textPrimary },
  labelGhost: { color: csColors.danger },
});
