import { describe, it, expect } from 'vitest';
import { canonicalize } from '../src/hash';
import { MonederoFileSchema } from '../src/schemas';
import { migrate } from '../src/migrations';
import { FORMAT_VERSION } from '../src/types';

describe('canonicalize (integridad del fichero .monedero)', () => {
  it('ordena las claves alfabéticamente de forma determinista', () => {
    const a = canonicalize({ b: 1, a: 2 });
    const b = canonicalize({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it('produce JSON idéntico para estructuras anidadas independientemente del orden', () => {
    const a = canonicalize({ data: { z: [1, 2], a: 'x' }, n: null });
    const b = canonicalize({ n: null, data: { a: 'x', z: [1, 2] } });
    expect(a).toBe(b);
  });

  it('descarta claves undefined (roundtrip estabilidad)', () => {
    expect(canonicalize({ a: undefined, b: 1 })).toBe('{"b":1}');
  });
});

describe('MonederoFileSchema (validación en import)', () => {
  const valid = {
    formatVersion: FORMAT_VERSION,
    exportedAt: '2026-10-11T12:00:00.000Z',
    vaultId: '123e4567-e89b-42d3-a456-426614174000',
    currency: 'COP',
    integrity: { sha256: 'a'.repeat(64) },
    data: { accounts: [], categories: [], transactions: [] },
  };

  it('acepta un fichero v1 válido', () => {
    expect(MonederoFileSchema.safeParse(valid).success).toBe(true);
  });

  it('rechaza hash con formato inválido (IMPORT_INTEGRITY_FAIL)', () => {
    const bad = { ...valid, integrity: { sha256: 'no-hash' } };
    expect(MonederoFileSchema.safeParse(bad).success).toBe(false);
  });

  it('rechaza moneda que no sea ISO-4217 de 3 letras', () => {
    const bad = { ...valid, currency: 'PESOS' };
    expect(MonederoFileSchema.safeParse(bad).success).toBe(false);
  });
});

describe('migrate (forward-only)', () => {
  it('etiqueta versiones antiguas a v1', () => {
    expect(migrate({ formatVersion: 0 }).formatVersion).toBe(FORMAT_VERSION);
  });

  it('lanza VERSION_NO_SOPORTADA para versiones futuras', () => {
    expect(() => migrate({ formatVersion: 99 })).toThrow('VERSION_NO_SOPORTADA');
  });
});
