/**
 * Base64 puro (sin dependencias) para el códec .monedero.enc (S7).
 * Uint8Array ⇄ string; estándar RFC 4648 (igual que btoa/atob y Buffer).
 */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += CHARS[b0 >> 2];
    out += CHARS[((b0 & 0x03) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? '=' : CHARS[((b1 & 0x0f) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? '=' : CHARS[(b2 & 0x3f)];
  }
  return out;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const outLength = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(outLength);
  let outIndex = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = CHARS.indexOf(clean[i] ?? '');
    const c1 = CHARS.indexOf(clean[i + 1] ?? '');
    const c2 = CHARS.indexOf(clean[i + 2] ?? '');
    const c3 = CHARS.indexOf(clean[i + 3] ?? '');
    out[outIndex++] = (c0 << 2) | (c1 >> 4);
    if (c2 >= 0) out[outIndex++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
    if (c3 >= 0) out[outIndex++] = ((c2 & 0x03) << 6) | c3;
  }
  return out.subarray(0, outIndex);
}
