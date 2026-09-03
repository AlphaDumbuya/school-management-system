/**
 * totp — self-contained TOTP (RFC 6238) + Base32 helpers using Node's crypto.
 *
 * Avoids an external dependency. Compatible with Google Authenticator, Authy,
 * Microsoft Authenticator, etc. (SHA1, 6 digits, 30-second period).
 */
import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Generate a random Base32 secret (default 20 bytes → 32 chars). */
export function generateBase32Secret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    out += BASE32_ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return out;
}

/** Decode a Base32 string to a Buffer. */
function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
  let bits = '';
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/** Compute the TOTP code for a given secret at a given time. */
export function generateTotp(secret: string, forTime = Date.now(), period = 30, digits = 6): string {
  const counter = Math.floor(forTime / 1000 / period);
  const key = base32Decode(secret);

  const counterBuf = Buffer.alloc(8);
  // Big-endian 64-bit counter (high 32 bits are ~0 for our timeframe)
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = (binary % 10 ** digits).toString().padStart(digits, '0');
  return otp;
}

/**
 * Verify a user-supplied token, allowing a ±`window` step drift (clock skew).
 * Default window of 1 accepts the previous, current and next 30s codes.
 */
export function verifyTotp(secret: string, token: string, window = 1, period = 30, digits = 6): boolean {
  if (!secret || !token) return false;
  const normalized = token.replace(/\s/g, '');
  if (!/^\d{4,8}$/.test(normalized)) return false;
  const now = Date.now();
  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const candidate = generateTotp(secret, now + errorWindow * period * 1000, period, digits);
    // Constant-time comparison
    if (candidate.length === normalized.length && crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(normalized))) {
      return true;
    }
  }
  return false;
}

/** Build an otpauth:// URI for QR provisioning. */
export function buildOtpAuthUri(params: { secret: string; label: string; issuer: string }): string {
  const label = encodeURIComponent(params.label);
  const issuer = encodeURIComponent(params.issuer);
  return `otpauth://totp/${issuer}:${label}?secret=${params.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}
