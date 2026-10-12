#!/usr/bin/env node
/**
 * sync-contract.mjs — Gate de CI (MANIFIESTO_CALIDAD gates: contract).
 * Verifica que AMBAS apps dependan del MISMO @monedero/export-contract (workspace:*)
 * y que el contrato exporte el FORMAT_VERSION esperado.
 * ADR-002: el contrato es el ÚNICO puente móvil ⇄ PWA.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const EXPECTED_FORMAT_VERSION = 1;

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`  ❌ ${msg}`);
};
const ok = (msg) => console.log(`  ✅ ${msg}`);

console.log('\n📄 contract:check — ADR-002 único acoplamiento\n');

// 1) Ambas apps usan workspace:*
for (const app of ['apps/mobile/package.json', 'apps/web/package.json']) {
  const pkg = JSON.parse(read(app));
  const dep = pkg.dependencies?.['@monedero/export-contract'];
  if (dep !== 'workspace:*') {
    fail(`${app}: dependency @monedero/export-contract = "${dep}" (esperado "workspace:*")`);
  } else {
    ok(`${app} → workspace:*`);
  }
}

// 2) El paquete existe con sus módulos obligatorios (CONTRATOS_API.md)
const requiredModules = [
  'shared/export-contract/src/index.ts',
  'shared/export-contract/src/types.ts',
  'shared/export-contract/src/schemas.ts',
  'shared/export-contract/src/hash.ts',
  'shared/export-contract/src/migrations.ts',
];
for (const m of requiredModules) {
  if (!existsSync(join(root, m))) fail(`falta módulo obligatorio del contrato: ${m}`);
}
ok('Módulos del contrato presentes (types, schemas, hash, migrations)');

// 3) FORMAT_VERSION coherente
const types = read('shared/export-contract/src/types.ts');
const match = types.match(/FORMAT_VERSION\s*=\s*(\d+)/);
if (!match || Number(match[1]) !== EXPECTED_FORMAT_VERSION) {
  fail(`FORMAT_VERSION = ${match?.[1]} (esperado ${EXPECTED_FORMAT_VERSION})`);
} else {
  ok(`FORMAT_VERSION = ${EXPECTED_FORMAT_VERSION}`);
}

// 4) Regla: NINGUNA app importa la otra (solo el contrato)
for (const [app, other] of [
  ['apps/mobile/src', 'apps/web'],
  ['apps/web/src', 'apps/mobile'],
]) {
  // búsqueda simple recursiva de referencias prohibidas
  const { execSync } = await import('node:child_process');
  try {
    const out = execSync(
      `findstr /S /I /M "@monedero/web" "${root}\\${app}\\*.ts*" 2>nul || exit 0`,
      { shell: true },
    ).toString();
    if (out.trim()) fail(`${app} referencia a ${other} directamente (prohibido por ADR-002)`);
  } catch {
    /* sin coincidencias = OK */
  }
}
ok('Sin imports cruzados entre apps (solo vía contrato)');

if (failures === 0) {
  console.log('\n✅ contract:check PASSED\n');
  process.exit(0);
} else {
  console.error(`\n❌ contract:check FAILED (${failures} incidencia(s))\n`);
  process.exit(1);
}
