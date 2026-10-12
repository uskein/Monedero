/**
 * A11y gate — Design System (ESTANDAR_ACCESIBILIDAD §8: a11y:jest sin violaciones AA).
 * axe-core sobre los componentes renderizados; helper local tipado (sin augment global).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Input,
  Modal,
  MoneyInput,
  Progress,
  Segmented,
  Spinner,
  Toast,
  Toggle,
  TxRow,
} from '../src/design-system';

/** Gate a11y: ninguna violación (AA) en el subárbol renderizado. */
async function expectNoViolations(container: Element): Promise<void> {
  const results = await axe(container);
  expect(results.violations).toEqual([]);
}

describe('Design System — axe-core (WCAG 2.1 AA)', () => {
  it('Button sin violaciones', async () => {
    const { container } = render(<Button>Guardar</Button>);
    await expectNoViolations(container);
  });

  it('Field+Input con label visible y error anunciado — sin violaciones', async () => {
    const { container } = render(
      <Field label="Correo" error="Introduce un correo válido">
        {({ inputId, describedBy, invalid }) => (
          <Input inputId={inputId} describedBy={describedBy} invalid={invalid} placeholder="tu@correo.com" />
        )}
      </Field>,
    );
    await expectNoViolations(container);
  });

  it('MoneyInput — sin violaciones', async () => {
    const { container } = render(
      <MoneyInput label="Importe" currencySymbol="$" value="1500" onValueChange={() => undefined} />,
    );
    await expectNoViolations(container);
  });

  it('Segmented (tablist) — sin violaciones', async () => {
    const { container } = render(
      <Segmented
        label="Periodo"
        options={[
          { value: 'mes', label: 'Mes' },
          { value: 'semana', label: 'Semana' },
        ]}
        value="mes"
        onChange={() => undefined}
      />,
    );
    await expectNoViolations(container);
  });

  it('Toggle (role=switch) — sin violaciones', async () => {
    const { container } = render(<Toggle label="Modo oscuro" checked onChange={() => undefined} />);
    await expectNoViolations(container);
  });

  it('Progress con aria-valuenow — sin violaciones', async () => {
    const { container } = render(<Progress percent={86} label="Presupuesto Comida" />);
    await expectNoViolations(container);
  });

  it('Toast y Spinner con roles live/status — sin violaciones', async () => {
    const { container } = render(
      <div>
        <Toast tone="success">Guardado</Toast>
        <Toast tone="error">Error grave</Toast>
        <Spinner label="Cargando" />
      </div>,
    );
    await expectNoViolations(container);
  });

  it('Modal (role=dialog, aria-modal, aria-labelledby) — sin violaciones', async () => {
    const { container } = render(
      <Modal open titleId="t1" title="Confirmar" onClose={() => undefined}>
        <p>Cuerpo</p>
      </Modal>,
    );
    await expectNoViolations(container);
  });

  it('TxRow con label compuesto (signo + categoría) — sin violaciones', async () => {
    const { container } = render(
      <Card>
        <TxRow
          icon="☕"
          title="Café"
          category="Comida"
          amount="− $ 4.500"
          isIncome={false}
          ariaLabel="Café, Comida, gasto de 4.500 pesos"
        />
        <Chip tone="income">+ Ingreso</Chip>
        <EmptyState title="Vacío" copy="Sin datos" />
      </Card>,
    );
    await expectNoViolations(container);
  });
});
