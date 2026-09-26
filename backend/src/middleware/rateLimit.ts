/**
 * Rate limiting middleware.
 *
 * Uses a Redis-backed store when REDIS_URL is configured (required for the
 * limits to actually hold across multiple Vercel serverless instances / Docker
 * replicas), and transparently falls back to an in-memory store otherwise with
 * a loud warning — because in-memory state is per-process and does NOT protect
 * a horizontally-scaled deployment.
 *
 * Exposes purpose-built limiters:
 *   apiLimiter      — broad per-IP ceiling for the whole API surface
 *   loginLimiter    — strict, keyed by IP+email so an attacker can't rotate IPs
 *                     against one account (credential stuffing / spraying)
 *   otpLimiter      — very strict for password-reset / verification flows
 *   passkeyLimiter  — moderate for passkey register/authenticate
 */
import rateLimit, { Options, Store } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import IORedis from 'ioredis';
import { Request } from 'express';
import { logger } from '../utils/logger';

let sharedStoreFactory: (() => Store) | null = null;

// Build a Redis store when REDIS_URL is configured. On any failure we fall back
// to the library's default in-memory store (with a loud warning) so the app
// still boots — but in-memory does NOT protect a multi-instance deployment.
try {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    // enableOfflineQueue MUST stay true: rate-limit-redis synchronously loads
    // its increment Lua script the moment the store is constructed. With the
    // offline queue disabled that command throws immediately when Redis isn't
    // connected yet (cold boot / Redis down) and crashes the whole process.
    // With it enabled the command buffers until the connection is ready, and
    // if Redis never comes up the per-command errors are handled gracefully
    // (logged via the 'error' handler) rather than taking the server down.
    const client = new IORedis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: true,
      lazyConnect: false,
    });
    client.on('error', (err: Error) => logger.warn(`Rate-limit Redis error: ${err.message}`));
    sharedStoreFactory = () =>
      new RedisStore({
        sendCommand: (...args: string[]) => (client as any).call(...args),
      });
    logger.info('Rate limiting: using Redis-backed store.');
  } else {
    logger.warn(
      'Rate limiting: REDIS_URL not set — using in-memory store. This does NOT ' +
        'protect a multi-instance/serverless deployment. Set REDIS_URL in production.'
    );
  }
} catch (err) {
  logger.warn(`Rate limiting: Redis store unavailable (${(err as Error).message}); using in-memory store.`);
  sharedStoreFactory = null;
}

/** Build a limiter, attaching the shared Redis store when available. */
function makeLimiter(opts: Partial<Options>) {
  const base: Partial<Options> = {
    standardHeaders: true,
    legacyHeaders: false,
    ...opts,
  };
  if (sharedStoreFactory) {
    try {
      base.store = sharedStoreFactory();
    } catch (err) {
      // Never let a Redis store failure crash the server at boot — fall back to
      // the library's default in-memory store for this limiter.
      logger.warn(
        `Rate limiting: failed to create Redis store (${(err as Error).message}); ` +
          'falling back to in-memory for this limiter.'
      );
    }
  }
  return rateLimit(base);
}

const clientIp = (req: Request) =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

const emailKey = (req: Request) => `${(req.body?.email ?? '').toString().toLowerCase().trim()}`;

// Broad per-IP ceiling for the whole API.
export const apiLimiter = makeLimiter({
  windowMs: 60 * 1000,
  limit: 300,
  message: { success: false, error: 'Too many requests — please slow down.' },
});

// Login: strict, keyed by IP + email so rotating IPs can't spray one account
// and hammering many accounts from one IP is also capped. Successful logins
// don't count so a legitimate user isn't penalised.
export const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${clientIp(req)}:${emailKey(req)}`,
  message: { success: false, error: 'Too many login attempts. Please wait a few minutes and try again.' },
});

// Password reset / verification / OTP — even stricter.
export const otpLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `otp:${clientIp(req)}:${emailKey(req)}`,
  message: { success: false, error: 'Too many attempts. Please try again later.' },
});

// Passkey registration / authentication.
export const passkeyLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `passkey:${clientIp(req)}`,
  message: { success: false, error: 'Too many passkey attempts. Please wait and try again.' },
});
