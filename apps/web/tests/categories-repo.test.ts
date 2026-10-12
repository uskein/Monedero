/**
 * Tests del SqlJsCategoryRepository + SqlJsTagRepository (HU-10) — integración
 * real con el esquema (sql.js + migraciones 001/002). Espejo de la PWA/móvil.
 * Reglas cubiertas: nombre único NOCASE → INTEGRITY_VIOLATION · jerarquía por
 * parentId · archivar = tombstone que libera el nombre · borrar solo sin
 * referencias (con movimientos/hijos → INTEGRITY_VIOLATION, se archiva).
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { MIGRATIONS, runMigrations } from '@monedero/db';
import { sqlJsMigrationExecutor } from '@monedero/db/sqljs';
import { SqlJsCategoryRepository } from '../src/data/repo/categories.repo.sqljs';
import { SqlJsTagRepository } from '../src/data/repo/tags.repo.sqljs';

const NOW = new Date().toISOString();

let db: Database;
let categories: SqlJsCategoryRepository;
let tags: SqlJsTagRepository;

beforeAll(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SQL: any = await initSqlJs();
  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  await runMigrations(sqlJsMigrationExecutor(db), MIGRATIONS);
  db.run(
    `INSERT INTO accounts (id,name,type,currency,created_at,updated_at)
     VALUES ('acc-efectivo','Efectivo','cash','COP','${NOW}','${NOW}')`,
  );
  categories = new SqlJsCategoryRepository(db);
  tags = new SqlJsTagRepository(db);
});

afterEach(() => {
  db.run('DELETE FROM transaction_tags');
  db.run('DELETE FROM transactions');
  db.run('DELETE FROM budgets');
  db.run('DELETE FROM tags');
  db.run('DELETE FROM categories');
});

afterAll(() => {
  db.close();
});

function insertTx(id: string, categoryId: string): void {
  db.run(
    `INSERT INTO transactions (id,type,amount_cents,currency,date,account_id,category_id,created_at,updated_at)
     VALUES ('${id}','expense',5000,'COP','2026-10-05','acc-efectivo','${categoryId}','${NOW}','${NOW}')`,
  );
}

describe('SqlJsCategoryRepository (HU-10)', () => {
  it('create → devuelve dominio y aparece en list (orden por nombre)', async () => {
    await categories.create({ name: 'Comida', type: 'expense' });
    await categories.create({ name: 'Salario', type: 'income' });
    const list = await categories.list();
    expect(list.map((c) => c.name)).toEqual(['Comida', 'Salario']);
    expect(list[0]?.type).toBe('expense');
  });

  it('filtra por tipo y oculta archivadas (includeArchived las incluye)', async () => {
    const comida = await categories.create({ name: 'Comida', type: 'expense' });
    await categories.create({ name: 'Salario', type: 'income' });
    await categories.archive(comida.id);
    expect((await categories.list()).map((c) => c.name)).toEqual(['Salario']);
    expect((await categories.list({ type: 'expense' })).map((c) => c.name)).toEqual([]);
    expect((await categories.list({ includeArchived: true })).map((c) => c.name)).toEqual([
      'Comida',
      'Salario',
    ]);
  });

  it('nombre duplicado NOCASE → INTEGRITY_VIOLATION (002)', async () => {
    await categories.create({ name: 'Comida', type: 'expense' });
    await expect(categories.create({ name: 'comida', type: 'expense' })).rejects.toThrow(
      'INTEGRITY_VIOLATION',
    );
  });

  it('renombrar a un nombre ocupado NOCASE → INTEGRITY_VIOLATION', async () => {
    await categories.create({ name: 'Comida', type: 'expense' });
    const transporte = await categories.create({ name: 'Transporte', type: 'expense' });
    await expect(categories.update(transporte.id, { name: 'COMIDA' })).rejects.toThrow(
      'INTEGRITY_VIOLATION',
    );
  });

  it('renombrar válido actualiza el nombre', async () => {
    const comida = await categories.create({ name: 'Comida', type: 'expense' });
    const renamed = await categories.update(comida.id, { name: 'comida del hogar' });
    expect(renamed.name).toBe('comida del hogar');
    expect(renamed.updatedAt >= renamed.createdAt).toBe(true);
  });

  it('jerarquía: parentId se persiste y se conserva', async () => {
    const casa = await categories.create({ name: 'Casa', type: 'expense' });
    const supermercado = await categories.create({
      name: 'Supermercado',
      type: 'expense',
      parentId: casa.id,
    });
    expect(supermercado.parentId).toBe(casa.id);
  });

  it('archivar libera el nombre para una nueva categoría', async () => {
    const viaje = await categories.create({ name: 'Viaje', type: 'expense' });
    await categories.archive(viaje.id);
    const otra = await categories.create({ name: 'VIAJE', type: 'expense' });
    expect(otra.name).toBe('VIAJE');
    expect((await categories.getById(viaje.id))?.deletedAt).not.toBeNull();
  });

  it('remove sin referencias → borrado físico', async () => {
    const ocio = await categories.create({ name: 'Ocio', type: 'expense' });
    await categories.remove(ocio.id);
    expect(await categories.getById(ocio.id)).toBeNull();
  });

  it('remove con movimientos → INTEGRITY_VIOLATION (se archiva, no se borra)', async () => {
    const comida = await categories.create({ name: 'Comida', type: 'expense' });
    insertTx('tx-1', comida.id);
    await expect(categories.remove(comida.id)).rejects.toThrow('INTEGRITY_VIOLATION');
    expect(await categories.getById(comida.id)).not.toBeNull();
  });

  it('remove con hijas → INTEGRITY_VIOLATION (referencia parent_id)', async () => {
    const casa = await categories.create({ name: 'Casa', type: 'expense' });
    await categories.create({ name: 'Supermercado', type: 'expense', parentId: casa.id });
    await expect(categories.remove(casa.id)).rejects.toThrow('INTEGRITY_VIOLATION');
  });

  it('remove inexistente → CATEGORY_NOT_FOUND (sin borrado silencioso)', async () => {
    await expect(categories.remove('no-existe')).rejects.toThrow('CATEGORY_NOT_FOUND');
  });

  it('validación Zod: nombre vacío o > 50 → rechaza antes de persistir', async () => {
    await expect(categories.create({ name: '   ', type: 'expense' })).rejects.toThrow();
    await expect(categories.create({ name: 'x'.repeat(51), type: 'expense' })).rejects.toThrow();
    expect((await categories.list()).length).toBe(0);
  });

  it('emite category:created/updated/archived a los suscriptores', async () => {
    const events: string[] = [];
    const off = categories.subscribe((e) => events.push(e.type));
    const comida = await categories.create({ name: 'Comida', type: 'expense' });
    await categories.update(comida.id, { icon: 'bowl' });
    await categories.archive(comida.id);
    off();
    await categories.create({ name: 'Ocio', type: 'expense' }); // tras off: no llega
    expect(events).toEqual(['category:created', 'category:updated', 'category:archived']);
  });
});

describe('SqlJsTagRepository (HU-10)', () => {
  it('create/list: nombres ordenados alfabéticamente', async () => {
    await tags.create({ name: 'vacaciones' });
    await tags.create({ name: 'anual' });
    expect((await tags.list()).map((t) => t.name)).toEqual(['anual', 'vacaciones']);
  });

  it('duplicado NOCASE → INTEGRITY_VIOLATION (ux_tags_name)', async () => {
    await tags.create({ name: 'Escuela' });
    await expect(tags.create({ name: 'escuela' })).rejects.toThrow('INTEGRITY_VIOLATION');
  });

  it('borrar la etiqueta limpia sus vínculos (ON DELETE CASCADE)', async () => {
    const escuela = await tags.create({ name: 'Escuela' });
    db.run(
      `INSERT INTO categories (id,name,type,created_at,updated_at)
       VALUES ('cat-x','Varios','expense','${NOW}','${NOW}')`,
    );
    insertTx('tx-tag', 'cat-x');
    db.run(
      `INSERT INTO transaction_tags (transaction_id, tag_id) VALUES ('tx-tag', '${escuela.id}')`,
    );
    await tags.remove(escuela.id);
    const links = db.exec('SELECT COUNT(*) FROM transaction_tags');
    expect(Number(links[0]?.values[0]?.[0])).toBe(0);
    expect((await tags.list()).length).toBe(0);
  });

  it('validación Zod: nombre vacío → rechaza antes de persistir', async () => {
    await expect(tags.create({ name: '' })).rejects.toThrow();
  });
});
