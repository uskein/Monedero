/**
 * Tests del store FLUX de movimientos — 4 estados + add/remove/undo.
 * Repo inyectado (fake en memoria) para aislar el store de sql.js.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useTransactionsStore, type TransactionsRepo } from '../src/features/transactions/store';
import type { Transaction, TxInput } from '../src/data/domain/transactions';

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

/** Repo fake: en memoria, con soporte de fallo inyectable para el estado error. */
function fakeRepo(seed: Transaction[] = [], opts: { failList?: boolean } = {}): TransactionsRepo & { data: Transaction[] } {
  const data = [...seed];
  return {
    data,
    async list() {
      if (opts.failList) throw new Error('boom');
      return data.filter((tx) => !tx.deletedAt);
    },
    async create(input: TxInput) {
      const tx = makeTx(`tx-${data.length + 1}`, {
        type: input.type,
        amountCents: input.amountCents,
        payee: input.payee ?? null,
      });
      data.push(tx);
      return tx;
    },
    async softDelete(id: string) {
      const tx = data.find((t) => t.id === id);
      if (tx) tx.deletedAt = '2026-10-11T13:00:00.000Z';
    },
    async restore(id: string) {
      const tx = data.find((t) => t.id === id);
      if (tx) tx.deletedAt = null;
    },
  };
}

beforeEach(() => {
  useTransactionsStore.setState({
    status: 'loading',
    items: [],
    filter: {},
    error: null,
    lastDeletedId: null,
    repo: null,
  });
});

describe('useTransactionsStore — estados (BP-04)', () => {
  it('init con repo vacío → status empty', async () => {
    await useTransactionsStore.getState().init(fakeRepo([]));
    expect(useTransactionsStore.getState().status).toBe('empty');
  });

  it('init con datos → status success', async () => {
    await useTransactionsStore.getState().init(fakeRepo([makeTx('a')]));
    expect(useTransactionsStore.getState().status).toBe('success');
    expect(useTransactionsStore.getState().items).toHaveLength(1);
  });

  it('init con repo que falla → status error + STORAGE_UNAVAILABLE', async () => {
    await useTransactionsStore.getState().init(fakeRepo([], { failList: true }));
    expect(useTransactionsStore.getState().status).toBe('error');
    expect(useTransactionsStore.getState().error).toBe('STORAGE_UNAVAILABLE');
  });

  it('init es idempotente (no re-inyecta el repo)', async () => {
    const repo = fakeRepo([makeTx('a')]);
    await useTransactionsStore.getState().init(repo);
    await useTransactionsStore.getState().init(fakeRepo([makeTx('b')]));
    expect(useTransactionsStore.getState().items).toHaveLength(1);
  });
});

describe('useTransactionsStore — add (BP-05)', () => {
  it('add crea el movimiento y refresca la lista', async () => {
    await useTransactionsStore.getState().init(fakeRepo([]));
    const ok = await useTransactionsStore.getState().add({
      type: 'expense',
      amountCents: 5000,
      currency: 'COP',
      date: '2026-10-11',
      accountId: 'acc-efectivo',
      payee: 'Café',
    });
    expect(ok).toBe(true);
    expect(useTransactionsStore.getState().items).toHaveLength(1);
    expect(useTransactionsStore.getState().status).toBe('success');
  });
});

describe('useTransactionsStore — remove / undo (BP-04 borrado blando)', () => {
  it('remove marca lastDeletedId y excluye de la lista', async () => {
    await useTransactionsStore.getState().init(fakeRepo([makeTx('a'), makeTx('b')]));
    await useTransactionsStore.getState().remove('a');
    expect(useTransactionsStore.getState().lastDeletedId).toBe('a');
    expect(useTransactionsStore.getState().items.find((t) => t.id === 'a')).toBeUndefined();
  });

  it('undoDelete restaura el movimiento y limpia lastDeletedId', async () => {
    await useTransactionsStore.getState().init(fakeRepo([makeTx('a')]));
    await useTransactionsStore.getState().remove('a');
    await useTransactionsStore.getState().undoDelete();
    expect(useTransactionsStore.getState().lastDeletedId).toBeNull();
    expect(useTransactionsStore.getState().items.find((t) => t.id === 'a')).toBeTruthy();
  });

  it('clearUndo limpia el aviso sin restaurar', async () => {
    await useTransactionsStore.getState().init(fakeRepo([makeTx('a')]));
    await useTransactionsStore.getState().remove('a');
    useTransactionsStore.getState().clearUndo();
    expect(useTransactionsStore.getState().lastDeletedId).toBeNull();
    expect(useTransactionsStore.getState().items.find((t) => t.id === 'a')).toBeUndefined();
  });
});
