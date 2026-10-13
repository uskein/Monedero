/**
 * DevEngine — contrato del MOTOR de la BD de sesión (hexagonal).
 * El motor es la ÚNICA pieza que cambia entre entornos:
 *  - runtime móvil: sqliteEngine (expo-sqlite nativo, en memoria);
 *  - jest: motor sql.js (tests/helpers/engineSqlJs.ts vía moduleNameMapper).
 * La fábrica createDevRepository, los repos y la UI no conocen el motor.
 */
import type { SqlDbPort } from './SqlDbPort';

export interface DevDatabase extends SqlDbPort {
  /** Ejecuta un script SQL multi-sentencia (DDL de migraciones). */
  execScript(sql: string): Promise<void>;
  /** Serializa TODA la BD a bytes (fuente del snapshot cifrado). */
  exportBytes(): Promise<Uint8Array>;
  /** Cierra la conexión (best-effort). */
  close(): Promise<void>;
}

export interface DevEngine {
  /** Abre la BD: hidratada desde `fromBytes` (snapshot) o vacía si es null. */
  open(fromBytes: Uint8Array | null): Promise<DevDatabase>;
}
