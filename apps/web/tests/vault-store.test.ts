/**
 * Test store de bóveda — máquina de estados BP-01/BP-02 (HU-01, HU-02).
 * jsdom + localStorage real: se valida creación, bloqueo y passphrase incorrecta.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useVaultStore } from '../src/features/vault/store';

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

describe('vault store — BP-01/BP-02', () => {
  it('boot sin datos → no-vault (estado vacío del onboarding)', () => {
    useVaultStore.getState().boot();
    expect(useVaultStore.getState().status).toBe('no-vault');
  });

  it('crear bóveda válida → unlocked + persiste salt/verifier', async () => {
    const ok = await useVaultStore.getState().createVault('clave-maestra-1', 'clave-maestra-1');
    expect(ok).toBe(true);
    expect(useVaultStore.getState().status).toBe('unlocked');
    expect(localStorage.getItem('monedero.vault.salt')).toBeTruthy();
    expect(localStorage.getItem('monedero.vault.verifier')).toBeTruthy();
  });

  it('rechaza passphrase < 8 chars → VALIDATION_FAILED', async () => {
    const ok = await useVaultStore.getState().createVault('corta', 'corta');
    expect(ok).toBe(false);
    expect(useVaultStore.getState().error).toBe('VALIDATION_FAILED');
    expect(useVaultStore.getState().status).toBe('boot');
  });

  it('rechaza confirmación distinta → VALIDATION_FAILED', async () => {
    const ok = await useVaultStore.getState().createVault('clave-maestra-1', 'clave-maestra-2');
    expect(ok).toBe(false);
    expect(useVaultStore.getState().error).toBe('VALIDATION_FAILED');
  });

  it('lock → locked; unlock correcto → unlocked', async () => {
    await useVaultStore.getState().createVault('clave-maestra-1', 'clave-maestra-1');
    useVaultStore.getState().lock();
    expect(useVaultStore.getState().status).toBe('locked');

    const ok = await useVaultStore.getState().unlock('clave-maestra-1');
    expect(ok).toBe(true);
    expect(useVaultStore.getState().status).toBe('unlocked');
  });

  it('unlock con passphrase incorrecta → VAULT_WRONG_PASSPHRASE (no abre)', async () => {
    await useVaultStore.getState().createVault('clave-maestra-1', 'clave-maestra-1');
    useVaultStore.getState().lock();

    const ok = await useVaultStore.getState().unlock('passphrase-equivocada');
    expect(ok).toBe(false);
    expect(useVaultStore.getState().error).toBe('VAULT_WRONG_PASSPHRASE');
    expect(useVaultStore.getState().status).toBe('locked');
  });

  it('boot tras recarga con bóveda persistida → locked (no unlocked)', async () => {
    await useVaultStore.getState().createVault('clave-maestra-1', 'clave-maestra-1');
    // Simula recarga: estado vuelve a boot, persistencia intacta
    useVaultStore.setState({ status: 'boot' });
    useVaultStore.getState().boot();
    expect(useVaultStore.getState().status).toBe('locked');
  });

  it('clearError limpia el error', async () => {
    await useVaultStore.getState().createVault('corta', 'corta');
    expect(useVaultStore.getState().error).toBeTruthy();
    useVaultStore.getState().clearError();
    expect(useVaultStore.getState().error).toBeNull();
  });
});
