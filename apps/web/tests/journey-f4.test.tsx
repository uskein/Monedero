/**
 * Recorrido E2E F4 (tarea 5.5) — FLUJOS_DE_USUARIO.md F4 · HU-11·12 · Gate S5.
 * Camino real por la UI con la BD real (sql.js + migraciones + seed):
 * desbloquear (BP-02) → Presupuestos empty (BP-06) → definir tope Comida
 * $ 25.000 → gasto $ 21.000 en Comida (BP-05, categoryId del catálogo) →
 * cruce 84 % → toast sereno «Vas cerca…» + barra accent → gasto $ 5.000 →
 * 104 % → toast «se cumplió» + chip «Meta alcanzada» → intentar DUPLICAR el
 * tope → INTEGRITY_VIOLATION («edítalo en su lugar») → «Editar tope» →
 * guardar $ 30.000 sobre el MISMO presupuesto (sin duplicar en BD) → barra
 * vuelve a warn y el chip desaparece.
 * Trazabilidad: PLAN_DE_SPRINTS 5.5 · Gate S5 (certificación técnica).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import App from '../src/app/App';
import { getBudgetsRepo, resetSession } from '../src/data/db/session';
import { useVaultStore } from '../src/features/vault/store';
import { useTransactionsStore } from '../src/features/transactions/store';
import { resetDashboardStore } from '../src/features/dashboard/store';
import { useBudgetsStore } from '../src/features/budgets/store';
import { useCategoriesStore } from '../src/features/settings/store';
import { currentPeriod } from '../src/data/domain/budgets';

const PASS = 'clave-maestra-1';
/** PBKDF2 120k + init sql.js WASM + migraciones/seed: esperas amplias. */
const WAIT = { timeout: 15000 };

/** Región visible de cada panel (getByRole excluye lo oculto). */
const budgets = () => within(screen.getByRole('region', { name: 'Presupuestos' }));
const movs = () => within(screen.getByRole('region', { name: 'Movimientos' }));
const tab = (name: string) => screen.getByRole('tab', { name });

/** Gasto en Comida vía BP-05 (categoryId del catálogo sembrado). */
async function addExpenseInComida(amount: string, concept: string): Promise<void> {
  fireEvent.click(
    await movs().findByRole(
      'button',
      { name: concept === 'Mercado' ? 'Añadir primer movimiento' : 'Nuevo movimiento' },
      WAIT,
    ),
  );
  fireEvent.change(movs().getByLabelText('Importe'), { target: { value: amount } });
  fireEvent.change(movs().getByLabelText('Concepto'), { target: { value: concept } });
  fireEvent.change(movs().getByLabelText('Categoría'), { target: { value: 'cat-comida' } });
  fireEvent.click(movs().getByRole('button', { name: 'Guardar movimiento' }));
  expect(await movs().findByText(concept, {}, WAIT)).toBeTruthy();
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

describe('Recorrido E2E F4 — topes con alertas serenas (tarea 5.5 · Gate S5)', () => {
  it(
    'tope → gasto → 84 % toast → 104 % chip → duplicado → editar existente',
    async () => {
      // Pre-condición: bóveda creada en una sesión anterior (BP-02).
      await useVaultStore.getState().createVault(PASS, PASS);
      useVaultStore.getState().lock();

      render(<App />);
      const input = await screen.findByLabelText('Contraseña maestra', {}, WAIT);
      fireEvent.change(input, { target: { value: PASS } });
      fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));
      await screen.findByRole('tab', { name: 'Presupuestos' }, WAIT);

      // 1. BP-06 estado empty (todavía sin topes). La región solo es consultable
      //    con la pestaña activa (hidden la excluye del árbol de a11y).
      fireEvent.click(tab('Presupuestos'));
      expect(await budgets().findByText('Aún no tienes topes', {}, WAIT)).toBeTruthy();

      // 2. Definir tope: Comida $ 25.000 del mes actual.
      fireEvent.click(await budgets().findByRole('button', { name: 'Definir tope' }, WAIT));
      fireEvent.change(budgets().getByLabelText('Categoría'), { target: { value: 'cat-comida' } });
      fireEvent.change(budgets().getByLabelText('Tope mensual'), { target: { value: '25000' } });
      fireEvent.click(budgets().getByRole('button', { name: 'Guardar tope' }));
      expect(await budgets().findByText('Comida', {}, WAIT)).toBeTruthy();
      expect(budgets().getByRole('progressbar', { name: 'Comida 0 %' })).toBeTruthy();

      // 3. Gasto real de $ 21.000 en Comida desde Movimientos (BP-05).
      fireEvent.click(tab('Movimientos'));
      await addExpenseInComida('21000', 'Mercado');

      // 4. Cruce del 84 % (evento tx → reevaluación): toast sereno + barra accent.
      fireEvent.click(tab('Presupuestos'));
      expect(
        await budgets().findByText(/Vas cerca de tu tope en Comida: 84 %/, {}, WAIT),
      ).toBeTruthy();
      expect(budgets().getByRole('progressbar', { name: 'Comida 84 %' })).toBeTruthy();
      expect(budgets().queryByText('Meta alcanzada')).toBeNull(); // aún warn

      // 5. Otro gasto de $ 5.000 → 104 %: toast «se cumplió» + chip «Meta alcanzada».
      fireEvent.click(tab('Movimientos'));
      await addExpenseInComida('5000', 'Pan');
      fireEvent.click(tab('Presupuestos'));
      expect(
        await budgets().findByText(/Tu tope en Comida se cumplió \(104 %/, {}, WAIT),
      ).toBeTruthy();
      expect(await budgets().findByText('Meta alcanzada', {}, WAIT)).toBeTruthy();
      expect(budgets().getByRole('progressbar', { name: 'Comida 104 %' })).toBeTruthy();

      // 6. F4 «duplicado → editar existente»: intentar crear otro tope de Comida.
      //    (El toast exceeded sigue vivo y también es role=alert → se afina por texto.)
      fireEvent.click(await budgets().findByRole('button', { name: 'Definir tope' }, WAIT));
      fireEvent.change(budgets().getByLabelText('Categoría'), { target: { value: 'cat-comida' } });
      fireEvent.change(budgets().getByLabelText('Tope mensual'), { target: { value: '99999' } });
      fireEvent.click(budgets().getByRole('button', { name: 'Guardar tope' }));
      expect(
        await budgets().findByText(/Esa categoría ya tiene un tope este mes/, {}, WAIT),
      ).toBeTruthy();

      // 7. «Editar tope» → formulario prellenado → $ 30.000 sobre el MISMO tope.
      fireEvent.click(budgets().getByRole('button', { name: 'Editar tope' }));
      expect(budgets().getByLabelText('Tope mensual')).toHaveProperty('value', '25000');
      fireEvent.change(budgets().getByLabelText('Tope mensual'), { target: { value: '30000' } });
      fireEvent.click(budgets().getByRole('button', { name: 'Guardar tope' }));

      // 26.000 / 30.000 = 87 % → warn de nuevo; chip retirado; SIN duplicar en BD.
      expect(await budgets().findByRole('progressbar', { name: 'Comida 87 %' }, WAIT)).toBeTruthy();
      expect(budgets().queryByText('Meta alcanzada')).toBeNull();
      const repo = await getBudgetsRepo();
      const persisted = await repo.listByPeriod(currentPeriod());
      expect(persisted).toHaveLength(1); // UNIQUE(category, period) + F4 sin duplicados
      expect(persisted[0]?.amountCents).toBe(3_000_000);
    },
    60000,
  );
});
