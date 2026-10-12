/**
 * AppRoot — composición raíz móvil (inyección de puertos → UI).
 * MVP S1: «hola mundo» con tokens Clay Serenity. Proveedores reales (VaultGate, tema)
 * según BLUEPRINTS BP-01/BP-02 en S2.
 * Trazabilidad: ESTRUCTURA_DIRECTORIOS.md → apps/mobile/src/AppRoot.tsx
 */
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { csColors, csLogo, csSpace, csRadius } from '@monedero/tokens';

export default function AppRoot() {
  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.center}>
        <View style={styles.tile} accessibilityRole="image" accessibilityLabel="Monedero, logotipo">
          <Text style={styles.tileLetter}>M</Text>
        </View>
        <Text style={styles.title}>Monedero</Text>
        <Text style={styles.lead} accessibilityLiveRegion="polite">
          Gestor de gastos local — scaffold S1 listo. Tus datos nunca salen de tu dispositivo.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: csColors.bgBase,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: csSpace.s5,
  },
  tile: {
    width: 72,
    height: 72,
    borderRadius: 72 * csLogo.radiusRatio,
    backgroundColor: csLogo.tileBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: csSpace.s4,
  },
  tileLetter: {
    color: csLogo.tileLetter,
    fontFamily: csLogo.font,
    fontWeight: '700',
    fontSize: 44,
  },
  title: {
    fontFamily: csLogo.font,
    fontWeight: '700',
    fontSize: 34,
    lineHeight: 37.4,
    letterSpacing: -0.34,
    color: csColors.textPrimary,
  },
  lead: {
    fontFamily: 'Inter',
    fontSize: 16,
    lineHeight: 26.4,
    color: csColors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: csSpace.s3,
    borderRadius: csRadius.input,
  },
});
