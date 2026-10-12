# Estrategia de Feature Flags — Monedero

> **Fase A · Paso A.6** · **Adaptación local-first.** Proveedores SaaS (LaunchDarkly/Unleash) requieren red: contradictorios con ADR-001. Se usa una **solución propia** de bajo costo.

---

## 1. Herramienta: flags propios en dos capas

| Capa | Mecanismo | Uso |
|------|-----------|-----|
| **Build-time** | `EXPO_PUBLIC_FLAG_*` (móvil) / `VITE_FLAG_*` (PWA) leídas en `packages/flags` | Flags de lanzamiento que pueden excluir código del bundle |
| **Runtime local** | tabla `settings` con clave `flags` (JSON) editable en builds QA/dev | Experimentos y toggles QA sin rebuild |

- En **producción solo existen los build-time flags** (deterministas, auditable en el binario).
- API única: `isFlagEnabled('feature.export.v2')` — prohibido leer env/flags directamente en pantallas.

## 2. Tipos de flags

| Tipo | Ejemplo | Vida |
|------|---------|------|
| **Lanzamiento** | `feature.reportes.v1` | Hasta que el 100% de usuarios lo tenga (1–2 releases) |
| **Experimento local** | `experiment.new_dashboard` | Solo QA/dev; nunca en prod sin decisión explícita |
| **Operacional** | `ops.import_replace_enabled` | Rollback rápido ante bug (se puede apagar en caliente en QA; en prod es rebuild) |
| **Permiso/entorno** | `env.debug_menu` | Solo dev/QA builds |

> Nota soberana: al no haber usuarios remotos, un «rollout progresivo» significa **apagado rápido en el siguiente build**; la bandera operacional existe para decidir sin reescribir código.

## 3. Convención de nombres

```
<ámbito>.<funcionalidad>.<versión|propósito>

ámbito ∈ { feature, experiment, ops, env }
```

Ejemplos: `feature.reportes.v1` · `feature.import_replace.v1` · `experiment.balance_compact` · `ops.wipe_double_confirm` · `env.debug_menu`.

- Todo flag nuevo se declara en `packages/flags/flags.ts` con **descripción, creador, ticket HU y fecha de expiración**.
- El tipo inferido del prefijo; ESLint (`flags/naming`) lo valida en CI.

## 4. Ciclo de vida (anti-deuda)

```
crear (con HU y fecha) → usar → eliminar al cumplir su objetivo
```

- **Ningún flag puede vivir > 90 días** sin revisión; CI corre `flags:lint` que falla si hay flags expirados.
- Al eliminar el flag: se queda la rama «on» y se borra el código muerto en el mismo PR (`chore(flags): elimina feature.reportes.v1`).
- Máximo práctico: **≤ 8 flags activos** en el repo; más de eso, discusión obligatoria.

## 5. Reglas de uso

- Las pantallas **no** ramifican UI completa por flag sin referencia a blueprint (coherencia con Skill 3).
- Flags en `shared/contract` prohibidos: el contrato `.monedero` es estable.
- Tests: cada flag tiene test de ambos caminos (on/off) mientras exista.
