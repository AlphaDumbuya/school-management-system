/**
 * Express 4 doesn't catch errors from async route handlers. A handler that
 * throws after an `await` (or before its own try) left the request hanging,
 * and on Node 15+ the unhandled rejection stopped the whole server, so every
 * school lost the API until it restarted.
 *
 * This patches Express's Layer once (same idea as `express-async-errors`): if
 * a handler returns a promise that rejects, or throws synchronously, the error
 * goes to next() and the normal error handler answers the request.
 * Error middleware (4 arguments) is left untouched.
 */
import { createRequire } from 'module';

const requireCjs = createRequire(import.meta.url);

let patched = false;
export function forwardAsyncRouteErrors(): void {
  if (patched) return;
  patched = true;
  try {
    const Layer = requireCjs('express/lib/router/layer.js');
    const original = Layer.prototype.handle_request;
    Layer.prototype.handle_request = function handleRequest(this: any, req: any, res: any, next: (e?: any) => void) {
      const fn = this.handle;
      if (typeof fn !== 'function' || fn.length > 3) return original.call(this, req, res, next);
      try {
        const out = fn(req, res, next);
        if (out && typeof out.then === 'function') out.then(undefined, (err: any) => next(err ?? new Error('Request failed')));
        return out;
      } catch (err) {
        next(err);
      }
    };
  } catch {
    // Express internals moved (e.g. Express 5 handles promises itself): nothing to do.
  }
}
