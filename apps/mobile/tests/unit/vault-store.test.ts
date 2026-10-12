/**
 * Tests — vault store móvil (BP-01/BP-02): máquina de estados + inyección
 * de almacenamiento. Espejo de los tests del store web de la bóveda.
 * Fuente: BLUEPRINTS BP-01/BP-02 · PLAN_DE_SPRINTS 2.3.
 */
import { useVaultStore, configureVaultStorage, resetVaultStore } from '../../src/state/vault.store';
import { createMemoryVaultStorage } from '../../src/infrastructure/security/memoryStorage';
import { KeyVault } from '../../src/infrastructure/security/KeyVault';

const PASS = 'clave-maestra-1';

/** Prepara una bóveda YA CREADA en el almacenamiento (simula sesión previa). */
async function seedExistingVault(): Promise<void> {
  const storage = createMemoryVaultStorage();
  await new KeyVault(storage).createVault('vault-seed', PASS);
  configureVaultStorage(storage);
}

beforeEach(() => {
  configureVaultStorage(createMemoryVaultStorage());
  resetVaultStore();
});

describe('vault store — boot (async por SecureStore)', () => {
  it('boot sin bóveda → no-vault', async () => {
    await useVaultStore.getState().boot();
    expect(useVaultStore.getState().status).toBe('no-vault');
  });

  it('boot con Keychain ilegible → no-vault + STORAGE_UNAVAILABLE (no spinner eterno)', async () => {
    configureVaultStorage({
      async getItem() {
        throw new Error('keychain roto');
      },
      async setItem() {},
      async removeItem() {},
    });
    await useVaultStore.getState().boot();
    const st = useVaultStore.getState();
    expect(st.status).toBe('no-vault');
    expect(st.error).toBe('STORAGE_UNAVAILABLE');
  });

  it('boot con bóveda existente → locked (nunca auto-desbloquea)', async () => {
    await seedExistingVault();
    await useVaultStore.getState().boot();
    expect(useVaultStore.getState().status).toBe('locked');
  });
});

describe('vault store — crear bóveda (BP-01)', () => {
  it('validación: passphrase corta o confirmación distinta → VALIDATION_FAILED', async () => {
    const st = useVaultStore.getState();
    expect(await st.createVault('corta', 'corta')).toBe(false);
    expect(useVaultStore.getState().error).toBe('VALIDATION_FAILED');

    expect(await st.createVault(PASS, 'otra-distinta')).toBe(false);
    expect(useVaultStore.getState().error).toBe('VALIDATION_FAILED');
    expect(useVaultStore.getState().status).toBe('boot'); // nada cambió
  });

  it('crear válida → unlocked (lista para usar)', async () => {
    const ok = await useVaultStore.getState().createVault(PASS, PASS);
    expect(ok).toBe(true);
    const st = useVaultStore.getState();
    expect(st.status).toBe('unlocked');
    expect(st.error).toBeNull();
    expect(st.busy).toBe(false);
  });
});

describe('vault store — desbloquear/bloquear (BP-02)', () => {
  it('passphrase correcta → unlocked', async () => {
    await seedExistingVault();
    await useVaultStore.getState().boot();

    expect(await useVaultStore.getState().unlock(PASS)).toBe(true);
    expect(useVaultStore.getState().status).toBe('unlocked');
  });

  it('passphrase equivocada → error VAULT_WRONG_PASSPHRASE y sigue locked', async () => {
    await seedExistingVault();
    await useVaultStore.getState().boot();

    expect(await useVaultStore.getState().unlock('passphrase-mala-1')).toBe(false);
    const st = useVaultStore.getState();
    expect(st.status).toBe('locked');
    expect(st.error).toBe('VAULT_WRONG_PASSPHRASE');
    expect(st.busy).toBe(false);
  });

  it('lock → locked; clearError limpia el error', async () => {
    await useVaultStore.getState().createVault(PASS, PASS);
    useVaultStore.getState().lock();
    expect(useVaultStore.getState().status).toBe('locked');

    await useVaultStore.getState().unlock('passphrase-mala-1');
    expect(useVaultStore.getState().error).toBe('VAULT_WRONG_PASSPHRASE');
    useVaultStore.getState().clearError();
    expect(useVaultStore.getState().error).toBeNull();
  });

  it('unlock sobre un store sin bóveda → no-vault (defensivo)', async () => {
    expect(await useVaultStore.getState().unlock(PASS)).toBe(false);
    expect(useVaultStore.getState().status).toBe('no-vault');
  });
});
