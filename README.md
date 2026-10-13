# Monedero 💸

Gestor de gastos **local-first** para móvil (iOS/Android) y PWA. Tus datos **nunca salen de tu dispositivo**: bóveda cifrada, funcionamiento offline y **cero** backend, nube o telemetría.

> **Privacidad por diseño:** el usuario es su propio custodio. El único acoplamiento entre apps es el intercambio de ficheros `.monedero` (ADR-002) — todo lo demás es independiente.

## Principios

- **Confianza · Claridad · Control · Serenidad** — emociones guía del producto.
- **Dinero siempre en centavos enteros** (`amountCents: number`) — nunca coma flotante.
- **Local-first real**: sql.js hoy; SQLCipher nativo en el dev-build (S8).
- **Accesibilidad WCAG 2.1 AA** y **cero strings hardcodeados** (es-CO ⇄ en-US con paridad forzada).

## Estructura

```
apps/
  mobile/   Expo SDK 57 · React Native 0.86.3 · React 19.2 — app móvil (prioridad)
  web/      Vite 6 · React 19 — PWA independiente
shared/
  tokens/           SSOT visual: tokens --cs-* (JSON ⇄ CSS vars ⇄ constants RN)
  i18n/             es-CO + en-US, formateo de dinero (centavos ⇄ display)
  db/               Migraciones/seed SQL versionadas (fuente de verdad del esquema)
  export-contract/  Fichero .monedero/.monedero.enc — único acoplamiento (ADR-002)
Artefactos/documentacion/   Documentación aprobada (arquitectura, flujos, calidad)
```

## Arranque rápido

Requisitos: **Node ≥ 20.11** y **pnpm 10** (se instala solo vía `packageManager`).

```bash
pnpm install        # instala todo el monorepo
ejecutar-movil.bat  # Metro (puerto 8081) → abre Expo Go en tu móvil
ejecutar-pwa.bat    # Vite dev server → la PWA en el navegador
```

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev:mobile` / `pnpm dev:web` | Desarrollo (sin .bat) |
| `pnpm test` | Toda la batería (Jest+RNTL móvil · Vitest web · suites shared) |
| `pnpm typecheck` · `pnpm lint` | TS estricto + ESLint |
| `pnpm tokens:check` | Coherencia de la SSOT visual (--cs-*) |
| `pnpm i18n:check` | Paridad de claves es-CO ⇄ en-US |
| `pnpm contract:check` | Sincronización del contrato `.monedero` |

## CI/CD

- **PR**: `.github/workflows/pr.yml` — gates completas (typecheck, lint, tests+coverage, axe, tokens, contrato, i18n, audit).
- **Release** (tag `v*`): `.github/workflows/release.yml` — PWA → Cloudflare Pages · móvil → EAS Build/Submit.

## Documentación

La fuente de verdad vive en [`Artefactos/documentacion`](Artefactos/documentacion): arquitectura y ADRs (`Arquitectura/`), requerimientos y flujos (`Producto y Flujos/`), plan de sprints (`Orquestador/`), estándares de calidad (`Calidad y Gobernanza/`). Antes de tocar UI, lee el [manual de identidad visual](Artefactos/documentacion/Dise%C3%B1o%20Visual/manual-identidad-visual.md).

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para el flujo de trabajo y las reglas innegociables.
