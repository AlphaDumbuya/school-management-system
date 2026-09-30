/**
 * Live portal sync routes.
 *
 *  GET /api/v1/live/version — the caller's school change counter. Cheap
 *  (one indexed PK read). Apps poll this while visible and refetch when it
 *  changes. Tenant-scoped via the verified token; super admins (no tenant) get
 *  a constant so their client simply never triggers a refresh from this.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext } from '@middleware/authMiddleware';
import { getTenantSync } from '@utils/liveSync';

const router = Router();

router.get('/version', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = (req as any).user?.tenant_id as string | undefined;
    const version = tenantId ? await getTenantSync(tenantId) : '0';
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data: { version } });
  } catch (error) {
    next(error);
  }
});

export default router;
