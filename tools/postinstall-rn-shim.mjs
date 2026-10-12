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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
      '// Réplica FIEL del rn-get-polyfills.js oficial (pre-0.87): re-exporta',
      '// @react-native/js-polyfills (console + error-guard). RN 0.87 eliminó el',
      '// archivo pero @expo/metro-config@57 lo sigue exigiendo al fusionar el',
      '// metro.config.js de usuario; devolver [] hereje dejaba el bundle SIN el',
      '// preludio de error-guard y el arranque moría con',
      '// "Cannot read property setGlobalHandler of undefined".',
      "module.exports = require('@react-native/js-polyfills');",
      '',
    ].join('\n'),
  );
  console.log('[postinstall] shim rn-get-polyfills.js instalado en react-native.');
}

// Además el "exports" de react-native debe exponer la subruta: Node/Metro
// rechazan require('react-native/rn-get-polyfills') si no está declarada
// (ERR_PACKAGE_PATH_NOT_EXPORTED), aunque el archivo exista.
const pkgPath = rnPkgJson;
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
if (pkg.exports && !('./rn-get-polyfills' in pkg.exports)) {
  pkg.exports['./rn-get-polyfills.js'] = './rn-get-polyfills.js';
  pkg.exports['./rn-get-polyfills'] = './rn-get-polyfills.js';
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[postinstall] exports ./rn-get-polyfills añadido a react-native.');
}
