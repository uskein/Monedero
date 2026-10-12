/**
 * Test UI + dinero — TransactionForm (BP-05): parseAmountToCents (TDD, área crítica) + a11y.
 * Fuente: BLUEPRINTS_DE_PANTALLAS.md BP-05 · HU-05 (importe > 0) · HU-18 (formatMoney).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { I18nProvider } from '@monedero/i18n/react';
import { TransactionForm, parseAmountToCents } from '../src/features/transactions/TransactionForm';
import type { TxInput } from '../src/data/domain/transactions';

const ACCOUNTS = [
  { id: 'acc-efectivo', name: 'Efectivo' },
  { id: 'acc-ahorro', name: 'Ahorro' },
];
const CATEGORIES = [
  { id: 'cat-comida', name: 'Comida' },
  { id: 'cat-salario', name: 'Salario' },
];

describe('parseAmountToCents — dinero a centavos enteros (HU-18, sin flotantes)', () => {
  it('parsea "18500" → 1850000 centavos (entero sin decimales)', () => {
    expect(parseAmountToCents('18500')).toBe(1850000);
  });

  it('parsea "18.500" (punto de miles es-CO) → 1850000 centavos', () => {
    expect(parseAmountToCents('18.500')).toBe(1850000);
  });

  it('parsea "18.500,50" (miles + decimal es-CO) → 1850050 centavos', () => {
    expect(parseAmountToCents('18.500,50')).toBe(1850050);
  });

  it('parsea "18,500.50" (miles en-US + decimal) → 1850050 centavos', () => {
    expect(parseAmountToCents('18,500.50')).toBe(1850050);
  });

  it('parsea "12.5" (decimal corto) → 1250 centavos', () => {
    expect(parseAmountToCents('12.5')).toBe(1250);
  });

  it('parsea "12,5" (decimal es-CO corto) → 1250 centavos', () => {
    expect(parseAmountToCents('12,5')).toBe(1250);
  });

  it('parsea "0" → 0 centavos (el schema lo rechaza, el parseo es neutro)', () => {
    expect(parseAmountToCents('0')).toBe(0);
  });

  it('rechaza vacío → null', () => {
    expect(parseAmountToCents('')).toBeNull();
  });

  it('rechaza texto no numérico → null', () => {
    expect(parseAmountToCents('abc')).toBeNull();
  });

  it('"12.3" (1 decimal) → 1230 centavos (regla 1–2 dígitos ⇒ decimal)', () => {
    // "12.3" → 1 dígito tras el punto ⇒ decimal → 12.3 → 1230 centavos
    expect(parseAmountToCents('12.3')).toBe(1230);
  });

  it('no produce flotantes: el resultado siempre es entero', () => {
    const cents = parseAmountToCents('99.99');
    expect(Number.isInteger(cents)).toBe(true);
    expect(cents).toBe(9999);
  });
});

function renderForm(onSubmit = vi.fn(), overrides: { busy?: boolean; error?: string | null } = {}) {
  return {
    onSubmit,
    ...render(
      <I18nProvider initialLocale="es-CO">
        <TransactionForm
          categories={CATEGORIES}
          accounts={ACCOUNTS}
          currency="COP"
          busy={overrides.busy ?? false}
          error={overrides.error ?? null}
          onSubmit={onSubmit}
        />
      </I18nProvider>,
    ),
  };
}

describe('TransactionForm — estados (BP-05)', () => {
  it('pristine → botón guardar presente (CTA del formulario)', async () => {
    const { container } = renderForm();
    expect(screen.getByRole('button', { name: 'Guardar movimiento' })).toBeTruthy();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });

  it('importe 0 → error inline VALIDATION_FAILED (HU-05, role=alert)', async () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }));
    await screen.findByText('El importe debe ser mayor que cero.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('importe no numérico → error de formato', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }));
    await screen.findByText('Escribe un importe válido.');
  });

  it('importe válido + submit → onSubmit recibe centavos enteros', async () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '18.500,50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 1850050, type: 'expense', currency: 'COP' }),
    );
  });

  it('busy → botón deshabilitado con texto «Guardando…»', async () => {
    renderForm(vi.fn(), { busy: true });
    const btn = screen.getByRole('button', { name: 'Guardando…' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('transferencia sin destino → error inline (INTEGRITY_VIOLATION)', async () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);
    fireEvent.click(screen.getByRole('tab', { name: 'Transferencia' }));
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '5000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }));
    await screen.findByText('Elige una cuenta destino distinta.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('transferencia válida → onSubmit sin categoryId y con toAccountId', async () => {
    const onSubmit = vi.fn();
    renderForm(onSubmit);
    fireEvent.click(screen.getByRole('tab', { name: 'Transferencia' }));
    fireEvent.change(screen.getByLabelText('Importe'), { target: { value: '5000' } });
    fireEvent.change(screen.getByLabelText('Cuenta destino'), { target: { value: 'acc-ahorro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar movimiento' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'transfer', toAccountId: 'acc-ahorro', categoryId: null }),
    );
  });

  it('error del store → toast role=alert (BP-05 estado error)', async () => {
    const { container } = renderForm(vi.fn(), { error: 'VALIDATION_FAILED' });
    expect(screen.getByRole('alert').textContent).toBeTruthy();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});

describe('TransactionForm — axe-core (WCAG 2.1 AA)', () => {
  it('formulario completo sin violaciones', async () => {
    const { container } = renderForm();
    const results = await axe(container);
    expect(results.violations).toEqual([]);
  });
});
