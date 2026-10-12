# Estrategia de Pruebas — Monedero

> **Fase A · Paso A.1** · Marco de calidad del software. Reglas **inquebrantables** para toda implementación.
> Compatible con: Expo + React Native / React + Vite (PWA) · pnpm + Turborepo · ADR-001 (sin backend, sin red).

---

## 1. Pirámide de pruebas

| Nivel | Ratio objetivo | Herramienta (móvil) | Herramienta (PWA / shared) |
|-------|----------------|---------------------|----------------------------|
| Unitarias | 70% | Jest + `jest-expo` | Vitest |
| Integración (repositorios, casos de uso, stores) | 20% | Jest + `@testing-library/react-native` | Vitest + `@testing-library/react` |
| E2E | 10% | **Maestro** (flujos críticos) | **Playwright** (+ `axe-core`) |

- **Componentes:** Testing Library (ambas plataformas). Nada de tests contra implementación interna (sin snapshots de DOM como gate).
- **Contrato compartido:** `shared/export-contract` se prueba con **matrix de fixtures** (v1 válido, corrupto, versión futura, hash alterado) ejecutada en ambas plataformas.

## 2. Cobertura mínima (gate de CI, no negociable)

| Área | Umbral |
|------|--------|
| Código de negocio (`domain/`, `application/`, puertos, merge LWW, dinero en centavos) | **≥ 80% líneas** y ≥ 80% ramas |
| Flujos críticos (vault, export/import, cálculo de dinero, presupuestos) | **100% de escenarios** de sus casos de uso |
| Global (monorepo) | ≥ 70% líneas |
| UI presentacional | No cuenta para el gate de negocio; se valida por a11y + E2E |

- Falla el pipeline si algún paquete `@monedero/*` queda por debajo de su umbral.
- Cobertura generada con `vitest --coverage` / `jest --coverage` (istanbul/`c8`).

## 3. Política TDD

- **TDD estricto** para: `domain/` (entidades, reglas), `application/` (casos de uso), `shared/export-contract`, cálculos de dinero/presupuestos, lógica de merge LWW y derivación de claves.
- **TDD recomendado** para componentes complejos (formulario de movimiento, barras de presupuesto).
- **Exento** de TDD: scaffolding, navegación pura, estilos, mocks.
- Ciclo obligatorio: **red → green → refactor**. El test nace antes que el código en las áreas estrictas.

## 4. Stack de testing (seleccionado)

| Propósito | Móvil (Expo) | PWA (React+Vite) | shared |
|-----------|--------------|------------------|--------|
| Unit / integración | Jest + jest-expo | Vitest | Vitest |
| Componentes | @testing-library/react-native | @testing-library/react + jsdom | — |
| E2E | Maestro | Playwright | — |
| a11y automatizada | Maestro + props RN | jest-axe + @axe-core/playwright + Lighthouse | — |
| Mocks de BD | SQLite en memoria (sql.js / better-sqlite3) | sql.js en memoria | fixtures |

## 5. Definition of Done (DoD) — calidad

Una HU está **terminada** solo si:

- [ ] Código mergeado en `main` con **commit semántico** (`feat:`, `fix:`, …).
- [ ] Tests nuevos/actualizados: TDD en áreas estrictas; cobertura ≥ umbral del paquete.
- [ ] **i18n**: cero strings hardcodeados visibles (`t('clave')` en todos los textos).
- [ ] **a11y**: props/ARIA correctas, focus visible, targets ≥44px; `jest-axe` sin violaciones AA.
- [ ] Los **4 estados** (loading/empty/success/error) implementados y cubiertos por test o E2E.
- [ ] PR con plantilla completa + **1 aprobación** + checks verdes.
- [ ] Sin `console.log` ni secrets; logs vía logger estructurado (PII-free).
- [ ] Si es funcionalidad nueva: **feature flag** definido según `ESTRATEGIA_FEATURE_FLAGS.md`.

## 6. Tipos de suites y frecuencia

| Suite | Comando (Turborepo) | Cuándo |
|-------|---------------------|--------|
| `test:unit` | `turbo run test:unit` | Cada PR + pre-commit (solo paquetes tocados) |
| `test:integration` | `turbo run test:integration` | Cada PR |
| `test:a11y` | `turbo run test:a11y` | Cada PR (PWA) / nightly (móvil) |
| `test:e2e` | `turbo run test:e2e` | Merge a `main` + nightly |
| `coverage:gate` | `turbo run coverage` | Cada PR (falla si < umbral) |

## 7. Datos de prueba

- **Fixtures** en `packages/test-fixtures/`: bóvedas `.monedero` de ejemplo (v1, corrupta, futura), conjuntos de transacciones con centavos negativos/positivos, presupuestos en todos los umbrales.
- **Nunca** usar datos reales de usuarios (y no existen: la app es local).
- Generador determinista para merge LWW (semilla fija) — mismas entradas, mismo resultado.
