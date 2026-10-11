/**
 * The demo school is read-only. Its logins are public (marketing site), so
 * any visitor could otherwise change the demo password, post announcements or
 * delete records for everyone else. Reads, signing in/out and token refresh
 * keep working; every other change gets 403 DEMO_READ_ONLY with a friendly
 * message the app shows as a toast.
 */
import { Request, Response, NextFunction } from 'express';
import { db } from '@utils/database';
import { JWTService } from '@services/jwtService';
import { AppError } from '@middleware/errorHandler';
import { isDemoTenant } from '@utils/demo';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Writes a demo visitor may still make. */
const ALLOWED = [
  '/api/v1/auth/login',
  '/api/v1/auth/logout',
  '/api/v1/auth/refresh',
  '/api/v1/auth/refresh-token',
  '/api/v1/live',
];

/** Marking the bell as read is harmless and keeps the UI quiet. */
const isMarkRead = (path: string) =>
  /^\/api\/v1\/(in-app-notifications|notifications)(\/|$)/.test(path) && /\/read(-all)?$|\/mark-(all-)?read$/.test(path);

export const demoReadOnly = async (req: Request, _res: Response, next: NextFunction) => {
  if (READ_METHODS.has(req.method.toUpperCase())) return next();
  const path = String(req.originalUrl || req.url || '').split('?')[0].replace(/\/+$/, '');
  if (ALLOWED.some((p) => path === p || path.startsWith(p + '/')) || isMarkRead(path)) return next();
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  let payload: any;
  try { payload = JWTService.verifyAccessToken(header.substring(7)); } catch { return next(); }
  if (!payload?.userId) return next();
  try {
    const user = await db('users').where({ id: payload.userId }).first('tenant_id');
    if (user?.tenant_id && (await isDemoTenant(user.tenant_id))) {
      return next(new AppError(
        'This is the WiSkul demo school, so changes are switched off. Register your school to try this with your own data.',
        403,
        'DEMO_READ_ONLY',
      ));
    }
  } catch { /* never block a real school because the lookup failed */ }
  next();
};

export default demoReadOnly;
