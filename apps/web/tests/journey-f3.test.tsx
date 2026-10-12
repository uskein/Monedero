/**
 * Recorrido E2E F3 (tarea 4.4) — FLUJOS_DE_USUARIO.md F3 · HU-05·06·07·08.
 * Camino real por la UI: crear bóveda (BP-01) → Inicio empty (BP-03) →
 * CTA → alta (BP-05) → fila (BP-04) → balance en Inicio → eliminar →
 * Deshacer → balance intacto. Segundo caso: bóveda existente → abrir →
 * desbloquear (BP-02) → Inicio visible (recorrido «abrir → desbloquear»
 * del Gate S4) → registrar gasto → ver balance: la cadena continua
 * «abrir → desbloquear → registrar → balance» del gate.
 * El AppShell mantiene AMBAS pantallas montadas (una oculta con `hidden`), así
 * que las consultas se acotan con within(region): getByRole excluye lo oculto
 * y within aísla claves repetidas entre paneles (tx.list.empty.*).
 * Trazabilidad: PLAN_DE_SPRINTS 4.4 · Gate S4 (🎯 Hito usuario).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { formatMoney } from '@monedero/i18n';
import App from '../src/app/App';
import { resetSession } from '../src/data/db/session';
import { useVaultStore } from '../src/features/vault/store';
import { useTransactionsStore } from '../src/features/transactions/store';
import { resetDashboardStore } from '../src/features/dashboard/store';

const PASS = 'clave-maestra-1';
/** PBKDF2 120k + init sql.js WASM + migraciones/seed: esperas amplias. */
const WAIT = { timeout: 15000 };

/** NBSP (U+00A0) de Intl → espacio: RTL normaliza el DOM, no el matcher. */
const plain = (s: string): string => s.replace(/\u00A0/g, ' ');
const money = (cents: number): string => plain(formatMoney(cents, 'COP', 'es-CO'));

/** Región visible de cada panel (falla si el panel está oculto). */
const dash = () => within(screen.getByRole('region', { name: 'Inicio' }));
const movs = () => within(screen.getByRole('region', { name: 'Movimientos' }));

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

/** BP-01 completo: bienvenida → passphrase → confirmación → éxito → dentro. */
async function createVaultThroughUi(): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }, WAIT));
  fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: PASS } });
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  fireEvent.change(screen.getByPlaceholderText('Escribe la misma contraseña'), { target: { value: PASS } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear bóveda' }));
  // Éxito BP-01 (PBKDF2 en curso → espera activa)
  fireEvent.click(await screen.findByRole('button', { name: 'Empezar' }, WAIT));
}

describe('Recorrido E2E F3 — alta → balance → deshacer (tarea 4.4)', () => {
  it(
    'crear bóveda → Inicio empty → CTA → alta → balance → eliminar → Deshacer',
    async () => {
      render(<App />);
      await createVaultThroughUi();

      // BP-03 estado empty: saldo $ 0 + CTA «Añadir primer movimiento»
      expect(await dash().findByText('Aún no hay movimientos', {}, WAIT)).toBeTruthy();
      expect(dash().getAllByText(money(0)).length).toBeGreaterThan(0);

      // CTA → pestaña Movimientos + alta BP-05 abierta (addSignal)
      fireEvent.click(screen.getByRole('button', { name: 'Añadir primer movimiento' }));
      expect(screen.getByRole('tab', { name: 'Movimientos' }).getAttribute('aria-selected')).toBe('true');
      expect(await movs().findByRole('form', { name: 'Nuevo movimiento' }, WAIT)).toBeTruthy();

      // Alta: ingreso de 15.000 COP (parseAmountToCents → 1 500 000 centavos).
      // Como ingreso, el balance total pasa de $ 0 a +$ 15.000 (sin saldo inicial).
      fireEvent.click(screen.getByRole('tab', { name: 'Ingreso' }));
      fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '15000' } });
      fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Nómina' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }));

      // BP-04: la fila aparece en la lista
      expect(await movs().findByText('Nómina', {}, WAIT)).toBeTruthy();

      // BP-03 + tarea 4.3: el alta actualizó el balance (contador → $ 15.000)
      fireEvent.click(screen.getByRole('tab', { name: 'Inicio' }));
      await waitFor(() => expect(dash().getAllByText(money(1500000)).length).toBeGreaterThan(0), WAIT);

      // BP-04: borrado blando + Toast «Movimiento eliminado.» → Deshacer
      fireEvent.click(screen.getByRole('tab', { name: 'Movimientos' }));
      fireEvent.click(await movs().findByRole('button', { name: 'Eliminar Nómina' }, WAIT));
      expect(await movs().findByText('Movimiento eliminado.', {}, WAIT)).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Deshacer' }));
      expect(await movs().findByText('Nómina', {}, WAIT)).toBeTruthy();

      // El balance sigue intacto tras deshacer (restore → evento tx)
      fireEvent.click(screen.getByRole('tab', { name: 'Inicio' }));
      await waitFor(() => expect(dash().getAllByText(money(1500000)).length).toBeGreaterThan(0), WAIT);
    },
    60000,
  );

  it(
    'abrir → desbloquear → registrar gasto → ver balance (Gate S4)',
    async () => {
      // Pre-condición: bóveda creada en una sesión anterior
      await useVaultStore.getState().createVault(PASS, PASS);
      useVaultStore.getState().lock();

      render(<App />);

      // BP-02: aparece la pantalla de bloqueo con la passphrase
      const input = await screen.findByLabelText('Contraseña maestra', {}, WAIT);
      fireEvent.change(input, { target: { value: PASS } });
      fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));

      // Dentro: esperar a que el desbloqueo (PBKDF2) monte el AppShell —
      // findByRole envuelve la espera; dash() lanza síncrono si aún no existe.
      expect(await screen.findByRole('region', { name: 'Inicio' }, WAIT)).toBeTruthy();
      expect(await dash().findByText('Aún no hay movimientos', {}, WAIT)).toBeTruthy();
      fireEvent.click(screen.getByRole('tab', { name: 'Movimientos' }));
      expect(screen.getByRole('tab', { name: 'Movimientos' }).getAttribute('aria-selected')).toBe('true');
      expect(await movs().findByText('Añadir primer movimiento', {}, WAIT)).toBeTruthy();

      // Gate S4 «día real»: registrar un gasto (tipo por defecto) tras desbloquear…
      fireEvent.click(await movs().findByRole('button', { name: 'Añadir primer movimiento' }, WAIT));
      fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '2500' } });
      fireEvent.change(screen.getByLabelText('Concepto'), { target: { value: 'Almuerzo' } });
      fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }));
      expect(await movs().findByText('Almuerzo', {}, WAIT)).toBeTruthy();

      // …y ver el balance actualizado en Inicio (evento tx → refresh del dashboard)
      // Formato negativo del gasto (moneySigned) → regex sin espacios (NBSP-safe).
      fireEvent.click(screen.getByRole('tab', { name: 'Inicio' }));
      await waitFor(() => expect(dash().getAllByText(/2\.500/).length).toBeGreaterThan(0), WAIT);
    },
    60000,
  );
});
