/**
 * Recorrido E2E F4 móvil (tarea 5.5) — FLUJOS_DE_USUARIO F4 · HU-11·12 · Gate S5.
 * Camino real por la UI con el repo dev real (sql.js + migraciones + seed):
 * desbloquear (BP-02) → Presupuestos empty (BP-06) → tope Comida $ 25.000 →
 * gasto $ 21.000 en Comida (BP-05, chip del catálogo sembrado) → 84 % toast
 * sereno → gasto $ 5.000 → 104 % toast «se cumplió» + chip «Meta alcanzada»
 * → duplicar tope → «edítalo en su lugar» → «Editar tope» → $ 30.000 sobre el
 * MISMO presupuesto (fila única) → barra vuelve a warn y el chip se retira.
 * RNTL v14: `await render` y fireEvent uniforme Y esperado. Los paneles se
 * aíslan con within(); se afina por TEXTO porque el toast exceeded también es
 * role=alert. Trazabilidad: PLAN_DE_SPRINTS 5.5 · Gate S5 (certificación).
 */
import { render, screen, fireEvent, within } from '@testing-library/react-native';
import AppRoot from '../src/AppRoot';
import { configureVaultStorage, useVaultStore } from '../src/state/vault.store';
import { useTransactionsStore } from '../src/state/transactions.store';
import { resetDashboardStore } from '../src/state/dashboard.store';
import { useBudgetsStore } from '../src/state/budgets.store';
import { useCategoriesStore } from '../src/state/categories.store';
import { createMemoryVaultStorage } from '../src/infrastructure/security/memoryStorage';
import { currentPeriod } from '../src/core/domain/budget';

const PASS = 'clave-maestra-1';
/** PBKDF2 120k + sql.js WASM + migraciones/seed: esperas amplias. */
const WAIT = { timeout: 15000 };

/** Panel de cada pestaña (ambos montados; el oculto sigue consultable). */
const budgets = () => within(screen.getByLabelText('Presupuestos'));
const movs = () => within(screen.getByLabelText('Movimientos'));
const navTab = (name: string) => screen.getByRole('tab', { name });

/** Gasto en Comida vía BP-05 (chip del catálogo sembrado 'cat-comida'). */
async function addExpenseInComida(amount: string, concept: string, cta: string): Promise<void> {
  await fireEvent.press(await movs().findByRole('button', { name: cta }, WAIT));
  await fireEvent.changeText(movs().getByLabelText('Importe'), amount);
  await fireEvent.changeText(movs().getByLabelText('Concepto'), concept);
  await fireEvent.press(movs().getByRole('button', { name: 'Comida' }));
  await fireEvent.press(movs().getByRole('button', { name: 'Guardar movimiento' }));
  expect(await movs().findByText(concept, {}, WAIT)).toBeTruthy();
}

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
  useBudgetsStore.setState({
    status: 'loading',
    period: currentPeriod(),
    items: [],
    error: null,
    duplicate: null,
    formError: null,
    toast: null,
    deps: null,
    levels: {},
  });
  useCategoriesStore.setState({
    status: 'loading',
    items: [],
    error: null,
    formError: null,
    repo: null,
  });
});

describe('Recorrido E2E F4 móvil — topes con alertas serenas (tarea 5.5 · Gate S5)', () => {
  it(
    'tope → gasto → 84 % toast → 104 % chip → duplicado → editar existente',
    async () => {
      // Pre-condición: bóveda creada en una sesión anterior (BP-02).
      await useVaultStore.getState().createVault(PASS, PASS);
      useVaultStore.getState().lock();

      await render(<AppRoot />);
      const input = await screen.findByLabelText('Contraseña maestra', {}, WAIT);
      await fireEvent.changeText(input, PASS);
      await fireEvent.press(screen.getByRole('button', { name: 'Desbloquear' }));
      await screen.findByRole('tab', { name: 'Presupuestos' }, WAIT);

      // 1. BP-06 estado empty (todavía sin topes).
      await fireEvent.press(navTab('Presupuestos'));
      expect(await budgets().findByText('Aún no tienes topes', {}, WAIT)).toBeTruthy();

      // 2. Definir tope: Comida $ 25.000 del mes actual (picker SOLO gastos).
      await fireEvent.press(await budgets().findByRole('button', { name: 'Definir tope' }, WAIT));
      await fireEvent.press(budgets().getByRole('radio', { name: 'Comida' }));
      await fireEvent.changeText(budgets().getByLabelText('Tope mensual'), '25000');
      await fireEvent.press(budgets().getByRole('button', { name: 'Guardar tope' }));
      expect(await budgets().findByText('Comida', {}, WAIT)).toBeTruthy();
      expect(budgets().getByLabelText('Comida 0 %')).toBeTruthy();

      // 3. Gasto real de $ 21.000 en Comida desde Movimientos (BP-05).
      await fireEvent.press(navTab('Movimientos'));
      await addExpenseInComida('21000', 'Mercado', 'Añadir primer movimiento');

      // 4. Cruce del 84 % (evento tx → reevaluación): toast sereno + barra accent.
      await fireEvent.press(navTab('Presupuestos'));
      expect(await budgets().findByText(/Vas cerca de tu tope en Comida: 84 %/, {}, WAIT)).toBeTruthy();
      expect(budgets().getByLabelText('Comida 84 %')).toBeTruthy();
      expect(budgets().queryByText('Meta alcanzada')).toBeNull(); // aún warn

      // 5. Otro gasto de $ 5.000 → 104 %: toast «se cumplió» + chip «Meta alcanzada».
      await fireEvent.press(navTab('Movimientos'));
      await addExpenseInComida('5000', 'Pan', 'Nuevo movimiento');
      await fireEvent.press(navTab('Presupuestos'));
      expect(await budgets().findByText(/Tu tope en Comida se cumplió \(104 %/, {}, WAIT)).toBeTruthy();
      expect(await budgets().findByText('Meta alcanzada', {}, WAIT)).toBeTruthy();
      expect(budgets().getByLabelText('Comida 104 %')).toBeTruthy();

      // 6. F4 «duplicado → editar existente»: intentar otro tope de Comida.
      //    (El toast exceeded también es role=alert → se afina por texto.)
      await fireEvent.press(await budgets().findByRole('button', { name: 'Definir tope' }, WAIT));
      await fireEvent.press(budgets().getByRole('radio', { name: 'Comida' }));
      await fireEvent.changeText(budgets().getByLabelText('Tope mensual'), '99999');
      await fireEvent.press(budgets().getByRole('button', { name: 'Guardar tope' }));
      expect(
        await budgets().findByText(/Esa categoría ya tiene un tope este mes/, {}, WAIT),
      ).toBeTruthy();

      // 7. «Editar tope» → prellenado $ 25.000 → $ 30.000 sobre el MISMO tope.
      await fireEvent.press(budgets().getByRole('button', { name: 'Editar tope' }));
      expect(budgets().getByLabelText('Tope mensual').props.value).toBe('25000');
      await fireEvent.changeText(budgets().getByLabelText('Tope mensual'), '30000');
      await fireEvent.press(budgets().getByRole('button', { name: 'Guardar tope' }));

      // 26.000 / 30.000 = 87 % → warn de nuevo; chip retirado; fila única (sin duplicar).
      expect(budgets().queryByRole('alert')).toBeNull(); // sin alertas pendientes
      expect(await budgets().findByText('Comida', {}, WAIT)).toBeTruthy();
      expect(budgets().getByLabelText('Comida 87 %')).toBeTruthy();
      expect(budgets().queryByText('Meta alcanzada')).toBeNull();
      expect(budgets().getAllByText('Comida')).toHaveLength(1); // UNA fila: jamás duplica
    },
    90000,
  );
});
