/**
 * @monedero/export-contract — único punto de acoplamiento entre apps (ADR-002).
 * TS puro, 0 dependencias de UI.
 */
export { FORMAT_VERSION } from './types';
export type { MonederoFile, MonederoCollection, ImportSummary } from './types';
export { MonederoFileSchema } from './schemas';
export type { MonederoFileInput } from './schemas';
export { canonicalize } from './hash';
export { migrate } from './migrations';
export type { FormatVersion } from './migrations';
