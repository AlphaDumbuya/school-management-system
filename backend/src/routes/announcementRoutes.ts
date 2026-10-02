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
import { resolveYearScope } from '@utils/academicYear';

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
      // ?academic_year= → that year's date window. Omitted/'all' = all years.
      yearScope: await resolveYearScope(user.tenant_id, req.query.academic_year),
    });
    res.json({ success: true, data: items, pagination: { total, limit, offset } });
  } catch (err) {
    next(err);
  }
});

/** GET /my-classes — classes the current teacher can announce to (for the compose dropdown). */
router.get('/my-classes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    if (user.role !== 'teacher') {
      return res.json({ success: true, data: [] });
    }
    const classes = await announcementService.getTeacherClasses(user.tenant_id, user.id);
    res.json({ success: true, data: classes });
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

/** POST / — create an announcement (staff roles; audience is constrained per role in the service). */
router.post(
  '/',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER, UserRole.ACCOUNTANT, UserRole.ADMISSIONS_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { title, body, audience, priority, notifyByEmail, classId } = req.body;
      const row = await announcementService.create({
        tenantId: user.tenant_id,
        authorId: user.id,
        authorRole: user.role,
        title,
        body,
        audience,
        priority,
        notifyByEmail: !!notifyByEmail,
        classId: classId ?? null,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  }
);

/** PUT /:id — edit an announcement. Non-admins may only edit their own. */
router.put(
  '/:id',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER, UserRole.ACCOUNTANT, UserRole.ADMISSIONS_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const { title, body, audience, priority } = req.body;
      const row = await announcementService.update(
        user.tenant_id,
        req.params.id,
        { title, body, audience, priority },
        { editorId: user.id, editorRole: user.role }
      );
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  }
);

/** DELETE /:id — remove an announcement. Non-admins may only delete their own. */
router.delete(
  '/:id',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER, UserRole.ACCOUNTANT, UserRole.ADMISSIONS_OFFICER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      await announcementService.remove(user.tenant_id, req.params.id, { editorId: user.id, editorRole: user.role });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
