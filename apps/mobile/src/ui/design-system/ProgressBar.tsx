/**
 * ProgressBar (móvil) — barra presupuestaria Clay (manual SSOT §7.5).
 * Filosofía serena: base → accent al 80 % → danger al 100 %. Combinar SIEMPRE
 * con texto/porcentaje visible en la UI (nunca solo color). RN: rol
 * progressbar + accessibilityValue. Temático (HU-17).
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { csRadius } from '@monedero/tokens';
import { useThemeColors } from '../theme';

export interface ProgressBarProps {
  /** 0–100+; >100 se satura al 100 % con tono over (danger). */
  percent: number;
  /** Etiqueta a11y (i18n en caller). */
  label: string;
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const clamped = Math.max(0, Math.min(100, percent));
  const tone = percent >= 100 ? 'over' : percent >= 80 ? 'warn' : 'base';
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
      style={styles.track}
    >
      <View
        style={[
          styles.fill,
          tone === 'warn' ? styles.warn : tone === 'over' ? styles.over : null,
          { width: `${clamped}%` as DimensionValue },
        ]}
      />
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    track: {
      height: 10,
      borderRadius: csRadius.pill,
      backgroundColor: c.surfaceSunken,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius: csRadius.pill,
      backgroundColor: c.primary,
    },
    warn: { backgroundColor: c.accent },
    over: { backgroundColor: c.danger },
  });
}
