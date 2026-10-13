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
import { Request, Response, NextFunction, RequestHandler } from 'express';
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
    // maxRetriesPerRequest MUST be null (not a finite number): with a finite
    // limit, a command buffered while Redis is unreachable rejects with a
    // MaxRetriesPerRequestError once the limit is hit. That rejection is NOT
    // delivered to the 'error' listener — it surfaces as an unhandled error and
    // CRASHES the whole server (exactly what happened when REDIS_URL pointed at
    // a Redis that wasn't running). With null, commands keep buffering quietly
    // and the connection retries in the background, so a down/absent Redis can
    // never take the API down — rate limiting simply degrades (fail-open).
    const client = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
      lazyConnect: false,
      // Cap reconnect backoff so we don't hammer, and never give up entirely.
      retryStrategy: (times: number) => Math.min(times * 200, 5000),
    });
    client.on('error', (err: Error) => logger.warn(`Rate-limit Redis error: ${err.message}`));
    sharedStoreFactory = () =>
      new RedisStore({
        // Swallow per-command failures so a Redis hiccup degrades to no-op
        // rather than throwing into the limiter (defense-in-depth alongside the
        // FAIL-OPEN wrapper in makeLimiter).
        sendCommand: (...args: string[]) =>
          (client as any).call(...args).catch((e: Error) => {
            logger.warn(`Rate-limit Redis command failed: ${e.message}`);
            return null;
          }),
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

  const limiter = rateLimit(base);

  // FAIL-OPEN wrapper. A rate limiter is a hardening layer, not an auth gate —
  // it must NEVER be the reason a legitimate user can't log in. If the store
  // errors at request time (e.g. Redis goes down mid-flight in production),
  // express-rate-limit forwards that error to next(err), which would surface as
  // a 500 and block the request. Here we intercept any such store error and let
  // the request proceed instead (logging it so the outage stays observable).
  // Genuine 429 rate-limit responses are unaffected — those are sent by the
  // limiter directly and never reach next().
  const failOpen: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    try {
      limiter(req, res, (err?: unknown) => {
        if (err) {
          logger.warn(`Rate limiting: store error at request time — allowing request. ${(err as Error)?.message ?? err}`);
          return next();
        }
        return next();
      });
    } catch (err) {
      logger.warn(`Rate limiting: limiter threw — allowing request. ${(err as Error)?.message ?? err}`);
      next();
    }
  };

  return failOpen;
}

export const clientIp = (req: Request) =>
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

// Changing where a school's fee payments are paid into: rare, so a low ceiling.
// (The password check inside the route has its own database-backed lock-out.)
export const paymentSettingsLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `paysettings:${clientIp(req)}`,
  message: { success: false, error: 'Too many attempts. Please wait a few minutes and try again.' },
});

// Public admission form: per IP + school. Shares the Redis store when
// REDIS_URL is set; the route also applies database caps that hold across
// serverless instances either way.
export const publicFormLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `apply:${clientIp(req)}:${String(req.params?.schoolSlug || '').toLowerCase()}`,
  message: { success: false, error: 'Too many applications from this connection. Please wait a few minutes and try again.' },
});

// "Book a live demo" form (the service also caps per email and per IP in the
// database, which holds across serverless instances).
export const demoRequestLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 6,
  keyGenerator: (req) => `demo-request:${clientIp(req)}`,
  message: { success: false, error: 'Too many demo requests from this connection. Please try again in an hour.' },
});
// Opening the demo from an emailed link.
export const demoSessionLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  keyGenerator: (req) => `demo-session:${clientIp(req)}`,
  message: { success: false, error: 'Too many attempts. Please wait a few minutes and try again.' },
});
// Passkey registration / authentication.
export const passkeyLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => `passkey:${clientIp(req)}`,
  message: { success: false, error: 'Too many passkey attempts. Please wait and try again.' },
});
