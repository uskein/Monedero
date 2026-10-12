/**
 * VaultGate (móvil) — BP-01/BP-02: el contenido solo se renderiza con la
 * bóveda desbloqueada. Espejo de la PWA con arranque ASYNC (SecureStore es
 * async): boot → onboarding (no-vault) · tarjeta de éxito (tras crear) ·
 * formulario de desbloqueo (locked) · children (unlocked).
 * Copy vía useT() — cero strings hardcodeados (gate i18n:check).
 * Trazabilidad: BLUEPRINTS BP-01/BP-02 · F1/F2 · HU-02·03·04.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useT } from '@monedero/i18n/react';
import { csColors, csSpace } from '@monedero/tokens';
import { Button, BusyIndicator, Card, Input } from '../design-system';
import { Onboarding } from './Onboarding';
import { useVaultStore } from '../../state/vault.store';

export interface VaultGateProps {
  children: ReactNode;
}

const FONT_DISPLAY = 'Fraunces';

export function VaultGate({ children }: VaultGateProps) {
  const t = useT();
  const status = useVaultStore((s) => s.status);
  const error = useVaultStore((s) => s.error);
  const busy = useVaultStore((s) => s.busy);
  const boot = useVaultStore((s) => s.boot);
  const createVault = useVaultStore((s) => s.createVault);
  const unlock = useVaultStore((s) => s.unlock);
  const [justCreated, setJustCreated] = useState(false);
  const [pass, setPass] = useState('');

  useEffect(() => {
    void boot();
  }, [boot]);

  // ── boot (lectura inicial de SecureStore, ya resuelta casi siempre) ──
  if (status === 'boot') {
    return (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <Text style={styles.muted}>{t('common.loading')}</Text>
      </View>
    );
  }

  // ── BP-01: sin bóveda → onboarding de 3 pasos ──
  if (status === 'no-vault') {
    return (
      <Onboarding
        onCreate={async (passphrase, confirm) => {
          const ok = await createVault(passphrase, confirm);
          if (ok) setJustCreated(true);
          return ok;
        }}
      />
    );
  }

  // ── desbloqueada ──
  if (status === 'unlocked') {
    if (justCreated) {
      return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <Card style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('vault.success.title')}
            </Text>
            <Text style={styles.copy}>{t('vault.success.copy')}</Text>
            <Button label={t('vault.success.cta')} onPress={() => setJustCreated(false)} />
          </Card>
        </ScrollView>
      );
    }
    return <>{children}</>;
  }

  // ── BP-02: bloqueada → passphrase maestra ──
  const wrongPassphrase = error === 'VAULT_WRONG_PASSPHRASE';
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('vault.lock.title')}
        </Text>
        <Text style={styles.copy}>{t('vault.lock.copy')}</Text>
        <Input
          label={t('vault.lock.passphrase')}
          value={pass}
          onValueChange={setPass}
          placeholder={t('vault.lock.passphrase')}
          secureTextEntry
          disabled={busy}
          error={wrongPassphrase ? t('vault.lock.error.wrong') : undefined}
        />
        {busy ? (
          <BusyIndicator label={t('vault.lock.busy')} copy={t('vault.busy.copy')} />
        ) : (
          <Button
            label={t('vault.lock.submit')}
            disabled={busy}
            onPress={() => {
              void (async () => {
                const ok = await unlock(pass);
                if (ok) {
                  setPass('');
                  setJustCreated(false);
                }
              })();
            }}
          />
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: csColors.bgBase },
  content: { padding: csSpace.s4 },
  // Separación explícita Input ↔ botón (el Card no tiene gap propio y
  // el estilo clay los fundía visualmente).
  card: { gap: csSpace.s4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: csColors.bgBase },
  title: { fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 24, color: csColors.textPrimary },
  copy: { fontSize: 15, color: csColors.textMuted },
  muted: { fontSize: 15, color: csColors.textMuted },
});
