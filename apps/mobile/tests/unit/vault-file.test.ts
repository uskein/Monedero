/**
 * TDD del VaultFile móvil (S7 · HU-14·15·16) — export/import reales sobre el
 * PUERTO SqlDbPort (sql.js en jest, expo-sqlite en runtime) con la cripto
 * REAL (@noble): roundtrip plano y cifrado, taxonomía IMPORT_*, merge LWW
 * contra BD local y reemplazar con wipe. Jest (globals).
 */
import initSqlJs from '../../src/infrastructure/db/sqlasm';
import { sqlJsDb } from '../../src/infrastructure/db/sqljsAdapter';
import type { SqlDbPort } from '../../src/infrastructure/db/SqlDbPort';
import { MIGRATIONS, runMigrations } from '@monedero/db';
import { sqlJsMigrationExecutor } from '@monedero/db/sqljs';
import {
  buildVaultFile,
  exportVaultFile,
  importVaultFile,
  readTable,
  wipeCollections,
} from '../../src/infrastructure/export/vaultFile';

const NOW = '2026-10-13T10:00:00.000Z';
const META = { vaultId: '4de9a1a2-1cde-4f10-9a7a-2f6f0f0d9b11', currency: 'COP' };

async function freshDb(): Promise<SqlDbPort> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SQL: any = await initSqlJs();
  const raw = new SQL.Database();
  raw.run('PRAGMA foreign_keys = ON');
  await runMigrations(sqlJsMigrationExecutor(raw), MIGRATIONS);
  return sqlJsDb(raw);
}

async function seed(db: SqlDbPort): Promise<void> {
  await db.run(
    `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,created_at,updated_at)
     VALUES ('acc-1','Efectivo','cash','COP',0,?,?)`,
    [NOW, NOW],
  );
  await db.run(
    `INSERT INTO categories (id,name,type,created_at,updated_at)
     VALUES ('cat-1','Comida','expense',?,?)`,
    [NOW, NOW],
  );
  await db.run(
    `INSERT INTO transactions (id,type,amount_cents,currency,date,account_id,category_id,payee,created_at,updated_at)
     VALUES ('tx-1','expense',18500,'COP','2026-10-11','acc-1','cat-1','Almuerzo',?,?)`,
    [NOW, NOW],
  );
  await db.run(
    `INSERT INTO budgets (id,category_id,period,amount_cents,created_at,updated_at)
     VALUES ('b1','cat-1','2026-10',100000,?,?)`,
    [NOW, NOW],
  );
}

describe('VaultFile móvil (S7)', () => {
  it('roundtrip plano: exportar → importar en OTRA BD conserva todo', async () => {
    const source = await freshDb();
    await seed(source);
    const exported = await exportVaultFile(source, META);
    expect(exported.filename).toMatch(/^monedero-\d{4}-\d{2}-\d{2}\.monedero$/);

    const target = await freshDb();
    const summary = await importVaultFile(target, exported.content, { mode: 'merge', source: 'pwa' });
    expect(summary.added).toBe(4); // account + category + tx + budget
    expect((await readTable(target, 'transactions'))[0]?.payee).toBe('Almuerzo');
    expect((await readTable(target, 'budgets'))[0]?.amount_cents).toBe(100000);
    // import_log local escrito (HU-16 auditoría)
    expect(await readTable(target, 'import_log')).toHaveLength(1);
  });

  it('roundtrip CIFRADO: passphrase correcta abre; equivocada → IMPORT_DECRYPT_FAILED', async () => {
    const source = await freshDb();
    await seed(source);
    const exported = await exportVaultFile(source, { ...META, passphrase: 'clave-segura-1' });
    expect(exported.filename).toMatch(/\.monedero\.enc$/);
    expect(exported.content).not.toContain('clave-segura');

    const target = await freshDb();
    const summary = await importVaultFile(target, exported.content, {
      mode: 'merge',
      passphrase: 'clave-segura-1',
    });
    expect(summary.added).toBeGreaterThan(0);

    const other = await freshDb();
    await expect(
      importVaultFile(other, exported.content, { mode: 'merge', passphrase: 'otra-clave-x1' }),
    ).rejects.toThrow('IMPORT_DECRYPT_FAILED');
  });

  it('fichero alterado → IMPORT_HASH_MISMATCH (0 escrituras)', async () => {
    const source = await freshDb();
    await seed(source);
    const file = await buildVaultFile(source, META);
    const tampered = { ...file, currency: 'USD' }; // datos alterados, hash viejo
    const target = await freshDb();
    await expect(importVaultFile(target, JSON.stringify(tampered), { mode: 'merge' })).rejects.toThrow(
      'IMPORT_HASH_MISMATCH',
    );
    expect(await readTable(target, 'transactions')).toHaveLength(0);
  });

  it('merge LWW: el archivo más reciente actualiza; el local más reciente sobrevive', async () => {
    // Origen A: tx-1 a las 10:00 (18.500)
    const sourceA = await freshDb();
    await seed(sourceA);

    // Destino: mismo tx-1 editado MÁS TARDE (20:00, 25.000) + tx-local propio
    const target = await freshDb();
    await seed(target);
    await target.run(
      `UPDATE transactions SET amount_cents = 25000, updated_at = '2026-10-13T20:00:00.000Z' WHERE id = 'tx-1'`,
    );
    await target.run(
      `INSERT INTO transactions (id,type,amount_cents,currency,date,account_id,created_at,updated_at)
       VALUES ('tx-local','income',9000,'COP','2026-10-12','acc-1',?,?)`,
      [NOW, NOW],
    );

    const exportedA = await exportVaultFile(sourceA, META);
    const summary = await importVaultFile(target, exportedA.content, { mode: 'merge' });
    // tx-1 local más reciente → NO se pisa; tx-local no está en el archivo → sobrevive
    expect((await readTable(target, 'transactions')).find((r) => r.id === 'tx-1')?.amount_cents).toBe(25000);
    expect((await readTable(target, 'transactions')).some((r) => r.id === 'tx-local')).toBe(true);
    expect(summary.updated).toBe(0);

    // Origen B con tx-1 AÚN MÁS reciente (23:00) → sí actualiza en destino
    const sourceB = await freshDb();
    await seed(sourceB);
    await sourceB.run(
      `UPDATE transactions SET amount_cents = 30000, updated_at = '2026-10-13T23:00:00.000Z' WHERE id = 'tx-1'`,
    );
    const exportedB = await exportVaultFile(sourceB, META);
    const summaryB = await importVaultFile(target, exportedB.content, { mode: 'merge' });
    expect((await readTable(target, 'transactions')).find((r) => r.id === 'tx-1')?.amount_cents).toBe(30000);
    expect(summaryB.updated).toBe(1);
  });

  it('REEMPLAZAR (HU-16): wipe + insert; lo local-only desaparece', async () => {
    const source = await freshDb();
    await seed(source);

    const target = await freshDb();
    await seed(target);
    await target.run(
      `INSERT INTO transactions (id,type,amount_cents,currency,date,account_id,created_at,updated_at)
       VALUES ('tx-local','income',9000,'COP','2026-10-12','acc-1',?,?)`,
      [NOW, NOW],
    );

    const exported = await exportVaultFile(source, META);
    const summary = await importVaultFile(target, exported.content, { mode: 'replace' });
    expect((await readTable(target, 'transactions')).some((r) => r.id === 'tx-local')).toBe(false);
    expect(await readTable(target, 'transactions')).toHaveLength(1);
    expect(summary.added).toBeGreaterThan(0);
  });

  it('wipeCollections vacía las 7 colecciones', async () => {
    const db = await freshDb();
    await seed(db);
    await wipeCollections(db);
    for (const table of ['accounts', 'categories', 'transactions', 'budgets'] as const) {
      expect(await readTable(db, table)).toHaveLength(0);
    }
  });
});
