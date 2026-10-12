/**
 * Semilla de datos por defecto (BP-05: «defaults: tipo Gasto, cuenta Efectivo»).
 * Idempotente: solo si las tablas están vacías. Categorías en es-CO (mercado
 * objetivo, ESTANDAR_INTERNACIONALIZACION §1: datos semilla del producto, no UI).
 */
import type { Database } from 'sql.js';

const NOW = '2026-10-11T00:00:00.000Z';

interface SeedRow {
  id: string;
  name: string;
}

const EXPENSE_CATEGORIES: SeedRow[] = [
  { id: 'cat-comida', name: 'Comida' },
  { id: 'cat-transporte', name: 'Transporte' },
  { id: 'cat-casa', name: 'Casa' },
  { id: 'cat-salud', name: 'Salud' },
  { id: 'cat-ocio', name: 'Ocio' },
  { id: 'cat-otros', name: 'Otros' },
];

const INCOME_CATEGORIES: SeedRow[] = [
  { id: 'cat-salario', name: 'Salario' },
  { id: 'cat-ingresos-otros', name: 'Otros ingresos' },
];

export function seedDefaults(db: Database): void {
  const accounts = db.exec('SELECT COUNT(*) FROM accounts');
  if (Number(accounts[0]?.values[0]?.[0] ?? 0) === 0) {
    db.run(
      `INSERT INTO accounts (id,name,type,currency,initial_balance_cents,icon,created_at,updated_at)
       VALUES ('acc-efectivo','Efectivo','cash','COP',0,'wallet','${NOW}','${NOW}')`,
    );
  }
  const categories = db.exec('SELECT COUNT(*) FROM categories');
  if (Number(categories[0]?.values[0]?.[0] ?? 0) === 0) {
    for (const [i, cat] of EXPENSE_CATEGORIES.entries()) {
      db.run(
        `INSERT INTO categories (id,name,type,sort_order,created_at,updated_at)
         VALUES ('${cat.id}','${cat.name}','expense',${i},'${NOW}','${NOW}')`,
      );
    }
    for (const [i, cat] of INCOME_CATEGORIES.entries()) {
      db.run(
        `INSERT INTO categories (id,name,type,sort_order,created_at,updated_at)
         VALUES ('${cat.id}','${cat.name}','income',${i},'${NOW}','${NOW}')`,
      );
    }
  }
}
