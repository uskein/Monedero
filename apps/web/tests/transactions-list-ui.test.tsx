/**
 * Test UI — TransactionList (BP-04): 4 estados + a11y + i18n.
 * Fuente: BLUEPRINTS_DE_PANTALLAS.md BP-04 · ESTANDAR_ACCESIBILIDAD §8.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { I18nProvider } from '@monedero/i18n/react';
import { TransactionList } from '../src/features/transactions/TransactionList';
import type { Transaction } from '../src/data/domain/transactions';
import type { TxListStatus } from '../src/features/transactions/store';

function makeTx(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'expense',
    amountCents: 18500,
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

interface Props {
  status: TxListStatus;
  items?: Transaction[];
  error?: string | null;
  lastDeletedId?: string | null;
  onDelete?: (id: string) => void;
  onUndo?: () => void;
  onRetry?: () => void;
  onAddFirst?: () => void;
}

function renderList(props: Props) {
  const noop = vi.fn();
  return render(
    <I18nProvider initialLocale="es-CO">
      <TransactionList
        status={props.status}
        items={props.items ?? []}
        error={props.error ?? null}
        lastDeletedId={props.lastDeletedId ?? null}
        currency="COP"
        categoryNames={{ 'cat-comida': 'Comida' }}
        onRetry={props.onRetry ?? noop}
        onDelete={props.onDelete ?? noop}
        onUndo={props.onUndo ?? noop}
        onClearUndo={noop}
        onAddFirst={props.onAddFirst ?? noop}
      />
    </I18nProvider>,
  );
}

describe('TransactionList — 4 estados (BP-04)', () => {
  it('loading → skeleton con aria-busy', async () => {
    const { container } = renderList({ status: 'loading' });
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(screen.getByText('Cargando…')).toBeTruthy();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('empty → EmptyState con CTA «Añadir primer movimiento»', async () => {
    const onAddFirst = vi.fn();
    const { container } = renderList({ status: 'empty', onAddFirst });
    expect(screen.getByText('Aún no hay movimientos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Añadir primer movimiento' }));
    expect(onAddFirst).toHaveBeenCalled();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('success → filas .tx con importe y botón eliminar', async () => {
    const onDelete = vi.fn();
    const { container } = renderList({ status: 'success', items: [makeTx('a'), makeTx('b', { payee: 'Café' })], onDelete });
    expect(screen.getByText('Almuerzo')).toBeTruthy();
    expect(screen.getByText('Café')).toBeTruthy();
    // importe formateado con signo − (gasto); COP 0 decimales: 18500 centavos → "− $ 185"
    expect(screen.getAllByText(/185/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Eliminar Almuerzo/ }));
    expect(onDelete).toHaveBeenCalledWith('a');
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('error → toast role=alert + botón Reintentar', async () => {
    const onRetry = vi.fn();
    const { container } = renderList({ status: 'error', error: 'STORAGE_UNAVAILABLE', onRetry });
    expect(screen.getByRole('alert').textContent).toContain('No se pudieron cargar');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

describe('TransactionList — borrado blando + Deshacer (BP-04)', () => {
  it('muestra aviso de deshacer y limpia tras el clic', async () => {
    const onUndo = vi.fn();
    renderList({ status: 'success', items: [makeTx('a')], lastDeletedId: 'a', onUndo });
    expect(screen.getByText('Movimiento eliminado.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(onUndo).toHaveBeenCalled();
  });

  it('regresión: borrar el ÚNICO movimiento → estado empty aún conserva el Deshacer', async () => {
    // Al borrar el único tx la lista pasa a 'empty'; el aviso Deshacer NO debe perderse.
    const onUndo = vi.fn();
    const { container } = renderList({ status: 'empty', items: [], lastDeletedId: 'a', onUndo });
    expect(screen.getByText('Aún no hay movimientos')).toBeTruthy();
    expect(screen.getByText('Movimiento eliminado.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(onUndo).toHaveBeenCalled();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

describe('TransactionList — filtros (BP-04)', () => {
  it('filtro por tipo reduce las filas visibles', async () => {
    renderList({
      status: 'success',
      items: [makeTx('a', { type: 'expense' }), makeTx('b', { type: 'income', categoryId: 'cat-salario' })],
    });
    expect(screen.getByText('2 movimientos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ingreso' }));
    expect(screen.getByText('1 movimientos')).toBeTruthy();
  });

  it('búsqueda por payee filtra', async () => {
    renderList({ status: 'success', items: [makeTx('a', { payee: 'Almuerzo' }), makeTx('b', { payee: 'Café' })] });
    fireEvent.change(screen.getByLabelText('Buscar por concepto o nota'), { target: { value: 'Café' } });
    expect(screen.getByText('1 movimientos')).toBeTruthy();
  });
});
