/**
 * Metro config — stubs de builtins Node para sql.js (ADR-003, repo dev).
 * Los builds sql-asm.js / sql-wasm.js require ESTÁTICAMENTE node:fs y
 * node:crypto en su rama Node (solo se ejecuta cuando corre en Node); en
 * React Native esa rama nunca se ejecuta, pero Metro resuelve todos los
 * require al compilar y falla con "Node standard library" errors.
 * Este resolver devuelve un módulo vacío para esos IDs y delega el resto
 * en el resolver por defecto de Expo.
 */
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const STUB = path.resolve(__dirname, 'stubs/node-stub.js');
const NODE_BUILTINS = new Set([
  'fs',
  'crypto',
  'path',
  'os',
  'module',
  'node:fs',
  'node:crypto',
  'node:path',
  'node:os',
  'node:module',
]);

const previousResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (NODE_BUILTINS.has(moduleName)) {
    return { type: 'sourceFile', filePath: STUB };
  }
  return (previousResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
