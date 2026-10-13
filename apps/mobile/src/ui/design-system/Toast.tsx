/**
 * Toast (móvil) — feedback sereno (manual SSOT §7.5), espejo del de la PWA.
 * role=alert SOLO en tono error (assertive); warn/success con liveRegion
 * polite. NUNCA roba el foco ni bloquea la UI. Se auto-cierra (4000 ms por
 * defecto, HU-12) invocando onDismiss. Temático (HU-17).
 */
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { csRadius, csSpace } from '@monedero/tokens';
import { useThemeColors } from '../theme';

export type ToastTone = 'success' | 'warn' | 'error';

export interface ToastProps {
  tone: ToastTone;
  message: string;
  /** Si se provee, el toast se cierra solo tras durationMs. */
  onDismiss?: () => void;
  durationMs?: number;
}

export function Toast({ tone, message, onDismiss, durationMs = 4000 }: ToastProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  useEffect(() => {
    if (!onDismiss) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, durationMs]);

  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
      style={[styles.toast, tone === 'warn' ? styles.warn : tone === 'error' ? styles.error : styles.success]}
    >
      <Text style={[styles.text, tone !== 'warn' ? styles.textOnFill : null]}>{message}</Text>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    toast: {
      borderRadius: csRadius.card,
      padding: csSpace.s4,
    },
    success: { backgroundColor: c.primarySoft },
    warn: { backgroundColor: c.accent },
    error: { backgroundColor: c.danger },
    text: {
      fontSize: 14,
      lineHeight: 22,
      color: c.textPrimary,
    },
    textOnFill: { color: c.textOnPrimary },
  });
}
