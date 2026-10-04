/**
 * Live portal sync — per-tenant change counter (tenants.sync_version).
 *
 * The API runs serverless (Vercel), so we can't hold WebSockets open. Instead
 * every structural write bumps the school's counter, and open apps poll
 * GET /api/v1/live/version. When the number moves they refetch their data and
 * re-check the signed-in user's role, so promotions / a new academic year /
 * role changes show up within seconds everywhere.
 */
import type { Request, Response, NextFunction } from 'express';
import db from '@utils/database';
import { logger } from '@utils/logger';

/** Increment a tenant's sync counter. Best-effort: never throws. */
export async function bumpTenantSync(tenantId: string | null | undefined): Promise<void> {
  if (!tenantId) return;
  try {
    await db('tenants').where({ id: tenantId }).increment('sync_version', 1);
  } catch (e) {
    logger.warn(`liveSync: failed to bump tenant ${tenantId}: ${(e as Error).message}`);
  }
}

/** Read a tenant's current counter as a string (bigint-safe). */
export async function getTenantSync(tenantId: string): Promise<string> {
  const row = await db('tenants').where({ id: tenantId }).select('sync_version').first();
  return String(row?.sync_version ?? '0');
}

// Route groups whose successful writes change what OTHER users' portals show:
// enrollment/class/promotion/year/role/staff/timetable/results-release changes.
// High-frequency writes (attendance marking, score entry, messaging) are
// deliberately NOT here so we don't make every open app refetch constantly.
const STRUCTURAL_PREFIXES = [
  '/api/v1/promotions',
  '/api/v1/school-config',
  '/api/v1/users',
  '/api/v1/auth/users',
  '/api/v1/roles',
  '/api/v1/students',
  '/api/v1/guardians',
  '/api/v1/classes',
  '/api/v1/enrollments',
  '/api/v1/admissions',
  '/api/v1/teachers',
  '/api/v1/staff',
  '/api/v1/subjects',
  '/api/v1/timetable',
  '/api/v1/fee-structures',
  '/api/v1/report-cards/publish',
];

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isStructural(path: string): boolean {
  return STRUCTURAL_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

/**
 * Express middleware (mount once, before the routers). For a successful
 * structural write it bumps the caller's tenant counter BEFORE the response is
 * flushed — on serverless, work after the response may never run.
 */
export function liveSyncMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING.has(req.method) || !isStructural(req.originalUrl.split('?')[0])) {
    return next();
  }

  const originalEnd = res.end.bind(res) as (...args: any[]) => Response;
  let handled = false;

  (res as any).end = (...args: any[]) => {
    if (handled) return originalEnd(...args);
    handled = true;

    if (res.statusCode < 200 || res.statusCode >= 300) {
      return originalEnd(...args);
    }

    // Tenant comes from the route's own auth (attachUserContext sets req.user);
    // fall back to a lookup by the verified token's userId.
    const resolveTenant = async (): Promise<string | null> => {
      const direct = (req as any).user?.tenant_id || (req as any).auth?.tenantId;
      if (direct) return direct;
      const userId = (req as any).auth?.userId;
      if (!userId) return null;
      const u = await db('users').where({ id: userId }).select('tenant_id').first();
      return u?.tenant_id ?? null;
    };

    // Cap the extra latency: if the DB is slow, send the response anyway.
    const bump = resolveTenant().then(bumpTenantSync).catch(() => undefined);
    const timeout = new Promise((r) => setTimeout(r, 1500));
    Promise.race([bump, timeout]).finally(() => originalEnd(...args));
    return res;
  };

  next();
}
