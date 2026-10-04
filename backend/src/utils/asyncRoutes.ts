/**
 * Express 4 does not catch errors thrown from async handlers: the promise
 * rejects, no response is ever sent (the request hangs until the client or
 * platform times out) and Node logs an unhandled rejection.
 *
 * Some legacy route modules register handlers straight on `app` and rethrow
 * from their catch blocks. Rather than edit every handler, register them
 * through this proxy: each function handler's rejection is passed to
 * `next(err)`, so the normal errorHandler answers with the right status
 * (400 / 403 / 404 / 500) and message.
 */
import type { Express, NextFunction, Request, Response } from 'express';

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'all', 'use']);

const wrap = (fn: unknown) => {
  // Leave non-functions (paths, routers) and error handlers (4 args) alone.
  if (typeof fn !== 'function' || fn.length === 4) return fn;
  return function asyncSafe(this: unknown, req: Request, res: Response, next: NextFunction) {
    try {
      const out = (fn as any).call(this, req, res, next);
      if (out && typeof (out as Promise<unknown>).catch === 'function') (out as Promise<unknown>).catch(next);
      return out;
    } catch (err) {
      return next(err);
    }
  };
};

/** An `app` whose route-registration methods forward async errors to next(). */
export function asyncSafeApp(app: Express): Express {
  return new Proxy(app, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof prop === 'string' && METHODS.has(prop) && typeof value === 'function') {
        return (...args: unknown[]) => value.apply(target, args.map(wrap));
      }
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as Express;
}
