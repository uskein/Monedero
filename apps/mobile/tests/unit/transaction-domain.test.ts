/**
 * Tests del dominio Transaction móvil — TDD, área crítica.
 * Fuente: MODELO_DE_DATOS.md §3/§5 · HU-05·06·07 (centavos enteros, transferencias).
 * Espejo de la matriz de la PWA (misma semántica en ambas plataformas).
 */
import { TxInputSchema, TxPatchSchema, sanitizeSearch } from '../../src/core/domain/transaction';

const BASE = {
  type: 'expense' as const,
  amountCents: 18500,
  currency: 'COP',
  date: '2026-10-11',
  accountId: 'acc-efectivo',
};

describe('TxInputSchema — alta de movimiento (BP-05)', () => {
  it('acepta un gasto válido con centavos enteros', () => {
    const parsed = TxInputSchema.parse({ ...BASE, payee: 'Almuerzo' });
    expect(parsed.amountCents).toBe(18500);
    expect(parsed.status).toBe('cleared'); // default
  });

  it('rechaza importe 0 (HU-05: nunca registrar $0)', () => {
    expect(TxInputSchema.safeParse({ ...BASE, amountCents: 0 }).success).toBe(false);
  });

  it('rechaza importe negativo (CHECK amount_cents >= 0)', () => {
    expect(TxInputSchema.safeParse({ ...BASE, amountCents: -100 }).success).toBe(false);
  });

  it('rechaza importe no entero (sin flotantes)', () => {
    expect(TxInputSchema.safeParse({ ...BASE, amountCents: 185.55 }).success).toBe(false);
  });

  it('rechaza fecha fuera de YYYY-MM-DD', () => {
    expect(TxInputSchema.safeParse({ ...BASE, date: '11/10/2026' }).success).toBe(false);
  });

  it('rechaza payee > 120', () => {
    expect(TxInputSchema.safeParse({ ...BASE, payee: 'x'.repeat(121) }).success).toBe(false);
  });
});

describe('TxInputSchema — transferencias (CHECKs del modelo)', () => {
  const TRANSFER = { ...BASE, type: 'transfer' as const, toAccountId: 'acc-ahorro', categoryId: null };

  it('acepta una transferencia válida', () => {
    const parsed = TxInputSchema.parse(TRANSFER);
    expect(parsed.type).toBe('transfer');
    expect(parsed.toAccountId).toBe('acc-ahorro');
  });

  it('rechaza transferencia sin destino (type=transfer ⇔ to_account_id)', () => {
    expect(TxInputSchema.safeParse({ ...BASE, type: 'transfer' }).success).toBe(false);
  });

  it('rechaza destino = origen (account_id ≠ to_account_id)', () => {
    expect(TxInputSchema.safeParse({ ...TRANSFER, toAccountId: BASE.accountId }).success).toBe(false);
  });

  it('rechaza transferencia con categoría (transfer ⇒ category_id NULL)', () => {
    expect(TxInputSchema.safeParse({ ...TRANSFER, categoryId: 'cat-comida' }).success).toBe(false);
  });

  it('rechaza gasto con cuenta destino (no-transfer ⇒ to_account_id NULL)', () => {
    expect(TxInputSchema.safeParse({ ...BASE, toAccountId: 'acc-ahorro' }).success).toBe(false);
  });
});

describe('TxPatchSchema — actualización parcial', () => {
  it('acepta patch con solo payee', () => {
    const parsed = TxPatchSchema.parse({ payee: 'Café' });
    expect(parsed.payee).toBe('Café');
    expect(parsed.amountCents).toBeUndefined();
  });

  it('rechaza patch con amountCents 0 (misma regla que alta)', () => {
    expect(TxPatchSchema.safeParse({ amountCents: 0 }).success).toBe(false);
  });
});

describe('sanitizeSearch — búsqueda segura', () => {
  it('elimina comodines LIKE (%, _, \\)', () => {
    expect(sanitizeSearch('50%_off\\x')).toBe('50  off x');
  });

  it('recorta a 120', () => {
    expect(sanitizeSearch('x'.repeat(200)).length).toBe(120);
  });
});
