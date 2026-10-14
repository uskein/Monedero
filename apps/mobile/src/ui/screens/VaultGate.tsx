/**
 * VaultGate (móvil) — BP-01/BP-02: el contenido solo se renderiza con la
 * bóveda desbloqueada. Espejo de la PWA con arranque ASYNC (SecureStore es
 * async): boot → onboarding (no-vault) · tarjeta de éxito (tras crear) ·
 * formulario de desbloqueo (locked) · children (unlocked).
 * Copy vía useT() — cero strings hardcodeados (gate i18n:check).
 * Trazabilidad: BLUEPRINTS BP-01/BP-02 · F1/F2 · HU-02·03·04.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useT } from '@monedero/i18n/react';
import { csSpace } from '@monedero/tokens';
import { Button, BusyIndicator, Card, Input } from '../design-system';
import { useThemeColors } from '../theme';
import { Onboarding } from './Onboarding';
import { useVaultStore } from '../../state/vault.store';
import {
  biometricAvailable,
  biometricDeclined,
  biometricEnabled,
  enableBiometric,
  passphraseFromBiometric,
  setBiometricDeclined,
} from '../../infrastructure/security/biometric';

export interface VaultGateProps {
  children: ReactNode;
}

const FONT_DISPLAY = 'Fraunces';

export function VaultGate({ children }: VaultGateProps) {
  const t = useT();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const status = useVaultStore((s) => s.status);
  const error = useVaultStore((s) => s.error);
  const busy = useVaultStore((s) => s.busy);
  const boot = useVaultStore((s) => s.boot);
  const createVault = useVaultStore((s) => s.createVault);
  const unlock = useVaultStore((s) => s.unlock);
  const [justCreated, setJustCreated] = useState(false);
  const [pass, setPass] = useState('');
  /** Biométrico (v0.3.0): null = comprobación aún no resuelta. */
  const [bio, setBio] = useState<{ available: boolean; enabled: boolean; declined: boolean } | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const [offer, setOffer] = useState(false);
  /** Passphrase recién validada, retenida SOLO mientras se decide la oferta. */
  const offerPassRef = useRef<string | null>(null);
  const bioCheckedRef = useRef(false);
  const autoTriedRef = useRef(false);

  useEffect(() => {
    void boot();
  }, [boot]);

  /** Comprobación única de hardware/enrolado/estado (jamás en boot). */
  useEffect(() => {
    if (status === 'boot' || bioCheckedRef.current) return;
    bioCheckedRef.current = true;
    void (async () => {
      const available = await biometricAvailable();
      if (!available) {
        setBio({ available: false, enabled: false, declined: false });
        return;
      }
      const [enabled, declined] = await Promise.all([biometricEnabled(), biometricDeclined()]);
      setBio({ available: true, enabled, declined });
    })();
  }, [status]);

  /** Oferta tras desbloquear con contraseña (solo si conviene, una vez). */
  function maybeOffer(passphrase: string) {
    if (!bio?.available || bio.enabled || bio.declined) return;
    offerPassRef.current = passphrase;
    setOffer(true);
  }

  /** Desbloqueo con biometría (botón o automático al entrar bloqueada). */
  async function tryBiometricUnlock() {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      const revealed = await passphraseFromBiometric(t('vault.bio.enable'));
      if (revealed != null) {
        const ok = await unlock(revealed);
        if (ok) setJustCreated(false);
      }
    } finally {
      setBioBusy(false);
    }
  }

  /** Autoprompt: una sola vez al entrar en pantalla de bloqueo con huella activa. */
  useEffect(() => {
    if (status !== 'locked' || !bio?.enabled || autoTriedRef.current) return;
    autoTriedRef.current = true;
    void tryBiometricUnlock();
  }, [status, bio?.enabled]);

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
          if (ok) {
            setJustCreated(true);
            maybeOffer(passphrase);
          }
          return ok;
        }}
      />
    );
  }

  // ── desbloqueada ──
  if (status === 'unlocked') {
    const offerCard = offer ? (
      <Card style={styles.card}>
        <Text accessibilityRole="header" style={styles.title}>
          {t('vault.bio.offer.title')}
        </Text>
        <Text style={styles.copy}>{t('vault.bio.offer.copy')}</Text>
        {bioBusy ? (
          <BusyIndicator label={t('vault.bio.busy')} />
        ) : (
          <>
            <Button
              label={t('vault.bio.offer.accept')}
              onPress={() => {
                void (async () => {
                  const passphrase = offerPassRef.current;
                  setBioBusy(true);
                  const ok = passphrase != null && (await enableBiometric(passphrase, t('vault.bio.enable')));
                  setBioBusy(false);
                  offerPassRef.current = null;
                  setOffer(false);
                  if (ok) setBio({ available: true, enabled: true, declined: false });
                })();
              }}
            />
            <Button
              variant="ghost"
              label={t('vault.bio.offer.decline')}
              onPress={() => {
                void (async () => {
                  await setBiometricDeclined();
                  offerPassRef.current = null;
                  setOffer(false);
                  setBio((s) => (s ? { ...s, declined: true } : s));
                })();
              }}
            />
          </>
        )}
      </Card>
    ) : null;

    if (justCreated) {
      return (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          {offerCard}
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
    return (
      <>
        {offerCard}
        {children}
      </>
    );
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
        {busy || bioBusy ? (
          <BusyIndicator label={busy ? t('vault.lock.busy') : t('vault.bio.busy')} copy={busy ? t('vault.busy.copy') : undefined} />
        ) : (
          <>
            <Button
              label={t('vault.lock.submit')}
              disabled={busy}
              onPress={() => {
                void (async () => {
                  const captured = pass;
                  const ok = await unlock(captured);
                  if (ok) {
                    setPass('');
                    setJustCreated(false);
                    maybeOffer(captured);
                  }
                })();
              }}
            />
            {bio?.enabled ? (
              <Button variant="secondary" label={t('vault.bio.enable')} onPress={() => void tryBiometricUnlock()} />
            ) : null}
          </>
        )}
      </Card>
    </ScrollView>
  );
}

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.bgBase },
  content: { padding: csSpace.s4 },
  // Separación explícita Input ↔ botón (el Card no tiene gap propio y
  // el estilo clay los fundía visualmente).
  card: { gap: csSpace.s4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bgBase },
  title: { fontFamily: FONT_DISPLAY, fontWeight: '700', fontSize: 24, color: c.textPrimary },
  copy: { fontSize: 15, color: c.textMuted },
  muted: { fontSize: 15, color: c.textMuted },
  });
}
