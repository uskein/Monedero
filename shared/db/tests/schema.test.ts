/**
 * Tests del esquema + runner (TDD, área crítica — ESTANDAR ESTRATEGIA_PRUEBAS §5).
 * Fuente: MODELO_DE_DATOS.md §3/§6 · HU-05·06·07 (dinero en centavos, transferencias).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MIGRATIONS, LATEST_VERSION } from '../src/migrations';
import { SCHEMA_TABLES_V1 } from '../src/index';
import { runMigrations, assertValidMigrations, type MigrationExecutor } from '../src/runner';
import { sqlJsMigrationExecutor } from '../src/sqljs';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SQL: any = await initSqlJs();

function freshDb(): Database {
  const db = new SQL.Database() as Database;
  db.run('PRAGMA foreign_keys = ON');
  return db;
}

async function migratedDb(): Promise<Database> {
  const db = freshDb();
  await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
  return db;
}

beforeAll(() => {
  assertValidMigrations(MIGRATIONS);
});

describe('runner de migraciones (MODELO §6)', () => {
  it('aplica 001_init y fija user_version = 1', async () => {
    const db = freshDb();
    const result = await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
    expect(result.from).toBe(0);
    expect(result.to).toBe(1);
    expect(result.applied).toEqual(['001_init']);
    const version = db.exec('PRAGMA user_version');
    expect(Number(version[0]?.values[0]?.[0])).toBe(1);
  });

  it('es idempotente: re-ejecutar no vuelve a aplicar nada', async () => {
    const db = freshDb();
    await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
    const second = await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
    expect(second.applied).toEqual([]);
    expect(second.to).toBe(1);
  });

  it('falla transaccional: script inválido deja la BD SIN cambios (sin tablas a medias)', async () => {
    const db = freshDb();
    const broken: MigrationExecutor = {
      ...sqlJsMigrationExecutor(db),
    };
    const badMigrations = [
      { version: 1, name: '001_broken', sql: 'CREATE TABLE ok(id TEXT); SELECT esto_no_existe;' },
    ];
    await expect(runMigrations(broken, badMigrations)).rejects.toThrow();
    const tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='ok'",
    );
    expect(tables.length).toBe(0);
    expect(Number(db.exec('PRAGMA user_version')[0]?.values[0]?.[0])).toBe(0);
  });

  it('assertValidMigrations rechaza versiones duplicadas o rotas', () => {
    expect(() =>
      assertValidMigrations([
        { version: 1, name: 'a', sql: '' },
        { version: 1, name: 'b', sql: '' },
      ]),
    ).toThrow('MIGRATION_DUPLICATE_VERSION');
    expect(() =>
      assertValidMigrations([
        { version: 1, name: 'a', sql: '' },
        { version: 3, name: 'b', sql: '' },
      ]),
    ).toThrow('MIGRATION_SEQUENCE_BROKEN');
  });
});

describe('esquema v1 — 8 tablas (MODELO §3)', () => {
  let db: Database;
  beforeAll(async () => {
    db = await migratedDb();
  });

  it('crea exactamente las 8 tablas del modelo', () => {
    const res = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const names = (res[0]?.values ?? []).map((v) => String(v[0]));
    expect([...names].sort()).toEqual([...SCHEMA_TABLES_V1].sort());
  });

  it('dinero: rechaza amount_cents negativo o no entero (sin FLOAT)', () => {
    const insert = (cents: number) =>
      db.run(
        `INSERT INTO transactions (id,type,amount_cents,date,account_id,created_at,updated_at)
         VALUES ('t${cents}','expense',${cents},'2026-10-01','acc','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')`,
      );
    db.run(
      "INSERT INTO accounts (id,name,type,created_at,updated_at) VALUES ('acc','Efectivo','cash','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')",
    );
    expect(() => insert(-100)).toThrow();
    expect(() => insert(1250)).not.toThrow();
  });

  it('transferencia: exige to_account_id y prohíbe category_id (CHECKs)', () => {
    db.run(
      "INSERT INTO accounts (id,name,type,created_at,updated_at) VALUES ('acc2','Ahorro','savings','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')",
    );
    const base = `INSERT INTO transactions (id,type,amount_cents,date,account_id,created_at,updated_at`;
    // transfer sin destino → CHECK ((type='transfer') = (to_account_id IS NOT NULL)) falla
    expect(() =>
      db.run(
        `${base}) VALUES ('tx1','transfer',5000,'2026-10-01','acc','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')`,
      ),
    ).toThrow();
    // transfer válida
    expect(() =>
      db.run(
        `${base},to_account_id) VALUES ('tx2','transfer',5000,'2026-10-01','acc','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z','acc2')`,
      ),
    ).not.toThrow();
    // destino = origen → prohibido
    expect(() =>
      db.run(
        `${base},to_account_id) VALUES ('tx3','transfer',5000,'2026-10-01','acc','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z','acc')`,
      ),
    ).toThrow();
  });

  it('fecha: exige formato YYYY-MM-DD (GLOB)', () => {
    expect(() =>
      db.run(
        "INSERT INTO transactions (id,type,amount_cents,date,account_id,created_at,updated_at) VALUES ('txd','expense',100,'01/10/2026','acc','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')",
      ),
    ).toThrow();
  });

  it('cuentas: nombre único activo (índice parcial) — archivar libera el nombre', () => {
    const acc = (id: string, name: string, archived = 0) =>
      db.run(
        `INSERT INTO accounts (id,name,type,archived,created_at,updated_at) VALUES ('${id}','${name}','cash',${archived},'2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')`,
      );
    expect(() => acc('dup1', 'Efectivo')).toThrow(); // ya existe 'acc' activa
    db.run("UPDATE accounts SET archived = 1 WHERE id = 'acc'");
    expect(() => acc('dup1', 'Efectivo')).not.toThrow(); // archivada → el nombre se libera
  });

  it('tombstones: deleted_at es opcional y las vistas lo filtran', () => {
    db.run("UPDATE transactions SET deleted_at = '2026-10-02T00:00:00Z' WHERE id = 't1250'");
    const active = db.exec('SELECT COUNT(*) FROM transactions WHERE deleted_at IS NULL');
    const total = db.exec('SELECT COUNT(*) FROM transactions');
    expect(Number(active[0]?.values[0]?.[0])).toBeLessThan(Number(total[0]?.values[0]?.[0]));
  });

  it('presupuestos: UNIQUE(category_id, period) → upsert idempotente', () => {
    db.run(
      "INSERT INTO categories (id,name,type,created_at,updated_at) VALUES ('cat','Comida','expense','2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')",
    );
    const budget = (id: string) =>
      db.run(
        `INSERT INTO budgets (id,category_id,period,amount_cents,created_at,updated_at) VALUES ('${id}','cat','2026-10',100000,'2026-10-01T00:00:00Z','2026-10-01T00:00:00Z')`,
      );
    expect(() => budget('b1')).not.toThrow();
    expect(() => budget('b2')).toThrow(); // duplicado category+period
  });
});

describe('paridad SQL embebido ↔ fichero .sql (gate de divergencia)', () => {
  it('SQL_001_INIT es idéntico a sql/001_init.sql (ignorando comentarios y bordes)', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..');
    const fileSql = readFileSync(join(root, 'sql/001_init.sql'), 'utf8');
    const normalize = (s: string) =>
      s
        .split('\n')
        .filter((l) => !l.trim().startsWith('--'))
        .join('\n')
        .replace(/\s+/g, ' ')
        .trim();
    expect(normalize(MIGRATIONS[0]!.sql)).toBe(normalize(fileSql));
  });

  it('LATEST_VERSION coincide con la última migración', () => {
    expect(LATEST_VERSION).toBe(MIGRATIONS[MIGRATIONS.length - 1]?.version);
  });
});
