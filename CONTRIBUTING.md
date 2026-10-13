# Contribuir en Monedero

## Flujo

```
main (protegido, checks verdes) ← PR ← feature/* | fix/*
```

1. Rama `feature/<tema>` o `fix/<tema>` desde `main`.
2. **Commits semánticos** (commitlint): `feat(scope): …`, `fix(scope): …`, `test(scope): …`, `docs(scope): …`.
3. Pull Request → las gates de `.github/workflows/pr.yml` deben estar en verde.
4. Merge a `main` (fast-forward o squash).

## Reglas innegociables

| Regla | Detalle |
|---|---|
| **Sin strings hardcodeados** | Todo texto de UI pasa por `@monedero/i18n` con clave en **ambos** locales. `pnpm i18n:check` lo bloquea. |
| **Solo tokens `--cs-*`** | Colores/espaciados/radios desde `@monedero/tokens`. Nada de hex en la UI. `pnpm tokens:check` lo bloquea. |
| **Dinero en centavos** | `amountCents: number` (enteros). El formateo vive en `shared/i18n` (p.ej. `formatAmountLive`). |
| **El frontend jamás escribe SQL** | Toda persistencia pasa por el repositorio (`Repository` port) con SQL tipada y migraciones versionadas. |
| **4 estados por pantalla** | loading · empty · error(+retry) · success. Diseñados, no improvisados. |
| **WCAG 2.1 AA** | Roles/labels accesibles; el axe de `tests/*-a11y.test.tsx` debe pasar. Sin rojo para gastos ordinarios. |
| **El contrato `.monedero` es intocable a la ligera** | Cambios solo en `shared/export-contract` + fixtures + `pnpm contract:check` (ADR-002). |
| **Tests del código de negocio** | Mínimo cobertura ≥70% en código de negocio (rutas de dinero: TDD estricto). |

## Comandos antes de abrir PR

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm tokens:check && pnpm i18n:check && pnpm contract:check
```

## Arquitectura

Lee antes de empezar: [`Artefactos/documentacion/Arquitectura/README_ARQUITECTURA.md`](Artefactos/documentacion/Arquitectura/README_ARQUITECTURA.md) (stack, patrones, ADRs) y el [plan de sprints](Artefactos/documentacion/Orquestador/PLAN_DE_SPRINTS.md) para el estado actual.
