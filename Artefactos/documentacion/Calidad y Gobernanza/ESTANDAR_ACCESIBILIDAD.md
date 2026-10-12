# Estándar de Accesibilidad (WCAG 2.1 AA) — Monedero

> **Fase A · Paso A.3** · Reglas **inquebrantables**. Hereda y endurece lo ya fijado en el SSOT `manual-identidad-visual.md` (Skill 1).

---

## 1. Nivel objetivo

- **WCAG 2.1 nivel AA** (A + AA) en ambas plataformas. Nada se lanza con violaciones AA.
- Auditoría automatizada en CI: **axe-core** (PWA, `@axe-core/playwright`) · `jest-axe` (unit/componente) · validación de props de accesibilidad RN + Maestro (móvil).

## 2. Contraste (validado contra la paleta Clay Serenity)

| Par | Ratio | Estado |
|-----|-------|--------|
| `--cs-primary #2F7D5B` sobre blanco | ≈ 5.0:1 | ✅ AA texto normal |
| `--cs-accent-text #B4573A` sobre blanco | ≈ 4.8:1 | ✅ AA texto normal |
| `--cs-text-muted #6E7681` sobre blanco | ≈ 4.6:1 | ✅ AA texto normal (mínimo; no usar <14px) |
| `--cs-text-primary #232A31` sobre `#F4EFE7` | ≈ 12:1 | ✅ AAA |
| `--cs-accent #D97757` sobre blanco | ≈ 2.9:1 | ❌ **Solo gráfico** — texto en `#B4573A` (regla SSOT) |
| `--cs-placeholder #9A938A` sobre `#EAE2D6` | ≈ 2.5:1 | ⚠️ Placeholder decorativo: **prohibido como única etiqueta**; usar `.p-label` real siempre (ya es norma en los blueprints) |
| Blanco sobre `--cs-primary` | ≈ 5.0:1 | ✅ Botones primarios |

- Texto grande (≥24px o ≥19px bold): mínimo 3:1.
- **Nunca solo color**: todo estado (gasto/ingreso, umbral de presupuesto, error, tab activo) combina color + signo/ícono/texto.

## 3. Teclado y focus

- Todo elemento interactivo alcanzable con Tab/Shift+Tab y operable con Enter/Espacio/Escape.
- **Focus visible 3px** `rgba(47,125,91,.45)` con offset (ya definido en SSOT como `:focus-visible`).
- Escape cierra modales/sheets; el foco se devuelve al disparador al cerrar (roving focus).
- Orden de tabulación = orden visual. Sin trampas de foco (el sheet de detalle devuelve foco a la fila).

## 4. Atributos ARIA (matriz obligatoria)

| Componente | Atributos |
|-------------|-----------|
| Tab bar / segmented | `role="tablist"` · `role="tab"` + `aria-selected` · `aria-controls` |
| Acordeones/épicas | `aria-expanded` + `aria-controls` en el disparador |
| Bottom sheet / modal | `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + foco atrapado |
| Toast / avisos | `role="status"` (polite) · errores `role="alert"` (assertive) · nunca steals-focus |
| Listas de movimientos | `accessibilityRole="summarylist"` (RN) / `<ul>` semántico (web) · filas con label compuesto (concepto, categoría, importe con signo) |
| Gráficos (donut) | `role="img"` + `aria-label` descriptivo **y** tabla alternativa |
| Campos de formulario | `<label>` real siempre visible; `aria-invalid` + `aria-describedby` al error |
| Botón FAB | `accessibilityLabel` con acción completa («Añadir movimiento») |

- RN: `accessible`, `accessibilityRole`, `accessibilityLabel`, `accessibilityState` (disabled/selected), `accessibilityLiveRegion` para toasts.
- Regla: **sin divs clicables sin rol**. Todo lo pulsable tiene `role="button"`/`button` nativo.

## 5. Lectores de pantalla

- Validado con **VoiceOver** (iOS), **TalkBack** (Android), **NVDA/JAWS** (PWA/Windows).
- Orden de lectura coherente: título → contenido → acciones.
- Las cifras se anuncian con moneda y signo («menos 180 mil pesos colombianos», no «-180000»).
- El bloqueo de bóveda (`VaultGate`) anuncia su estado y el método de desbloqueo disponible.

## 6. Movimiento y tiempo

- `prefers-reduced-motion`: animaciones ≤80ms, sin contadores animados (saldo directo), sin drift de blobs (heredado del SSOT).
- Sin contenido que parpadee >3 veces/segundo (regla 2.3.1).
- Sin timeouts autogestionados en la UI salvo toasts (4000 ms, no esenciales para la tarea).

## 7. Objetivos táctiles y zoom

- Targets ≥ **44×44px** (SSOT). Separación ≥8px entre acciones vecinas.
- Zoom de texto hasta **200%** sin pérdida de funcionalidad (PWA); respeta `fontScale` de RN sin truncar.

## 8. Gates de CI

| Gate | Herramienta | Fallo si… |
|------|-------------|-----------|
| `a11y:axe` | @axe-core/playwright | 1+ violación AA en rutas críticas |
| `a11y:jest` | jest-axe | 1+ violación en componentes |
| `a11y:props` | test RN propio | falta `accessibilityLabel`/role en elementos del catálogo |
| `a11y:e2e` | Maestro + Playwright keyboard test | flujo crítico no operable por teclado/lector |

## 9. Checklist por pantalla (añadida a cada DoD de blueprint)

- [ ] 4 estados anunciados correctamente (live regions).
- [ ] Formulario navegable por teclado/lector en orden lógico.
- [ ] Errores asociados al campo (`aria-describedby`), no solo toast.
- [ ] Gráficos con alternativa textual.
- [ ] axe-core limpio en la ruta.
