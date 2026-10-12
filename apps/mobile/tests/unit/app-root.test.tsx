/**
 * Smoke test S1 — AppRoot (móvil).
 * Corre con Jest + jest-expo. RNTL v14: `render` es async (React 19 concurrent) → await.
 */
import { render, screen } from '@testing-library/react-native';
import AppRoot from '../../src/AppRoot';

describe('AppRoot (smoke S1)', () => {
  it('renderiza el wordmark Monedero', async () => {
    await render(<AppRoot />);
    expect(screen.getByText('Monedero')).toBeTruthy();
  });

  it('expone el logo con accessibilityLabel (a11y)', async () => {
    await render(<AppRoot />);
    expect(screen.getByLabelText('Monedero, logotipo')).toBeTruthy();
  });

  it('anuncia el mensaje de privacidad (serenidad + soberanía)', async () => {
    await render(<AppRoot />);
    expect(screen.getByText(/Tus datos nunca salen de tu dispositivo/)).toBeTruthy();
  });
});
