# CONTRATOS_API — Proyecto **Monedero**

> **No existe API de red.** Los "contratos" del sistema son:
> 1. **Contratos de repositorio** (interfaz entre dominio e infraestructura, por plataforma).
> 2. **Contrato de archivo `.monedero` v1** (único acoplamiento móvil ⇄ PWA).
> 3. **Contratos de error y eventos** (respuesta estándar a la UI).
> Versión 1.0 · Aprobado.

---

## 1. Contratos de repositorio (puertos)

Semántica **idéntica** en ambas apps; implementación distinta (`infrastructure/` en móvil, `data/` en PWA).

### 1.1 TransactionRepository

```ts
interface TxFilter {
  month?: string;          // 'YYYY-MM'
  accountId?: string;
  categoryId?: string;     // incluye hijas si deep=true
  type?: 'income' | 'expense' | 'transfer';
  search?: string;         // payee/note (saneado, ≤120)
  limit?: number; offset?: number;
}

interface TransactionRepository {
  list(filter: TxFilter): Promise<Transaction[]>;        // orden: date DESC, id DESC
  getById(id: string): Promise<Transaction | null>;
  getByMonth(month: string): Promise<Transaction[]>;
  create(input: TxInput): Promise<Transaction>;          // Zod ANTES de persistir
  update(id: string, patch: TxPatch): Promise<Transaction>;
  softDelete(id: string): Promise<void>;                 // sets deleted_at + updated_at
  restore(id: string): Promise<void>;
  subscribe(cb: (changed: { scope: 'tx' | 'account' | 'category' }) => void): Unsubscribe;
}
```

### 1.2 AccountRepository · CategoryRepository · BudgetRepository · TagRepository
```ts
interface AccountRepository {
  list(opts?: { includeArchived?: boolean }): Promise<Account[]>;
  balanceOf(accountId: string): Promise<MoneyCents>;
  create(input: AccountInput): Promise<Account>;
  update(id: string, patch: AccountPatch): Promise<Account>;
  archive(id: string): Promise<void>;
}
interface CategoryRepository {        // HU-10
  list(opts?: { type?: 'income' | 'expense'; includeArchived?: boolean }): Promise<Category[]>;
  getById(id: string): Promise<Category | null>;
  create(input: CategoryInput): Promise<Category>;   // nombre NOCASE duplicado → INTEGRITY_VIOLATION
  update(id: string, patch: CategoryPatch): Promise<Category>;
  archive(id: string): Promise<void>;                // tombstone: siempre permitido, libera el nombre
  remove(id: string): Promise<void>;                 // con movimientos/hijos → INTEGRITY_VIOLATION (archivar)
  subscribe(cb: (e: { scope: 'category' }) => void): Unsubscribe;
}
interface BudgetRepository {
  get(categoryId: string, period: string): Promise<Budget | null>;
  listByPeriod(period: string): Promise<Budget[]>;   // BP-06: topes del mes
  upsert(input: BudgetInput): Promise<Budget>;           // UNIQUE(category,period) → idempotente
  usage(categoryId: string, period: string): Promise<{ spentCents: MoneyCents; budgetCents: MoneyCents; ratio: number }>;
}
interface TagRepository {             // HU-10
  list(): Promise<Tag[]>;
  create(input: TagInput): Promise<Tag>;             // nombre NOCASE duplicado → INTEGRITY_VIOLATION
  remove(id: string): Promise<void>;                 // ON DELETE CASCADE de vínculos
}
```

### 1.3 Seguridad y archivo
```ts
interface KeyVaultPort {
  hasKey(): Promise<boolean>;
  unlock(auth: { biometric?: true; passphrase?: string }): Promise<void>;   // deriva/recupera clave
  lock(): Promise<void>;                                                    // zeroize
  isUnlocked(): boolean;
}
interface CryptoPort {                     // SQLCipher móvil · WebCrypto PWA
  encrypt(plain: Uint8Array): Promise<Uint8Array>;
  decrypt(cipher: Uint8Array): Promise<Uint8Array>;
}
interface ExportPort {
  exportFile(opts?: { encrypt?: string /* passphrase */ }): Promise<MonederoFile | EncryptedBytes>;
  importFile(raw: MonederoFile | Uint8Array, opts: { mode: 'merge' | 'replace'; passphrase?: string })
    : Promise<ImportSummary>;
}
```

### 1.4 Frontend → dominio (casos de uso)

| Caso de uso | Payload | Respuesta |
|---|---|---|
| `addTransaction` | `TxInput` (Zod `TxInputSchema`) | `Transaction` |
| `updateTransaction` | `id` + `TxPatch` | `Transaction` |
| `deleteTransaction` | `id` | `void` |
| `computeMonthReport` | `'YYYY-MM'` | `{ incomeCents, expenseCents, byCategory[], balanceCents }` |
| `evaluateBudgets` | `'YYYY-MM'` | `BudgetUsage[]` (evento `budget:exceeded` si ratio ≥1) |
| `exportVault` | `opts` | archivo `.monedero` |
| `importVault` | bytes + mode | `ImportSummary` |

> **Regla:** el frontend **jamás** escribe SQL ni accede a storage directamente → solo casos de uso.

---

## 2. Contrato de archivo `.monedero` v1

### 2.1 Estructura (JSON canónico)

```jsonc
{
  "format": "monedero",
  "formatVersion": 1,
  "source": "mobile",                      // "mobile" | "pwa"
  "appVersion": "1.0.0",
  "exportedAt": "2026-10-11T12:00:00.000Z",
  "schema": { "currency": "EUR", "moneyUnit": "cents" },
  "collections": {
    "accounts":        [ /* Account[], incl. deletedAt */ ],
    "categories":      [ /* Category[] */ ],
    "transactions":    [ /* Transaction[] */ ],
    "tags":            [ /* Tag[] */ ],
    "transactionTags": [ { "transactionId": "uuid", "tagId": "uuid" } ],
    "budgets":         [ /* Budget[] */ ],
    "settings":        [ { "key": "theme", "value": "light", "updatedAt": "…" } ]
  },
  "integrity": { "algo": "sha256", "hash": "<base64 del JSON canónico SIN 'integrity'>" }
}
```

### 2.2 Reglas del contrato

| Regla | Detalle |
|---|---|
| Validación | `MonederoFileSchema` (Zod) en **ambos** lados desde `shared/export-contract` |
| Canonicalización | claves ordenadas alfabéticamente, UTF-8, sin espacios → hash estable |
| Versionado | `formatVersion` semántico simple; lectores aceptan `≤` su versión vía `migrate()`; `>` → `IMPORT_FORMAT_UNSUPPORTED` |
| Idempotencia | PKs UUID v4: importar 2 veces no duplica |
| Integridad | SHA-256 verificado → `IMPORT_HASH_MISMATCH` si difiere |
| Fichero cifrado (opcional) | Extensión `.monedero.enc`: `salt(16)‖iv(12)‖ciphertext‖tag` con AES-256-GCM, clave = PBKDF2(passphrase, salt, ≥120.000) |

### 2.3 Estrategia de merge (`mode: 'merge'`)

```
por cada registro del fichero entrante:
  local no existe            → ADD      (added++)
  local existe y updatedAt
    entrante > local          → UPDATE   (updated++)
    entrante ≤ local          → KEEP     (conflicts++ si entrante tenía cambios distintos)
  entrante deletedAt != null  → propaga soft-delete (deleted++)
settings: merge por key con LWW (excepto 'format_version': max())
transaction_tags: upsert por PK compuesta
```

`ImportSummary`:
```ts
{ added: number; updated: number; deleted: number; kept: number; conflicts: number;
  errors: Array<{ collection: string; id: string; code: DomainErrorCode }> }
```

`mode: 'replace'` → **destructivo**: requiere confirmación explícita en UI + snapshot de seguridad automático (export previo) antes de aplicar.

---

## 3. Contrato de errores (respuesta estándar a la UI)

```ts
type DomainError = { code: DomainErrorCode; field?: string; messageKey: string };  // i18n, sin datos sensibles
```

| Código | Análogo HTTP | Condición | UI |
|---|---|---|---|
| `VALIDATION_FAILED` | 422 | Zod rechaza input | error inline en campo (`field`), focus |
| `NOT_FOUND` | 404 | UUID inexistente | toast, navegar a lista |
| `INTEGRITY_VIOLATION` | 409 | FK/CHECK de BD | toast error, reportar sin datos |
| `VAULT_LOCKED` | 423 | operación con bóveda bloqueada | pantalla de bloqueo |
| `IMPORT_FORMAT_UNSUPPORTED` | 415 | `formatVersion` no soportado | "Actualiza la app" |
| `IMPORT_HASH_MISMATCH` | 422 | SHA-256 no coincide | "Fichero corrupto o alterado" |
| `IMPORT_DECRYPT_FAILED` | 401 | passphrase incorrecta (GCM tag fail) | aviso passphrase, ≤5 intentos |
| `EXPORT_FAILED` | 500 | error de storage/permisos | toast + reintento |
| `STORAGE_UNAVAILABLE` | 503 | BD no abre (corrupción/cipher) | pantalla de recuperación + backup |

**Manejo global:** reducer de errores central → `messageKey` localizado; **nunca** registrar `amount/payee/note` en logs.

---

## 4. Eventos internos (bus tipado)

| Evento | Payload | Consumidores |
|---|---|---|
| `tx:created` / `tx:updated` / `tx:deleted` | `{ id }` | refresco de listas, dashboard |
| `account:balanceChanged` | `{ accountId }` | tarjetas de saldo |
| `budget:exceeded` | `{ categoryId, period, ratio }` | toast *aviso* (chip `accent` SSOT) |
| `vault:locked` / `vault:unlocked` | `{}` | gate de navegación |
| `import:completed` | `ImportSummary` | pantalla resumen de importación |

---

## 5. Endpoints HTTP

**Ninguno.** La PWA declara CSP `connect-src 'none'` (salvo assets del propio origen con `default-src 'self'`). Cualquier incorporación futura de red exige nuevo ADR y revisión de seguridad.
