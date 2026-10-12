/**
 * Tests del dashboard store (BP-03) — 4 estados + sincronía tarea 4.3.
 * Fuente: BLUEPRINTS BP-03 · PLAN_DE_SPRINTS 4.3 (tx:created actualiza balance).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  useDashboardStore,
  resetDashboardStore,
  LATEST_LIMIT,
  type DashboardRepo,
} from '../src/features/dashboard/store';
import type { DashboardSummary, Transaction } from '../src/data/domain/transactions';

function makeTx(id: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'expense',
    amountCents: 18500,
    currency: 'COP',
    date: '2026-10-11',
    accountId: 'acc-efectivo',
    toAccountId: null,
    categoryId: null,
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

type Scope = 'tx' | 'account' | 'category';

interface FakeRepo extends DashboardRepo {
  emit(scope: Scope): void;
  /** Resumen devuelto ahora mismo (lo mutan los tests para probar la recarga). */
  current: DashboardSummary;
  /** Cuántas veces se ha pedido el resumen (detecta recargas). */
  summaryCalls: () => number;
  listenerCount: () => number;
  failSummary: boolean;
}

function fakeRepo(items: Transaction[] = []): FakeRepo {
  const listeners = new Set<(changed: { scope: Scope }) => void>();
  let calls = 0;
  const repo: FakeRepo = {
    current: { ...SUMMARY },
    failSummary: false,
    summaryCalls: () => calls,
    listenerCount: () => listeners.size,
    async dashboardSummary() {
      if (repo.failSummary) throw new Error('boom');
      calls += 1;
      return repo.current;
    },
    async list(filter) {
      return typeof filter?.limit === 'number' ? items.slice(0, filter.limit) : items;
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    emit(scope) {
      listeners.forEach((cb) => cb({ scope }));
    },
  };
  return repo;
}

/** Deja terminar las cargas disparadas por eventos (void load → microtareas + tick). */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  resetDashboardStore();
});

describe('useDashboardStore — 4 estados (BP-03)', () => {
  it('init con datos → success con resumen y últimos', async () => {
    await useDashboardStore.getState().init(fakeRepo([makeTx('a'), makeTx('b')]));
    const st = useDashboardStore.getState();
    expect(st.status).toBe('success');
    expect(st.summary?.totalBalanceCents).toBe(SUMMARY.totalBalanceCents);
    expect(st.latest).toHaveLength(2);
    expect(st.error).toBeNull();
  });

  it('init sin movimientos → empty', async () => {
    await useDashboardStore.getState().init(fakeRepo([]));
    expect(useDashboardStore.getState().status).toBe('empty');
  });

  it('init con fallo → error + STORAGE_UNAVAILABLE', async () => {
    const repo = fakeRepo([]);
    repo.failSummary = true;
    await useDashboardStore.getState().init(repo);
    const st = useDashboardStore.getState();
    expect(st.status).toBe('error');
    expect(st.error).toBe('STORAGE_UNAVAILABLE');
    expect(st.summary).toBeNull();
  });

  it('init es idempotente (una sola suscripción)', async () => {
    const repo = fakeRepo([makeTx('a')]);
    await useDashboardStore.getState().init(repo);
    await useDashboardStore.getState().init(fakeRepo([makeTx('z')]));
    expect(repo.listenerCount()).toBe(1);
    expect(useDashboardStore.getState().latest[0]?.id).toBe('a');
  });
});

describe('useDashboardStore — sincronía tx:created → balance (tarea 4.3)', () => {
  it('evento scope="tx" recarga el resumen con el nuevo balance', async () => {
    const repo = fakeRepo([makeTx('a')]);
    await useDashboardStore.getState().init(repo);
    expect(repo.summaryCalls()).toBe(1);

    // El alta en el repo emite 'tx' → el dashboard debe refrescar solo.
    repo.current = { ...SUMMARY, totalBalanceCents: 999900 };
    repo.emit('tx');
    await flush();

    expect(repo.summaryCalls()).toBe(2);
    expect(useDashboardStore.getState().summary?.totalBalanceCents).toBe(999900);
    expect(useDashboardStore.getState().status).toBe('success');
  });

  it('scope distinto de "tx" no dispara recarga', async () => {
    const repo = fakeRepo([makeTx('a')]);
    await useDashboardStore.getState().init(repo);
    const before = repo.summaryCalls();
    repo.emit('account');
    await flush();
    expect(repo.summaryCalls()).toBe(before);
  });

  it('varios eventos seguidos dejan el ÚLTIMO balance (carga gana por secuencia)', async () => {
    const repo = fakeRepo([makeTx('a')]);
    await useDashboardStore.getState().init(repo);
    repo.current = { ...SUMMARY, totalBalanceCents: 111100 };
    repo.emit('tx');
    repo.current = { ...SUMMARY, totalBalanceCents: 222200 };
    repo.emit('tx');
    await flush();
    expect(useDashboardStore.getState().summary?.totalBalanceCents).toBe(222200);
  });
});

describe('useDashboardStore — periodo del segmented', () => {
  it('setMonth cambia el periodo y recarga el resumen de ese mes', async () => {
    const repo = fakeRepo([makeTx('a')]);
    await useDashboardStore.getState().init(repo);

    repo.current = { ...SUMMARY, incomeCents: 777000, monthBalanceCents: 700000 };
    await useDashboardStore.getState().setMonth('2026-09');

    const st = useDashboardStore.getState();
    expect(st.month).toBe('2026-09');
    expect(st.summary?.incomeCents).toBe(777000);
  });

  it('refresh marca loading y vuelve a success', async () => {
    const repo = fakeRepo([makeTx('a')]);
    await useDashboardStore.getState().init(repo);
    const promise = useDashboardStore.getState().refresh();
    expect(useDashboardStore.getState().status).toBe('loading');
    await promise;
    expect(useDashboardStore.getState().status).toBe('success');
  });
});

describe('useDashboardStore — contrato de consulta', () => {
  it('pide los últimos movimientos con el límite de BP-03', async () => {
    const items = Array.from({ length: 8 }, (_, i) => makeTx(`tx-${i}`));
    const repo = fakeRepo(items);
    await useDashboardStore.getState().init(repo);
    expect(useDashboardStore.getState().latest).toHaveLength(LATEST_LIMIT);
  });
});
