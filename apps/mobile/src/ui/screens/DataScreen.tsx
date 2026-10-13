/**
 * DataScreen (móvil) — BP-09 export / BP-10 import del fichero .monedero
 * (S7 · HU-14·15·16 · ADR-002: el ÚNICO acoplamiento móvil ⇄ PWA).
 * Export: passphrase opcional → .monedero(.enc) → Share nativo.
 * Import: Fusionar (LWW) o Reemplazar (palabra clave + copia local previa
 * vía snapshot) → resumen ImportSummary o error IMPORT_* mapeado a i18n.
 * Tras un import se recargan todos los stores (misma BD sql.js).
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Database } from 'sql.js';
import { useI18n } from '@monedero/i18n/react';
import { csRadius, csSpace } from '@monedero/tokens';
import { Button, Card, Input } from '../design-system';
import { useThemeColors } from '../theme';
import { exportVaultFile, importVaultFile } from '../../infrastructure/export/vaultFile';
import { usePrefsStore } from '../../state/prefs.store';
import { useTransactionsStore } from '../../state/transactions.store';
import { useDashboardStore } from '../../state/dashboard.store';
import { useBudgetsStore } from '../../state/budgets.store';
import { useCategoriesStore } from '../../state/categories.store';
import { useReportsStore } from '../../state/reports.store';

export interface DataScreenProps {
  /** BD sql.js de la sesión (AppShell la posee). */
  db?: Database;
  /** uuid de la bóveda (KeyVault) — viaja en el fichero. */
  vaultId?: string | null;
  onBack: () => void;
}

type Mode = 'merge' | 'replace';

export function DataScreen({ db, vaultId, onBack }: DataScreenProps) {
  const { t } = useI18n();
  const c = useThemeColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const currency = usePrefsStore((s) => s.currency);

  const [passphrase, setPassphrase] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  const [mode, setMode] = useState<Mode>('merge');
  const [replaceWord, setReplaceWord] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  const replaceRequired = mode === 'replace';
  const replaceOk = replaceWord.trim().toUpperCase() === t('data.import.replace.word').toUpperCase();

  async function handleExport() {
    if (!db || !vaultId) return;
    setExporting(true);
    setExportDone(false);
    try {
      const pass = passphrase.trim();
      const result = await exportVaultFile(db, {
        vaultId,
        currency,
        passphrase: pass.length >= 8 ? pass : undefined,
      });
      const { File, Paths } = await import('expo-file-system');
      const file = new File(Paths.document, result.filename);
      file.write(result.content);
      const Sharing = await import('expo-sharing');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: result.filename.endsWith('.enc') ? 'application/octet-stream' : 'application/json',
          dialogTitle: 'Monedero',
        });
        setExportDone(true);
      }
    } catch (err) {
      if (__DEV__) console.warn('[monedero] export vault falló', err);
    } finally {
      setExporting(false);
    }
  }

  async function refreshAfterImport(): Promise<void> {
    await useTransactionsStore.getState().reload();
    await useDashboardStore.getState().refresh();
    await useBudgetsStore.getState().reload();
    await useCategoriesStore.getState().reload();
    await useReportsStore.getState().setMonth(useReportsStore.getState().month);
  }

  async function handleImport() {
    if (!db) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const DocumentPicker = await import('expo-document-picker');
      const picked = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' });
      if (picked.canceled || !picked.assets?.[0]) {
        setImporting(false);
        return; // cancelar es siempre seguro (0 escrituras)
      }
      const { File } = await import('expo-file-system');
      const content = await new File(picked.assets[0].uri).text();
      const summary = await importVaultFile(db, content, {
        mode,
        passphrase: importPassphrase.trim() === '' ? undefined : importPassphrase.trim(),
        source: 'mobile',
      });
      await refreshAfterImport();
      setImportResult(
        t('data.import.result', {
          added: summary.added,
          updated: summary.updated,
          skipped: summary.skipped,
          conflicts: summary.conflicts,
        }),
      );
      setReplaceWord('');
      setPassphrase('');
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (__DEV__) console.warn('[monedero] import vault falló', code);
      setImportError(importErrorMessage(code, t));
    } finally {
      setImporting(false);
    }
  }

  const busy = exporting || importing;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} accessibilityLabel={t('data.title')}>
      <View style={styles.header}>
        <Button variant="ghost" label={t('common.back')} onPress={onBack} />
        <Text style={styles.title}>{t('data.title')}</Text>
      </View>

      {/* BP-09 · Exportar */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{t('data.export')}</Text>
        <Text style={styles.copy}>{t('data.export.hint')}</Text>
        <Input
          label={t('data.export.passphrase')}
          value={passphrase}
          onValueChange={setPassphrase}
          secureTextEntry
          disabled={busy}
          error={passphrase.length > 0 && passphrase.length < 8 ? t('vault.onboarding.error.min') : undefined}
        />
        {exportDone && (
          <Text accessibilityLiveRegion="polite" style={styles.okText}>
            {t('data.export.done')}
          </Text>
        )}
        <Button
          label={exporting ? t('reports.export.generating') : t('data.export.submit')}
          disabled={busy || !db || !vaultId || (passphrase.length > 0 && passphrase.length < 8)}
          onPress={() => void handleExport()}
        />
      </Card>

      {/* BP-10 · Importar */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>{t('data.import')}</Text>
        <Text style={styles.copy}>{t('data.import.hint')}</Text>

        <View accessibilityRole="radiogroup" accessibilityLabel={t('data.import')} style={styles.chips}>
          {(['merge', 'replace'] as Mode[]).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="radio"
              accessibilityState={{ checked: mode === m }}
              accessibilityLabel={m === 'merge' ? t('data.import.mode.merge') : t('data.import.mode.replace')}
              disabled={busy}
              onPress={() => setMode(m)}
              style={[styles.chip, mode === m && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, mode === m && styles.chipLabelSelected]}>
                {m === 'merge' ? t('data.import.mode.merge') : t('data.import.mode.replace')}
              </Text>
            </Pressable>
          ))}
        </View>

        {replaceRequired && (
          <View style={styles.gap}>
            <Text style={styles.warning}>{t('data.import.replace.warning')}</Text>
            <Input
              label={t('data.import.replace.word')}
              value={replaceWord}
              onValueChange={setReplaceWord}
              disabled={busy}
            />
          </View>
        )}

        <Input
          label={t('data.import.passphrase')}
          value={importPassphrase}
          onValueChange={setImportPassphrase}
          secureTextEntry
          disabled={busy}
        />

        {importError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {importError}
          </Text>
        )}
        {importResult && (
          <Text accessibilityLiveRegion="polite" style={styles.okText}>
            {importResult}
          </Text>
        )}

        <Button
          label={importing ? t('reports.export.generating') : t('data.import.pick')}
          disabled={busy || !db || (replaceRequired && !replaceOk)}
          onPress={() => void handleImport()}
        />
      </Card>
    </ScrollView>
  );
}

function importErrorMessage(code: string, t: (key: TranslationKeys) => string): string {
  switch (code) {
    case 'IMPORT_HASH_MISMATCH':
      return t('data.error.hash');
    case 'IMPORT_DECRYPT_FAILED':
      return t('data.error.decrypt');
    case 'IMPORT_FORMAT_UNSUPPORTED':
    case 'VERSION_NO_SOPORTADA':
      return t('data.error.format');
    case 'PASSPHRASE_REQUIRED':
      return t('data.error.passphraseRequired');
    default:
      return t('data.error.generic');
  }
}

type TranslationKeys =
  | 'data.error.hash'
  | 'data.error.decrypt'
  | 'data.error.format'
  | 'data.error.passphraseRequired'
  | 'data.error.generic';

function makeStyles(c: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bgBase },
    content: { gap: csSpace.s4, padding: csSpace.s4 },
    header: { flexDirection: 'row', alignItems: 'center', gap: csSpace.s3 },
    title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
    card: { gap: csSpace.s3 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
    copy: { fontSize: 14, lineHeight: 22, color: c.textMuted },
    gap: { gap: csSpace.s3 },
    warning: { fontSize: 13, color: c.danger },
    error: { fontSize: 13, color: c.danger },
    okText: { fontSize: 13, color: c.primary },
    chips: { flexDirection: 'row', gap: csSpace.s2 },
    chip: {
      flex: 1,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: csRadius.pill,
      backgroundColor: c.surfaceSunken,
      paddingHorizontal: csSpace.s3,
    },
    chipSelected: { backgroundColor: c.primary },
    chipLabel: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
    chipLabelSelected: { color: c.textOnPrimary },
  });
}
