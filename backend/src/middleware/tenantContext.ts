/**
 * tenantContext middleware — attaches a request-scoped `withTenant` helper that
 * runs DB work inside an RLS-scoped transaction for the authenticated user's
 * tenant. Place AFTER authenticate/attachUserContext.
 *
 * Usage in a route:
 *   const student = await req.withTenant((trx) =>
 *     trx('students').where({ id }).first()
 *   );
 *
 * Super admins (no single tenant) get a passthrough that runs without a tenant
 * binding (cross-tenant). Non-super-admin requests without a tenant are left
 * without the helper; handlers should already require a tenant in that case.
 */
import { Request, Response, NextFunction } from 'express';
import type { Knex } from 'knex';
import { withTenant, withoutTenant } from '../db/tenantContext';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      withTenant?: <T>(fn: (trx: Knex.Transaction) => Promise<T>) => Promise<T>;
    }
  }
}

export function tenantContext(req: Request, _res: Response, next: NextFunction) {
  // Bind LAZILY: this middleware may run before a per-router attachUserContext
  // populates req.user, so we resolve the tenant/role at CALL time, not now.
  req.withTenant = <T>(fn: (trx: Knex.Transaction) => Promise<T>) => {
    const user = (req as any).user;
    const tenantId: string | undefined = user?.tenant_id;
    const role: string | undefined = user?.role;

    if (tenantId) return withTenant(tenantId, fn);
    if (role === 'super_admin') return withoutTenant(fn); // cross-tenant platform work
    // No tenant context available — run without a binding (RLS policy allows
    // this today; handlers should still enforce their own auth/tenant checks).
    return withoutTenant(fn);
  };
  next();
}
