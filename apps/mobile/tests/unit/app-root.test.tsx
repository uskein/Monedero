/**
 * Smoke test — AppRoot (móvil): composición raíz con hero i18n (t()) y
 * arranque del VaultGate (onboarding BP-01 al no existir bóveda).
 * RNTL v14: `await render` es async (React 19 concurrent).
 * El storage de la bóveda se inyecta con memoria tras importar AppRoot
 * (su módulo configura SecureStore de forma perezosa): en jest nunca se
 * carga expo-secure-store.
 */
import { render, screen } from '@testing-library/react-native';
import AppRoot from '../../src/AppRoot';
import { configureVaultStorage } from '../../src/state/vault.store';
import { createMemoryVaultStorage } from '../../src/infrastructure/security/memoryStorage';

beforeEach(() => {
  configureVaultStorage(createMemoryVaultStorage());
});

describe('AppRoot (composición raíz)', () => {
  it('renderiza el wordmark Monedero', async () => {
    await render(<AppRoot />);
    expect(screen.getByText('Monedero')).toBeTruthy();
  });

  it('expone el logo con accessibilityLabel (a11y)', async () => {
    await render(<AppRoot />);
    expect(screen.getByLabelText('Monedero, logotipo')).toBeTruthy();
  });

  it('anuncia el copy de privacidad vía home.lead (sin strings hardcodeados)', async () => {
    await render(<AppRoot />);
    expect(screen.getByText(/tus datos nunca salen de tu dispositivo/)).toBeTruthy();
  });

  it('arranca en el onboarding de bóveda (BP-01) tras el boot', async () => {
    await render(<AppRoot />);
    expect(await screen.findByText('Bienvenido a Monedero', {}, { timeout: 8000 })).toBeTruthy();
  });
});
