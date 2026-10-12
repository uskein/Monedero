/**
 * Card (móvil) — manual SSOT §7.3. Elevación suave, radio 24, sin borde oscuro.
 * RN no soporta sombras duales idénticas a CSS: approx. con shadowColor cálido.
 */
import { StyleSheet, View } from 'react-native';
import type { ViewProps } from 'react-native';
import { csColors, csRadius, csSpace } from '@monedero/tokens';

export type CardProps = ViewProps;

export function Card({ children, style, ...rest }: CardProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: csColors.surface,
    borderRadius: csRadius.card,
    padding: csSpace.s5,
    shadowColor: 'rgb(60, 50, 40)',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
});
