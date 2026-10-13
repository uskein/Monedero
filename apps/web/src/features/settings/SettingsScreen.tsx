/**
 * SettingsScreen — BP-08 (raíz de Ajustes) bajo el VaultGate.
 * S5: el hub vive con la sección Categorías (HU-10); el resto de secciones
 * (seguridad, datos/export-import, apariencia) se incorporan en S6/S7.
 * Trazabilidad: ESTRUCTURA_DIRECTORIOS.md → features/settings.
 */
import { useState } from 'react';
import { csColors } from '@monedero/tokens';
import { useT } from '@monedero/i18n/react';
import { Button, Card } from '../../design-system';
import { CategoriesManager, type CategoriesManagerProps } from './CategoriesManager';
import { DataPanel } from './DataPanel';

export interface SettingsScreenProps {
  /** Solo tests: repo en memoria para no tocar sql.js en la UI. */
  categoriesRepoOverride?: CategoriesManagerProps['repoOverride'];
}

export function SettingsScreen({ categoriesRepoOverride }: SettingsScreenProps) {
  const t = useT();
  const [view, setView] = useState<'hub' | 'categories' | 'data'>('hub');

  if (view === 'categories') {
    return <CategoriesManager repoOverride={categoriesRepoOverride} onBack={() => setView('hub')} />;
  }
  if (view === 'data') {
    return <DataPanel onBack={() => setView('hub')} />;
  }

  return (
    <section aria-label={t('settings.title')} style={{ display: 'grid', gap: 'var(--cs-space-4)' }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{t('settings.title')}</h2>
      <Card style={{ display: 'grid', gap: 'var(--cs-space-3)', textAlign: 'left' }}>
        <p style={{ margin: 0, color: csColors.textMuted }}>{t('settings.subtitle')}</p>
        <Button variant="secondary" onClick={() => setView('categories')}>
          {t('settings.categories')}
        </Button>
        <p style={{ margin: 0, fontSize: 13, color: csColors.textMuted }}>{t('settings.categories.copy')}</p>
      </Card>
      <Card style={{ display: 'grid', gap: 'var(--cs-space-3)', textAlign: 'left' }}>
        <p style={{ margin: 0, fontWeight: 700 }}>{t('data.title')}</p>
        <Button variant="secondary" onClick={() => setView('data')}>
          {t('data.export')}
        </Button>
      </Card>
    </section>
  );
}
