/**
 * Test UI — BudgetsScreen móvil (BP-06 · HU-11·12): 4 estados, alta con
 * picker SOLO gastos + monto, ProgressBar semántica + chip «Meta alcanzada»,
 * F4 (slot ocupado → «editar existente») y toast sereno auto-cerrado 4000 ms.
 * RNTL v14: `await render` y `await fireEvent` son async (React 19 concurrent).
 * Jest (globals): NO importar de vitest.
 */
import { act, render, screen, fireEvent } from '@testing-library/react-native';
import { I18nProvider } from '@monedero/i18n/react';
import { BudgetsScreen } from '../../src/ui/screens/BudgetsScreen';
import { useBudgetsStore, type BudgetsRepo } from '../../src/state/budgets.store';
import type { Budget, BudgetInput } from '../../src/core/domain/budget';

function makeBudget(id: string, categoryId: string, amountCents: number, period = '2026-10'): Budget {
  return {
    id,
    categoryId,
    period,
    amountCents,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    deletedAt: null,
  };
}

function fakeBudgets(seed: Budget[] = [], opts: { failList?: boolean } = {}) {
  const data = [...seed];
  const spentByCategory: Record<string, number> = {};
  const repo: BudgetsRepo = {
    async get(categoryId, period) {
      return data.find((b) => b.categoryId === categoryId && b.period === period) ?? null;
    },
    async listByPeriod(period) {
      if (opts.failList) throw new Error('boom');
      return data.filter((b) => b.period === period);
    },
    async upsert(input: BudgetInput) {
      const existing = data.find(
        (b) => b.categoryId === input.categoryId && b.period === input.period,
      );
      if (existing) {
        existing.amountCents = input.amountCents;
        return existing;
      }
      const created = makeBudget(`b-${data.length + 1}`, input.categoryId, input.amountCents, input.period);
      data.push(created);
      return created;
    },
    async usage(categoryId, period) {
      const budget = data.find((b) => b.categoryId === categoryId && b.period === period);
      const spentCents = spentByCategory[categoryId] ?? 0;
      const budgetCents = budget?.amountCents ?? 0;
      return { spentCents, budgetCents, ratio: budgetCents > 0 ? spentCents / budgetCents : 0 };
    },
  };
  return {
    repo,
    data,
    setSpend(categoryId: string, cents: number) {
      spentByCategory[categoryId] = cents;
    },
  };
}

const CATEGORIES = [
  { id: 'cat-comida', name: 'Comida', type: 'expense', deletedAt: null },
  { id: 'cat-ocio', name: 'Ocio', type: 'expense', deletedAt: null },
  { id: 'cat-salario', name: 'Salario', type: 'income', deletedAt: null },
];

function renderBudgets(fake: ReturnType<typeof fakeBudgets>) {
  return render(
    <I18nProvider initialLocale="es-CO">
      <BudgetsScreen
        budgets={fake.repo}
        categories={{ list: async () => CATEGORIES }}
        period="2026-10"
      />
    </I18nProvider>,
  );
}

beforeEach(() => {
  useBudgetsStore.setState({
    status: 'loading',
    period: '2026-10',
    items: [],
    error: null,
    duplicate: null,
    formError: null,
    toast: null,
    deps: null,
    levels: {},
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('BudgetsScreen móvil — 4 estados (BP-06)', () => {
  it('loading → «Cargando…»; empty → EmptyState + CTA', async () => {
    const loading = fakeBudgets([]);
    loading.repo.listByPeriod = () => new Promise<Budget[]>(() => undefined);
    await renderBudgets(loading);
    expect(screen.getByText('Cargando…')).toBeTruthy();

    useBudgetsStore.setState({ deps: null });
    await renderBudgets(fakeBudgets([]));
    expect(await screen.findByText('Aún no tienes topes')).toBeTruthy();
  });

  it('success → fila con ProgressBar (rol + avance) y edición por nombre', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 50_000);
    await renderBudgets(fake);
    expect(await screen.findByText('Comida')).toBeTruthy();
    expect(screen.getByLabelText('Comida 50 %')).toBeTruthy(); // a11y de la barra
    expect(screen.getByText(/500 de/)).toBeTruthy(); // $ 500 de $ 1.000 (COP)
    expect(screen.getByRole('button', { name: 'Editar tope Comida' })).toBeTruthy();
  });

  it('error → alert + Reintentar', async () => {
    await renderBudgets(fakeBudgets([], { failList: true }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});

describe('BudgetsScreen móvil — alta y edición (HU-11 · F4)', () => {
  it('alta: picker SOLO gastos → monto → fila creada', async () => {
    const fake = fakeBudgets([]);
    await renderBudgets(fake);
    await fireEvent.press(await screen.findByRole('button', { name: 'Definir tope' }));
    expect(screen.getByRole('radio', { name: 'Ocio' })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: 'Salario' })).toBeNull(); // ingresos fuera
    await fireEvent.press(screen.getByRole('radio', { name: 'Ocio' }));
    await fireEvent.changeText(screen.getByLabelText('Tope mensual'), '50000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar tope' }));
    expect(await screen.findByText('Ocio')).toBeTruthy();
    expect(fake.data[0]).toMatchObject({ categoryId: 'cat-ocio', amountCents: 5_000_000 });
  });

  it('F4: slot ocupado → alert + «Editar tope» actualiza sin duplicar', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    await renderBudgets(fake);
    await fireEvent.press(await screen.findByRole('button', { name: 'Definir tope' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Comida' }));
    await fireEvent.changeText(screen.getByLabelText('Tope mensual'), '20000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar tope' }));

    const alert = await screen.findByRole('alert');
    expect(alert.props.children).toContain('Esa categoría ya tiene un tope este mes');

    await fireEvent.press(screen.getByRole('button', { name: 'Editar tope' })); // CTA duplicado
    expect(screen.getByLabelText('Tope mensual').props.value).toBe('1000'); // prellenado
    await fireEvent.changeText(screen.getByLabelText('Tope mensual'), '150000');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar tope' }));

    expect(await screen.findByText('Comida')).toBeTruthy();
    expect(fake.data).toHaveLength(1); // nunca duplica
    expect(fake.data[0]?.amountCents).toBe(15_000_000);
  });

  it('monto ≤ 0 → error local sin tocar el repo', async () => {
    const fake = fakeBudgets([]);
    await renderBudgets(fake);
    await fireEvent.press(await screen.findByRole('button', { name: 'Definir tope' }));
    await fireEvent.changeText(screen.getByLabelText('Tope mensual'), '0');
    await fireEvent.press(screen.getByRole('button', { name: 'Guardar tope' }));
    expect(screen.getByLabelText('Tope mensual').props.accessibilityHint).toContain(
      'monto mayor a cero',
    );
    expect(fake.data).toHaveLength(0);
  });
});

describe('BudgetsScreen móvil — semántica 80/100 + toast (HU-12)', () => {
  it('100 % → chip «Meta alcanzada» junto a la fila', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 120_000);
    await renderBudgets(fake);
    expect(await screen.findByText('Meta alcanzada')).toBeTruthy();
  });

  it('toast sereno con auto-cierre a los 4000 ms (fake timers)', async () => {
    jest.useFakeTimers();
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 85_000);
    await renderBudgets(fake);
    await screen.findByText(/Vas cerca de tu tope en Comida/);
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(screen.queryByText(/Vas cerca de tu tope en Comida/)).toBeNull();
  });
});
