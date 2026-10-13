/**
 * Card (móvil) — manual SSOT §7.3. Elevación suave, radio 24, sin borde oscuro.
 * RN no soporta sombras duales idénticas a CSS: approx. con shadowColor cálido.
 * Temático (HU-17): superficie por tema.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ViewProps } from 'react-native';
import { csRadius, csSpace } from '@monedero/tokens';
import { useThemeColors } from '../theme';

export type CardProps = ViewProps;

export function Card({ children, style, ...rest }: CardProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: csRadius.card,
      padding: csSpace.s5,
      shadowColor: 'rgb(60, 50, 40)',
      shadowOpacity: 0.12,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 10 },
      elevation: 4,
    },
  });
}
