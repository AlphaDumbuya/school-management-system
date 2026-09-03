/**
 * encryption — AES-256-GCM helpers for encrypting small secrets at rest
 * (e.g. TOTP secrets). Key is derived from ENCRYPTION_KEY (or JWT_SECRET as a
 * fallback) via scrypt, so it's a stable 32-byte key regardless of input length.
 *
 * Output format: base64(iv).base64(authTag).base64(ciphertext)
 */
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

function getKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'wiskul-default-dev-encryption-key-change-me';
  // Deterministic 32-byte key from the secret.
  return crypto.scryptSync(secret, 'wiskul-enc-salt', 32);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted payload');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
