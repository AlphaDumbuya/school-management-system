/**
 * publicUrl — the ONE place that decides the public address of the app, used
 * for every link the server puts in an email, PDF, QR code or payment redirect.
 *
 * Why this exists: FRONTEND_URL doubles as the CORS allow-list and is often a
 * comma-separated list that starts with http://localhost:5173. Taking its first
 * entry (or the whole value) put localhost links and logo URLs into production
 * emails.
 *
 * Resolution, first match wins:
 *   1. PUBLIC_APP_URL, APP_URL, FRONTEND_URL (every comma-separated entry)
 *   2. Vercel's production domain (VERCEL_PROJECT_PRODUCTION_URL)
 *   3. The host real browsers reach the API on (remembered from requests)
 *   4. https://www.wiskulsl.com
 * In production, localhost / private / plain-http candidates are skipped.
 */

const DEFAULT_APP_URL = 'https://www.wiskulsl.com';
const LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)$/i;

let rememberedOrigin: string | null = null;

const isProduction = () => process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

function normalise(raw: string): string | null {
  const v = String(raw || '').trim().replace(/\/+$/, '');
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** Usable as a public link? (production: https and not a local address). */
function isPublic(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (!isProduction()) return true;
    return u.protocol === 'https:' && !LOCAL.test(u.hostname);
  } catch {
    return false;
  }
}

function candidates(): string[] {
  const list: string[] = [];
  for (const key of ['PUBLIC_APP_URL', 'APP_URL', 'FRONTEND_URL']) {
    for (const part of String(process.env[key] || '').split(',')) {
      const n = normalise(part);
      if (n) list.push(n);
    }
  }
  const vercelProd = normalise(process.env.VERCEL_PROJECT_PRODUCTION_URL || '');
  if (vercelProd) list.push(vercelProd);
  if (rememberedOrigin) list.push(rememberedOrigin);
  return list;
}

/** Public origin of the web app, e.g. https://www.wiskulsl.com (no trailing slash). */
export function publicAppUrl(): string {
  const all = candidates();
  // In development a localhost URL is fine (and expected).
  return all.find(isPublic) || (isProduction() ? DEFAULT_APP_URL : all[0] || DEFAULT_APP_URL);
}

/** Public origin of the API (same as the app on Vercel unless PUBLIC_API_URL is set). */
export function publicApiUrl(): string {
  const explicit = normalise(String(process.env.PUBLIC_API_URL || '').split(',')[0]);
  return explicit && isPublic(explicit) ? explicit : publicAppUrl();
}

/** Absolute link into the app; `path` should start with '/'. */
export function appUrl(path = '/'): string {
  return `${publicAppUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Remember the public host browsers actually use (from proxied API requests),
 * so links stay correct even when no URL env var is configured. Only public
 * https hosts are remembered; the first good one sticks.
 */
export function rememberRequestOrigin(headers: Record<string, any>): void {
  if (rememberedOrigin) return;
  const host = String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim();
  const proto = String(headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  if (!host || proto !== 'https') return;
  const origin = normalise(`https://${host}`);
  if (!origin || !isPublic(origin)) return;
  // Preview deployments (*.vercel.app) are not the school-facing address.
  if (/\.vercel\.app$/i.test(new URL(origin).hostname) && process.env.VERCEL_ENV === 'production') return;
  rememberedOrigin = origin;
}

/** Test hook. */
export function _resetPublicUrlForTests() { rememberedOrigin = null; }
