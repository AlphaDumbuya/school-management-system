/**
 * Sync Routes — teacher offline-first sync.
 *   GET  /api/v1/sync/pull?since=<iso>  — teacher-scoped changed rows
 *   POST /api/v1/sync/push              — batch apply queued local writes (idempotent)
 *
 * Teacher-only (principals/super admins are online-first and use the normal
 * endpoints). Scope is resolved from the authenticated teacher's classes.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware';
import { UserRole } from '../types/auth';
import { AppError } from '../middleware/errorHandler';
import { SyncService } from '../services/syncService';

const router = Router();

function tenantOf(req: Request): string {
  const tenantId = req.user?.tenant_id || (req.auth as any)?.tenantId;
  if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  return tenantId;
}

router.get('/pull', authenticate, attachUserContext, authorize(UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).auth?.userId;
    const data = await SyncService.pull(userId, tenantOf(req), req.query.since as string | undefined);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/push', authenticate, attachUserContext, authorize(UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || (req as any).auth?.userId;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) return res.json({ success: true, data: [] });
    const results = await SyncService.push(userId, tenantOf(req), items);
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

export default router;
