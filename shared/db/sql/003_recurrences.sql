-- 003 — Movimientos recurrentes (gastos/ingresos fijos): el usuario
-- CONFIRMA cada generación (la app propone, nunca inventa transacciones).
-- Sin transferencias (solo expense/income) · día 1..28 (mes seguro) ·
-- last_generated_period garantiza idempotencia por mes (YYYY-MM).
CREATE TABLE recurrences (
  id                    TEXT PRIMARY KEY,
  type                  TEXT NOT NULL CHECK (type IN ('expense','income')),
  amount_cents          INTEGER NOT NULL CHECK (amount_cents > 0),
  currency              TEXT NOT NULL DEFAULT 'EUR' CHECK (length(currency) = 3),
  account_id            TEXT NOT NULL REFERENCES accounts(id),
  category_id           TEXT REFERENCES categories(id),
  payee                 TEXT CHECK (length(payee) <= 120),
  note                  TEXT CHECK (length(note) <= 1000),
  day_of_month          INTEGER NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 28),
  active                INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  last_generated_period TEXT CHECK (last_generated_period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  deleted_at            TEXT
);
CREATE INDEX idx_recurrences_active ON recurrences(active) WHERE deleted_at IS NULL;
CREATE INDEX idx_recurrences_generated ON recurrences(last_generated_period);
