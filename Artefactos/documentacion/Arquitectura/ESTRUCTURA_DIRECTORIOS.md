# ESTRUCTURA_DIRECTORIOS — Proyecto **Monedero**

> Mapa físico del repositorio con la responsabilidad de cada módulo.
> Patrones: **hexagonal por capas** en `apps/mobile` · **FLUX por features** en `apps/web`.
> Versión 1.0 · Aprobado.

---

## 1. Raíz del proyecto

```
Proyecto App Monedero -Gestor de gastos/
│
├── opencode.json                      # references de sesión: identidad-visual, arquitectura
├── package.json                       # workspace raíz (pnpm) + scripts globales
├── pnpm-workspace.yaml                # define apps/* y shared/*
├── turbo.json                         # pipeline: build, test, lint, typecheck, tokens:check
├── .gitignore
├── .github/
│   └── workflows/
│       ├── pr.yml                     # CI por PR: typecheck+lint+test+contract+a11y+audit
│       └── release.yml                # tag v*: EAS build/submit + Pages deploy
│
├── Artefactos/documentacion/          # 📚 DOCUMENTACIÓN (fuente de verdad)
│   ├── Diseño Visual/
│   │   ├── manual-identidad-visual.md # SSOT visual (references activa)
│   │   └── identidad-visual-clay-serenity.html  # Brand Book interactivo
│   ├── Prototipos/
│   │   ├── prototipo-b-clay-serenity.html       # diseño aprobado
│   │   └── prototipo-a-sovereign-vault.html     # descartado (trazabilidad)
│   └── Arquitectura/                  # ← fase de arquitectura
│       ├── README_ARQUITECTURA.md     # stack, patrones, ADR
│       ├── ESTRUCTURA_DIRECTORIOS.md  # este documento
│       ├── MODELO_DE_DATOS.md         # ERD + diccionario de datos
│       ├── CONTRATOS_API.md           # contratos de repositorio + fichero .monedero
│       └── GUIA_DEVOPS_SEGURIDAD.md   # CI/CD, despliegue, seguridad
│
├── shared/
│   └── export-contract/               # 📄 ÚNICO CÓDIGO COMPARTIDO entre apps
│       ├── package.json               # name: @monedero/export-contract (TS puro, 0 deps UI)
│       ├── src/
│       │   ├── index.ts
│       │   ├── schemas.ts             # Zod: MonederoFileSchema v1 (colecciones)
│       │   ├── hash.ts                # canonical JSON → SHA-256 (integrity)
│       │   ├── migrations.ts          # migrate(file): v0.x → v1 (forward only)
│       │   └── types.ts               # MonederoFile, ImportSummary, formatVersion
│       └── tests/
│           ├── roundtrip.test.ts      # export → import → export idéntico
│           └── migration.test.ts
│
├── apps/
│   ├── mobile/                        # 📱 APP MÓVIL (Expo + React Native) — hexagonal
│   │   ├── package.json               # name: @monedero/mobile
│   │   ├── app.json                   # Expo: scheme "monedero", permisos, íconos «M»
│   │   ├── eas.json                   # perfiles: development | preview | production
│   │   ├── babel.config.js            # reanimated plugin (orden obligatorio)
│   │   ├── tsconfig.json
│   │   ├── .env.example               # EXPO_PUBLIC_APP_SCHEME, EAS_PROJECT_ID
│   │   ├── src/
│   │   │   ├── core/                  # ⚙️ DOMINIO PURO (prohibido importar react/react-native)
│   │   │   │   ├── domain/            #   entidades: Account, Category, Transaction, Budget, Tag
│   │   │   │   │   ├── money.ts       #   MoneyCents + format/parse (branded type)
│   │   │   │   │   └── *.entity.ts    #   reglas de negocio (invariantes)
│   │   │   │   ├── usecases/          #   addTransaction, updateBalance, evaluateBudgets,
│   │   │   │   │                      #   monthlyReport, importFile, exportFile
│   │   │   │   ├── ports/             #   interfaces: TransactionRepository, SettingsRepository,
│   │   │   │   │                      #   KeyVaultPort, CryptoPort, ExportPort, ClockPort
│   │   │   │   ├── events/            #   bus tipado: tx:created, budget:exceeded, vault:locked
│   │   │   │   ├── validation/        #   Zod schemas de input + DomainError codes
│   │   │   │   └── errors.ts          #   {code, field?, messageKey}
│   │   │   ├── infrastructure/        # 🔌 ADAPTERS (implementan puertos)
│   │   │   │   ├── db/
│   │   │   │   │   ├── sqlite.adapter.ts   # open con PRAGMA key (SQLCipher)
│   │   │   │   │   ├── migrations/         # 001_init.sql, 002_*.sql (user_version)
│   │   │   │   │   ├── tx.repo.sqlite.ts   # prepared statements (?), índices
│   │   │   │   │   └── settings.repo.sqlite.ts
│   │   │   │   ├── security/
│   │   │   │   │   ├── keystore.port.ts    # expo-secure-store / keystore
│   │   │   │   │   └── biometric.ts        # LocalAuthentication
│   │   │   │   └── file/
│   │   │   │       ├── export.file.ts      # gera .monedero (+ .enc AES-GCM)
│   │   │   │       └── import.file.ts      # Share/DocumentPicker + merge LWW
│   │   │   ├── ui/                    # 🎨 PRESENTACIÓN
│   │   │   │   ├── design-system/     #   tokens.ts (csColors), tema claro/oscuro,
│   │   │   │   │                      #   primitivas Clay: Button, Card, Input, Sheet…
│   │   │   │   ├── components/        #   TxRow, BalanceCard, DonutChart, EmptyState…
│   │   │   │   ├── screens/           #   Home, Movimientos, MovimientoDetalle,
│   │   │   │   │                      #   Presupuestos, Reportes, Ajustes, Bloqueo
│   │   │   │   └── navigation/        #   Expo Router (rutas tipadas)
│   │   │   ├── state/                 #   Zustand (UI: tema, tab, filtros) + selectores
│   │   │   ├── hooks/                 #   useTransactions(), useBalance() (suscripción repo)
│   │   │   └── AppRoot.tsx
│   │   ├── assets/                    #   fonts/ (Fraunces+Inter subset), grain.png, icon-M
│   │   └── tests/                     #   Jest + RNTL por capa
│   │       ├── unit/                  #   core (≥70%)
│   │       ├── integration/           #   infra con sqlite en memoria
│   │       └── e2e/                   #   Maestro flows: crear-gasto, exportar, bloqueo
│   │
│   └── web/                           # 🌐 PWA (React + Vite) — FLUX por features
│       ├── package.json               # name: @monedero/web
│       ├── vite.config.ts             # + vite-plugin-pwa (Workbox), base, alias
│       ├── index.html                 # CSP meta, manifest link
│       ├── public/
│       │   ├── manifest.webmanifest   # name Monedero, tile «M», bg #F4EFE7
│       │   └── icons/                 # 192/512 maskable «M»
│       ├── .env.example               # VITE_APP_NAME (sin secretos)
│       └── src/
│           ├── main.tsx               # bootstrap + Workbox registration
│           ├── app/
│           │   ├── App.tsx            # providers: Theme, Router, VaultGate
│           │   ├── router.tsx         # rutas por feature
│           │   └── providers/
│           ├── features/              # 🧩 UNIDAD DE DISO (cada una autocontenida)
│           │   ├── vault/             #   desbloqueo, passphrase, CryptoKey no extraíble
│           │   │   ├── store.ts       #   estado: locked/unlocked, error codes
│           │   │   ├── hooks.ts
│           │   │   ├── components/    #   UnlockScreen, LockButton
│           │   │   └── page.tsx
│           │   ├── dashboard/         #   balance, resumen mensual, donut
│           │   ├── transactions/      #   alta (Zod form), lista, filtros, detalle
│           │   ├── budgets/           #   presupuestos por categoría y periodo
│           │   └── settings/          #   tema, export/import .monedero, borrar datos
│           ├── data/                  #   capa de datos SIN React
│           │   ├── repo/              #   tx.repo.sqljs.ts (implementa misma semántica)
│           │   ├── crypto/            #   aesGcm.encrypt/decrypt, pbkdf2.deriveKey
│           │   ├── persistence/       #   load/save blob cifrado → IndexedDB
│           │   └── db/                #   sql.js init, migrations (mismo DDL)
│           ├── design-system/         #   tokens.css (--cs-*), theme.ts, primitivas Clay
│           │                          #   Button, Card, Input, Toast, Progress…
│           ├── shared/                #   utils, formatters, i18n, types
│           └── tests/
│               ├── unit/              #   Vitest (data, features) ≥70% core
│               ├── e2e/               #   Playwright: alta, reportes, export/import
│               └── a11y/              #   axe-core por ruta (WCAG AA gate)
│
└── tools/                             # 🔧 scripts transversales
    ├── tokens-check.mjs               #   verifica CSS vars vs tema TS vs SSOT
    ├── sync-contract.mjs              #   valida que ambas apps usan mismo contract
    └── audit.sh                       #   pnpm audit --audit-level=high
```

---

## 2. Reglas de dependencias

```
apps/mobile/src/ui ──────────► apps/mobile/src/core ◄── apps/mobile/src/infrastructure
apps/web/src/features ───────► apps/web/src/data ──────► shared/export-contract
apps/mobile/src/infrastructure ─────────────────────────► shared/export-contract
```

1. `core` (móvil) **no importa** `ui`, `infrastructure`, React ni React Native.
2. `infrastructure` implementa `ports/` de `core`; la composición (inyección) ocurre en `AppRoot`.
3. `web/data` no importa React; `features/*` no importa `data` directamente → vía hooks del feature (repositorio inyectado en `app/providers`).
4. **Nunca** importar código entre `apps/mobile` y `apps/web`. El único puente es `@monedero/export-contract`.
5. HEX/tokens: prohibidos fuera de `design-system` (verificado por lint + `tokens:check`).

## 3. Convenciones de nombrado

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos de componente | PascalCase | `BalanceCard.tsx` |
| Archivos lógicos/utilidades | kebab-case | `tx.repo.sqlite.ts` |
| Casos de uso | verbo + sustantivo | `addTransaction.ts` |
| Puertos | sustantivo + `Port` | `TransactionRepository` |
| Tests | `*.test.ts` / `*.spec.tsx` junto al módulo o en `tests/` | — |
| Migraciones SQL | `NNN_descripcion.sql` | `001_init.sql` |
| Env vars | prefijo plataforma | `EXPO_PUBLIC_*`, `VITE_*` |

## 4. Scripts raíz (package.json)

```jsonc
{
  "scripts": {
    "dev:mobile": "pnpm --filter @monedero/mobile start",
    "dev:web":    "pnpm --filter @monedero/web dev",
    "build":      "turbo run build",
    "test":       "turbo run test",
    "lint":       "turbo run lint",
    "typecheck":  "turbo run typecheck",
    "tokens:check": "node tools/tokens-check.mjs",
    "contract:check": "node tools/sync-contract.mjs",
    "audit":      "pnpm audit --audit-level=high"
  }
}
```
