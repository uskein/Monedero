/**
 * Tests TDD — KeyVault (KeyVaultPort móvil, plan 2.3).
 * Almacenamiento inyectado (memoria): mismo KeyVault recarga metadatos con
 * load() y una instancia NUEVA sobre el mismo storage simula «reabrir la app».
 * Fuente: CONTRATOS_API.md KeyVaultPort · BP-01/BP-02.
 */
import { DomainError } from '../../src/core/errors';
import { KeyVault } from '../../src/infrastructure/security/KeyVault';
import { createMemoryVaultStorage } from '../../src/infrastructure/security/memoryStorage';
import type { VaultStorage } from '../../src/core/ports/VaultStorage';

const PASS = 'clave-maestra-1';

describe('KeyVault — ciclo de vida (KeyVaultPort)', () => {
  it('storage vacío → load() deja hasVault() en false', async () => {
    const vault = new KeyVault(createMemoryVaultStorage());
    await vault.load();
    expect(vault.hasVault()).toBe(false);
    expect(vault.isUnlocked()).toBe(false);
  });

  it('createVault persiste salt/verifier/id y queda desbloqueada', async () => {
    const storage = createMemoryVaultStorage();
    const vault = new KeyVault(storage);
    await vault.createVault('vault-1', PASS);

    expect(vault.hasVault()).toBe(true);
    expect(vault.isUnlocked()).toBe(true);
    expect(await storage.getItem('monedero.vault.salt')).toBeTruthy();
    expect(await storage.getItem('monedero.vault.verifier')).toBeTruthy();
    expect(await storage.getItem('monedero.vault.id')).toBe('vault-1');
  });

  it('«reabrir la app»: instancia nueva + load() → metadatos presentes y CLAVE SIN CACHEAR', async () => {
    const storage = createMemoryVaultStorage();
    await new KeyVault(storage).createVault('vault-1', PASS);

    const reopened = new KeyVault(storage);
    await reopened.load();
    expect(reopened.hasVault()).toBe(true);
    expect(reopened.isUnlocked()).toBe(false); // la clave no persiste: solo en memoria
  });

  it('unlock con la passphrase correcta cachea la clave', async () => {
    const storage = createMemoryVaultStorage();
    await new KeyVault(storage).createVault('vault-1', PASS);

    const reopened = new KeyVault(storage);
    await reopened.load();
    await reopened.unlock(PASS);
    expect(reopened.isUnlocked()).toBe(true);
  });

  it('unlock con passphrase equivocada → DomainError VAULT_WRONG_PASSPHRASE', async () => {
    const storage = createMemoryVaultStorage();
    await new KeyVault(storage).createVault('vault-1', PASS);

    const reopened = new KeyVault(storage);
    await reopened.load();
    await expect(reopened.unlock('passphrase-equivocada')).rejects.toMatchObject({
      code: 'VAULT_WRONG_PASSPHRASE',
    });
    expect(reopened.isUnlocked()).toBe(false);
  });

  it('lock zeroiza la clave: isUnlocked() → false y se puede volver a desbloquear', async () => {
    const storage = createMemoryVaultStorage();
    const vault = new KeyVault(storage);
    await vault.createVault('vault-1', PASS);

    vault.lock();
    expect(vault.isUnlocked()).toBe(false);
    await vault.unlock(PASS);
    expect(vault.isUnlocked()).toBe(true);
  });

  it('createVault con passphrase corta → VALIDATION_FAILED (sin persistir nada)', async () => {
    const storage = createMemoryVaultStorage();
    const vault = new KeyVault(storage);
    await expect(vault.createVault('vault-1', 'corta')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    expect(await storage.getItem('monedero.vault.salt')).toBeNull();
  });

  it('createVault es idempotente por vaultId y rechaza otro id (VAULT_ALREADY_EXISTS)', async () => {
    const vault = new KeyVault(createMemoryVaultStorage());
    await vault.createVault('vault-1', PASS);
    await expect(vault.createVault('vault-1', PASS)).resolves.toBeUndefined();

    await expect(vault.createVault('vault-2', PASS)).rejects.toBeInstanceOf(DomainError);
    await expect(vault.createVault('vault-2', PASS)).rejects.toMatchObject({ code: 'VAULT_ALREADY_EXISTS' });
  });

  it('unlock sin bóveda cargada → VALIDATION_FAILED defensivo', async () => {
    const vault = new KeyVault(createMemoryVaultStorage());
    await expect(vault.unlock(PASS)).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('load() parcial (solo salt) cuenta como «no hay bóveda» (metadatos corruptos)', async () => {
    const storage: VaultStorage = createMemoryVaultStorage({ 'monedero.vault.salt': 'abc' });
    const vault = new KeyVault(storage);
    await vault.load();
    expect(vault.hasVault()).toBe(false);
  });
});
