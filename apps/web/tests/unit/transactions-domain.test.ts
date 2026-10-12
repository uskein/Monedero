/**
 * Tests del dominio Transaction — TDD, área crítica (ESTANDAR_ESTRATEGIA_PRUEBAS §5).
 * Fuente: MODELO_DE_DATOS.md §3/§5 · HU-05·06·07 (centavos enteros, transferencias).
 */
import { describe, it, expect } from 'vitest';
import { TxInputSchema, TxPatchSchema, sanitizeSearch } from '../../src/data/domain/transactions';

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
    const result = TxInputSchema.safeParse({ ...BASE, amountCents: 0 });
    expect(result.success).toBe(false);
  });

  it('rechaza importe negativo (CHECK amount_cents >= 0)', () => {
    const result = TxInputSchema.safeParse({ ...BASE, amountCents: -100 });
    expect(result.success).toBe(false);
  });

  it('rechaza importe no entero (MONEY_NOT_INTEGER — sin flotantes)', () => {
    const result = TxInputSchema.safeParse({ ...BASE, amountCents: 185.55 });
    expect(result.success).toBe(false);
  });

  it('rechaza fecha fuera del formato YYYY-MM-DD', () => {
    const result = TxInputSchema.safeParse({ ...BASE, date: '11/10/2026' });
    expect(result.success).toBe(false);
  });

  it('rechaza payee > 120 caracteres', () => {
    const result = TxInputSchema.safeParse({ ...BASE, payee: 'x'.repeat(121) });
    expect(result.success).toBe(false);
  });

  it('rechaza note > 1000 caracteres', () => {
    const result = TxInputSchema.safeParse({ ...BASE, note: 'x'.repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe('TxInputSchema — transferencias (CHECKs del modelo)', () => {
  const TRANSFER = {
    ...BASE,
    type: 'transfer' as const,
    toAccountId: 'acc-ahorro',
    categoryId: null,
  };

  it('acepta una transferencia válida (cuenta destino ≠ origen, sin categoría)', () => {
    const parsed = TxInputSchema.parse(TRANSFER);
    expect(parsed.type).toBe('transfer');
    expect(parsed.toAccountId).toBe('acc-ahorro');
    expect(parsed.categoryId).toBeNull();
  });

  it('rechaza transferencia sin cuenta destino (CHECK type=transfer ⇔ to_account_id)', () => {
    const result = TxInputSchema.safeParse({ ...BASE, type: 'transfer' });
    expect(result.success).toBe(false);
  });

  it('rechaza transferencia con destino = origen (CHECK account_id ≠ to_account_id)', () => {
    const result = TxInputSchema.safeParse({ ...TRANSFER, toAccountId: BASE.accountId });
    expect(result.success).toBe(false);
  });

  it('rechaza transferencia con categoría (CHECK transfer ⇒ category_id NULL)', () => {
    const result = TxInputSchema.safeParse({ ...TRANSFER, categoryId: 'cat-comida' });
    expect(result.success).toBe(false);
  });

  it('rechaza gasto con cuenta destino (no-transfer ⇒ to_account_id NULL)', () => {
    const result = TxInputSchema.safeParse({ ...BASE, toAccountId: 'acc-ahorro' });
    expect(result.success).toBe(false);
  });
});

describe('TxPatchSchema — actualización parcial', () => {
  it('acepta un patch con solo payee', () => {
    const parsed = TxPatchSchema.parse({ payee: 'Café' });
    expect(parsed.payee).toBe('Café');
    expect(parsed.amountCents).toBeUndefined();
  });

  it('acepta un patch vacío (sin cambios)', () => {
    const parsed = TxPatchSchema.parse({});
    expect(parsed).toEqual({});
  });

  it('rechaza patch con amountCents 0 (misma regla que alta)', () => {
    const result = TxPatchSchema.safeParse({ amountCents: 0 });
    expect(result.success).toBe(false);
  });
});

describe('sanitizeSearch — búsqueda segura (CONTRATOS_API §1.1)', () => {
  it('elimina caracteres peligrosos de LIKE (%, _, \\)', () => {
    expect(sanitizeSearch('50%_off\\x')).toBe('50  off x');
  });

  it('recorta a 120 caracteres', () => {
    expect(sanitizeSearch('x'.repeat(200)).length).toBe(120);
  });

  it('hace trim de los bordes', () => {
    expect(sanitizeSearch('  Almuerzo  ')).toBe('Almuerzo');
  });
});
