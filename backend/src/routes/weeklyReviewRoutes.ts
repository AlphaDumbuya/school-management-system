/**
 * Weekly student reviews: a teacher's short review of each student's week,
 * shown to parents beside the weekly attendance digest.
 *
 * Mounted at /api/v1/weekly-reviews. The tenant always comes from the signed-in
 * user. The demo school's read-only guard (demoReadOnly) is applied to every
 * /api/v1 write before this router, so PUT is refused there like other writes.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { UserRole } from '../types/auth';
import {
  getClassWeek,
  saveClassWeek,
  getProgress,
  getForStudent,
  assertCanViewStudent,
  studentIdForUser,
} from '@services/weeklyReviewService';

const router = Router();
router.use(authenticate, attachUserContext);

function context(req: Request): { tenantId: string; user: { id: string; role: string } } {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  if (!req.user?.id) throw new AppError('Authenticated user context is required', 401, 'UNAUTHENTICATED');
  return { tenantId, user: { id: req.user.id, role: String(req.user.role) } };
}

const staff = authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER);

/** GET /progress?week=YYYY-MM-DD → [{ class_id, class_name, students, reviewed }] */
router.get('/progress', staff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, user } = context(req);
    res.json({ success: true, data: await getProgress(tenantId, user, req.query.week) });
  } catch (error) { next(error); }
});

/** GET /class/:classId?week=YYYY-MM-DD → the class's students with that week's attendance and review */
router.get('/class/:classId', staff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, user } = context(req);
    res.json({ success: true, data: await getClassWeek(tenantId, user, req.params.classId, req.query.week) });
  } catch (error) { next(error); }
});

/** PUT /class/:classId  { week, reviews: [{ student_id, performance_rating, behaviour_rating?, comment?, clear? }] } */
router.put('/class/:classId', staff, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId, user } = context(req);
    const body = req.body || {};
    res.json({ success: true, data: await saveClassWeek(tenantId, user, req.params.classId, body.week, body.reviews) });
  } catch (error) { next(error); }
});

/** GET /my?academic_year=&term= → the signed-in student's own reviews, newest week first */
router.get('/my', authorize(UserRole.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tenantId } = context(req);
    const studentId = await studentIdForUser(tenantId, req.user!.id);
    if (!studentId) throw new AppError('Student record not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: await getForStudent(tenantId, studentId, { academic_year: req.query.academic_year, term: req.query.term }) });
  } catch (error) { next(error); }
});

/** GET /child/:studentId?academic_year=&term= → one student's reviews (their parent, themself, their teacher, principal) */
router.get(
  '/child/:studentId',
  authorize(UserRole.PARENT, UserRole.STUDENT, UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { tenantId, user } = context(req);
      await assertCanViewStudent(tenantId, user, req.params.studentId);
      res.json({ success: true, data: await getForStudent(tenantId, req.params.studentId, { academic_year: req.query.academic_year, term: req.query.term }) });
    } catch (error) { next(error); }
  },
);

export default router;
