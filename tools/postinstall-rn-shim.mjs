/**
 * Postinstall — shim de react-native/rn-get-polyfills.
 *
 * @expo/metro-config@57 invoca react-native/rn-get-polyfills al fusionar
 * (mergeConfig) un metro.config.js de usuario, pero React Native 0.87 eliminó
 * ese archivo del paquete (RN 0.8x se auto-polyfila desde InitializeCore).
 * Sin el shim, `expo start` muere con "Cannot find module rn-get-polyfills".
 * Este script lo reescribe tras cada `pnpm install` (idempotente).
 * Alternativa intentada: `pnpm patch` — falla en Windows por límites de ruta.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const rnPkgJson = require.resolve('react-native/package.json');
const target = join(dirname(rnPkgJson), 'rn-get-polyfills.js');

if (!existsSync(target)) {
  writeFileSync(
    target,
    [
      '// Shim AUTO-GENERADO por tools/postinstall-rn-shim.mjs — NO editar.',
      '// RN 0.87 eliminó rn-get-polyfills; @expo/metro-config@57 aún lo exige',
      '// al fusionar metro.config.js de usuario. Lista vacía = comportamiento',
      '// por defecto de Metro (RN se auto-polyfila desde InitializeCore).',
      'module.exports = () => [];',
      '',
    ].join('\n'),
  );
  console.log('[postinstall] shim rn-get-polyfills.js instalado en react-native.');
}
