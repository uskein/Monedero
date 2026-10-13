/**
 * wipeAllData — BORRADO TOTAL (HU-19 · F6).
 * Orden crítico: (1) repo dev SIN guardado final (no recrear el snapshot),
 * (2) snapshot cifrado fuera, (3) bóveda fuera (SecureStore + zeroize),
 * (4) stores a su estado inicial y (5) reboot de bóveda → Onboarding (F6
 * «estado limpio»). Las preferencias (tema/moneda) NO se borran: son
 * preferencias de apariencia, no datos financieros.
 */
import { monthKeyOf } from '@monedero/i18n';
import { getActiveDevRepository } from './createDevRepository';
import { createFileSystemSnapshotStorage } from './snapshotStorage';
import { getVaultPort, useVaultStore } from '../../state/vault.store';
import { useTransactionsStore } from '../../state/transactions.store';
import { resetDashboardStore } from '../../state/dashboard.store';
import { useBudgetsStore } from '../../state/budgets.store';
import { useCategoriesStore } from '../../state/categories.store';
import { useReportsStore } from '../../state/reports.store';

export async function wipeAllData(): Promise<void> {
  // 1. Repo dev activa: desuscribir + cerrar SIN snapshot final.
  getActiveDevRepository()?.dispose(false);

  // 2. Snapshot cifrado del disco.
  await createFileSystemSnapshotStorage().clear();

  // 3. Bóveda: metadatos SecureStore + zeroize de la clave en memoria.
  await getVaultPort()?.delete();

  // 4. Stores limpios (la nueva sesión no arrastra datos viejos).
  useTransactionsStore.setState({
    status: 'loading',
    items: [],
    filter: {},
    error: null,
    lastDeletedId: null,
    repo: null,
  });
  resetDashboardStore();
  useBudgetsStore.setState({
    status: 'loading',
    period: monthKeyOf(new Date()),
    items: [],
    error: null,
    duplicate: null,
    formError: null,
    toast: null,
    deps: null,
    levels: {},
  });
  useCategoriesStore.setState({
    status: 'loading',
    items: [],
    error: null,
    formError: null,
    repo: null,
  });
  useReportsStore.setState({
    month: monthKeyOf(new Date()),
    status: 'loading',
    report: null,
    error: null,
    repo: null,
  });

  // 5. Re-arranque de la bóveda → sin metadatos → Onboarding (BP-01).
  await useVaultStore.getState().boot();
}
