/**
 * Announcement Routes — /api/v1/announcements
 *
 * Tenant-scoped. Principals/teachers can post; everyone in the tenant can read
 * (filtered to their audience). Only principals/super admins can delete.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { UserRole } from '../types/auth';
import announcementService from '../services/announcementService';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

/** GET / — list announcements visible to the current user (paginated + read state). */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const { items, total } = await announcementService.list(user.tenant_id, {
      viewerRole: user.role,
      viewerId: user.id,
      limit,
      offset,
    });
    res.json({ success: true, data: items, pagination: { total, limit, offset } });
  } catch (err) {
    next(err);
  }
});

/** GET /unread-count — number of unread announcements for the current user. */
router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const count = await announcementService.unreadCount(user.tenant_id, user.id, user.role);
    res.json({ success: true, data: { count } });
  } catch (err) {
    next(err);
  }
});

/** POST /:id/read — mark one announcement read. */
router.post('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    await announcementService.markRead(user.tenant_id, user.id, req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/** POST /read-all — mark all visible announcements read. */
router.post('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    await announcementService.markAllRead(user.tenant_id, user.id, user.role);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/** POST / — create an announcement (principal, teacher, super admin). */
router.post(
  '/',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { title, body, audience, priority, notifyByEmail } = req.body;
      const row = await announcementService.create({
        tenantId: user.tenant_id,
        authorId: user.id,
        title,
        body,
        audience,
        priority,
        notifyByEmail: !!notifyByEmail,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  }
);

/** PUT /:id — edit an announcement (principal, super admin, teacher). */
router.put(
  '/:id',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { title, body, audience, priority } = req.body;
      const row = await announcementService.update(user.tenant_id, req.params.id, { title, body, audience, priority });
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  }
);

/** DELETE /:id — remove an announcement (principal, super admin). */
router.delete(
  '/:id',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      await announcementService.remove(user.tenant_id, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
