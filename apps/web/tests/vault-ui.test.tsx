/**
 * Test UI — VaultGate/Onboarding (HU-01/HU-02): 4 estados + a11y.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VaultGate } from '../src/features/vault/VaultGate';
import type { VaultGateStrings } from '../src/features/vault/VaultGate';
import { useVaultStore } from '../src/features/vault/store';

const s: VaultGateStrings = {
  lockTitle: 'Bóveda bloqueada',
  lockCopy: 'Introduce tu contraseña.',
  passphraseLabel: 'Contraseña maestra',
  unlock: 'Desbloquear',
  loading: 'Descifrando…',
  errorWrong: 'Contraseña incorrecta.',
  successTitle: '¡Bóveda lista!',
  successCopy: 'Datos cifrados.',
  successCta: 'Empezar',
  onboarding: {
    welcomeTitle: 'Bienvenido a Monedero',
    welcomeCopy: 'Tus gastos viven solo en este dispositivo.',
    createTitle: 'Crea tu contraseña maestra',
    createCopy: 'Cifra todo localmente.',
    passphraseLabel: 'Contraseña maestra',
    passphraseHint: 'Mínimo 8 caracteres',
    confirmLabel: 'Repite la contraseña',
    confirmHint: 'Escribe la misma contraseña',
    errorMin: 'La contraseña debe tener al menos 8 caracteres.',
    errorMatch: 'Las contraseñas no coinciden.',
    next: 'Continuar',
    back: 'Atrás',
    finish: 'Crear bóveda',
    loading: 'Cifrando…',
    successTitle: '¡Bóveda lista!',
    successCopy: 'Datos cifrados.',
  },
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useVaultStore.setState({
    status: 'boot',
    saltHex: null,
    verifierHex: null,
    vaultId: null,
    error: null,
    busy: false,
  });
});

describe('VaultGate — estados BP-02', () => {
  it('estado vacío (no-vault) → muestra Onboarding BP-01', async () => {
    render(<VaultGate s={s} />);
    expect(await screen.findByText('Bienvenido a Monedero')).toBeTruthy();
  });

  it('estado locked → formulario con contraseña', async () => {
    await useVaultStore.getState().createVault('clave-maestra-1', 'clave-maestra-1');
    useVaultStore.getState().lock();
    render(<VaultGate s={s} />);
    expect(await screen.findByText('Bóveda bloqueada')).toBeTruthy();
    expect(screen.getByLabelText('Contraseña maestra')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeTruthy();
  });

  it('estado error → anuncia passphrase incorrecta con role=alert', async () => {
    await useVaultStore.getState().createVault('clave-maestra-1', 'clave-maestra-1');
    useVaultStore.getState().lock();
    render(<VaultGate s={s} />);
    const input = (await screen.findByLabelText('Contraseña maestra')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'equivocada-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Contraseña incorrecta'));
    expect(useVaultStore.getState().status).toBe('locked');
  });

  it('estado éxito → unlock correcto desbloquea', async () => {
    await useVaultStore.getState().createVault('clave-maestra-1', 'clave-maestra-1');
    useVaultStore.getState().lock();
    render(<VaultGate s={s} />);
    const input = (await screen.findByLabelText('Contraseña maestra')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'clave-maestra-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));
    await waitFor(() => expect(useVaultStore.getState().status).toBe('unlocked'));
  });
});
