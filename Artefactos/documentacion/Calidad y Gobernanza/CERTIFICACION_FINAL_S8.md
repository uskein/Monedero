# Certificación final — S8 (M5 · Pulido, i18n, a11y y release)

> **Fecha:** 2026-10-13 · **Gate:** 🎯 Hito final
> **Estado: ✅ CERTIFICADO — aprobado por el usuario (2026-10-13).** Los ítems manuales de §5 se validaron en dispositivo por el usuario junto con la aprobación.
> Sprint del plan: [`PLAN_DE_SPRINTS.md`](../Orquestador/PLAN_DE_SPRINTS.md) · Estándares: [`MANIFIESTO_CALIDAD.html`](MANIFIESTO_CALIDAD.html)

## 1. Evidencia automatizada (última batería completa)

| Compuerta | Resultado |
|---|---|
| Tests móvil (Jest + RNTL) | ✅ **196/196** (24 suites) |
| Tests PWA (Vitest 4 + Testing Library) | ✅ **226/226** (24 archivos) |
| Tests shared (db · i18n · export-contract) | ✅ verdes (contrato `.monedero` 27 núcleo + 6 móvil + 3 web con cripto real) |
| Typecheck (TS strict, monorepo) | ✅ 6/6 tareas |
| Lint (ESLint) | ✅ 2/2 tareas |
| `tokens:check` (SSOT `--cs-*`, cero hex en UI) | ✅ |
| `i18n:check` (paridad es-CO ⇄ en-US) | ✅ |
| `contract:check` (ADR-002 sincronizado) | ✅ |
| a11y axe-core WCAG 2.1 AA | ✅ design system + **app real** (onboarding · app desbloqueada · ajustes) — 3/3 sin violaciones |
| Audit | ✅ **0 críticos** (antes: 2 críticos RCE en tinypool). Gate = prod-critical; 2 altos + 2 moderados SIN parche upstream quedan como deuda (toolchain build-time de Expo: node-forge/braces/sprintf-js/uuid — cero llegada al bundle de usuario) |
| Bundle móvil (Metro, Android) | ✅ HTTP 200 verificado en dispositivo |

## 2. Entregado en S8

- **8.1** Barrido i18n: logo a11y por clave (`brand.logo.label`); cero strings hardcodeados en app (Showcase = storybook dev).
- **8.2** axe-core sobre la app completa (3 estados raíz). Voz manual (VoiceOver/TalkBack) → checklist del usuario.
- **8.3** Lista de movientos con **ventana incremental** (30 + «Cargar más»); reduced-motion verificado en ambas apps; **service worker offline-first** para la PWA (faltaba para la independencia total).
- **8.4** CI/CD: `pr.yml` (gates en cada PR) + `release.yml` (tag `v*` → Cloudflare Pages + EAS Build/Submit).
- **8.5** `README.md` + `CONTRIBUTING.md` (reglas innegociables).
- **8.6** Seguridad: vitest 4.1.11 + tinypool 2.1.2 (CVEs críticas cerradas).

## 3. Deuda técnica conocida (honesto y trazable)

| # | Deuda | Impacto | Cuándo se resuelve |
|---|---|---|---|
| D1 | ~~SQLCipher nativo~~ **Motor ejecutado (ADR-008)**: la sesión corre sobre expo-sqlite NATIVO en memoria + snapshot AES-256-GCM (cero plaintext en reposo). Falta el cifrado del fichero a nivel de fichero (SQLCipher) | Bajo — cifrado real ya activo vía snapshot | Dev-build EAS |
| D2 | PWA sin la capa S6 (tema claro/oscuro, moneda global, reportes, zona de peligro) — entregada solo en móvil | Medio — paridad de features | Siguiente sprint de paridad |
| D3 | Coverage ≥80% sin auditar en cada iteración (CI ya ejecuta `--coverage`) | Bajo | Revisión tras primer CI en verde |
| D4 | Advisories sin parche upstream en toolchain Expo (2 high + 2 moderate) | Nulo en producción | Cuando Expo actualice transitive deps |
| D5 | Skeletons shimmer (hoy: BusyIndicator con identidad de marca) | Cosmético | Mejora futura |
| D6 | Secrets de CI/CD sin configurar en GitHub (ver §4) | Bloquea release automático | Acción del usuario |

## 4. Checklist de despliegue (acciones del usuario)

- [ ] GitHub → Settings → Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `EXPO_TOKEN`
- [ ] Cloudflare: crear Pages project `monedero` (producción)
- [ ] `apps/mobile`: `npx eas init` (EAS_PROJECT_ID) + `npx eas credentials` (App Store Connect .p8 / Play service account)
- [ ] Etiqueta `v1.0.0` → `release.yml` despliega PWA + dispara EAS

## 5. Certificación manual pendiente (usuario)

- [ ] VoiceOver (iOS) / TalkBack (Android): recorrer Inicio · Movimientos · Presupuestos · Reportes · Ajustes
- [ ] Arranque en frío < 1,5 s en dispositivo real (hoy: BusyIndicator durante bóveda + hidratación expo-sqlite)
- [ ] PWA offline: instalarla, cerrar la red, recargar (service worker)
- [ ] Smoke final: alta → presupuesto → reporte → export `.monedero` → import en la otra plataforma (F5 ya aprobado)
