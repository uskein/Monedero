/**
 * Motor sql.js — build ASM.JS (JS puro). SOLO TESTS/JEST desde la migración
 * D1/ADR-008: el runtime corre expo-sqlite (SQLite nativo, BD en memoria) y
 * la suite ejercita el MISMO DevEngine con este build vía
 * tests/helpers/engineSqlJs.ts. El build sql-wasm.js exige node:fs y un .wasm
 * que Metro no resuelve sin stubs; el asm.js es 100 % JS puro (probado aquí).
 * Jest mapeia '^sql\.js$' → sql-asm.js (moduleNameMapper).
 */
// sql-asm.js: build JS puro sin WASM; los tipos reutilizan los de 'sql.js'.
import initSqlJsAsm from 'sql.js/dist/sql-asm.js';
import type initSqlJsType from 'sql.js';

const initSqlJs = initSqlJsAsm as unknown as typeof initSqlJsType;
export default initSqlJs;
