/**
 * Test UI + dinero — TransactionForm móvil (BP-05): parseAmountToCents → centavos
 * enteros + validaciones. Fuente: BLUEPRINTS BP-05 · HU-05 · HU-18.
 * RNTL v14 + React 19: los TextInput CONTROLADOS se llenan con `userEvent.type`
 * y los botones/chips con `userEvent.press` (UNIFICAR en userEvent evita el
 * «overlapping act» de mezclar act async de userEvent con act sync de fireEvent,
 * que rompía el flush del estado y la llamada a onSubmit).
 * Aislado del store (onSubmit mock): sin acople con init asíncrono.
 */
import { render, screen, userEvent } from '@testing-library/react-native';
import { I18nProvider } from '@monedero/i18n/react';
import { TransactionForm } from '../../src/ui/screens/TransactionForm';
import type { TxInput } from '../../src/core/domain/transaction';

const ACCOUNTS = [
  { id: 'acc-efectivo', name: 'Efectivo' },
  { id: 'acc-ahorro', name: 'Ahorro' },
];
const CATEGORIES = [
  { id: 'cat-comida', name: 'Comida' },
  { id: 'cat-salario', name: 'Salario' },
];

async function renderForm(onSubmit: (i: TxInput) => void = () => {}) {
  return await render(
    <I18nProvider initialLocale="es-CO">
      <TransactionForm categories={CATEGORIES} accounts={ACCOUNTS} currency="COP" onSubmit={onSubmit} />
    </I18nProvider>,
  );
}

describe('TransactionForm — dinero a centavos enteros (BP-05/HU-05/HU-18)', () => {
  it('importe válido "18.500" → onSubmit recibe 1850000 centavos', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await renderForm(onSubmit);
    await user.type(screen.getByLabelText('Importe'), '18.500');
    await user.press(screen.getByRole('button', { name: 'Guardar movimiento' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 1850000, type: 'expense', currency: 'COP' }),
    );
  });

  it('importe "18.500,50" → 1850050 centavos (miles + decimal, siempre entero)', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await renderForm(onSubmit);
    await user.type(screen.getByLabelText('Importe'), '18.500,50');
    await user.press(screen.getByRole('button', { name: 'Guardar movimiento' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amountCents: 1850050 }));
    expect(Number.isInteger(onSubmit.mock.calls[0][0].amountCents)).toBe(true);
  });

  it('importe 0 → error inline y NO se envía (HU-05)', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await renderForm(onSubmit);
    await user.type(screen.getByLabelText('Importe'), '0');
    await user.press(screen.getByRole('button', { name: 'Guardar movimiento' }));
    // Input renderiza el error como "⚠ {error}" → match parcial por regex.
    expect(screen.getByText(/El importe debe ser mayor que cero/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('importe no numérico → error de formato y NO se envía', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await renderForm(onSubmit);
    await user.type(screen.getByLabelText('Importe'), 'abc');
    await user.press(screen.getByRole('button', { name: 'Guardar movimiento' }));
    expect(screen.getByText(/Escribe un importe válido/)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('TransactionForm — transferencias (CHECKs del modelo)', () => {
  it('transferencia sin destino → error y NO se envía', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await renderForm(onSubmit);
    await user.press(screen.getByRole('button', { name: 'Transferencia' }));
    await user.type(screen.getByLabelText('Importe'), '5000');
    await user.press(screen.getByRole('button', { name: 'Guardar movimiento' }));
    expect(screen.getByText('Elige una cuenta destino distinta.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('transferencia válida → onSubmit con toAccountId y SIN categoría', async () => {
    const onSubmit = jest.fn();
    const user = userEvent.setup();
    await renderForm(onSubmit);
    await user.press(screen.getByRole('button', { name: 'Transferencia' }));
    await user.type(screen.getByLabelText('Importe'), '5000');
    await user.press(screen.getByRole('button', { name: 'Cuenta destino: Ahorro' }));
    await user.press(screen.getByRole('button', { name: 'Guardar movimiento' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'transfer', toAccountId: 'acc-ahorro', categoryId: null }),
    );
  });

  it('al elegir transferencia se oculta Categoría y aparece destino', async () => {
    const user = userEvent.setup();
    await renderForm();
    expect(screen.queryByLabelText('Categoría')).toBeNull();
    await user.press(screen.getByRole('button', { name: 'Transferencia' }));
    expect(screen.getByLabelText('Cuenta destino: Ahorro')).toBeTruthy();
  });
});
