/**
 * IconButton (móvil) — botón de acción circular del manual §7 (área táctil
 * 44 dp, radio pill). Tonos: `primary` (fondo verde identidad + icono
 * blanco) · `danger` (fondo rojo sereno + icono blanco) · `neutral` (hundido
 * + icono de tinta). El nombre accesible lo aporta el caller (i18n).
 */
import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import type { PressableProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { csRadius } from '@monedero/tokens';
import { useThemeColors } from '../theme';

export type IconButtonTone = 'primary' | 'danger' | 'neutral';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: IconButtonTone;
  size?: number;
}

export function IconButton({ icon, label, tone = 'neutral', size = 20, disabled, ...rest }: IconButtonProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const filled = tone !== 'neutral';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        tone === 'primary' ? styles.primary : tone === 'danger' ? styles.danger : styles.neutral,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      {...rest}
    >
      <Ionicons name={icon} size={size} color={filled ? c.textOnPrimary : c.textPrimary} />
    </Pressable>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    base: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: csRadius.pill,
    },
    primary: { backgroundColor: c.primary },
    danger: { backgroundColor: c.danger },
    neutral: { backgroundColor: c.surfaceSunken },
    pressed: { opacity: 0.82 },
    disabled: { opacity: 0.45 },
  });
}
