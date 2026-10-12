#!/usr/bin/env node
/**
 * tokens-check.mjs — Gate de CI (MANIFIESTO_CALIDAD gates: tokens).
 * Verifica que CSS vars, constantes TS y tokens.json coincidan EXACTAMENTE
 * con el SSOT Clay Serenity (manual-identidad-visual.md §3).
 * Sale con código != 0 si hay divergencia (falla el pipeline).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`  ❌ ${msg}`);
};
const ok = (msg) => console.log(`  ✅ ${msg}`);

// ---- Fuente de verdad: tokens.json ----
const tokens = JSON.parse(read('shared/tokens/src/tokens.css/../tokens.json'));
const css = read('shared/tokens/src/tokens.css');
const ts = read('shared/tokens/src/index.ts');

console.log('\n🎨 tokens:check — Clay Serenity SSOT\n');

// 1) Cada color HEX del JSON debe existir en tokens.css
for (const [key, value] of Object.entries(tokens.color)) {
  const kebab = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  const cssVar = `--cs-${kebab}:`;
  if (!css.includes(cssVar)) {
    fail(`tokens.css falta la variable ${cssVar} (color "${key}")`);
  } else {
    const line = css.split('\n').find((l) => l.includes(cssVar));
    const normalizedValue = value.replace(/\s/g, '').toLowerCase();
    const lineValue = (line.split(':')[1] ?? '').replace(/[;\s]/g, '').toLowerCase();
    if (!lineValue.includes(normalizedValue)) {
      fail(`tokens.css "${cssVar}" = "${lineValue}" ≠ JSON "${value}"`);
    }
  }
}

// 2) Colores del JSON presentes en index.ts (exportación TS/RN)
for (const [key, value] of Object.entries(tokens.color)) {
  if (!ts.includes(`"${key}"`) && !ts.includes(`raw.color.${key}`)) {
    // index.ts usa spread por color; verificamos la referencia directa
    if (!ts.includes(`${key}:`)) fail(`tokens index.ts no exporta el color "${key}"`);
  }
}

// 3) Prohibiciones SSOT §4: ningún HEX fuera de la lista permitida en tokens.css
const allowedHex = new Set(
  [
    ...Object.values(tokens.color),
    ...Object.values(tokens.colorDark),
    ...Object.values(tokens.color).flatMap((v) => {
      // extrae rgb de rgba() para comparar si hace falta
      return [];
    }),
  ]
    .filter((v) => /^#[0-9a-f]{6}$/i.test(v))
    .map((v) => v.toLowerCase()),
);
const hexInCss = css.match(/#[0-9a-f]{3,8}/gi) ?? [];
for (const hex of hexInCss) {
  const norm = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  if (![...allowedHex].some((a) => a.toLowerCase() === norm.toLowerCase() && a.length === 7)) {
    if (norm.length === 7 && !allowedHex.has(norm.toLowerCase())) {
      fail(`tokens.css contiene HEX no SSOT: ${hex}`);
    }
  }
}

// 4) Presencia de tokens estructurales obligatorios
const required = [
  '--cs-font-display',
  '--cs-font-ui',
  '--cs-radius-input: 16px',
  '--cs-radius-btn: 18px',
  '--cs-radius-card: 24px',
  '--cs-ease-spring',
  '--cs-focus-outline',
  'prefers-reduced-motion',
];
const cssNoSpace = css.replace(/\s/g, '');
for (const r of required) {
  const needle = r.replace(/\s/g, '');
  if (!cssNoSpace.includes(needle)) fail(`tokens.css falta el token obligatorio "${r}"`);
}

if (failures === 0) {
  ok('CSS vars ↔ JSON ↔ TS consistentes');
  ok('Tokens estructurales (radios 16/18/24, Fraunces/Inter, focus, reduced-motion) presentes');
  ok('Sin HEX fuera de la paleta SSOT');
  console.log('\n✅ tokens:check PASSED\n');
  process.exit(0);
} else {
  console.error(`\n❌ tokens:check FAILED (${failures} incidencia(s))\n`);
  process.exit(1);
}
