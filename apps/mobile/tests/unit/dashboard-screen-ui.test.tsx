/**
 * Test UI — DashboardScreen móvil (BP-03): 4 estados + periodo + informe +
 * últimos + CTA/onSeeAll. Repo fake (aislado de sql.js) y store reseteado.
 * Patrón RNTL v14: `await render` + `findBy` para cargas asíncronas; importes
 * con regex para esquivar el NBSP de Intl (convención de la lista BP-04).
 * Fuente: BLUEPRINTS BP-03 · PLAN_DE_SPRINTS 4.2 · HU-08·09·12.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { I18nProvider } from '@monedero/i18n/react';
import { formatMonthLabel, monthKeyOf, previousMonthKey } from '@monedero/i18n';
import { DashboardScreen } from '../../src/ui/screens/DashboardScreen';
import {
  useDashboardStore,
  resetDashboardStore,
  type DashboardRepo,
} from '../../src/state/dashboard.store';
import type { DashboardSummary, Transaction } from '../../src/core/domain/transaction';
import type { RepositoryEvent } from '../../src/core/ports/TransactionRepository';

const WAIT = { timeout: 3000 };

const SUMMARY: DashboardSummary = {
  totalBalanceCents: 12480550, // $ 124.806
  incomeCents: 2500000, // + $ 25.000
  expenseCents: 185000, // − $ 1.850
  monthBalanceCents: 2315000, // + $ 23.150
};

function makeTx(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'expense',
    amountCents: 1850000, // − $ 18.500
    currency: 'COP',
    date: '2026-10-11',
    accountId: 'acc-efectivo',
    toAccountId: null,
    categoryId: 'cat-comida',
    payee: 'Almuerzo',
    note: null,
    status: 'cleared',
    createdAt: '2026-10-11T12:00:00.000Z',
    updatedAt: '2026-10-11T12:00:00.000Z',
    deletedAt: null,
    ...overrides,
  };
}

interface FakeRepo extends DashboardRepo {
  current: DashboardSummary;
  failSummary: boolean;
  /** Si está definida, la próxima carga se suspende (test de loading). */
  onSummary?: () => Promise<void>;
  summaryCalls: () => number;
  months: () => string[];
}

function fakeRepo(items: Transaction[] = []): FakeRepo {
  let calls = 0;
  const requested: string[] = [];
  const repo: FakeRepo = {
    current: { ...SUMMARY },
    failSummary: false,
    summaryCalls: () => calls,
    months: () => requested,
    async dashboardSummary(month) {
      requested.push(month);
      if (repo.onSummary) await repo.onSummary();
      if (repo.failSummary) throw new Error('boom');
      calls += 1;
      return repo.current;
    },
    async list(filter) {
      return typeof filter?.limit === 'number' ? items.slice(0, filter.limit) : items;
    },
    subscribe() {
      return () => undefined;
    },
  };
  return repo;
}

async function renderDashboard(
  repo: DashboardRepo,
  props: Partial<{ onAddFirst: () => void; onSeeAll: () => void }> = {},
) {
  const onAddFirst = props.onAddFirst ?? jest.fn();
  const onSeeAll = props.onSeeAll ?? jest.fn();
  await render(
    <I18nProvider initialLocale="es-CO">
      <DashboardScreen repo={repo} currency="COP" onAddFirst={onAddFirst} onSeeAll={onSeeAll} />
    </I18nProvider>,
  );
  return { onAddFirst, onSeeAll };
}

beforeEach(() => {
  resetDashboardStore();
});

describe('DashboardScreen — 4 estados (BP-03)', () => {
  it('loading → «Cargando…» hasta que el resumen llega (sin flash de vacío)', async () => {
    const repo = fakeRepo([makeTx('a')]);
    let open: (() => void) | undefined;
    repo.onSummary = () =>
      new Promise<void>((resolve) => {
        open = resolve;
      });

    await renderDashboard(repo);
    expect(screen.getByText('Cargando…')).toBeTruthy();

    open?.();
    await waitFor(() => expect(screen.queryByText('Cargando…')).toBeNull(), WAIT);
    expect(await screen.findByText(/124\.806/, {}, WAIT)).toBeTruthy();
  });

  it('empty → título + copy + CTA llama onAddFirst', async () => {
    const { onAddFirst } = await renderDashboard(fakeRepo([]));
    expect(await screen.findByText('Aún no hay movimientos', {}, WAIT)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Añadir primer movimiento' }));
    expect(onAddFirst).toHaveBeenCalled();
  });

  it('error → alerta + Reintentar vuelve a pedir el resumen', async () => {
    const repo = fakeRepo([]);
    repo.failSummary = true;
    await renderDashboard(repo);
    expect(await screen.findByText('No se pudo cargar tu inicio.', {}, WAIT)).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    // Cada reintento vuelve a pedir el resumen (intentos, no éxitos).
    await waitFor(() => expect(repo.months().length).toBeGreaterThan(1), WAIT);
  });

  it('success → balance, informe del mes y últimos movimientos', async () => {
    await renderDashboard(fakeRepo([makeTx('a'), makeTx('b', { payee: 'Metro', type: 'income', amountCents: 250000 })]));

    expect(await screen.findByText(/124\.806/, {}, WAIT)).toBeTruthy();
    const month = monthKeyOf(new Date());
    expect(screen.getByText(formatMonthLabel(month, 'es-CO'))).toBeTruthy();
    expect(screen.getByText(/25\.000/)).toBeTruthy(); // ingresos del mes
    expect(screen.getByText(/1\.850/)).toBeTruthy(); // gastos del mes
    expect(screen.getByText('Almuerzo')).toBeTruthy();
    expect(screen.getByText('Metro')).toBeTruthy();
  });
});

describe('DashboardScreen — periodo y navegación (BP-03/HU-09)', () => {
  it('tabs de periodo: «Este mes» activo; «Mes anterior» cambia el mes', async () => {
    const repo = fakeRepo([makeTx('a')]);
    await renderDashboard(repo);

    const current = monthKeyOf(new Date());
    expect(screen.getByRole('tab', { name: 'Este mes' }).props.accessibilityState?.selected).toBe(true);

    fireEvent.press(screen.getByRole('tab', { name: 'Mes anterior' }));

    expect(useDashboardStore.getState().month).toBe(previousMonthKey(current));
    await waitFor(() => expect(repo.months()).toContain(previousMonthKey(current)), WAIT);
    expect(screen.getByRole('tab', { name: 'Mes anterior' }).props.accessibilityState?.selected).toBe(true);
  });

  it('«Movimientos» (ver todos) llama onSeeAll', async () => {
    const { onSeeAll } = await renderDashboard(fakeRepo([makeTx('a')]));
    expect(await screen.findByText(/124\.806/, {}, WAIT)).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Movimientos' }));
    expect(onSeeAll).toHaveBeenCalled();
  });

  it('el contador termina en el balance exacto (animación con final fijado)', async () => {
    await renderDashboard(fakeRepo([makeTx('a')]));
    // useCountUp fija el último frame al objetivo: el valor final es exacto.
    await waitFor(() => expect(screen.getAllByText(/124\.806/).length).toBeGreaterThan(0), WAIT);
  });
});
