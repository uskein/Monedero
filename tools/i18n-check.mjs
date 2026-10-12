#!/usr/bin/env node
/**
 * i18n-check.mjs — Gate de CI (MANIFIESTO_CALIDAD gates: i18n).
 * 1) Paridad de claves es-CO ↔ en-US
 * 2) Strings hardcodeados sospechosos en JSX de producto (fuera de archivos exentos)
 * Sale con código != 0 si falla.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`  ❌ ${msg}`);
};
const ok = (msg) => console.log(`  ✅ ${msg}`);

console.log('\n🌍 i18n:check — es-CO ↔ en-US + cero strings hardcodeados\n');

// ── 1) Paridad de diccionarios ──
const esc = readFileSync(join(root, 'shared/i18n/src/locales/es-CO.ts'), 'utf8');
const en = readFileSync(join(root, 'shared/i18n/src/locales/en-US.ts'), 'utf8');
const keyRe = /^\s{2}'([\w.]+)':/gm;
const keysOf = (src) => [...src.matchAll(keyRe)].map((m) => m[1]);
const esKeys = keysOf(esc);
const enKeys = new Set(keysOf(en));

if (esKeys.length === 0) fail('no se extrajeron claves de es-CO.ts');
const missing = esKeys.filter((k) => !enKeys.has(k));
const extra = [...enKeys].filter((k) => !esKeys.includes(k));
if (missing.length) fail(`en-US carece de claves: ${missing.join(', ')}`);
if (extra.length) fail(`en-US tiene claves extra: ${extra.join(', ')}`);
if (!missing.length && !extra.length && esKeys.length > 0) {
  ok(`Paridad de diccionarios: ${esKeys.length} claves en ambos idiomas`);
}

// ── 2) Strings hardcodeados en JSX de producto ──
// Patrón: > texto visible < con ≥2 palabras y letras dentro de un tag JSX.
const EXEMPT_DIRS = ['shared/i18n', 'shared/tools', 'Artefactos', 'node_modules'];
const EXEMPT_FILES = ['Showcase.tsx', 'tests/', '.test.', '.d.ts'];
const JSX_TEXT = />([^<>{}\n]*\b[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}\s+[A-Za-zÁÉÍÓÚÑáéíóúñ]{3,}[^<>{}\n]*)</g;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === '.git') continue;
      walk(full, out);
    } else if (/\.(tsx|jsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const offenders = [];
for (const file of walk(join(root, 'apps'))) {
  const rel = relative(root, file).replaceAll('\\', '/');
  if (EXEMPT_DIRS.some((d) => rel.startsWith(d))) continue;
  if (EXEMPT_FILES.some((f) => rel.includes(f))) continue;
  const src = readFileSync(file, 'utf8');
  for (const match of src.matchAll(JSX_TEXT)) {
    const text = match[1].trim();
    // Heurística: frases de UI (2+ palabras, sin código ni emojis)
    if (/^[A-Za-zÁÉÍÓÚÑáéíóúñ]+ [A-Za-zÁÉÍÓÚÑáéíóúñ].*/.test(text) && !/^(div|span|p|h[1-6]|section|main|button)$/i.test(text)) {
      offenders.push(`${rel}: "${text.slice(0, 60)}"`);
    }
  }
}

if (offenders.length) {
  for (const o of offenders.slice(0, 10)) fail(`string hardcodeado en JSX: ${o}`);
  if (offenders.length > 10) fail(`…y ${offenders.length - 10} más`);
} else {
  ok('Cero strings hardcodeados en JSX de producto (todo pasa por t())');
}

if (failures === 0) {
  console.log('\n✅ i18n:check PASSED\n');
  process.exit(0);
} else {
  console.error(`\n❌ i18n:check FAILED (${failures} incidencia(s))\n`);
  process.exit(1);
}
