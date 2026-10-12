/**
 * Test UI — VaultGate móvil (BP-01/BP-02): boot con lectura pendiente →
 * onboarding (3 pasos + validaciones) → tarjeta de éxito → children; y
 * locked → passphrase equivocada (alerta) → desbloqueo correcto.
 * RNTL v14: `await render` + findBy con WAIT (PBKDF2 120k ≈ 1,2 s en jest);
 * los errores de Input llevan prefijo «⚠ » → regex.
 * Fuente: BLUEPRINTS BP-01/BP-02 · F1/F2 · HU-01·02·03.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { I18nProvider } from '@monedero/i18n/react';
import { Text } from 'react-native';
import { VaultGate } from '../../src/ui/screens/VaultGate';
import { configureVaultStorage, resetVaultStore } from '../../src/state/vault.store';
import { createMemoryVaultStorage } from '../../src/infrastructure/security/memoryStorage';
import { KeyVault } from '../../src/infrastructure/security/KeyVault';

const WAIT = { timeout: 8000 };
const PASS = 'clave-maestra-1';

function renderGate() {
  return render(
    <I18nProvider initialLocale="es-CO">
      <VaultGate>
        <Text>contenido protegido</Text>
      </VaultGate>
    </I18nProvider>,
  );
}

beforeEach(() => {
  configureVaultStorage(createMemoryVaultStorage());
  resetVaultStore();
});

describe('VaultGate — boot y onboarding (BP-01)', () => {
  it('boot con lectura pendiente → «Cargando…» (sin flash de onboarding)', async () => {
    let release: (() => void) | undefined;
    const gatePromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    const base = createMemoryVaultStorage();
    configureVaultStorage({
      async getItem(key) {
        await gatePromise;
        return base.getItem(key);
      },
      setItem: (key, value) => base.setItem(key, value),
      removeItem: (key) => base.removeItem(key),
    });

    await renderGate();
    expect(screen.getByText('Cargando…')).toBeTruthy();

    release?.();
    expect(await screen.findByText('Bienvenido a Monedero', {}, WAIT)).toBeTruthy();
    expect(screen.getByText(/Tus gastos viven solo en este dispositivo/)).toBeTruthy();
  });

  it('onboarding: 3 pasos + validaciones → éxito → children', async () => {
    await renderGate();
    await fireEvent.press(await screen.findByRole('button', { name: 'Continuar' }, WAIT));

    // Paso 1: mínimo 8 caracteres
    await fireEvent.changeText(screen.getByLabelText('Contraseña maestra'), 'corta');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByText(/La contraseña debe tener al menos 8 caracteres\./)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Contraseña maestra'), PASS);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    // Paso 2: la confirmación vive error mientras no coincida
    await fireEvent.changeText(screen.getByLabelText('Repite la contraseña'), 'distinta');
    expect(screen.getByText(/Las contraseñas no coinciden\./)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Repite la contraseña'), PASS);
    expect(screen.queryByText(/Las contraseñas no coinciden\./)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Crear bóveda' }));
    expect(screen.getByText('Cifrando…')).toBeTruthy(); // busy se pinta antes de derivar

    expect(await screen.findByText('¡Bóveda lista!', {}, WAIT)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Empezar' }));
    expect(screen.getByText('contenido protegido')).toBeTruthy();
  });
});

describe('VaultGate — desbloqueo (BP-02)', () => {
  it('passphrase equivocada → alerta y sigue bloqueada; correcta → children', async () => {
    const storage = createMemoryVaultStorage();
    await new KeyVault(storage).createVault('vault-1', PASS);
    configureVaultStorage(storage);
    resetVaultStore();

    await renderGate();
    expect(await screen.findByText('Bóveda bloqueada', {}, WAIT)).toBeTruthy();

    // Equivocada: «Descifrando…» → error (GCM auth fail), sin contenido
    await fireEvent.changeText(screen.getByLabelText('Contraseña maestra'), 'passphrase-mala-1');
    await fireEvent.press(screen.getByRole('button', { name: 'Desbloquear' }));
    expect(screen.getByText('Descifrando…')).toBeTruthy();
    expect(
      await screen.findByText(/Contraseña incorrecta\. Tus datos siguen protegidos\./, {}, WAIT),
    ).toBeTruthy();
    expect(screen.queryByText('contenido protegido')).toBeNull();

    // Correcta: vuelve a derivar y abre
    await fireEvent.changeText(screen.getByLabelText('Contraseña maestra'), PASS);
    await fireEvent.press(screen.getByRole('button', { name: 'Desbloquear' }));
    expect(await screen.findByText('contenido protegido', {}, WAIT)).toBeTruthy();
  });
});
