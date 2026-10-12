/**
 * AES-256-GCM — cifrado de la DB local (ADR-003). WebCrypto.
 * Formato: iv(12) || ciphertext. iv aleatorio por operación.
 */
const IV_BYTES = 12;

export async function encrypt(plaintext: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource },
      key,
      plaintext as unknown as BufferSource,
    ),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return out;
}

export async function decrypt(payload: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
  if (payload.length <= IV_BYTES) throw new Error('DECRYPT_INVALID_PAYLOAD');
  const iv = payload.subarray(0, IV_BYTES);
  const ct = payload.subarray(IV_BYTES);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    ct as unknown as BufferSource,
  );
  return new Uint8Array(pt);
}

/** SHA-256 en hex — integridad del fichero .monedero. */
export async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
