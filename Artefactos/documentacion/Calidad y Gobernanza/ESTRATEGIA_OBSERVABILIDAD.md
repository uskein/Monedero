# Estrategia de Observabilidad — Monedero

> **Fase A · Paso A.4** · **Adaptación deliberada al ADR-001.** La skill por defecto propone Sentry/LogRocket/Slack:
> contradictorios con «100% offline, cero telemetría». Esta estrategia reemplaza la telemetría en la nube por
> **observabilidad local soberana**. Requiere aprobación explícita del usuario (registrada en `LOG_AUDITORIA.md`).

---

## 1. Principios

1. **Cero red en producción.** Ningún evento, métrica o error sale del dispositivo. Sin excepciones.
2. **Cero PII en logs.** Nunca se registran importes, conceptos, passphrases, saldos ni nombres de categoría.
3. **Bajo demanda y por el usuario:** el usuario exporta un diagnóstico si decide compartirlo (pilar Soberanía).

## 2. Logger estructurado local

- Módulo único `packages/telemetry-local` (móvil: ring buffer en memoria + archivo cifrado; PWA: `localStorage` con retención limitada).
- Formato **JSON** por evento, campos obligatorios:

```json
{
  "ts": "2026-10-11T14:03:22.101Z",
  "level": "ERROR",
  "traceId": "uuid-op-actual",
  "app": "monedero-pwa",
  "version": "1.4.0",
  "screen": "movimientos/nuevo",
  "event": "tx.create.failed",
  "code": "VALIDATION_FAILED"
}
```

- **Niveles:** `DEBUG` (solo dev builds) · `INFO` · `WARN` · `ERROR`.
- **Prohibido:** montos, texto de usuario, rutas de archivo del SO, passphrases, claves, hash de bóveda.
- Rotación: máx 500 KB en disco; retención 14 días; borrado automático.

## 3. Error tracking local

- Captura global de excepciones no controladas (JS global handler + `ErrorBoundary` + `NativeExceptionHandler`).
- Se persiste el **último stack** en el ring buffer (sin datos de negocio).
- Pantalla «Diagnóstico» (Ajustes → Acerca de): lista de errores recientes con opción **Exportar diagnóstico** (fichero `.log.json` cifrado) — el usuario decide si lo comparte.

## 4. Métricas de rendimiento locales

- **PWA:** Web Vitals (LCP/INP/CLS) capturados con `web-vitals` y almacenados en buffer local; visibles en Diagnóstico. Sin envío externo.
- **Móvil:** TTFT de la bóveda, tiempo de derivación PBKDF2, duración de `addTransaction`, fps percibido en listas largas (marcas `performance.now()`).
- Presupuestos de rendimiento (gate E2E): arranque a dashboard < 1,5 s · alta de movimiento < 300 ms · listado 1.000 filas sin dropped frames > 16 ms.

## 5. Logs de auditoría de datos (no de usuario)

- Operaciones destructivas (wipe, reemplazar import, migración) escriben un registro local inmutable en `import_log` / log estructurado (qué, cuándo, resultado — nunca qué datos).

## 6. Alertas (adaptación local)

- No hay alertas push/Slack (sin red). Las «alertas» son **in-app**:
  - Toast de `budget:exceeded` (producto).
  - Aviso en Diagnóstico si el ring buffer acumuló ≥3 errores `ERROR` en 24 h («Exporta un diagnóstico si el problema persiste»).
- Durante desarrollo: consola + DevTools con nivel DEBUG; CI falla con `lint` de `console.*` en código de producto.

## 7. Entornos

| Entorno | Nivel log | Export diagnóstico | Red |
|---------|-----------|--------------------|-----|
| Dev / QA builds | DEBUG | Sí | Solo HMR local |
| Producción | INFO+ | Sí (usuario decidido) | **Cero** |

- Verificación E2E: test `no-network.spec` que **falla el build si hay cualquier intento de fetch/XHR** a dominio externo en producción.

## 8. Lo que queda prohibido explícitamente

- Sentry, LogRocket, Datadog, Analytics, crash reporters en la nube.
- Cookies/identificadores de dispositivo con fin analítico.
- Cualquier SDK de terceros que realice red (los únicos deps permitidos son las del runtime de Expo/React).
