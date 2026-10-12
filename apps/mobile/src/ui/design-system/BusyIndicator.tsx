/**
 * BusyIndicator (móvil) — carga con IDENTIDAD Clay Serenity (manual §7.5).
 * La «M» del wordmark pulsa (csLogo) mientras se deriva la clave (PBKDF2
 * ~1-3 s en dispositivo): convierte una espera opaca en un proceso visible
 * y sereno. Respeta «reducir movimiento» (AccessibilityInfo). Nunca roba
 * el foco; anuncia el estado vía accessibilityRole progressbar + liveRegion.
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { csColors, csLogo, csSpace } from '@monedero/tokens';

export interface BusyIndicatorProps {
  /** Estado actual («Descifrando…», «Cifrando…», «Cargando…») — i18n en caller. */
  label: string;
  /** Copy sereno explicando la espera (i18n en caller). */
  copy?: string;
}

export function BusyIndicator({ label, copy }: BusyIndicatorProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let loop: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!active || reduceMotion) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      active = false;
      loop?.stop();
    };
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={styles.wrap}
    >
      <Animated.View style={[styles.tile, { transform: [{ scale }], opacity }]}>
        <Text style={styles.tileLetter}>M</Text>
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
      {copy ? <Text style={styles.copy}>{copy}</Text> : null}
    </View>
  );
}

const TILE_SIZE = 64;

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: csSpace.s3,
    paddingVertical: csSpace.s4,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: TILE_SIZE * csLogo.radiusRatio,
    backgroundColor: csLogo.tileBg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgb(60, 50, 40)',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  tileLetter: {
    color: csLogo.tileLetter,
    fontFamily: csLogo.font,
    fontWeight: '700',
    fontSize: 32,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: csColors.textPrimary,
  },
  copy: {
    fontSize: 13,
    lineHeight: 20,
    color: csColors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
});
