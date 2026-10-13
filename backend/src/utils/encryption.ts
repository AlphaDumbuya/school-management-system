/**
 * encryption — AES-256-GCM helpers for encrypting small secrets at rest
 * (e.g. TOTP secrets, a school's payment access token). Key is derived from
 * ENCRYPTION_KEY (or JWT_SECRET as a fallback) via scrypt, so it's a stable
 * 32-byte key regardless of input length.
 *
 * Output formats:
 *  - legacy:  base64(iv).base64(authTag).base64(ciphertext)
 *  - bound:   v2.base64(iv).base64(authTag).base64(ciphertext)
 *    A "bound" secret is encrypted with a context string (for example
 *    "monime:<tenantId>:<spaceId>") as GCM additional authenticated data. It
 *    only decrypts with the same context, so copying the stored value to
 *    another school's row, or changing the space it belongs to, makes it
 *    unreadable instead of silently redirecting money.
 */
import crypto from 'crypto';
import { logger } from './logger.js';

const ALGO = 'aes-256-gcm';
const BOUND_PREFIX = 'v2.';
let warnedWeakKey = false;

function getKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'wiskul-default-dev-encryption-key-change-me';
  if (!process.env.ENCRYPTION_KEY && process.env.NODE_ENV === 'production' && !warnedWeakKey) {
    warnedWeakKey = true;
    logger.error(
      'ENCRYPTION_KEY is not set in production: stored secrets (payment tokens, 2FA seeds) are protected only by JWT_SECRET or a built-in default. Set a dedicated ENCRYPTION_KEY.',
    );
  }
  // Deterministic 32-byte key from the secret.
  return crypto.scryptSync(secret, 'wiskul-enc-salt', 32);
}

/** Encrypt a secret. With `context` the result is bound to it (see above). */
export function encryptSecret(plain: string, context?: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  if (context) cipher.setAAD(Buffer.from(context, 'utf8'));
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const body = `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
  return context ? `${BOUND_PREFIX}${body}` : body;
}

/** True when the stored value is bound to a context (needs the same context to decrypt). */
export function isBoundSecret(payload: string): boolean {
  return typeof payload === 'string' && payload.startsWith(BOUND_PREFIX);
}

/**
 * Decrypt a secret. A bound value ("v2.") needs the context it was encrypted
 * with, and fails if it is missing or different. A legacy value decrypts as before.
 */
export function decryptSecret(payload: string, context?: string): string {
  const bound = isBoundSecret(payload);
  const raw = bound ? payload.slice(BOUND_PREFIX.length) : payload;
  const [ivB64, tagB64, dataB64] = raw.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Invalid encrypted payload');
  if (bound && !context) throw new Error('Encrypted payload requires its context');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  if (bound && context) decipher.setAAD(Buffer.from(context, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
