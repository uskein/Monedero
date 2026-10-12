/**
 * Recorrido E2E F3 móvil (tarea 4.4) — FLUJOS_DE_USUARIO F3 · Gate S4 (🎯).
 * Camino real por la UI: crear bóveda (BP-01) → Inicio empty (BP-03) →
 * CTA → alta de ingreso (BP-05) → fila (BP-04) → balance en Inicio. Segundo
 * caso: bóveda existente → abrir → desbloquear (BP-02) → registrar gasto →
 * ver balance: el recorrido continuo «abrir → desbloquear → registrar →
 * balance» del Gate S4.
 * RNTL v14: `await render` y fireEvent uniforme Y esperado (mezclar con
 * userEvent provoca «overlapping act» y el estado no flushea). PBKDF2 120k
 * ≈ 1,2 s/derive + sql.js WASM → WAIT amplio.
 * Ambos paneles quedan montados (el oculto con display:'none'): dentro de un
 * panel se aíslan las claves repetidas con within(); entre paneles distingue
 * getByLabelText — solo el ScrollView de cada pantalla lleva accessibilityLabel
 * (los tabs de navegación nombran por texto hijo).
 * Trazabilidad: PLAN_DE_SPRINTS 4.4 · Gate S4 (🎯 Hito usuario).
 */
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';
import AppRoot from '../src/AppRoot';
import { configureVaultStorage, useVaultStore } from '../src/state/vault.store';
import { useTransactionsStore } from '../src/state/transactions.store';
import { resetDashboardStore } from '../src/state/dashboard.store';
import { createMemoryVaultStorage } from '../src/infrastructure/security/memoryStorage';

const PASS = 'clave-maestra-1';
/** PBKDF2 120k + sql.js WASM + migraciones/seed: esperas amplias. */
const WAIT = { timeout: 15000 };

/** Panel de cada pestaña (ambos montados; el oculto sigue consultable). */
const dash = () => within(screen.getByLabelText('Inicio'));
const movs = () => within(screen.getByLabelText('Movimientos'));
const navTab = (name: string) => screen.getByRole('tab', { name });

beforeEach(() => {
  // Bóveda en memoria (expo-secure-store no se carga en jest) + stores limpios:
  // cada caso monta un AppRoot con su propio repo sql.js recién creado.
  configureVaultStorage(createMemoryVaultStorage());
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
  await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }, WAIT));
  await fireEvent.changeText(screen.getByLabelText('Contraseña maestra'), PASS);
  await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  await fireEvent.changeText(screen.getByLabelText('Repite la contraseña'), PASS);
  await fireEvent.press(screen.getByRole('button', { name: 'Crear bóveda' }));
  // Éxito BP-01 (PBKDF2 en curso → espera activa)
  await fireEvent.press(await screen.findByRole('button', { name: 'Empezar' }, WAIT));
}

describe('Recorrido E2E F3 móvil — alta → balance (tarea 4.4 · Gate S4)', () => {
  it(
    'crear bóveda → Inicio empty → CTA → alta de ingreso → balance en Inicio',
    async () => {
      await render(<AppRoot />);
      await createVaultThroughUi();

      // Los paneles montan cuando el repo (sql.js) está listo
      await screen.findByRole('tab', { name: 'Inicio' }, WAIT);

      // BP-03 estado empty: sin movimientos + CTA
      expect(await dash().findByText('Aún no hay movimientos', {}, WAIT)).toBeTruthy();
      expect(await dash().findByText('Añadir primer movimiento', {}, WAIT)).toBeTruthy();

      // CTA → pestaña Movimientos + alta BP-05 abierta (addSignal)
      await fireEvent.press(dash().getByRole('button', { name: 'Añadir primer movimiento' }));
      expect(navTab('Movimientos').props.accessibilityState?.selected).toBe(true);
      expect(await movs().findByText('Nuevo movimiento', {}, WAIT)).toBeTruthy();

      // Alta: ingreso de 15.000 COP (parseAmountToCents → 1 500 000 centavos)
      await fireEvent.press(movs().getByRole('button', { name: 'Ingreso' }));
      await fireEvent.changeText(movs().getByLabelText('Importe'), '15000');
      await fireEvent.changeText(movs().getByLabelText('Concepto'), 'Nómina');
      await fireEvent.press(movs().getByRole('button', { name: 'Guardar movimiento' }));

      // BP-04: la fila aparece en la lista
      expect(await movs().findByText('Nómina', {}, WAIT)).toBeTruthy();

      // BP-03 + tarea 4.3: el alta actualizó el panel Inicio (evento tx → refresh)
      await fireEvent.press(navTab('Inicio'));
      expect(navTab('Inicio').props.accessibilityState?.selected).toBe(true);
      await waitFor(() => expect(dash().getAllByText(/15\.000/).length).toBeGreaterThan(0), WAIT);
    },
    60000,
  );

  it(
    'abrir → desbloquear → registrar gasto → ver balance (Gate S4)',
    async () => {
      // Pre-condición: bóveda creada en una sesión anterior
      await useVaultStore.getState().createVault(PASS, PASS);
      useVaultStore.getState().lock();

      await render(<AppRoot />);

      // BP-02: pantalla de bloqueo con la passphrase
      const input = await screen.findByLabelText('Contraseña maestra', {}, WAIT);
      await fireEvent.changeText(input, PASS);
      await fireEvent.press(screen.getByRole('button', { name: 'Desbloquear' }));

      // Dentro: esperar a que el desbloqueo (PBKDF2) + repo monten el AppShell
      await screen.findByRole('tab', { name: 'Inicio' }, WAIT);
      expect(await dash().findByText('Aún no hay movimientos', {}, WAIT)).toBeTruthy();

      await fireEvent.press(navTab('Movimientos'));
      expect(navTab('Movimientos').props.accessibilityState?.selected).toBe(true);
      expect(await movs().findByText('Añadir primer movimiento', {}, WAIT)).toBeTruthy();

      // Gate S4 «día real»: registrar un gasto (tipo por defecto) tras desbloquear…
      await fireEvent.press(movs().getByRole('button', { name: 'Añadir primer movimiento' }));
      await fireEvent.changeText(movs().getByLabelText('Importe'), '2500');
      await fireEvent.changeText(movs().getByLabelText('Concepto'), 'Almuerzo');
      await fireEvent.press(movs().getByRole('button', { name: 'Guardar movimiento' }));
      expect(await movs().findByText('Almuerzo', {}, WAIT)).toBeTruthy();

      // …y ver el balance actualizado en Inicio (evento tx → refresh del dashboard)
      await fireEvent.press(navTab('Inicio'));
      await waitFor(() => expect(dash().getAllByText(/2\.500/).length).toBeGreaterThan(0), WAIT);
    },
    60000,
  );
});
