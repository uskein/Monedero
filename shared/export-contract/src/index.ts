/**
 * @monedero/export-contract — único punto de acoplamiento entre apps (ADR-002).
 * TS puro, 0 dependencias de UI. S7: núcleo completo del fichero
 * .monedero/.monedero.enc (build · integrity · envelope · merge LWW).
 */
export { FORMAT_VERSION } from './types';
export type { MonederoFile, MonederoCollection, ImportSummary } from './types';
export { MonederoFileSchema } from './schemas';
export type { MonederoFileInput } from './schemas';
export { canonicalize } from './hash';
export { migrate } from './migrations';
export type { FormatVersion } from './migrations';
export { bytesToBase64, base64ToBytes } from './base64';
export { encodeUtf8, decodeUtf8 } from './utf8';
export {
  EXPORT_ORDER,
  buildMonederoFile,
  verifyMonederoIntegrity,
  parseMonederoFileJson,
  type Sha256Hex,
} from './file';
export {
  ENVELOPE_MAGIC,
  FILE_KDF_ITERATIONS,
  encryptToEnvelope,
  openEnvelope,
  type EncryptedEnvelope,
  type FileCrypto,
} from './envelope';
export { parseMonederoInput, isEncryptedEnvelope, type ParsedMonederoInput } from './parse';
export { planMerge, planReplace, type MergePlan, type DbRow } from './merge';
