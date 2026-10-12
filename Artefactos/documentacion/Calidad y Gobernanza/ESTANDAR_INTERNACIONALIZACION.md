# Estándar de Internacionalización (i18n) y Localización (l10n) — Monedero

> **Fase A · Paso A.2** · Reglas inquebrantables. La **Regla de Oro i18n** (cero strings hardcodeados) es no negociable.

---

## 1. Idiomas base

| Idioma | Código | Rol |
|--------|--------|-----|
| Español (Colombia) | `es-CO` | **Idioma por defecto y SSOT de traducción** (marca Monedero, mercado inicial) |
| Inglés (US) | `en-US` | Idioma objetivo secundario (fase 1) |

- Fallback obligatorio: `en-US` → `es-CO` → clave visible en dev / «—» en prod con log de alerta.
- Nuevos idiomas entran solo con su diccionario ≥95% completo (gate `i18n:check`).

## 2. Estructura de diccionarios

- Formato: **JSON** plano anidado por dominio, uno por idioma:
  - `packages/i18n/src/locales/es-CO.json`
  - `packages/i18n/src/locales/en-US.json`
- Convención de claves: `<dominio>.<pantalla>.<elemento>.<variante>` en **kebab-case**:

```json
{
  "common": { "actions": { "save": "Guardar", "cancel": "Cancelar" } },
  "home": { "balance": { "totalLabel": "Balance total", "monthDelta": "Este mes" } },
  "tx": { "form": { "amountLabel": "Importe", "submitDisabledHint": "Completa el importe" } },
  "errors": { "validation_failed": "Revisa el campo señalado" }
}
```

- **Códigos de dominio de error** (`CONTRATOS_API.md`) tienen su entrada obligatoria en `errors.*` — el usuario nunca ve el código crudo en prod (se loguea, se muestra el mensaje).

## 3. Plurales, fechas y montos

| Concern | Solución | Regla |
|---------|----------|-------|
| Plurales | `i18next` (Intl.PluralRules) | Claves `_one` / `_other` (y `_few/_many` cuando el idioma lo exija) |
| Fechas | `Intl.DateTimeFormat` | Siempre relativas en listas («Hoy», «Ayer») vía claves; absolutas solo en detalle (`d MMM yyyy`) |
| **Montos** | `Intl.NumberFormat` | **Un único módulo** `formatMoney(amountCents, currency, locale)` en `shared/money` — prohibido `toLocaleString` disperso |
| Reglas moneda | ver HU-18 | COP 0 decimales de presentación; USD/EUR 2 decimales; `amount_cents` siempre entero |

- El locale activo deriva del SO, con override en Ajustes.
- El formato de moneda **no depende del idioma** sino de la moneda de la cuenta (`accounts.currency`).

## 4. Regla de Oro i18n (no negociable)

1. **Prohibición absoluta** de strings visibles hardcodeados en `apps/` y `packages/`. Todo texto pasa por `t('clave')`.
2. Exentos (por diseño): literales técnicos no localizables — códigos de moneda ISO, `.monedero`, UUID — y **unit tests/fixtures**.
3. Los showcases HTML de `Artefactos/` son **documentación estática**, no producto; se marcan `data-i18n="off"` conceptualmente. Su contenido se localiza solo si se convierten en producto.
4. El ESLint trae la regla `no-restricted-syntax` + plugin `i18next` para detectar JSX text literal; el gate `lint` falla el PR.
5. `i18n:check` en CI: claves huérfanas, claves ausentes por idioma, y **test de estrés de expansión**.

## 5. Test de expansión de texto (obligatorio por HU)

> «Funciona con textos 30% más largos» (ej. `de-DE` simulado).

- Suite `test:i18n-expansion` que renderiza componentes con un diccionario `de-DE` simulado (+30%) y verifica **sin desbordes** (sin `text-overflow: ellipsis` en CTAs ni truncado de cifras).
- Los montos usan `tabular-nums` y contenedores flex para no romperse con cifras grandes (`$ 12.480.550`).

## 6. Archivos de traducción en el pipeline

- CI falla si un PR toca UI sin actualizar/crear claves (`i18n:check` + diff de claves).
- No se usa servicio de TMS en la nube (ADR-001): la revisión de idiomas es **humana en repo**.
