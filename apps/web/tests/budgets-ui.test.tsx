/**
 * Test UI — BudgetsScreen (BP-06 · HU-11·12): 4 estados, alta con picker de
 * categorías + MoneyInput, barra semántica + chip «Meta alcanzada», F4
 * (slot ocupado → «editar existente») y toast sereno auto-cerrado (4000 ms).
 * Fuente: BLUEPRINTS BP-06 · FLUJOS F4 · HU-12.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { axe } from 'jest-axe';
import { I18nProvider } from '@monedero/i18n/react';
import { BudgetsScreen } from '../src/features/budgets/BudgetsScreen';
import { useBudgetsStore, type BudgetsRepo } from '../src/features/budgets/store';
import type { Budget, BudgetInput } from '../src/data/domain/budgets';

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

function fakeBudgets(
  seed: Budget[] = [],
  opts: { failList?: boolean; manualPeriod?: boolean } = {},
) {
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
        currency="COP"
        repoOverride={fake.repo}
        categoriesOverride={async () => CATEGORIES}
        txEventsOverride={() => () => undefined}
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
  vi.useRealTimers();
});

describe('BudgetsScreen — 4 estados (BP-06)', () => {
  it('loading → spinner role=status', async () => {
    const fake = fakeBudgets([]);
    fake.repo.listByPeriod = () => new Promise<Budget[]>(() => undefined);
    renderBudgets(fake);
    expect(await screen.findByRole('status')).toBeTruthy();
  });

  it('empty → EmptyState + CTA «Definir tope»', async () => {
    const { container } = renderBudgets(fakeBudgets([]));
    expect(await screen.findByText('Aún no tienes topes')).toBeTruthy();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('success → fila con barra, porcentaje y edición (a11y)', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 50_000);
    const { container } = renderBudgets(fake);
    expect(await screen.findByText('Comida')).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Comida 50 %' });
    expect(bar.getAttribute('aria-valuenow')).toBe('50');
    // COP 0 decimales: 50 000 centavos = $ 500 · 100 000 = $ 1.000 (sin NBSP en la aserción).
    expect(screen.getByText(/500 de/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar tope Comida' })).toBeTruthy();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('error → role=alert + Reintentar', async () => {
    const fake = fakeBudgets([], { failList: true });
    renderBudgets(fake);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});

describe('BudgetsScreen — alta y edición (HU-11 · F4)', () => {
  it('alta: CTA → picker solo gastos + MoneyInput → fila creada', async () => {
    const fake = fakeBudgets([]);
    renderBudgets(fake);
    fireEvent.click(await screen.findByRole('button', { name: 'Definir tope' }));
    const select = screen.getByLabelText('Categoría') as HTMLSelectElement;
    expect(select.options).toHaveLength(2); // solo categorías de gasto
    fireEvent.change(select, { target: { value: 'cat-ocio' } });
    fireEvent.change(screen.getByLabelText('Tope mensual'), { target: { value: '50000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tope' }));
    expect(await screen.findByText('Ocio')).toBeTruthy();
    expect(fake.data).toHaveLength(1);
    expect(fake.data[0]).toMatchObject({ categoryId: 'cat-ocio', amountCents: 5_000_000 });
  });

  it('F4: slot ocupado → alert + «Editar tope» actualiza el existente', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    renderBudgets(fake);
    fireEvent.click(await screen.findByRole('button', { name: 'Definir tope' }));
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: 'cat-comida' } });
    fireEvent.change(screen.getByLabelText('Tope mensual'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tope' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Esa categoría ya tiene un tope este mes');

    fireEvent.click(screen.getByRole('button', { name: 'Editar tope' })); // CTA del duplicado
    expect(screen.getByLabelText('Tope mensual')).toHaveProperty('value', '1000'); // prellenado
    fireEvent.change(screen.getByLabelText('Tope mensual'), { target: { value: '150000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tope' }));

    expect(await screen.findByText('Comida')).toBeTruthy();
    expect(fake.data).toHaveLength(1); // nunca duplica
    expect(fake.data[0]?.amountCents).toBe(15_000_000);
  });

  it('monto ≤ 0 → error local sin tocar el repo', async () => {
    const fake = fakeBudgets([]);
    renderBudgets(fake);
    fireEvent.click(await screen.findByRole('button', { name: 'Definir tope' }));
    fireEvent.change(screen.getByLabelText('Tope mensual'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar tope' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Escribe un monto mayor a cero.');
    expect(fake.data).toHaveLength(0);
  });
});

describe('BudgetsScreen — barra semántica + toast (HU-12)', () => {
  it('80 % → barra warn (accent) y sin chip de meta', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 80_000);
    renderBudgets(fake);
    const bar = await screen.findByRole('progressbar', { name: 'Comida 80 %' });
    expect(bar.querySelector('.ds-progress__fill--warn')).toBeTruthy();
    expect(screen.queryByText('Meta alcanzada')).toBeNull();
  });

  it('100 % → chip «Meta alcanzada» junto a la fila', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 120_000);
    renderBudgets(fake);
    expect(await screen.findByText('Meta alcanzada')).toBeTruthy();
  });

  it('toast sereno al estar sobre el umbral y auto-cierre a los 4000 ms', async () => {
    vi.useFakeTimers();
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    fake.setSpend('cat-comida', 85_000);
    renderBudgets(fake);
    await act(async () => {}); // resuelve el boot (microtareas)
    expect(screen.getByText(/Vas cerca de tu tope en Comida/)).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText(/Vas cerca de tu tope en Comida/)).toBeNull();
  });

  it('cruce por movimiento posterior (onTxEvent) dispara el aviso', async () => {
    const fake = fakeBudgets([makeBudget('b1', 'cat-comida', 100_000)]);
    let listener: (() => void) | null = null;
    render(
      <I18nProvider initialLocale="es-CO">
        <BudgetsScreen
          currency="COP"
          repoOverride={fake.repo}
          categoriesOverride={async () => CATEGORIES}
          txEventsOverride={(cb) => {
            listener = cb;
            return () => {
              listener = null;
            };
          }}
        />
      </I18nProvider>,
    );
    expect(await screen.findByText('Comida')).toBeTruthy();
    expect(screen.queryByText(/Vas cerca de tu tope/)).toBeNull();

    fake.setSpend('cat-comida', 90_000);
    act(() => listener?.());
    await waitFor(() => expect(screen.getByText(/Vas cerca de tu tope en Comida: 90 %/)).toBeTruthy());
  });
});
