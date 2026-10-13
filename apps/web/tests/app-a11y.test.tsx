/**
 * 8.2 · Auditoría a11y (axe-core) sobre la APP REAL — WCAG 2.1 AA.
 * Recorre los tres estados raíz: onboarding (BP-01), app desbloqueada
 * (Inicio + Movimientos) y el hub de Ajustes. Helper local tipado, sin
 * augment global (mismo patrón que design-system-a11y.test.tsx).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import App from '../src/app/App';
import { resetSession } from '../src/data/db/session';
import { useVaultStore } from '../src/features/vault/store';
import { useTransactionsStore } from '../src/features/transactions/store';
import { resetDashboardStore } from '../src/features/dashboard/store';

const PASS = 'clave-maestra-1';
/** PBKDF2 120k + sql.js WASM + migraciones: esperas amplias. */
const WAIT = { timeout: 15000 };

async function expectNoViolations(container: Element): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toEqual([]);
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetSession();
  useVaultStore.setState({
    status: 'boot',
    saltHex: null,
    verifierHex: null,
    vaultId: null,
    error: null,
    busy: false,
  });
  useTransactionsStore.setState({
    status: 'loading',
    items: [],
    filter: {},
    error: null,
    lastDeletedId: null,
    repo: null,
  });
  resetDashboardStore();
});

/** BP-01 completo por UI (espejo del journey F3). */
async function createVaultThroughUi(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }, WAIT));
  fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: PASS } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.change(screen.getByPlaceholderText('Escribe la misma contraseña'), { target: { value: PASS } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear bóveda' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Empezar' }, WAIT));
}

describe('App real - axe-core (WCAG 2.1 AA)', () => {
  it('onboarding (BP-01) sin violaciones', async () => {
    const { container } = render(<App />);
    await screen.findByRole('button', { name: 'Continuar' }, WAIT);
    await expectNoViolations(container);
  });

  it(
    'app desbloqueada (Inicio + Movimientos) sin violaciones',
    async () => {
      const { container } = render(<App />);
      await createVaultThroughUi();
      await screen.findByLabelText('Movimientos', {}, WAIT);
      await expectNoViolations(container);
    },
    30_000,
  );

  it(
    'hub de Ajustes sin violaciones',
    async () => {
      const { container } = render(<App />);
      await createVaultThroughUi();
      fireEvent.click(await screen.findByRole('tab', { name: 'Ajustes' }, WAIT));
      await screen.findByText('Datos', {}, WAIT);
      await expectNoViolations(container);
    },
    30_000,
  );
});
