/**
 * Migraciones numeradas — MODELO_DE_DATOS.md §6.
 * El SQL vive en `sql/*.sql` (SSOT legible) y se embebe aquí como string porque
 * Metro (móvil) no soporta imports `?raw`. Un test (tests/schema.test.ts) verifica
 * que ambas copias son idénticas byte a byte → imposible divergios silenciosos.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const SQL_001_INIT = `
CREATE TABLE accounts (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  type                 TEXT NOT NULL CHECK (type IN ('cash','checking','savings','credit','wallet')),
  currency             TEXT NOT NULL DEFAULT 'EUR' CHECK (length(currency) = 3),
  initial_balance_cents INTEGER NOT NULL DEFAULT 0,
  icon                 TEXT NOT NULL DEFAULT 'wallet',
  color                TEXT NOT NULL DEFAULT '#2F7D5B',
  archived             INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0,1)),
  sort_order           INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  deleted_at           TEXT
);
CREATE UNIQUE INDEX ux_accounts_name_active
  ON accounts(name) WHERE deleted_at IS NULL AND archived = 0;

CREATE TABLE categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('income','expense')),
  parent_id   TEXT REFERENCES categories(id),
  icon        TEXT NOT NULL DEFAULT 'tag',
  color       TEXT NOT NULL DEFAULT '#3D5A80',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE TABLE transactions (
  id              TEXT PRIMARY KEY,
  type            TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount_cents    INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'EUR' CHECK (length(currency) = 3),
  date            TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  account_id      TEXT NOT NULL REFERENCES accounts(id),
  to_account_id   TEXT REFERENCES accounts(id),
  category_id     TEXT REFERENCES categories(id),
  payee           TEXT CHECK (length(payee) <= 120),
  note            TEXT CHECK (length(note) <= 1000),
  status          TEXT NOT NULL DEFAULT 'cleared' CHECK (status IN ('pending','cleared')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  deleted_at      TEXT,
  CHECK ((type = 'transfer') = (to_account_id IS NOT NULL)),
  CHECK (type <> 'transfer' OR category_id IS NULL),
  CHECK (to_account_id IS NULL OR account_id <> to_account_id)
);

CREATE TABLE tags (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL COLLATE NOCASE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE UNIQUE INDEX ux_tags_name ON tags(name) WHERE deleted_at IS NULL;

CREATE TABLE transaction_tags (
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id         TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE budgets (
  id            TEXT PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES categories(id),
  period        TEXT NOT NULL CHECK (period GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  UNIQUE (category_id, period)
);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE import_log (
  id          TEXT PRIMARY KEY,
  source      TEXT NOT NULL CHECK (source IN ('mobile','pwa')),
  file_hash   TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE INDEX idx_tx_date     ON transactions(date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_tx_account  ON transactions(account_id, date DESC);
CREATE INDEX idx_tx_category ON transactions(category_id, date DESC);
CREATE INDEX idx_tx_updated  ON transactions(updated_at);
CREATE INDEX idx_tx_payee    ON transactions(payee);
CREATE INDEX idx_cat_parent  ON categories(parent_id);
CREATE INDEX idx_budget_period ON budgets(period);
CREATE INDEX idx_tt_tag      ON transaction_tags(tag_id);
`;

/** Lista ordenada por versión (forward-only). */
export const MIGRATIONS: readonly Migration[] = [
  { version: 1, name: '001_init', sql: SQL_001_INIT },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
