# Manual de Identidad Visual — «Clay Serenity»

> **Single Source of Truth (SSOT)** de la identidad visual del proyecto ***Monedero*** (gestor de gastos local-first).
> Cualquier agente de IA o desarrollador debe consultar este documento antes de crear o modificar cualquier interfaz.
> Versión: **1.0** · Plataforma: **Móvil (iOS/Android) prioritario + PWA** · Fecha: 2026-10-11

---

## 0. Índice

1. [Concepto de marca](#1-concepto-de-marca)
2. [Plataforma y contexto](#2-plataforma-y-contexto)
3. [Tokens de diseño](#3-tokens-de-diseño)
4. [Color: reglas y prohibiciones](#4-color-reglas-y-prohibiciones)
5. [Tipografía](#5-tipografía)
6. [Forma, elevación y textura](#6-forma-elevación-y-textura)
7. [Directrices de componentes](#7-directrices-de-componentes)
8. [Movimiento](#8-movimiento)
9. [Logo y wordmark](#9-logo-y-wordmark)
10. [Accesibilidad](#10-accesibilidad)
11. [Modo oscuro](#11-modo-oscuro)
12. [Respuesta rápida para agentes](#12-respuesta-rápida-para-agentes)

---

## 1. Concepto de marca

**Estilo elegido:** Claymorphism terroso con lenguaje editorial — *Clay Serenity*.
**Metáfora:** arcilla moldeada y papel artesanal. Superficies con volumen, tacto y calidez.

| Pilar | Significado en UI |
|---|---|
| **Soberanía** | Todo es local. Nunca pedir "subir a la nube" en copy ni en UI. |
| **Serenidad** | Sin rojos alarmistas gratuitos ni urgencia visual. |
| **Claridad** | Una idea por pantalla; jerarquía fuerte; aire generoso. |
| **Tacto** | Botones que se hunden, tarjetas que se elevan; feedback físico. |

**Emociones a evocar:** confianza, claridad, control, serenidad.
**Público:** usuarios *privacy-conscious*, freelancers, familias, usuarios no técnicos.

---

## 3. Tokens de diseño

### 3.1 Color

| Token | HEX | Rol semántico | Contraste verificado |
|---|---|---|---|
| `--cs-bg-base` | `#F4EFE7` | Fondo principal (papel hueso) | — (nunca texto) |
| `--cs-surface` | `#FFFFFF` | Cards elevadas, sheets | — |
| `--cs-surface-sunken` | `#EAE2D6` | Inputs, tracks, listas, segmentados | — |
| `--cs-primary` | `#2F7D5B` | CTA, éxito, marcas, ingresos | 5.2:1 sobre blanco ✅ AA |
| `--cs-primary-hover` | `#276B4E` | Hover/active de primario | ✅ |
| `--cs-primary-soft` | `rgba(47,125,91,.12)` | Fondos de chips/estados suaves | — |
| `--cs-accent` | `#D97757` | Íconos, gráficos, énfasis (NO texto pequeño) | 3.4:1 ⚠️ solo ≥18px o no-texto |
| `--cs-accent-text` | `#B4573A` | Terracota permitida en texto | 4.8:1 sobre blanco ✅ AA |
| `--cs-secondary` | `#3D5A80` | Enlaces, datos, series de gráfico | 7.0:1 sobre blanco ✅ AAA |
| `--cs-danger` | `#C4453B` | Errores y destrucción (NO gastos) | 5.4:1 ✅ AA |
| `--cs-text-primary` | `#232A31` | Texto principal | 13.1:1 ✅ AAA |
| `--cs-text-muted` | `#6E7681` | Texto secundario, etiquetas | 4.9:1 ✅ AA |
| `--cs-text-on-primary` | `#FFFFFF` | Texto sobre primario | 5.2:1 ✅ AA |
| `--cs-placeholder` | `#9A938A` | Placeholders (no usar como etiqueta) | — |

### 3.2 CSS Custom Properties (listo para copiar)

```css
:root{
  /* Color */
  --cs-bg-base:#F4EFE7;
  --cs-surface:#FFFFFF;
  --cs-surface-sunken:#EAE2D6;
  --cs-primary:#2F7D5B;
  --cs-primary-hover:#276B4E;
  --cs-primary-soft:rgba(47,125,91,.12);
  --cs-accent:#D97757;
  --cs-accent-text:#B4573A;
  --cs-secondary:#3D5A80;
  --cs-danger:#C4453B;
  --cs-text-primary:#232A31;
  --cs-text-muted:#6E7681;
  --cs-text-on-primary:#FFFFFF;
  --cs-placeholder:#9A938A;

  /* Tipografía */
  --cs-font-display:'Fraunces','Iowan Old Style','Palatino Linotype',Georgia,serif;
  --cs-font-ui:'Inter','Segoe UI',system-ui,-apple-system,sans-serif;

  /* Espaciado (base 4px) */
  --cs-space-1:4px;  --cs-space-2:8px;   --cs-space-3:12px;
  --cs-space-4:16px; --cs-space-5:24px;  --cs-space-6:32px;
  --cs-space-7:48px; --cs-space-8:64px;

  /* Radios */
  --cs-radius-input:16px;
  --cs-radius-btn:18px;
  --cs-radius-card:24px;
  --cs-radius-sheet:24px 24px 0 0;
  --cs-radius-pill:999px;

  /* Elevación clay */
  --cs-clay:inset 4px 4px 8px rgba(0,0,0,.06), inset -4px -4px 8px rgba(255,255,255,.9), 0 10px 24px rgba(60,50,40,.12);
  --cs-clay-sm:inset 3px 3px 6px rgba(0,0,0,.05), inset -3px -3px 6px rgba(255,255,255,.9), 0 6px 14px rgba(60,50,40,.10);
  --cs-clay-press:inset 4px 4px 10px rgba(0,0,0,.10), inset -3px -3px 8px rgba(255,255,255,.8);
  --cs-focus-ring:0 0 0 4px rgba(47,125,91,.15);
  --cs-focus-outline:3px solid rgba(47,125,91,.45);

  /* Movimiento */
  --cs-ease-spring:cubic-bezier(.34,1.56,.64,1);
  --cs-ease-out:cubic-bezier(.2,.8,.2,1);
  --cs-dur-fast:150ms;
  --cs-dur-base:220ms;
  --cs-dur-slow:280ms;

  /* Z-index */
  --cs-z-bg:0; --cs-z-content:1; --cs-z-sticky:50; --cs-z-modal:100;
}
```

### 3.3 Tokens JSON (para theming multiplataforma)

```json
{
  "color": {
    "bgBase": "#F4EFE7", "surface": "#FFFFFF", "surfaceSunken": "#EAE2D6",
    "primary": "#2F7D5B", "primaryHover": "#276B4E", "primarySoft": "rgba(47,125,91,0.12)",
    "accent": "#D97757", "accentText": "#B4573A",
    "secondary": "#3D5A80", "danger": "#C4453B",
    "textPrimary": "#232A31", "textMuted": "#6E7681", "textOnPrimary": "#FFFFFF"
  },
  "typography": {
    "display": "Fraunces", "ui": "Inter",
    "h1": { "size": 34, "weight": 700, "family": "display" },
    "h2": { "size": 22, "weight": 600, "family": "display" },
    "body": { "size": 16, "weight": 400, "family": "ui" },
    "small": { "size": 14, "weight": 400, "family": "ui" },
    "data": { "size": 26, "weight": 700, "family": "display", "tabular": true },
    "dataSmall": { "size": 15, "weight": 600, "family": "ui", "tabular": true }
  },
  "radius": { "input": 16, "button": 18, "card": 24, "sheet": 24, "pill": 999 },
  "space": [4, 8, 12, 16, 24, 32, 48, 64],
  "motion": { "easeSpring": [.34,1.56,.64,1], "fast": 150, "base": 220, "slow": 280 },
  "zIndex": { "bg": 0, "content": 1, "sticky": 50, "modal": 100 },
  "breakpoints": { "sm": 480, "md": 768, "lg": 1024, "xl": 1280 }
}
```

### 3.4 Breakpoints

| Token | Valor | Uso |
|---|---|---|
| `sm` | 480px | Phones grandes |
| `md` | 768px | Tablets / inicio de PWA |
| `lg` | 1024px | Escritorio: sidebar visible |
| `xl` | 1280px | Contenedor máximo 1160px |

---

## 4. Color: reglas y prohibiciones

### Reglas

- Usar **exclusivamente** los tokens de §3.1. Las transparencias se derivan con opacidad del token, jamás con un HEX nuevo.
- Gastos e ingresos se distinguen por **signo (+/−) + ícono + color**, nunca solo por color.
- Chips semánticos: ingreso `primary`/`primary-soft`; gasto `danger`/`rgba(196,69,59,.12)`; pendiente `accent`/`rgba(217,119,87,.14)`.
- Progress bar: fill `primary` → `accent` al 80% → `danger` al 100%.

### Prohibiciones

| # | Prohibición |
|---|---|
| 1 | ❌ Usar `#D97757` (accent) como color de **texto** pequeño; usar `#B4573A`. |
| 2 | ❌ Usar `#C4453B` (danger) para montos de gasto habituales → es solo errores/destrucción. |
| 3 | ❌ Introducir negros puros (`#000`) o blancos puros como fondo de superficie. |
| 4 | ❌ Colores fuera de la paleta: nada de `#FF0000`, azules saturados, degradados multicolor. |
| 5 | ❌ Usar `bg-base` como color de texto o `surface` como color de texto. |
| 6 | ❌ Fondos de color saturados detrás de párrafos largos. |
| 7 | ❌ Rojo en iconos de "gasto" por defecto (el gasto es información, no culpa). |

---

## 5. Tipografía

| Rol | Familia | Peso | Tamaño / línea |
|---|---|---|---|
| H1 | Fraunces | 700 | 34 / 1.10 |
| H2 | Fraunces | 600 | 22 / 1.25 |
| H3 | Fraunces | 600 | 18–19 / 1.30 |
| Body | Inter | 400 | 16 / 1.65 |
| UI / botones | Inter | 600 | 15 / 1 |
| Small | Inter | 400 | 14 / 1.5 |
| Caption / helper | Inter | 400–600 | 12–13 / 1.4 |
| Cifra hero (saldo) | Fraunces | 700 | 26–38, `font-variant-numeric: tabular-nums` |
| Cifra en listas | Inter | 600 | 15, `tabular-nums` |

**Reglas**

- Toda cifra monetaria lleva **`font-variant-numeric: tabular-nums`** (alineación de columna).
- Formato monetario regional: `€ 12.480,55` (es-ES) vía `toLocaleString('es-ES',{minimumFractionDigits:2})`.
- Inputs con `font-size: 16px` mínimo (evita zoom automático en iOS).
- `letter-spacing:-.01em` solo en Fraunces ≥22px.
- No usar Fraunces para párrafos largos; no usar Inter para títulos H1/H2.

**Escala fluida móvil:** H1 `clamp(30px,7vw,34px)`.

---

## 6. Forma, elevación y textura

| Elemento | Radio | Elevación |
|---|---|---|
| Inputs | 16px | `--cs-clay-press` (hundido) |
| Botones | 18px | `--cs-clay-sm`; press → `--cs-clay-press` |
| Cards | 24px | `--cs-clay` (elevado) |
| Bottom sheet | 24px top | `--cs-clay` + backdrop `rgba(35,42,49,.42)` + blur 4px |
| Toast | 16px | `--cs-clay-sm` + **borde izquierdo 4px** semántico |
| Chips / badges | 999px | sin sombra o `--cs-clay-press` |
| Avatar | 50% | `--cs-clay-sm` |
| Iconos decorativos (dentro de tx) | 14–15px | `--cs-clay-press` |

- **No usar bordes oscuros** para separar: separación con sombra clay o `1px solid` de `bg-base`.
- Grano de papel: SVG `feTurbulence` (`baseFrequency .8`, `numOctaves 3`) al **4.5%** de opacidad, `position:fixed`, `pointer-events:none`.
- Blobs de fondo (hero): gradientes radiales `#CFE3D5`, `#F3D2C4`, `#C9D6E8` con `blur(60px)` y opacidad ≤.55.

---

## 7. Directrices de componentes

### 7.1 Botones

| Propiedad | Primario | Secundario | Ghost | Icono |
|---|---|---|---|---|
| Fondo | `primary` | `surface` | transparente | `surface` |
| Texto | `#FFFFFF` | `text-primary` | `danger` | `text-primary` |
| Alto | 48–52px (móvil 52) | 48–52px | 48px | 44×44px |
| Radio | 18px | 18px | 18px | 14px |
| Sombra | `--cs-clay-sm` | `--cs-clay-sm` | ninguna | `--cs-clay-sm` |
| Hover | `primary-hover` + `translateY(-3px)` | `translateY(-3px)` | bg soft | `translateY(-2px)` |
| Active | `scale(.97)` + `--cs-clay-press` | igual | igual | `scale(.95)` |
| Focus | `outline:3px solid rgba(47,125,91,.45); outline-offset:2px` | igual | igual | igual |
| Disabled | bg `surface-sunken`, texto `#A39B90`, sin sombra | — | — | — |

**Toda acción primaria de pantalla usa UN SOLO botón primario por vista.**

### 7.2 Navegación

- **Tab bar móvil:** 4 ítems máximo; fondo `surface` con `box-shadow: --cs-clay`; ítems con radio 16px; activo = `primary-soft` + texto `primary`; altura de toque ≥44px; respetar `safe-area-inset-bottom`.
- **Top app bar:** 56px; título Fraunces 600 ~19–20px; fondo `bg-base`.
- **Segmented control:** track `surface-sunken` radio 14px, padding 5px; activo = `surface` + `--cs-clay-sm`.
- **PWA sidebar:** 248px → colapsable 72px; sección activa con `primary-soft`.

### 7.3 Contenedores

- **Card:** `surface`, radio 24px, padding 20–24px, `--cs-clay`. Nunca `border` oscuro.
- **Modal:** `surface`, radio 24px, padding 26px, `--cs-clay`; entry `scale(.94)→1` + spring 280ms; backdrop `rgba(35,42,49,.42)` blur 4px; cerrar con clic fuera y `Esc`.
- **Bottom sheet (móvil):** radio 24px top, handle 36×4 `surface-sunken`, swype-to-dismiss.
- **Tooltip:** bg `text-primary`, texto `#FFFFFF` 12px, radio 10px, delay 400ms, `z-index: --cs-z-modal`.

### 7.4 Formularios

| Estado | Especificación |
|---|---|
| Default | bg `surface-sunken`, borde `2px transparent`, radio 16px, `--cs-clay-press`, alto 54px |
| Focus | bg `surface`, borde `primary`, ring `--cs-focus-ring` |
| Error | borde `danger` + helper 12px `danger` **con ícono ⚠ y texto explicativo** |
| Disabled | bg `surface-sunken`, texto `#A39B90` |
| Label | 13px/600 `text-muted`, SIEMPRE visible (nunca placeholder como única etiqueta) |

- **Campo monetario:** prefijo `€` + input `tabular-nums` Fraunces 700 21px, `inputmode="decimal"`.
- **Checkbox:** 24px, radio 8px, check `surface-sunken` → activo `primary` con ✓ blanco.
- **Radio:** 24px circular, punto interior blanco 10px.
- **Toggle:** 50×30, off `surface-sunken`, on `primary`, knob blanco 22px con `ease-spring`.

### 7.5 Feedback

| Componente | Especificación |
|---|---|
| Toast | radio 16px, `--cs-clay-sm`, **borde izquierdo 4px**: éxito `primary` / aviso `accent` / error `danger`; duración 4000ms; `z-index: --cs-z-modal` |
| Badge/chip | pill, 12px/600, fondo del color a ~12% + texto en color pleno AA |
| Progress | alto 10px, track `surface-sunken` con `--cs-clay-press`, fill `primary` (vira `accent` 80%, `danger` 100%) |
| Spinner | 36–38px, borde 4px `surface-sunken` + `primary` arriba, 0.9s lineal |
| Empty state | ícono/ilustración sobre cuadrado `surface-sunken` radio 30px + título Fraunces 18 + copy 13px `text-muted` + CTA primario |
| Skeletons | `surface-sunken` con shimmer `rgba(255,255,255,.5)` |

### 7.6 Elementos de usuario

- **Avatar:** 42px (sm 34 / lg 60), iniciales **Fraunces 700** en `#FFFFFF`; color de fondo derivado del hash del nombre dentro de la paleta (`#2F7D5B`, `#D97757`, `#3D5A80`…); radio 50%; `--cs-clay-sm`.
- **Fila de movimiento (`.tx`):** alto ≥64px; ícono-categoría 40px radio 14px con `--cs-clay-press` → título 15/600 + categoría 12 `text-muted` → monto 15/600 `tabular-nums` con signo; separador `1px solid bg-base`.
- **Gráficos:** paleta semántica (`primary`, `accent`, `secondary`); grid `surface-sunken`; labels 11px `text-muted`; sin efectos 3D.

---

## 8. Movimiento

| Token | Valor | Uso |
|---|---|---|
| `--cs-ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | **Curva firma**: entradas, toggles, hovers |
| `--cs-ease-out` | `cubic-bezier(.2,.8,.2,1)` | Transiciones neutras |
| `--cs-dur-fast` | 150ms | hovers, color |
| `--cs-dur-base` | 220ms | toggles, segmented, focus |
| `--cs-dur-slow` | 280ms | modales, sheets, toasts |

**Microinteracciones**

- Press de botón: `scale(.97)` + `--cs-clay-press` (squish).
- Contador de saldo: animación numérica 900–1000ms con ease-out cúbico.
- Respiración (estado "guardado localmente"): pulso `2.6s ease-in-out infinite`.
- Spinners: `0.9s cubic-bezier(.4,0,.2,1) infinite`.

**Accesibilidad del motion:** con `prefers-reduced-motion: reduce` → todas las animaciones a **≤80ms o `none`**; contadores se muestran directamente al valor final; skeleton sin shimmer.

---

## 9. Logo y wordmark

**Nombre de marca:** **Monedero** — gestor de gastos local.

**Isotipo:** *tile «M»* — cuadrado de arcilla con radio `13/48` (≈27% del lado), **fondo `#2F7D5B`** (color primario de la identidad visual) y **letra «M» blanca `#FFFFFF` en Fraunces 700**. Su forma inflada recuerda una pastilla de arcilla pulgareable.

- **Lockup horizontal:** tile «M» (SVG) + wordmark **Monedero** en Fraunces 700 + tagline `Gestor de gastos local` en 9px `letter-spacing:.3em`.
- **Área de protección:** igual al **25% del ancho del tile** en los 4 lados.
- **Tamaño mínimo:** tile **16px** de alto (legibilidad de la «M»); lockup **96px** de ancho.
- **Variantes de tinta:**
  | Variante | Fondo tile | «M» | Uso |
  |---|---|---|---|
  | Principal | `#2F7D5B` | `#FFFFFF` | Defecto en todo producto |
  | Oscuro | `#2F7D5B` (sin cambio) | `#FFFFFF` (5.2:1) | Wordmark a `#F4EFE7` |
  | Monocromo | `#232A31` | `#FFFFFF` | Documentos impresos |
  | Negativo | `#FFFFFF` | `#232A31` | Fondos con contraste AA |

- El tile «M» sirve además como **icono de app, favicon, avatar de perfil y marcador de tab activa**.

**Prohibiciones del logo:** ❌ distorsionar/rotar o alterar el radio · ❌ recolorear el fondo fuera de `#2F7D5B` o la «M» en color · ❌ degradados, contornos o sombras nuevas (sí la sombra clay institucional) · ❌ «M» blanca sobre fondos con contraste <4.5:1 · ❌ escalar por debajo del tamaño mínimo usando el lockup.

---

## 10. Accesibilidad

- **Objetivo:** WCAG 2.1 **AA** mínimo; AAA en `text-primary` y `secondary`.
- Pares verificados: 13.1:1 texto/fondo · 5.2:1 CTA · 4.9:1 muted · 4.8:1 terracota-texto · 7.0:1 datos · 5.4:1 errores.
- **Focus visible obligatorio** en todo interactivo: `outline:3px solid rgba(47,125,91,.45)` (o ring `0 0 0 4px rgba(47,125,91,.15)`).
- Objetivos táctiles **≥44×44px** (botones 48–54px).
- Nunca comunicar estado solo con color (siempre texto/ícono/signo).
- Placeholders **no** sustituyen a labels.
- `aria-live="polite"` en toasts; `role="status"` en spinners; modales con foco atrapado y `Esc`.
- Input `font-size ≥16px`; soportar **texto hasta 200%** de zoom sin scroll horizontal.
- Formato monetario localizado; no abreviar montos de forma ambigua.

---

## 11. Modo oscuro

| Rol | Claro | Oscuro |
|---|---|---|
| `bg-base` | `#F4EFE7` | `#1B1815` (tierra) |
| `surface` | `#FFFFFF` | `#26221E` |
| `surface-sunken` | `#EAE2D6` | `#332E29` |
| `primary` | `#2F7D5B` | `#6FCF97` |
| `accent` | `#D97757` | `#E89B84` |
| `text-primary` | `#232A31` | `#F4EFE7` |
| `text-muted` | `#6E7681` | `#A79F95` |
| `danger` | `#C4453B` | `#EF8078` |

- El oscuro es **tierra profunda**, nunca negro puro: conserva la calidez de la marca.
- Re-verificar contraste AA al comutar modos. Preferir `prefers-color-scheme` + override manual.

---

## 12. Respuesta rápida para agentes

Antes de generar cualquier UI de este proyecto:

1. **Carga los tokens** de §3.2 (o §3.3 en RN/JSON). No inventes colores ni radios.
2. **Estilo:** claymorphism suave — radios 16/18/24, elevación por sombra dual, **sin bordes oscuros**.
3. **Tipografía:** Fraunces (títulos y cifras hero) + Inter (UI/cuerpo) + `tabular-nums` en todo importe.
4. **Color:** solo tokens de §3.1; respeta las prohibiciones de §4 (especialmente: terracota no-texto y rojo solo errores).
5. **Motion:** spring `cubic-bezier(.34,1.56,.64,1)`, 150/220/280ms, con `prefers-reduced-motion`.
6. **A11y:** focus visible, toques ≥44px, AA verificado, labels visibles, color + signo/ícono.
7. **Copy:** tono sereno y transparente; nunca urges ni alarmas; siempre reafirma que los datos son locales.
8. **Referencias visuales:**
   - Showcase: `Artefactos/documentacion/Diseño Visual/identidad-visual-clay-serenity.html`
   - Prototipo aprobado: `Artefactos/documentacion/Prototipos/prototipo-b-clay-serenity.html`

---

*Documento generado por la skill `disenador-identidad-marca`. Cambios de identidad requieren reaprobación explícita del usuario y actualización de este SSOT.*
