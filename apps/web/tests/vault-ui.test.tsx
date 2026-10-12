/**
 * Test UI — VaultGate/Onboarding (HU-01/HU-02): 4 estados + a11y + i18n.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '@monedero/i18n/react';
import { VaultGate } from '../src/features/vault/VaultGate';
import { useVaultStore } from '../src/features/vault/store';

function renderGate() {
  return render(
    <I18nProvider initialLocale="es-CO">
      <VaultGate>
        <p>contenido-desbloqueado</p>
      </VaultGate>
    </I18nProvider>,
  );
}

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

describe('VaultGate — estados BP-02 (i18n es-CO)', () => {
  it('estado vacío (no-vault) → muestra Onboarding BP-01', async () => {
    renderGate();
    expect(await screen.findByText('Bienvenido a Monedero')).toBeTruthy();
  });

  it('estado locked → formulario con contraseña', async () => {
    await useVaultStore.getState().createVault('clave-maestra-1', 'clave-maestra-1');
    useVaultStore.getState().lock();
    renderGate();
    expect(await screen.findByText('Bóveda bloqueada')).toBeTruthy();
    expect(screen.getByLabelText('Contraseña maestra')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeTruthy();
  });

  it('estado error → anuncia passphrase incorrecta con role=alert', async () => {
    await useVaultStore.getState().createVault('clave-maestra-1', 'clave-maestra-1');
    useVaultStore.getState().lock();
    renderGate();
    const input = (await screen.findByLabelText('Contraseña maestra')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'equivocada-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Contraseña incorrecta'));
    expect(useVaultStore.getState().status).toBe('locked');
  });

  it('estado éxito → unlock correcto muestra children', async () => {
    await useVaultStore.getState().createVault('clave-maestra-1', 'clave-maestra-1');
    useVaultStore.getState().lock();
    renderGate();
    const input = (await screen.findByLabelText('Contraseña maestra')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'clave-maestra-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Desbloquear' }));
    await waitFor(() => expect(screen.getByText('contenido-desbloqueado')).toBeTruthy());
  });
});

describe('Onboarding BP-01 — validación', () => {
  it('passphrase < 8 muestra error role=alert (estado error)', async () => {
    renderGate();
    await screen.findByText('Bienvenido a Monedero');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Crea tu contraseña maestra');

    const input = screen.getByPlaceholderText('Mínimo 8 caracteres');
    fireEvent.change(input, { target: { value: 'corta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByRole('alert').textContent).toContain('al menos 8 caracteres');
    // no avanza de paso
    expect(screen.getByText('Crea tu contraseña maestra')).toBeTruthy();
  });

  it('crear bóveda completa → pantalla de éxito 4/4 (estado success)', async () => {
    renderGate();
    await screen.findByText('Bienvenido a Monedero');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByText('Crea tu contraseña maestra');

    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), {
      target: { value: 'clave-maestra-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByRole('heading', { name: 'Repite la contraseña' });

    fireEvent.change(screen.getByPlaceholderText('Escribe la misma contraseña'), {
      target: { value: 'clave-maestra-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Crear bóveda' }));

    expect(await screen.findByText('¡Bóveda lista!')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('cifrados');
  });

  it('confirmación distinta → avisa (estado error en paso 3)', async () => {
    renderGate();
    await screen.findByText('Bienvenido a Monedero');
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.change(await screen.findByPlaceholderText('Mínimo 8 caracteres'), {
      target: { value: 'clave-maestra-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByRole('heading', { name: 'Repite la contraseña' });

    fireEvent.change(screen.getByPlaceholderText('Escribe la misma contraseña'), {
      target: { value: 'otra-clave-distinta' },
    });
    expect(screen.getByRole('alert').textContent).toContain('no coinciden');
  });
});
