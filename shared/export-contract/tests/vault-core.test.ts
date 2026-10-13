/**
 * TDD del núcleo .monedero (S7 · HU-14·15) — build/integridad, codec `.enc`
 * con cripto simulada (tag de autenticación GCM simulado), parseo con la
 * taxonomía IMPORT_* y el plan de merge LWW (matriz completa).
 * La cripto REAL por plataforma se prueba en cada app (móvil @noble · PWA WebCrypto).
 */
import { describe, it, expect } from 'vitest';
import { bytesToBase64, base64ToBytes } from '../src/base64';
import { encodeUtf8, decodeUtf8 } from '../src/utf8';
import { canonicalize } from '../src/hash';
import { buildMonederoFile, verifyMonederoIntegrity, EXPORT_ORDER } from '../src/file';
import { encryptToEnvelope, openEnvelope, type FileCrypto } from '../src/envelope';
import { parseMonederoInput, isEncryptedEnvelope } from '../src/parse';
import { planMerge, planReplace, type DbRow } from '../src/merge';
import type { MonederoCollection } from '../src/types';

/** SHA-256 simulado determinista (64 hex) — la pureza del módulo es lo que se prueba. */
const fakeSha256 = async (input: string): Promise<string> => {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    h1 = Math.imul(h1 ^ input.charCodeAt(i), 16777619) >>> 0;
    h2 = Math.imul(h2 + input.charCodeAt(i) * (i + 1), 2654435761) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(4).slice(0, 64);
};

/** Cripto simulada: XOR con clave/iv + tag que DEPENDE de la clave (simula
 *  la autenticación GCM: clave equivocada → tag inválido → decrypt lanza). */
function tagFor(key: Uint8Array): number {
  return (0xab ^ (key[0] ?? 0)) & 0xff;
}
function xorCrypt(data: Uint8Array, key: Uint8Array, iv: Uint8Array): Uint8Array {
  return Uint8Array.from(data, (b, i) => b ^ (key[i % key.length] ?? 0) ^ (iv[i % iv.length] ?? 0));
}
const fakeCrypto: FileCrypto = {
  randomBytes: async (n) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + 7) % 256),
  pbkdf2: async (passphrase) => {
    const key = new Uint8Array(32);
    for (let i = 0; i < key.length; i++) key[i] = passphrase.charCodeAt(i % passphrase.length) & 0xff;
    return key;
  },
  aesGcmEncrypt: async (p, key, iv) => {
    const ct = xorCrypt(p, key, iv);
    const out = new Uint8Array(ct.length + 1);
    out.set(ct);
    out[ct.length] = tagFor(key);
    return out;
  },
  aesGcmDecrypt: async (ct, key, iv) => {
    if (ct[ct.length - 1] !== tagFor(key)) throw new Error('auth');
    return xorCrypt(ct.subarray(0, ct.length - 1), key, iv);
  },
  sha256Hex: fakeSha256,
};

const EMPTY_DATA = {
  accounts: [],
  categories: [],
  transactions: [],
  tags: [],
  transaction_tags: [],
  budgets: [],
  settings: [],
} as Record<MonederoCollection, DbRow[]>;

describe('base64 + utf8 puros', () => {
  it('base64 roundtrip con todos los bytes y bloques parciales', () => {
    const all = Uint8Array.from({ length: 258 }, (_, i) => i % 256);
    expect(Array.from(base64ToBytes(bytesToBase64(all)))).toEqual(Array.from(all));
    expect(Array.from(base64ToBytes(bytesToBase64(Uint8Array.from([1]))))).toEqual([1]);
    expect(Array.from(base64ToBytes(bytesToBase64(Uint8Array.from([1, 2]))))).toEqual([1, 2]);
  });

  it('utf8 roundtrip con tildes, ñ y emoji (4 bytes)', () => {
    const text = 'Bóveda de Éker — ñoño 🚀 final';
    expect(decodeUtf8(encodeUtf8(text))).toBe(text);
  });
});

describe('buildMonederoFile + integridad (HU-14)', () => {
  it('el integrity es el hash del canónico SIN integrity', async () => {
    const file = await buildMonederoFile(
      { ...EMPTY_DATA, transactions: [{ id: 'tx-1', amount_cents: 100 }] },
      { vaultId: '4de9a1a2-1cde-4f10-9a7a-2f6f0f0d9b11', currency: 'cop', exportedAt: '2026-10-13T10:00:00.000Z' },
      fakeSha256,
    );
    expect(file.currency).toBe('COP'); // normalizado a mayúsculas
    const { integrity, ...rest } = file;
    expect(integrity.sha256).toBe(await fakeSha256(canonicalize(rest)));
    expect(await verifyMonederoIntegrity(file, fakeSha256)).toBe(true);
  });

  it('cualquier alteración de datos o del hash → inválido', async () => {
    const file = await buildMonederoFile(EMPTY_DATA, { vaultId: '4de9a1a2-1cde-4f10-9a7a-2f6f0f0d9b11', currency: 'COP' }, fakeSha256);
    expect(await verifyMonederoIntegrity({ ...file, currency: 'USD' }, fakeSha256)).toBe(false);
    expect(await verifyMonederoIntegrity({ ...file, integrity: { sha256: 'a'.repeat(64) } }, fakeSha256)).toBe(false);
    expect(await verifyMonederoIntegrity({ ...file, integrity: undefined }, fakeSha256)).toBe(false);
  });
});

describe('envelope .monedero.enc (HU-14)', () => {
  it('roundtrip: cifrar → abrir con la MISMA passphrase', async () => {
    const file = await buildMonederoFile(EMPTY_DATA, { vaultId: '4de9a1a2-1cde-4f10-9a7a-2f6f0f0d9b11', currency: 'COP' }, fakeSha256);
    const env = await encryptToEnvelope(file, 'clave-segura-1', fakeCrypto);
    expect(env.magic).toBe('MONEDERO-ENC-1');
    expect(JSON.stringify(env)).not.toContain('clave-segura'); // la passphrase jamás viaja
    const opened = await openEnvelope(env, 'clave-segura-1', fakeCrypto);
    expect(opened.vaultId).toBe(file.vaultId);
  });

  it('passphrase corta → VALIDATION_FAILED al exportar', async () => {
    const file = await buildMonederoFile(EMPTY_DATA, { vaultId: '4de9a1a2-1cde-4f10-9a7a-2f6f0f0d9b11', currency: 'COP' }, fakeSha256);
    await expect(encryptToEnvelope(file, 'corta', fakeCrypto)).rejects.toThrow('VALIDATION_FAILED');
  });

  it('envoltorio alterado → IMPORT_HASH_MISMATCH (antes de descifrar)', async () => {
    const file = await buildMonederoFile(EMPTY_DATA, { vaultId: '4de9a1a2-1cde-4f10-9a7a-2f6f0f0d9b11', currency: 'COP' }, fakeSha256);
    const env = await encryptToEnvelope(file, 'clave-segura-1', fakeCrypto);
    const tampered = { ...env, iv: bytesToBase64(new Uint8Array(12).fill(9)) };
    await expect(openEnvelope(tampered, 'clave-segura-1', fakeCrypto)).rejects.toThrow('IMPORT_HASH_MISMATCH');
  });

  it('passphrase equivocada → IMPORT_DECRYPT_FAILED (GCM autentica)', async () => {
    const file = await buildMonederoFile(EMPTY_DATA, { vaultId: '4de9a1a2-1cde-4f10-9a7a-2f6f0f0d9b11', currency: 'COP' }, fakeSha256);
    const env = await encryptToEnvelope(file, 'clave-segura-1', fakeCrypto);
    await expect(openEnvelope(env, 'otra-clave-x1', fakeCrypto)).rejects.toThrow('IMPORT_DECRYPT_FAILED');
  });
});

describe('parseMonederoInput — taxonomía IMPORT_* (F5)', () => {
  it('JSON plano válido → file sin cifrar', async () => {
    const file = await buildMonederoFile(EMPTY_DATA, { vaultId: '4de9a1a2-1cde-4f10-9a7a-2f6f0f0d9b11', currency: 'COP' }, fakeSha256);
    const parsed = await parseMonederoInput(JSON.stringify(file), { sha256Hex: fakeSha256 });
    expect(parsed.encrypted).toBe(false);
    expect(parsed.file.formatVersion).toBe(1);
  });

  it('basura → IMPORT_FORMAT_UNSUPPORTED', async () => {
    await expect(parseMonederoInput('no soy json', { sha256Hex: fakeSha256 })).rejects.toThrow('IMPORT_FORMAT_UNSUPPORTED');
  });

  it('versión futura con hash válido → IMPORT_FORMAT_UNSUPPORTED («actualiza»)', async () => {
    const file = await buildMonederoFile(EMPTY_DATA, { vaultId: '4de9a1a2-1cde-4f10-9a7a-2f6f0f0d9b11', currency: 'COP' }, fakeSha256);
    const { integrity: _i, ...rest } = file;
    const future = { ...rest, formatVersion: 2 };
    const withHash = { ...future, integrity: { sha256: await fakeSha256(canonicalize(future)) } };
    await expect(parseMonederoInput(JSON.stringify(withHash), { sha256Hex: fakeSha256 })).rejects.toThrow('IMPORT_FORMAT_UNSUPPORTED');
  });

  it('envoltorio sin passphrase → PASSPHRASE_REQUIRED', async () => {
    const file = await buildMonederoFile(EMPTY_DATA, { vaultId: '4de9a1a2-1cde-4f10-9a7a-2f6f0f0d9b11', currency: 'COP' }, fakeSha256);
    const env = await encryptToEnvelope(file, 'clave-segura-1', fakeCrypto);
    expect(isEncryptedEnvelope(env)).toBe(true);
    await expect(parseMonederoInput(JSON.stringify(env), { sha256Hex: fakeSha256, crypto: fakeCrypto })).rejects.toThrow('PASSPHRASE_REQUIRED');
    const parsed = await parseMonederoInput(JSON.stringify(env), { passphrase: 'clave-segura-1', sha256Hex: fakeSha256, crypto: fakeCrypto });
    expect(parsed.encrypted).toBe(true);
  });
});

describe('planMerge LWW (HU-15)', () => {
  const row = (id: string, updatedAt: string, extra: DbRow = {}): DbRow => ({
    id,
    updated_at: updatedAt,
    deleted_at: null,
    ...extra,
  });

  it('inserta lo nuevo, actualiza lo más reciente y descarta lo viejo', () => {
    const incoming = {
      ...EMPTY_DATA,
      transactions: [
        row('tx-nuevo', '2026-10-10T10:00:00.000Z'),
        row('tx-mas-reciente', '2026-10-12T10:00:00.000Z', { amount_cents: 500 }),
        row('tx-viejo', '2026-10-01T10:00:00.000Z', { amount_cents: 100 }),
        row('tx-local-gana', '2026-10-05T10:00:00.000Z', { amount_cents: 999 }),
      ],
    };
    const existing = {
      ...EMPTY_DATA,
      transactions: [
        row('tx-mas-reciente', '2026-10-11T10:00:00.000Z', { amount_cents: 300 }),
        row('tx-viejo', '2026-10-08T10:00:00.000Z', { amount_cents: 200 }),
        row('tx-local-gana', '2026-10-09T10:00:00.000Z', { amount_cents: 777 }),
      ],
    };
    const plan = planMerge(incoming, existing);
    const txInserts = plan.inserts.find((p) => p.collection === 'transactions')?.rows ?? [];
    const txUpdates = plan.updates.find((p) => p.collection === 'transactions')?.rows ?? [];
    expect(txInserts.map((r) => r.id)).toEqual(['tx-nuevo']);
    expect(txUpdates.map((r) => r.id)).toEqual(['tx-mas-reciente']);
    expect(plan.summary.added).toBe(1);
    expect(plan.summary.updated).toBe(1);
    expect(plan.summary.skipped).toBe(2); // tx-viejo + tx-local-gana (locales más recientes)
    expect(plan.summary.reasons.LOCAL_MAS_RECIENTE).toBe(2);
  });

  it('empate de fecha con contenido distinto → conflicto (gana el local)', () => {
    const ts = '2026-10-10T10:00:00.000Z';
    const plan = planMerge(
      { ...EMPTY_DATA, transactions: [row('tx-1', ts, { amount_cents: 111 })] },
      { ...EMPTY_DATA, transactions: [row('tx-1', ts, { amount_cents: 222 })] },
    );
    expect(plan.summary.conflicts).toBe(1);
    expect(plan.updates).toHaveLength(0);
    expect(plan.summary.reasons.CONFLICTO_EN_EMPATE).toBe(1);
  });

  it('empate idéntico → SIN_CAMBIOS', () => {
    const ts = '2026-10-10T10:00:00.000Z';
    const plan = planMerge(
      { ...EMPTY_DATA, transactions: [row('tx-1', ts, { amount_cents: 111 })] },
      { ...EMPTY_DATA, transactions: [row('tx-1', ts, { amount_cents: 111 })] },
    );
    expect(plan.summary.skipped).toBe(1);
    expect(plan.summary.reasons.SIN_CAMBIOS).toBe(1);
  });

  it('tombstone más reciente también gana (borrados sincronizan)', () => {
    const plan = planMerge(
      { ...EMPTY_DATA, transactions: [row('tx-1', '2026-10-12T10:00:00.000Z', { deleted_at: '2026-10-12T10:00:00.000Z' })] },
      { ...EMPTY_DATA, transactions: [row('tx-1', '2026-10-11T10:00:00.000Z', { deleted_at: null })] },
    );
    expect(plan.summary.updated).toBe(1);
    expect(plan.updates[0]?.rows[0]?.deleted_at).toBe('2026-10-12T10:00:00.000Z');
  });

  it('transaction_tags: unión de conjuntos por PK compuesta', () => {
    const plan = planMerge(
      { ...EMPTY_DATA, transaction_tags: [{ transaction_id: 'tx-1', tag_id: 'tag-a' }, { transaction_id: 'tx-1', tag_id: 'tag-b' }] },
      { ...EMPTY_DATA, transaction_tags: [{ transaction_id: 'tx-1', tag_id: 'tag-a' }] },
    );
    const inserts = plan.inserts.find((p) => p.collection === 'transaction_tags')?.rows ?? [];
    expect(inserts).toEqual([{ transaction_id: 'tx-1', tag_id: 'tag-b' }]);
    expect(plan.summary.added).toBe(1);
    expect(plan.summary.skipped).toBe(1);
  });

  it('filas sin id válido → FILA_INVALIDA; orden de aplicación por FK', () => {
    const plan = planMerge(
      { ...EMPTY_DATA, transactions: [{ amount_cents: 5 }, row('tx-ok', '2026-10-10T10:00:00.000Z')] },
      { ...EMPTY_DATA, transactions: [] },
    );
    expect(plan.summary.reasons.FILA_INVALIDA).toBe(1);
    const order = plan.inserts.map((p) => p.collection);
    const idx = (c: MonederoCollection) => order.indexOf(c);
    if (order.includes('accounts') && order.includes('transactions')) {
      expect(idx('accounts')).toBeLessThan(idx('transactions'));
    }
    expect(EXPORT_ORDER.indexOf('accounts')).toBeLessThan(EXPORT_ORDER.indexOf('transactions'));
  });

  it('planReplace vacía e inserta todo (HU-16)', () => {
    const plan = planReplace({ ...EMPTY_DATA, budgets: [{ id: 'b1', category_id: 'c1', period: '2026-10', amount_cents: 1, updated_at: 'x', created_at: 'x', deleted_at: null }] });
    expect(plan.inserts).toHaveLength(1);
    expect(plan.summary.added).toBe(1);
  });
});
