/**
 * DataPanel (PWA) — BP-09 export / BP-10 import del fichero .monedero
 * (S7 · HU-14·15·16 · ADR-002: el ÚNICO acoplamiento móvil ⇄ PWA).
 * Export: passphrase opcional → descarga del archivo (Blob + <a download>).
 * Import: input de archivo → Fusionar (LWW) o Reemplazar (palabra clave) →
 * resumen ImportSummary o error IMPORT_* mapeado a i18n. Cancelar = 0 escrituras.
 * Tras un import se recargan los stores de la sesión (misma BD sql.js).
 */
import { useState } from 'react';
import { csColors } from '@monedero/tokens';
import { useT } from '@monedero/i18n/react';
import type { TranslationKey } from '@monedero/i18n';
import { Button, Card } from '../../design-system';
import { exportVaultFile, importVaultFile } from '../../data/repo/vaultFile';
import { getSessionDb } from '../../data/db/session';
import { useVaultStore } from '../vault/store';
import { useTransactionsStore } from '../transactions/store';
import { useBudgetsStore } from '../budgets/store';
import { useCategoriesStore } from '../settings/store';

/** Moneda base de la PWA (HU-18 global en la web llega con el tema oscuro). */
const BASE_CURRENCY = 'COP';

type Mode = 'merge' | 'replace';

const ERROR_KEYS: Record<string, TranslationKey> = {
  IMPORT_HASH_MISMATCH: 'data.error.hash',
  IMPORT_DECRYPT_FAILED: 'data.error.decrypt',
  IMPORT_FORMAT_UNSUPPORTED: 'data.error.format',
  VERSION_NO_SOPORTADA: 'data.error.format',
  PASSPHRASE_REQUIRED: 'data.error.passphraseRequired',
};

export function DataPanel({ onBack }: { onBack: () => void }) {
  const t = useT();
  const vaultId = useVaultStore((s) => s.vaultId);

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
    setExporting(true);
    setExportDone(false);
    try {
      const db = await getSessionDb();
      if (!vaultId) return;
      const pass = passphrase.trim();
      const result = await exportVaultFile(db, {
        vaultId,
        currency: BASE_CURRENCY,
        passphrase: pass.length >= 8 ? pass : undefined,
      });
      const blob = new Blob([result.content], {
        type: result.filename.endsWith('.enc') ? 'application/octet-stream' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch (err) {
      if (import.meta.env?.DEV) console.warn('[monedero] export vault falló', err);
    } finally {
      setExporting(false);
    }
  }

  async function refreshAfterImport(): Promise<void> {
    await useTransactionsStore.getState().reload();
    await useBudgetsStore.getState().reload();
    await useCategoriesStore.getState().reload();
  }

  async function handleImport(file: File) {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const db = await getSessionDb();
      const content = await file.text();
      const summary = await importVaultFile(db, content, {
        mode,
        passphrase: importPassphrase.trim() === '' ? undefined : importPassphrase.trim(),
        source: 'pwa',
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
      if (import.meta.env?.DEV) console.warn('[monedero] import vault falló', code);
      setImportError(ERROR_KEYS[code] ? t(ERROR_KEYS[code]) : t('data.error.generic'));
    } finally {
      setImporting(false);
    }
  }

  const busy = exporting || importing;

  return (
    <section aria-label={t('data.title')} style={{ display: 'grid', gap: 'var(--cs-space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cs-space-3)' }}>
        <Button variant="ghost" onClick={onBack} aria-label={t('common.back')}>
          ←
        </Button>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('data.title')}</h2>
      </div>

      {/* BP-09 · Exportar */}
      <Card style={{ display: 'grid', gap: 'var(--cs-space-3)', textAlign: 'left' }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{t('data.export')}</p>
        <p style={{ margin: 0, fontSize: 13, color: csColors.textMuted }}>{t('data.export.hint')}</p>
        <label className="ds-label" htmlFor="export-pass">
          {t('data.export.passphrase')}
        </label>
        <input
          id="export-pass"
          type="password"
          value={passphrase}
          disabled={busy}
          onChange={(e) => setPassphrase(e.target.value)}
          style={{ minHeight: 48, borderRadius: 18, border: 'none', padding: '0 12px', fontSize: 16, background: csColors.surfaceSunken, color: csColors.textPrimary }}
        />
        {passphrase.length > 0 && passphrase.length < 8 ? (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: csColors.danger }}>
            {t('vault.onboarding.error.min')}
          </p>
        ) : null}
        {exportDone ? (
          <p aria-live="polite" style={{ margin: 0, fontSize: 13, color: csColors.primary }}>
            {t('data.export.done')}
          </p>
        ) : null}
        <Button
          variant="primary"
          disabled={busy || !vaultId || (passphrase.length > 0 && passphrase.length < 8)}
          onClick={() => void handleExport()}
        >
          {exporting ? t('reports.export.generating') : t('data.export.submit')}
        </Button>
      </Card>

      {/* BP-10 · Importar */}
      <Card style={{ display: 'grid', gap: 'var(--cs-space-3)', textAlign: 'left' }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{t('data.import')}</p>
        <p style={{ margin: 0, fontSize: 13, color: csColors.textMuted }}>{t('data.import.hint')}</p>

        <div role="radiogroup" aria-label={t('data.import')} style={{ display: 'flex', gap: 8 }}>
          {(['merge', 'replace'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              disabled={busy}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 999,
                border: 'none',
                cursor: 'pointer',
                background: mode === m ? csColors.primary : csColors.surfaceSunken,
                color: mode === m ? csColors.textOnPrimary : csColors.textPrimary,
                fontWeight: 600,
              }}
            >
              {m === 'merge' ? t('data.import.mode.merge') : t('data.import.mode.replace')}
            </button>
          ))}
        </div>

        {replaceRequired ? (
          <>
            <p role="alert" style={{ margin: 0, fontSize: 13, color: csColors.danger }}>
              {t('data.import.replace.warning')}
            </p>
            <label className="ds-label" htmlFor="replace-word">
              {t('data.import.replace.word')}
            </label>
            <input
              id="replace-word"
              value={replaceWord}
              disabled={busy}
              onChange={(e) => setReplaceWord(e.target.value)}
              style={{ minHeight: 48, borderRadius: 18, border: 'none', padding: '0 12px', fontSize: 16, background: csColors.surfaceSunken, color: csColors.textPrimary }}
            />
          </>
        ) : null}

        <label className="ds-label" htmlFor="import-pass">
          {t('data.import.passphrase')}
        </label>
        <input
          id="import-pass"
          type="password"
          value={importPassphrase}
          disabled={busy}
          onChange={(e) => setImportPassphrase(e.target.value)}
          style={{ minHeight: 48, borderRadius: 18, border: 'none', padding: '0 12px', fontSize: 16, background: csColors.surfaceSunken, color: csColors.textPrimary }}
        />

        {importError ? (
          <p role="alert" style={{ margin: 0, fontSize: 13, color: csColors.danger }}>
            {importError}
          </p>
        ) : null}
        {importResult ? (
          <p aria-live="polite" style={{ margin: 0, fontSize: 13, color: csColors.primary }}>
            {importResult}
          </p>
        ) : null}

        <input
          type="file"
          accept=".monedero,.enc,.json,application/json"
          disabled={busy || (replaceRequired && !replaceOk)}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
            e.target.value = '';
          }}
          style={{ fontSize: 14 }}
        />
      </Card>
    </section>
  );
}
