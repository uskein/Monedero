/**
 * Select (móvil) — picker accesible (rol `combobox`) con lista en bottom
 * sheet. Reemplaza a los chips de categoría en el alta de movimiento: los
 * chips recortaban los nombres largos; el Select muestra el nombre completo
 * en el campo (hasta 2 líneas) y la lista envuelve sin cortar.
 * 4 estados: pristine (placeholder) · open · selected · disabled/error.
 * Copy i18n vía props — cero strings hardcodeados (gate i18n:check).
 */
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT } from '@monedero/i18n/react';
import { csRadius, csSpace } from '@monedero/tokens';
import { useThemeColors } from '../theme';
import { glyphFor } from '../icons';

export interface SelectOption {
  id: string;
  name: string;
  /** Icono Ionicons + color de categoría (v0.3.0) — opcionales. */
  icon?: string;
  color?: string;
}

export interface SelectProps {
  label: string;
  /** Opciones ya filtradas por tipo (el caller decide gasto/ingreso). */
  options: SelectOption[];
  /** id seleccionado o null (sin categoría). */
  value: string | null;
  onChange: (id: string | null) => void;
  /** Texto del campo cuando no hay selección («Sin categoría»). */
  placeholder: string;
  /** Cierra el picker tras elegir (default true). */
  commitOnPick?: boolean;
  disabled?: boolean;
  error?: string;
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder,
  commitOnPick = true,
  disabled = false,
  error,
}: SelectProps) {
  const t = useT();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) ?? null;

  function pick(id: string | null) {
    onChange(id);
    if (commitOnPick) setOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityHint={placeholder}
        accessibilityState={{ expanded: open, disabled, selected: selected != null }}
        disabled={disabled}
        onPress={() => setOpen((o) => !o)}
        style={[styles.field, error ? styles.fieldError : null, disabled ? styles.fieldDisabled : null]}
      >
        <Text
          style={[styles.value, selected ? null : styles.placeholder]}
          numberOfLines={2}
        >
          {selected ? selected.name : placeholder}
        </Text>
        {selected?.icon ? (
          <Ionicons
            name={glyphFor(selected.icon)}
            size={18}
            color={selected.color ?? c.primary}
          />
        ) : null}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={c.textMuted} />
      </Pressable>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* Tocar fuera cancela (nombre accesible = Cancelar, nunca el label
            del campo, para no duplicar nombres a11y). */}
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.sheetHandle} accessibility-hidden="true" />
          <Text style={styles.sheetTitle}>{label}</Text>
          <ScrollView style={styles.list} bounces={false}>
            {options.map((o) => {
              const isSel = o.id === value;
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSel }}
                  accessibilityLabel={o.name}
                  onPress={() => pick(o.id)}
                  style={[styles.option, isSel && styles.optionSelected]}
                >
                  {o.icon ? (
                    <Ionicons
                      accessibility-hidden="true"
                      name={glyphFor(o.icon)}
                      size={18}
                      color={o.color ?? c.textPrimary}
                    />
                  ) : null}
                  <Text style={[styles.optionLabel, isSel && styles.optionLabelSelected]}>{o.name}</Text>
                  {isSel ? <Ionicons name="checkmark" size={18} color={c.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    wrap: { gap: csSpace.s2 },
    label: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    field: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      gap: csSpace.s2,
      paddingHorizontal: csSpace.s4,
      backgroundColor: c.surfaceSunken,
      borderWidth: 2,
      borderColor: 'transparent',
      borderRadius: csRadius.input,
    },
    fieldError: { borderColor: c.danger },
    fieldDisabled: { opacity: 0.5 },
    value: { flex: 1, fontSize: 16, color: c.textPrimary },
    placeholder: { color: c.placeholder },
    error: { fontSize: 12, color: c.danger },
    backdrop: { flex: 1, backgroundColor: 'rgba(35,42,49,.42)' },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: csRadius.sheet,
      borderTopRightRadius: csRadius.sheet,
      paddingBottom: csSpace.s6,
      paddingHorizontal: csSpace.s4,
      paddingTop: csSpace.s3,
      gap: csSpace.s2,
      maxHeight: '70%',
    },
    sheetHandle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: csRadius.pill,
      backgroundColor: c.surfaceSunken,
      marginBottom: csSpace.s1,
    },
    sheetTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    list: { flexGrow: 0 },
    option: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      gap: csSpace.s2,
      paddingHorizontal: csSpace.s3,
      paddingVertical: csSpace.s2,
      borderRadius: csRadius.button,
    },
    optionSelected: { backgroundColor: c.primarySoft },
    optionLabel: { flex: 1, fontSize: 16, color: c.textPrimary },
    optionLabelSelected: { fontWeight: '700', color: c.primary },
  });
}
