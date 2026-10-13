/**
 * Button (móvil) — manual SSOT §7.1. Altura 52 (toque), radio 18, primario único por vista.
 * Texto SIEMPRE via props (i18n en caller). Temático (HU-17): colores por tema.
 */
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { PressableProps } from 'react-native';
import { csRadius, csSpace } from '@monedero/tokens';
import { useThemeColors } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: ButtonVariant;
  label: string;
}

export function Button({ variant = 'primary', label, disabled, ...rest }: ButtonProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
      <Text style={[styles.label, isPrimary || variant === 'secondary' ? styles.labelOnFill : null]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    base: {
      minHeight: 52,
      borderRadius: csRadius.button,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: csSpace.s5,
    },
    primary: { backgroundColor: c.primary },
    secondary: { backgroundColor: c.surfaceSunken },
    ghost: { backgroundColor: 'transparent' },
    pressed: { opacity: 0.82 },
    disabled: { opacity: 0.45 },
    label: { fontSize: 16, fontWeight: '600', color: c.textPrimary },
    labelOnFill: { color: c.textOnPrimary },
  });
}
