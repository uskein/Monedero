/**
 * Test UI — DashboardScreen BP-03 (HU-08·09·12): 4 estados DoD, contador,
 * periodo segmented y sincronía tx:created → balance EN PANTALLA (tarea 4.3).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '@monedero/i18n/react';
import { formatMoney, formatMoneySigned, formatMonthLabel, monthKeyOf, previousMonthKey } from '@monedero/i18n';
import { DashboardScreen } from '../src/features/dashboard/DashboardScreen';
import {
  useDashboardStore,
  resetDashboardStore,
  type DashboardRepo,
} from '../src/features/dashboard/store';
import type { DashboardSummary, Transaction } from '../src/data/domain/transactions';

const NOW_MONTH = monthKeyOf(new Date());

/**
 * Intl formatea es-CO con NBSP (U+00A0, evita partir «$ 12.480.550»). RTL
 * normaliza SOLO el texto del DOM (NBSP → espacio) y compara el matcher en
 * crudo: hay que pasar el espacio simple para que matchee.
 */
const plain = (s: string): string => s.replace(/\u00A0/g, ' ');
const money = (cents: number): string => plain(formatMoney(cents, 'COP', 'es-CO'));
const signed = (cents: number, isIncome: boolean): string =>
  plain(formatMoneySigned(cents, 'COP', 'es-CO', isIncome));

function makeTx(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'expense',
    amountCents: 9900, // distinto de expenseCents del resumen (evita texto duplicado)
    currency: 'COP',
    date: '2026-10-11',
    accountId: 'acc-efectivo',
    toAccountId: null,
    categoryId: 'cat-comida',
    payee: 'Almuerzo',
    note: null,
    status: 'cleared',
    createdAt: '2026-10-11T13:00:00.000Z',
    updatedAt: '2026-10-11T13:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

const SUMMARY: DashboardSummary = {
  totalBalanceCents: 12480550,
  incomeCents: 2500000,
  expenseCents: 18500,
  monthBalanceCents: 2481500,
};

const PREV_SUMMARY: DashboardSummary = {
  totalBalanceCents: 12480550,
  incomeCents: 300000,
  expenseCents: 99000,
  monthBalanceCents: 201000,
};

interface FakeRepo extends DashboardRepo {
  emit(): void;
  current: DashboardSummary;
  previous: DashboardSummary;
  fail: boolean;
}

function fakeRepo(items: Transaction[] = []): FakeRepo {
  const listeners = new Set<(changed: { scope: 'tx' | 'account' | 'category' }) => void>();
  const repo: FakeRepo = {
    current: { ...SUMMARY },
    previous: { ...PREV_SUMMARY },
    fail: false,
    async dashboardSummary(month) {
      if (repo.fail) throw new Error('boom');
      return month === previousMonthKey(NOW_MONTH) ? repo.previous : repo.current;
    },
    async list(filter) {
      return typeof filter?.limit === 'number' ? items.slice(0, filter.limit) : items;
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    emit() {
      listeners.forEach((cb) => cb({ scope: 'tx' }));
    },
  };
  return repo;
}

/** Renderiza con el repo inyectado (test: nunca toca sql.js). */
function renderWithRepo(repo: DashboardRepo, extras: { onAddFirst?: () => void } = {}) {
  return render(
    <I18nProvider initialLocale="es-CO">
      <DashboardScreen currency="COP" repoOverride={repo} onAddFirst={extras.onAddFirst} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  resetDashboardStore();
});

describe('DashboardScreen — 4 estados (BP-03)', () => {
  it('loading → región aria-busy con skeletons (sin flash de vacío)', () => {
    const pending: DashboardRepo = {
      async dashboardSummary() {
        return new Promise<DashboardSummary>(() => undefined); // nunca resuelve
      },
      async list() {
        return [];
      },
      subscribe() {
        return () => {};
      },
    };
    renderWithRepo(pending);
    const region = screen.getByRole('region', { name: 'Inicio' });
    expect(region.getAttribute('aria-busy')).toBe('true');
    expect(region.querySelectorAll('.ds-skeleton').length).toBeGreaterThan(0);
  });

  it('empty → balance $ 0 + CTA «Añadir primer movimiento» (blueprint)', async () => {
    const onAddFirst = vi.fn();
    renderWithRepo(fakeRepo([]), { onAddFirst });

    expect(await screen.findByText('Aún no hay movimientos')).toBeTruthy();
    expect(screen.getAllByText(money(0)).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Añadir primer movimiento' }));
    expect(onAddFirst).toHaveBeenCalledTimes(1);
  });

  it('success → contador animado, informe del mes, últimos movimientos y segmented', async () => {
    renderWithRepo(fakeRepo([makeTx('a'), makeTx('b', { payee: 'Taxi' })]));

    // Contador: espera a que la animación aterrice en el valor final.
    const finalText = money(SUMMARY.totalBalanceCents);
    await waitFor(() => expect(screen.getAllByText(finalText).length).toBeGreaterThan(0), {
      timeout: 2000,
    });

    expect(screen.getByText(formatMonthLabel(NOW_MONTH, 'es-CO'))).toBeTruthy();
    expect(screen.getByText(signed(SUMMARY.incomeCents, true))).toBeTruthy();
    expect(screen.getByText(signed(SUMMARY.expenseCents, false))).toBeTruthy();
    expect(screen.getByText('Almuerzo')).toBeTruthy(); // últimos .tx

    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual(['Este mes', 'Mes anterior']);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tablist', { name: 'Periodo' })).toBeTruthy();
  });

  it('error → toast con mensaje + «Reintentar» recupera (estado success)', async () => {
    const repo = fakeRepo([]);
    repo.fail = true;
    renderWithRepo(repo);

    expect(await screen.findByText('No se pudo cargar tu inicio.')).toBeTruthy();

    repo.fail = false; // el storage vuelve → el reintento debe recuperar
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByText('Aún no hay movimientos');
    expect(screen.queryByText('No se pudo cargar tu inicio.')).toBeNull();
  });
});

describe('DashboardScreen — periodo segmented (HU-09)', () => {
  it('«Mes anterior» cambia el periodo y muestra el resumen de ese mes', async () => {
    renderWithRepo(fakeRepo([makeTx('a')]));
    await waitFor(() =>
      expect(screen.getAllByText(money(SUMMARY.totalBalanceCents)).length).toBeGreaterThan(0),
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Mes anterior' }));

    const prevMonth = previousMonthKey(NOW_MONTH);
    await waitFor(() => expect(useDashboardStore.getState().month).toBe(prevMonth));
    expect(screen.getByText(formatMonthLabel(prevMonth, 'es-CO'))).toBeTruthy();
    expect(screen.getByText(signed(PREV_SUMMARY.incomeCents, true))).toBeTruthy();
    expect(screen.getAllByRole('tab')[1]?.getAttribute('aria-selected')).toBe('true');
  });
});

describe('DashboardScreen — tx:created actualiza balance EN PANTALLA (tarea 4.3)', () => {
  it('un evento del repo refresca el contador sin recargar la pantalla', async () => {
    const repo = fakeRepo([makeTx('a')]);
    renderWithRepo(repo);
    const before = money(SUMMARY.totalBalanceCents);
    await waitFor(() => expect(screen.getAllByText(before).length).toBeGreaterThan(0));

    // Simula un alta en la lista: el repo emite 'tx' con balance nuevo.
    repo.current = { ...SUMMARY, totalBalanceCents: 13000000 };
    repo.emit();

    const after = money(13000000);
    await waitFor(() => expect(screen.getAllByText(after).length).toBeGreaterThan(0), { timeout: 2000 });
    expect(useDashboardStore.getState().summary?.totalBalanceCents).toBe(13000000);
  });
});
