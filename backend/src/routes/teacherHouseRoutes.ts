/**
 * Houses for teachers: /api/v1/houses/me
 * A teacher sees nothing here unless the principal or admissions officer put
 * them on a house (read only list of that house) or allowed them to draw
 * houses for the students of their own classes.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { UserRole } from '../types/auth';
import { houseService as svc } from '../services/houseService.js';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);
router.use(authorize(UserRole.TEACHER));

const T = (req: Request) => {
  const t = req.user?.tenant_id;
  if (!t) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  return t;
};
const U = (req: Request) => String(req.user?.id || req.auth?.userId || '');
const wrap = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** GET /me: my houses (with my post), whether I may draw, and whether I have any access at all. */
router.get('/me', wrap(async (req, res) => {
  res.json({ success: true, data: await svc.teacherAccess(T(req), U(req)) });
}));

/** GET /me/students?house_id&search: students of the houses I am attached to. */
router.get('/me/students', wrap(async (req, res) => {
  res.json({ success: true, data: await svc.teacherStudents(T(req), U(req), { house_id: str(req.query.house_id), search: str(req.query.search) }) });
}));

/** GET /me/waiting?search: students in my classes still waiting for a house (only if I may draw). */
router.get('/me/waiting', wrap(async (req, res) => {
  res.json({ success: true, data: await svc.teacherWaiting(T(req), U(req), str(req.query.search)) });
}));

/** POST /me/draw { student_id }: draw a house for one student of my classes (only if I may draw). */
router.post('/me/draw', wrap(async (req, res) => {
  const id = str(req.body?.student_id);
  if (!id) throw new AppError('Choose the student to draw for.', 400, 'VALIDATION_ERROR');
  res.json({ success: true, data: await svc.teacherDraw(T(req), U(req), id) });
}));

export default router;
