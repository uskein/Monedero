/**
 * TransactionRepository — puerto de dominio (hexagonal light).
 * Fuente: CONTRATOS_API.md §1.1. La implementación (SQLCipher en prod, sql.js en
 * test) vive en infrastructure/. El store consume SOLO este puerto.
 */
import type { DashboardSummary, Transaction, TxFilter, TxInput, TxPatch } from '../domain/transaction';

export interface RepositoryEvent {
  scope: 'tx';
  type: 'tx:created' | 'tx:updated' | 'tx:deleted' | 'tx:restored';
  id: string;
}

export interface TransactionRepository {
  list(filter?: TxFilter): Promise<Transaction[]>;
  getById(id: string): Promise<Transaction | null>;
  create(input: TxInput): Promise<Transaction>;
  update(id: string, patch: TxPatch): Promise<Transaction>;
  /** Tombstone: conserva la fila (se exporta para propagar el borrado). */
  softDelete(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  /** Balance de cuenta: inicial + ingresos − gastos (transferencias mueven saldo). */
  balanceOf(accountId: string, initialBalanceCents: number): Promise<number>;
  monthReport(month: string): Promise<{ incomeCents: number; expenseCents: number; balanceCents: number }>;
  /** Resumen BP-03: saldo total global + ingreso/gasto del mes (HU-08·09). */
  dashboardSummary(month: string): Promise<DashboardSummary>;
  subscribe(listener: (event: RepositoryEvent) => void): () => void;
}
