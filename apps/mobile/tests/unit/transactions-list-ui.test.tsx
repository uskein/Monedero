/**
 * Test UI — TransactionList móvil (BP-04): 4 estados + filas con importe formateado
 * + borrado (onDelete) + Deshacer (onUndo). Callbacks mock (aislado del store).
 * Patrón RNTL v14 (idéntico a app-root.test.tsx): `await render` + `getBy` síncrono.
 * Fuente: BLUEPRINTS BP-04 · HU-06 · HU-07.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { I18nProvider } from '@monedero/i18n/react';
import { TransactionList } from '../../src/ui/screens/TransactionList';
import type { Transaction } from '../../src/core/domain/transaction';

const CATEGORY_NAMES = { 'cat-comida': 'Comida' };

function makeTx(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'expense',
    amountCents: 1850000,
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

async function renderList(overrides: Partial<Parameters<typeof TransactionList>[0]> = {}) {
  const props = {
    status: 'success' as const,
    items: [makeTx('a'), makeTx('b', { payee: 'Metro', type: 'income', amountCents: 250000 })],
    error: null,
    lastDeletedId: null,
    currency: 'COP' as const,
    categoryNames: CATEGORY_NAMES,
    onRetry: jest.fn(),
    onDelete: jest.fn(),
    onUndo: jest.fn(),
    onClearUndo: jest.fn(),
    onAddFirst: jest.fn(),
    ...overrides,
  };
  await render(
    <I18nProvider initialLocale="es-CO">
      <TransactionList {...props} />
    </I18nProvider>,
  );
  return props;
}

describe('TransactionList — 4 estados (BP-04)', () => {
  it('loading → texto de carga', async () => {
    await renderList({ status: 'loading', items: [] });
    expect(screen.getByText('Cargando…')).toBeTruthy();
  });

  it('empty → título + CTA llama onAddFirst', async () => {
    const props = await renderList({ status: 'empty', items: [] });
    expect(screen.getByText('Aún no hay movimientos')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Añadir primer movimiento' }));
    expect(props.onAddFirst).toHaveBeenCalled();
  });

  it('error → alerta + Reintentar llama onRetry', async () => {
    const props = await renderList({ status: 'error', items: [], error: 'STORAGE_UNAVAILABLE' });
    expect(screen.getByText('No se pudieron cargar los movimientos.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(props.onRetry).toHaveBeenCalled();
  });

  it('success → filas con importe formateado en es-CO', async () => {
    await renderList();
    expect(screen.getByText('Almuerzo')).toBeTruthy();
    expect(screen.getByText('Metro')).toBeTruthy();
    expect(screen.getByText(/18\.500/)).toBeTruthy(); // 1850000 → − $ 18.500
    expect(screen.getByText(/2\.500/)).toBeTruthy(); // 250000 ingreso → + $ 2.500
  });
});

describe('TransactionList — borrado + Deshacer (BP-04/HU-07)', () => {
  it('botón eliminar llama onDelete con el id', async () => {
    const props = await renderList();
    fireEvent.press(screen.getByRole('button', { name: 'Eliminar Almuerzo' }));
    expect(props.onDelete).toHaveBeenCalledWith('a');
  });

  it('lastDeletedId → muestra Deshacer y llama onUndo', async () => {
    const props = await renderList({ lastDeletedId: 'a' });
    expect(screen.getByText('Movimiento eliminado.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));
    expect(props.onUndo).toHaveBeenCalled();
  });

  it('vacío PERO con lastDeletedId conserva el Deshacer (regresión)', async () => {
    const props = await renderList({ status: 'empty', items: [], lastDeletedId: 'a' });
    expect(screen.getByText('Movimiento eliminado.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Deshacer' }));
    expect(props.onUndo).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Añadir primer movimiento' })).toBeTruthy();
  });
});

describe('TransactionList — filtros (BP-04)', () => {
  it('chip Todos arranca selected', async () => {
    await renderList();
    const all = screen.getByRole('button', { name: 'Todos' });
    expect(all.props.accessibilityState?.selected).toBe(true);
  });
});
