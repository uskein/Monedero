/**
 * Motor sql.js para React Native — build ASM.JS (JS puro, 100 % compatible
 * con Metro/Expo Go). El build sql-wasm.js exige node:fs y un .wasm que
 * Metro no puede resolver (ADR-003: el repo dev móvil vive en memoria hasta
 * el dev-build con SQLCipher). Jest usa el MISMO build vía moduleNameMapper
 * ('^sql\.js$' → sql-asm.js): lo probado es lo que corre en el dispositivo.
 */
// sql-asm.js: build JS puro sin WASM; los tipos reutilizan los de 'sql.js'.
import initSqlJsAsm from 'sql.js/dist/sql-asm.js';
import type initSqlJsType from 'sql.js';

const initSqlJs = initSqlJsAsm as unknown as typeof initSqlJsType;
export default initSqlJs;
