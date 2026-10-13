/**
 * TDD del VaultFile PWA (S7 · HU-14·15·16) — WebCrypto real sobre sql.js.
 * Espejo reducido de la suite móvil: roundtrip plano/cifrado, hash alterado,
 * LWW y replace.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { MIGRATIONS, runMigrations } from '@monedero/db';
import { sqlJsMigrationExecutor } from '@monedero/db/sqljs';
import {
  buildVaultFile,
  exportVaultFile,
  importVaultFile,
  readTable,
} from '../src/data/repo/vaultFile';

const NOW = '2026-10-13T10:00:00.000Z';
const META = { vaultId: '4de9a1a2-1cde-4f10-9a7a-2f6f0f0d9b11', currency: 'COP' };

let db: Database;

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SQL: any = await initSqlJs();
  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
});

async function freshDb(): Promise<Database> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SQL: any = await initSqlJs();
  const d = new SQL.Database();
  d.run('PRAGMA foreign_keys = ON');
  await runMigrations(sqlJsMigrationExecutor(d), MIGRATIONS);
  return d;
}

function seed(db2: Database): void {
  db2.run(
    `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,created_at,updated_at)
     VALUES ('acc-1','Efectivo','cash','COP',0,'${NOW}','${NOW}')`,
  );
  db2.run(
    `INSERT INTO categories (id,name,type,created_at,updated_at)
     VALUES ('cat-1','Comida','expense','${NOW}','${NOW}')`,
  );
  db2.run(
    `INSERT INTO transactions (id,type,amount_cents,currency,date,account_id,category_id,payee,created_at,updated_at)
     VALUES ('tx-1','expense',18500,'COP','2026-10-11','acc-1','cat-1','Almuerzo','${NOW}','${NOW}')`,
  );
}

describe('VaultFile PWA (S7)', () => {
  it('roundtrip plano y CIFRADO con WebCrypto real', async () => {
    const source = await freshDb();
    seed(source);
    const plain = await exportVaultFile(source, META);
    expect(plain.filename).toMatch(/\.monedero$/);

    const target = await freshDb();
    const summary = await importVaultFile(target, plain.content, { mode: 'merge', source: 'mobile' });
    expect(summary.added).toBe(3);
    expect(readTable(target, 'transactions')[0]?.payee).toBe('Almuerzo');

    const encrypted = await exportVaultFile(source, { ...META, passphrase: 'clave-segura-1' });
    expect(encrypted.filename).toMatch(/\.monedero\.enc$/);
    const target2 = await freshDb();
    expect((await importVaultFile(target2, encrypted.content, { mode: 'merge', passphrase: 'clave-segura-1' })).added).toBe(3);
    const target3 = await freshDb();
    await expect(
      importVaultFile(target3, encrypted.content, { mode: 'merge', passphrase: 'otra-clave-x1' }),
    ).rejects.toThrow('IMPORT_DECRYPT_FAILED');
  }, 30_000);

  it('hash alterado → IMPORT_HASH_MISMATCH (0 escrituras)', async () => {
    const source = await freshDb();
    seed(source);
    const file = await buildVaultFile(source, META);
    const target = await freshDb();
    await expect(
      importVaultFile(target, JSON.stringify({ ...file, currency: 'USD' }), { mode: 'merge' }),
    ).rejects.toThrow('IMPORT_HASH_MISMATCH');
    expect(readTable(target, 'transactions')).toHaveLength(0);
  });

  it('merge LWW + replace (HU-15·16)', async () => {
    const sourceA = await freshDb();
    seed(sourceA);
    const target = await freshDb();
    seed(target);
    target.run(`UPDATE transactions SET amount_cents = 25000, updated_at = '2026-10-13T20:00:00.000Z' WHERE id = 'tx-1'`);

    // El destino es más reciente → sobrevive
    const exportedA = await exportVaultFile(sourceA, META);
    await importVaultFile(target, exportedA.content, { mode: 'merge' });
    expect(readTable(target, 'transactions')[0]?.amount_cents).toBe(25000);

    // Origen más reciente → actualiza
    const sourceB = await freshDb();
    seed(sourceB);
    sourceB.run(`UPDATE transactions SET amount_cents = 30000, updated_at = '2026-10-13T23:00:00.000Z' WHERE id = 'tx-1'`);
    const exportedB = await exportVaultFile(sourceB, META);
    expect((await importVaultFile(target, exportedB.content, { mode: 'merge' })).updated).toBe(1);
    expect(readTable(target, 'transactions')[0]?.amount_cents).toBe(30000);

    // Reemplazar: se pierde lo local-only
    target.run(
      `INSERT INTO transactions (id,type,amount_cents,currency,date,account_id,created_at,updated_at)
       VALUES ('tx-local','income',9000,'COP','2026-10-12','acc-1','${NOW}','${NOW}')`,
    );
    await importVaultFile(target, exportedB.content, { mode: 'replace' });
    expect(readTable(target, 'transactions').some((r) => r.id === 'tx-local')).toBe(false);
  }, 30_000);
});
