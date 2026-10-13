/**
 * MoneyInput (móvil) — campo monetario Clay (manual SSOT §7.4).
 * Símbolo de moneda visible + formato EN VIVO mientras se escribe
 * (formatAmountLive, HU-18: '25.000' es / '25,000.50' usd) + teclado numérico.
 * El valor es controlado y YA formateado: el caller reformatea en cada cambio
 * con formatAmountLive. Label SIEMPRE visible (nunca placeholder solo).
 */
import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { CurrencyCode } from '@monedero/i18n';
import { symbolFor } from '@monedero/i18n';
import { csRadius, csSpace } from '@monedero/tokens';
import { useThemeColors } from '../theme';

export interface MoneyInputProps {
  label: string;
  /** Valor formateado (controlado). */
  value: string;
  currency: CurrencyCode;
  /** Devuelve el valor ya formateado (llamar formatAmountLive en el caller). */
  onValueChange: (formatted: string) => void;
  error?: string;
  disabled?: boolean;
}

export function MoneyInput({
  label,
  value,
  currency,
  onValueChange,
  error,
  disabled = false,
}: MoneyInputProps) {
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const invalid = Boolean(error);
  return (
    <View style={styles.field}>
      <Text style={styles.label} nativeID={`${label}-label`}>
        {label}
      </Text>
      <View style={[styles.box, invalid && styles.boxError, disabled && styles.disabled]}>
        <Text style={styles.prefix} accessibility-hidden="true">
          {symbolFor(currency)}
        </Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={(raw) => onValueChange(raw)}
          placeholder="0"
          placeholderTextColor={c.placeholder}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          accessibilityHint={invalid && error ? error : undefined}
          aria-invalid={invalid || undefined}
          editable={!disabled}
          maxLength={16}
        />
      </View>
      {invalid && error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {`⚠ ${error}`}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    field: { gap: csSpace.s2 },
    label: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: csSpace.s2,
      backgroundColor: c.surfaceSunken,
      borderRadius: csRadius.input,
      paddingHorizontal: csSpace.s4,
      minHeight: 56,
    },
    boxError: { borderWidth: 1.5, borderColor: c.danger },
    disabled: { opacity: 0.5 },
    prefix: { fontSize: 20, fontWeight: '700', color: c.textMuted },
    input: {
      flex: 1,
      fontSize: 22,
      fontWeight: '700',
      color: c.textPrimary,
      paddingVertical: csSpace.s2,
    },
    error: { fontSize: 13, color: c.danger },
  });
}
