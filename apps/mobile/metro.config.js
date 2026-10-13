/**
 * Metro config — Expo por defecto.
 * Historial: aquí vivían stubs de builtins Node (fs/crypto/path/...) para el
 * build asm.js de sql.js (ADR-003). Con la migración a expo-sqlite (D1) el
 * runtime ya NO empaqueta sql-asm.js, así que los stubs se retiraron.
 */
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
