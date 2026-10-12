# Gobernanza de Código y Git Flow — Monedero

> **Fase A · Paso A.5** · Reglas de colaboración y versionado. Los **commits semánticos al 100%** son no negociables.

---

## 1. Estrategia de ramificación: **GitHub Flow** (simplificado)

Justificación: monorepo con dos apps (móvil/PWA) sin despliegues de release branching complejo; releases se etiquetan por app (`mobile@v1.4.0`, `pwa@v1.4.0`).

```
main ────────────────●───────●──────►  (producción, siempre desplegable)
          \        /       /
           feat/x ─●──────PR──► (1 aprobación + checks verdes → squash merge)
```

- `main` es **siempre desplegable**: PWA se publica en Cloudflare Pages desde `main`; móvil usa EAS Build desde `main`/tags.
- Ramas: `feat/<HU-xx>-slug`, `fix/<slug>`, `chore/<slug>`. Vida ≤ 3 días; si vive más, se parte o se abre discusión.
- **Sin `develop`**. Sin ramas de larga duración.

## 2. Commits semánticos (Conventional Commits) — obligatorio 100%

```
<type>(<scope>): <descripción en imperativo, ≤72 chars>
[opcional cuerpo]
[opcional footer: refs HU-XX, BREAKING CHANGE]
```

| Type | Uso |
|------|-----|
| `feat` | Funcionalidad nueva (flag asociado si aplica) |
| `fix` | Corrección de bug |
| `docs` | Solo documentación |
| `test` | Solo pruebas |
| `refactor` | Sin cambio de comportamiento ni fix |
| `perf` | Rendimiento |
| `chore` | Build, deps, config |
| `ci` | Pipelines |

- **Scopes canónicos:** `mobile`, `pwa`, `shared`, `contract`, `ds` (design system), `i18n`, `a11y`, `ci`, `docs`.
- Ejemplos válidos:
  - `feat(mobile): alta de movimiento con money-input COP/USD/EUR`
  - `fix(shared): merge LWW respeta deleted_at como gana`
  - `docs(producto): corrige numeración HU-18 enérgica`
- Ejecutor: `commitlint` + `czg` (opcional). Los commits no conformes **rechazan el push** (hook).

## 3. Hooks locales (husky + lint-staged)

| Hook | Acción |
|------|--------|
| `pre-commit` | `lint-staged`: ESLint + Prettier + typecheck rápido de los archivos tocados |
| `commit-msg` | `commitlint` (conventional) |
| `pre-push` | `test:unit` del paquete afectado |

- Los hooks **no** sustituyen los gates de CI: los mismos checks corren en el pipeline (fuente de verdad).

## 4. Pull Requests — plantilla obligatoria

```markdown
## 📦 Descripción
<!-- Qué y por qué. refs HU-XX -->

## 🧪 Testing
- [ ] Tests añadidos/actualizados (TDD en domain/application/contract)
- [ ] Cobertura ≥ umbral del paquete

## ♿ Accesibilidad
- [ ] axe-core / jest-axe sin violaciones AA
- [ ] Teclado + lector verificados en los estados tocados
- [ ] `prefers-reduced-motion` respetado

## 🌐 i18n
- [ ] Sin strings hardcodeados (`t('clave')`)
- [ ] Claves añadidas en es-CO y en-US

## 📸 Evidencia
<!-- Capturas/vídeos de los 4 estados afectados (móvil y PWA si aplica) -->

## 🚩 Feature flags
- [ ] Flag creado/actualizado/eliminado (nombre: `feature.…`)
```

## 5. Code review

- **1 aprobación obligatoria** (2 si toca `shared/contract` o seguridad/vault).
- El reviewer verifica el checklist del PR; el CI manda: sin checks verdes no se mergea.
- **Veto del Auditor:** si el reviewer o CI detecta violación AA, string hardcodeado o cobertura <80% en negocio, el PR se bloquea hasta corregir.
- Squash merge; el título del squash = mensaje del PR (conventional).

## 6. Release

- Tags por app: `mobile@x.y.z` / `pwa@x.y.z` (SemVer).
- `BREAKING CHANGE` ⇒ major automático; feat ⇒ minor; fix ⇒ patch.
- CHANGELOG generado de los conventional commits (`git-cliff`).
