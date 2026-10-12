/**
 * Persistencia cifrada interina del repo dev móvil (ADR-003).
 * Con storage en memoria + crypto real (AES-256-GCM con clave aleatoria):
 *  - guardar → crear segunda instancia → los datos RESTAURAN;
 *  - snapshot con otra clave → se descarta y arranca limpio;
 *  - sin crypto → RAM pura (comportamiento antiguo).
 * Jest (globals): NO importar de vitest.
 */
import { randomBytes } from '../../src/infrastructure/security/random';
import { encrypt, decrypt } from '../../src/infrastructure/security/aesGcm';
import { createMemorySnapshotStorage } from '../../src/infrastructure/db/snapshotStorage';
import { createDevRepository, type DevRepositoryCrypto } from '../../src/infrastructure/db/createDevRepository';
import type { TxInput } from '../../src/core/domain/transaction';

function cryptoOf(key: Uint8Array): DevRepositoryCrypto {
  return {
    encryptBytes: (d) => encrypt(d, key),
    decryptBytes: (p) => decrypt(p, key),
  };
}

const TX: TxInput = {
  type: 'expense',
  amountCents: 18_500,
  currency: 'COP',
  date: '2026-10-11',
  accountId: 'acc-efectivo',
  toAccountId: null,
  categoryId: 'cat-comida',
  payee: 'Almuerzo',
};

describe('createDevRepository — persistencia cifrada interina (ADR-003)', () => {
  it('los datos escritos RESTAURAN en una nueva instancia con la misma clave', async () => {
    const key = await randomBytes(32);
    const storage = createMemorySnapshotStorage();

    const first = await createDevRepository({ crypto: cryptoOf(key), storage });
    await first.repo.create(TX);
    await first.persist();

    const second = await createDevRepository({ crypto: cryptoOf(key), storage });
    const items = await second.repo.list({});
    expect(items).toHaveLength(1);
    expect(items[0]?.payee).toBe('Almuerzo');
    expect(items[0]?.amountCents).toBe(18_500);
    // el seed NO duplica en la BD restaurada
    const cats = await second.categories.list();
    expect(cats.filter((c) => c.id === 'cat-comida')).toHaveLength(1);
  });

  it('el snapshot está CIFRADO: sin la clave no hay datos legibles', async () => {
    const key = await randomBytes(32);
    const storage = createMemorySnapshotStorage();
    const repo = await createDevRepository({ crypto: cryptoOf(key), storage });
    await repo.repo.create(TX);
    await repo.persist();

    const blob = storage.data;
    expect(blob).not.toBeNull();
    // Nunca en claro: los bytes no contienen el payee (búsqueda por bytes ASCII).
    const needle = 'Almuerzo';
    const hay = Array.from(blob!)
      .map((b) => String.fromCharCode(b))
      .join('');
    expect(hay).not.toContain(needle);
    // y descifrar con OTRA clave lanza (GCM autentica)
    const otherKey = await randomBytes(32);
    await expect(decrypt(blob!, otherKey)).rejects.toThrow();
  });

  it('snapshot con clave distinta → se descarta y arranca limpio (sin bloquear)', async () => {
    const keyA = await randomBytes(32);
    const keyB = await randomBytes(32);
    const storage = createMemorySnapshotStorage();
    const repoA = await createDevRepository({ crypto: cryptoOf(keyA), storage });
    await repoA.repo.create(TX);
    await repoA.persist();

    const repoB = await createDevRepository({ crypto: cryptoOf(keyB), storage });
    expect(await repoB.repo.list({})).toHaveLength(0);
    expect(storage.data).toBeNull(); // snapshot ilegible descartado
  });

  it('sin crypto → RAM pura (sin persistencia, como antes)', async () => {
    const repo = await createDevRepository();
    await repo.repo.create(TX);
    await repo.persist(); // no-op seguro
    const second = await createDevRepository();
    expect(await second.repo.list({})).toHaveLength(0);
  });

  it('dispose desuscribe y hace guardado final', async () => {
    const key = await randomBytes(32);
    const storage = createMemorySnapshotStorage();
    const repo = await createDevRepository({ crypto: cryptoOf(key), storage });
    await repo.repo.create(TX);
    repo.dispose();
    await new Promise<void>((r) => setTimeout(r, 50)); // el guardado final es async
    const second = await createDevRepository({ crypto: cryptoOf(key), storage });
    expect(await second.repo.list({})).toHaveLength(1);
  });
});
