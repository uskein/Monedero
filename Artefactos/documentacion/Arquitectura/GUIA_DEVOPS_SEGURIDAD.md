# GUIA_DEVOPS_SEGURIDAD — Proyecto **Monedero**

> Entorno local, variables de entorno, CI/CD, despliegue y protocolos de seguridad.
> Versión 1.0 · Aprobado (Paso 6).

---

## 1. Entorno local

### 1.1 Requisitos

| Componente | Versión | Notas |
|---|---|---|
| Node.js | 22 LTS | con `corepack` activado |
| pnpm | 9+ | `corepack enable && corepack prepare pnpm@9 --activate` |
| Git | 2.4x | |
| **Móvil** | | Android Studio (SDK 34+) **o** Xcode 16+ (macOS); dispositivos/emuladores |
| **PWA** | | solo navegador (Chrome/Edge/Firefox recientes) |
| Docker (opcional) | — | devcontainer/CI determinista; **no** se usa en producción |

### 1.2 Primer arranque

```bash
git clone <repo> && cd "Proyecto App Monedero -Gestor de gastos"
pnpm install                       # workspace: shared + apps/*
pnpm typecheck && pnpm lint && pnpm test

pnpm dev:web                       # → http://localhost:5173 (Vite + PWA dev)
pnpm dev:mobile                    # → Expo (emulador o Expo Go / dev build)
```

> ⚠️ WebCrypto (`crypto.subtle`) requiere **contexto seguro**: en dev funciona en `localhost`; en despliegue, **HTTPS obligatorio**.

### 1.3 Scripts raíz

```jsonc
{
  "dev:mobile":  "pnpm --filter @monedero/mobile start",
  "dev:web":     "pnpm --filter @monedero/web dev",
  "build":       "turbo run build",
  "test":        "turbo run test",
  "lint":        "turbo run lint",
  "typecheck":   "turbo run typecheck",
  "tokens:check":"node tools/tokens-check.mjs",       // coherencia con SSOT visual
  "contract:check":"node tools/sync-contract.mjs",    // mismo contrato en ambas apps
  "audit":       "pnpm audit --audit-level=high"
}
```

---

## 2. Variables de entorno

### 2.1 `apps/mobile/.env.example`
```bash
EXPO_PUBLIC_APP_SCHEME=monedero      # deep links (sin secretos)
# EAS_PROJECT_ID se gestiona vía `eas init` (no en repo)
```

### 2.2 `apps/web/.env.example`
```bash
VITE_APP_NAME=Monedero               # sin claves: el cifrado usa passphrase del usuario
VITE_APP_VERSION=1.0.0
```

### 2.3 Secretos (solo CI/EAS — nunca en repo)
| Secreto | Entorno | Uso |
|---|---|---|
| `EXPO_TOKEN` | GitHub `release` | EAS Build/Submit |
| `APP_STORE_CONNECT_KEY` (.p8) + issuer/team | GitHub `release` | App Store |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | GitHub `release` | Google Play |

**Prohibido:** cualquier clave de cifrado de usuarios, passphrase o token de datos — **no existen** (el usuario es su propio custodio).

---

## 3. CI/CD (GitHub Actions)

### 3.1 `pr.yml` — quality gate en cada Pull Request
```yaml
jobs: [mobile, web]   # matriz
  steps:
    - pnpm install --frozen-lockfile
    - typecheck: tsc --noEmit
    - lint: eslint . && prettier --check .
    - unit:  Jest+RNTL (mobile) / Vitest (web)   # coverage core ≥70%
    - contract: pnpm contract:check + tests de round-trip shared/export-contract
    - a11y (web): axe-core por ruta crítica → falla si viola WCAG AA
    - audit: pnpm audit --audit-level=high       # falla con CVE high/critical
    - tokens: pnpm tokens:check                  # SSOT visual coherente
```

### 3.2 `release.yml` — al etiquetar `vX.Y.Z`
```
web:     build (vite) → deploy Cloudflare Pages (producción) → crear GitHub Release
mobile:  eas build --profile production → eas submit (App Store + Google Play)
```

### 3.3 Flujo de trabajo
```
main (protegido, checks verdes) ← PR ← feature/* o fix/*
tag v* → release automático en ambas apps (versiones independientes permitidas,
         el formato del fichero versiona por separado: formatVersion)
```

---

## 4. Despliegue

### 4.1 PWA — Cloudflare Pages
| Aspecto | Detalle |
|---|---|
| Build | `pnpm --filter @monedero/web build` → `dist/` |
| Dominio | propio (ej. `monedero.app`); HTTPS **obligatorio** (WebCrypto) |
| Headers | ver §6.4 |
| Cache | Workbox: `index.html`/SW `network-first`; assets hashed `cache-first`; datos **siempre locales** |
| Rollback | re-deploy del build anterior desde dashboard/Pages CI |

### 4.2 Móvil — EAS
```bash
eas login
eas init                                   # vincula project id
eas build --profile preview                # APK/QA interna
eas build --profile production
eas submit --platform all                  # o vía release.yml
```

| Perfil (`eas.json`) | Salida |
|---|---|
| `development` | dev client con inspector |
| `preview` | APK interno / TestFlight para QA |
| `production` | store-ready (app bundle) |

**Ciclo de vida por plataforma:** interno → TestFlight/Play interno → producción gradual (10% → 100%). Cada release incluye notas y `CHANGELOG`.

### 4.3 Contenedores
- **Producción: ningún contenedor** (sin backend). PWA = assets estáticos; móvil = binario firmado.
- **CI/dev opcional:** imagen `node:22-alpine + pnpm` para builds deterministas y `devcontainer.json`.

---

## 5. Seguridad — protocolos

### 5.1 Autenticación y custodia de claves
| Paso | Móvil | PWA |
|---|---|---|
| Configuración inicial | passphrase (≥10 chars) → PBKDF2-SHA256 **≥120.000** iteraciones (salt aleatoria) → clave SQLCipher; verificador HMAC en `settings['vault']` | análogo con WebCrypto (`deriveKey`, `CryptoKey` **no extraíble**) |
| Desbloqueo | biometría (`expo-local-authentication`) libera clave del **Keychain/Keystore (Secure Enclave)**, o passphrase | passphrase en sesión |
| Bloqueo | al background/timeout → `lock()` + **zeroize** de clave en memoria | cierre de pestaña/timeout → `lock()` |
| Fallos | backoff exponencial tras 5 intentos; autodestrucción **no** por defecto (opcional) | ídem |
| Recuperación | **no existe** (nube proscrita) → la UI advierte: perder la passphrase = perder la bóveda → fomentar export `.monedero.enc` periódico | ídem |

> **Mínimo privilegio:** el JS solo ve la clave con bóveda desbloqueada; nada de claves en logs, `console`, crash reports ni storage no cifrado.

### 5.2 Cifrado
| Fase | Móvil | PWA |
|---|---|---|
| En reposo | **SQLCipher** AES-256 (+HMAC) a nivel de fichero (`PRAGMA key`) | blob BBDD → **AES-256-GCM** antes de IndexedDB (IV aleatorio/carga) |
| En tránsito | N/A (cero red) — el fichero de export viaja por el Share del SO; recomendar `.monedero.enc` | ídem |
| Integridad | SHA-256 canónico en `integrity.hash` | ídem |
| Algoritmos vetados | MD5, SHA-1, ECB, IVs estáticos, TLS <1.2 (n/a) | ídem |

### 5.3 OWASP Top 10 → mapeo local-first
| # | Riesgo | Mitigación |
|---|---|---|
| A01 | Broken Access | sin API; biometría + lockout local |
| A02 | Cryptographic Failures | AES-256 (SQLCipher/GCM), PBKDF2 120k, sin algoritmos débiles |
| A03 | Injection | **Zod en toda frontera** + prepared statements `?` (jamás concatenar SQL); sin `eval`/`innerHTML` |
| A04 | Insecure Design | hexagonal + mínimos privilegios + cero superficie de red (Paso 3) |
| A05 | Misconfiguration / Supply Chain | lockfile pnpm, Dependabot, `audit` en CI, deps mínimas |
| A06 | Vulnerable Components | auditoría CI + revisión mensual de updates |
| A07 | Identification/Auth Failures | biometría+passphrase+backoff; sin cuentas remotas |
| A08 | Software/Data Integrity | releases firmados por tiendas; hash del `.monedero`; contract tests |
| A09 | Logging Failures | **logs sin importes/payees/notas/PII**; diagnóstico opt-in |
| A10 | SSRF | N/A: sin fetch a red; CSP `connect-src 'none'` |

**OWASP MASVS (móvil):** detección root/jailbreak (aviso, no bloqueo por defecto) · `FLAG_SECURE` opcional en pantallas de saldo · permisos mínimos (`share`, `document-picker`) · `android:allowBackup="false"` · networks security config sin cleartext.

**Headers PWA:** CSP estricta · `X-Content-Type-Options: nosniff` · `Referrer-Policy: no-referrer` · `Permissions-Policy` mínimo (sin cámara/mic) · `Strict-Transport-Security`.

### 5.4 Manejo de datos de usuario en soporte
- Nunca pedir capturas con saldos reales; si el usuario las envía, tratarlas como datos sensibles y no conservarlas.
- Crash reports: **deshabilitados por defecto** (no hay telemetría); si se añaden, opt-in explícito y sin payloads de transacciones.

---

## 6. Operación y backups (educación al usuario)

| Tarea | Protocolo |
|---|---|
| Backup recomendado | Mensual → Ajustes → *Exportar bóveda* → `.monedero.enc` guardado en almacenamiento del usuario (nube personal opcional **bajo su control**) |
| Restaurar | Importar → modo `replace` (con snapshot previo automático) o `merge` |
| Verificación | CI round-trip: export→import→export idéntico (contract tests) |
| Pérdida de dispositivo | solo se recupera desde backup del usuario (advertencia clara en onboarding) |
| Auditoría | `pnpm audit` en CI + Dependabot alerts activados |

---

## 7. Checklist de release

- [ ] `typecheck + lint + test + a11y + audit` verdes en `pr.yml`
- [ ] `tokens:check` y `contract:check` verdes
- [ ] Versiones bump (SemVer) + `CHANGELOG`
- [ ] QA manual: alta de gasto, bloqueo biométrico, export/import bidireccional real (móvil ⇄ PWA)
- [ ] Prueba de passphrase incorrecta → `IMPORT_DECRYPT_FAILED` correcto
- [ ] Snapshot de tienda/pantallas actualizados (tile «M»)
- [ ] Tag `v*` → pipelines de producción
