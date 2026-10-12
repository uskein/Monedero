/**
 * Onboarding (móvil) — blueprint BP-01: 3 pasos con progreso; el éxito lo
 * pinta VaultGate (misma división que la PWA). Copy vía useT() — cero strings
 * hardcodeados (gate i18n:check). 4 estados DoD: loading (busy «Cifrando…»),
 * empty (paso inicial), success (delegado al padre), error (validación local
 * con role=alert). Trazabilidad: BLUEPRINTS BP-01 · F1 · HU-01.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useT } from '@monedero/i18n/react';
import { csColors, csRadius, csSpace } from '@monedero/tokens';
import { Button, Card, Input } from '../design-system';

export interface OnboardingProps {
  /** Crea la bóveda (store); false si la validación falla (error en el paso). */
  onCreate: (passphrase: string, confirm: string) => Promise<boolean>;
}

type Step = 0 | 1 | 2;

const TOTAL_STEPS = 4; // bienvenida + crear + confirmar + éxito (lo pinta el padre)
const MIN_LEN = 8;
// Font display de Clay Serenity (misma convención literal que el resto del app).
const FONT_DISPLAY = 'Fraunces';

export function Onboarding({ onCreate }: OnboardingProps) {
  const t = useT();
  const [step, setStep] = useState<Step>(0);
  const [pass, setPass] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finish() {
    setBusy(true);
    const ok = await onCreate(pass, confirm); // VaultGate salta a la tarjeta de éxito
    setBusy(false);
    if (!ok) setError(t('vault.onboarding.error.min'));
  }

  const stepLabel = t('vault.onboarding.step', { current: step + 1, total: TOTAL_STEPS });
  const percent = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.progressRow}>
          <Text style={styles.stepText}>{stepLabel}</Text>
          <View
            style={styles.track}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
            accessibilityLabel={stepLabel}
          >
            <View style={[styles.fill, { width: `${percent}%` }]} />
          </View>
        </View>

        {step === 0 && (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('vault.onboarding.welcome.title')}
            </Text>
            <Text style={styles.copy}>{t('vault.onboarding.welcome.copy')}</Text>
            <Button label={t('common.next')} onPress={() => setStep(1)} />
          </View>
        )}

        {step === 1 && (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.titleSmall}>
              {t('vault.onboarding.create.title')}
            </Text>
            <Text style={styles.copy}>{t('vault.onboarding.create.copy')}</Text>
            <Input
              label={t('vault.onboarding.passphrase')}
              value={pass}
              onValueChange={setPass}
              placeholder={t('vault.onboarding.passphrase.hint')}
              secureTextEntry
              disabled={busy}
              error={error ?? undefined}
            />
            <View style={styles.actions}>
              <Button variant="secondary" label={t('common.back')} disabled={busy} onPress={() => setStep(0)} />
              <Button
                label={t('common.next')}
                disabled={busy}
                onPress={() => {
                  if (pass.length < MIN_LEN) setError(t('vault.onboarding.error.min'));
                  else {
                    setError(null);
                    setStep(2);
                  }
                }}
              />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.titleSmall}>
              {t('vault.onboarding.confirm')}
            </Text>
            <Input
              label={t('vault.onboarding.confirm')}
              value={confirm}
              onValueChange={setConfirm}
              placeholder={t('vault.onboarding.confirm.hint')}
              secureTextEntry
              disabled={busy}
              error={
                confirm.length > 0 && confirm !== pass
                  ? t('vault.onboarding.error.match')
                  : (error ?? undefined)
              }
            />
            <View style={styles.actions}>
              <Button variant="secondary" label={t('common.back')} disabled={busy} onPress={() => setStep(1)} />
              <Button
                label={busy ? t('vault.onboarding.busy') : t('vault.onboarding.finish')}
                disabled={busy}
                onPress={() => void finish()}
              />
            </View>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: csColors.bgBase },
  content: { padding: csSpace.s4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s3, marginBottom: csSpace.s4 },
  stepText: { fontSize: 12, color: csColors.textMuted },
  track: { flex: 1, height: 6, borderRadius: csRadius.pill, backgroundColor: csColors.surfaceSunken },
  fill: { height: 6, borderRadius: csRadius.pill, backgroundColor: csColors.primary },
  section: { gap: csSpace.s3 },
  title: { fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 30, color: csColors.textPrimary },
  titleSmall: { fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 22, color: csColors.textPrimary },
  copy: { fontSize: 15, color: csColors.textMuted },
  actions: { flexDirection: 'row', gap: csSpace.s3, marginTop: csSpace.s2 },
});
