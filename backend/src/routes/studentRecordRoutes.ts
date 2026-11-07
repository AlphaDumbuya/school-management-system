/**
 * Completing the records of students enrolled before the system.
 *
 * Staff (principal, admissions officer):  /api/v1/student-records/...
 * Parents (no login, personal link):      /api/v1/public/student-update/:token
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { studentUpdateLimiter, studentCheckLimiter } from '@middleware/rateLimit';
import { UserRole } from '../types/auth';
import { studentRecordService as svc } from '../services/studentRecordService';

const wrap = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const T = (req: Request) => {
  const t = req.user?.tenant_id;
  if (!t) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  return t;
};
const U = (req: Request) => ({ id: String(req.user?.id || req.auth?.userId) });

export const staffRouter = Router();
staffRouter.use(authenticate);
staffRouter.use(attachUserContext);
staffRouter.use(authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER));

/** The form fields, so the screens and the server read one list. */
staffRouter.get('/meta', wrap(async (_req, res) => { res.json({ success: true, data: { fields: svc.fields } }); }));
/** GET ?class_id&search&filter=all|incomplete|complete|no_photo|pending|no_link&page&limit */
staffRouter.get('/', wrap(async (req, res) => { res.json({ success: true, data: await svc.completeness(T(req), req.query as any) }); }));
/** POST { student_ids? | class_id, only_incomplete?, days? }: the links come back once, here. */
staffRouter.post('/links', wrap(async (req, res) => { res.status(201).json({ success: true, data: await svc.createLinks(T(req), U(req).id, req.body || {}) }); }));
/** GET ?status=pending|approved|rejected */
staffRouter.get('/updates', wrap(async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(String(req.query.status)) ? String(req.query.status) : 'pending';
  res.json({ success: true, data: await svc.listUpdates(T(req), status) });
}));
staffRouter.post('/updates/:id/approve', wrap(async (req, res) => { res.json({ success: true, data: await svc.approve(T(req), U(req), req.params.id, req.body?.overrides) }); }));
staffRouter.post('/updates/:id/reject', wrap(async (req, res) => { res.json({ success: true, data: await svc.reject(T(req), U(req), req.params.id, req.body?.note) }); }));
/** The message parents read before the form (default or the school's own wording). */
staffRouter.get('/welcome', wrap(async (req, res) => { res.json({ success: true, data: await svc.getWelcome(T(req)) }); }));
/** PUT { message }: an empty message restores the default. */
staffRouter.put('/welcome', wrap(async (req, res) => { res.json({ success: true, data: await svc.setWelcome(T(req), U(req).id, req.body?.message) }); }));
/** The school's one shared link (for the parents' WhatsApp group). */
staffRouter.get('/shared-link', wrap(async (req, res) => { res.json({ success: true, data: await svc.sharedLink(T(req)) }); }));
/** POST { days? }: makes a new link and closes the old one. No days = no expiry. */
staffRouter.post('/shared-link', wrap(async (req, res) => { res.status(201).json({ success: true, data: await svc.createSharedLink(T(req), U(req).id, req.body?.days) }); }));
staffRouter.delete('/shared-link', wrap(async (req, res) => { res.json({ success: true, data: await svc.closeSharedLink(T(req)) }); }));
/** Attach a submission that could not be matched by name to the student the officer picked. */
staffRouter.post('/updates/:id/match', wrap(async (req, res) => { res.json({ success: true, data: await svc.matchUpdate(T(req), req.params.id, String(req.body?.student_id || '')) }); }));
staffRouter.get('/students/:studentId', wrap(async (req, res) => { res.json({ success: true, data: await svc.detail(T(req), req.params.studentId) }); }));
/** Parents' session: saved at once. */
staffRouter.put('/students/:studentId', wrap(async (req, res) => { res.json({ success: true, data: await svc.saveDirect(T(req), U(req), req.params.studentId, req.body || {}) }); }));

export const publicRouter = Router();
publicRouter.use(studentUpdateLimiter);
publicRouter.get('/shared/:token', wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: await svc.openShared(req.params.token) });
}));
publicRouter.post('/shared/:token', wrap(async (req, res) => {
  if (req.body?.website) throw new AppError('Could not be sent', 400, 'INVALID');
  res.set('Cache-Control', 'no-store');
  res.status(201).json({ success: true, data: await svc.submitShared(req.params.token, req.body || {}) });
}));
/**
 * "Is my child registered?" POST { child_first_name, child_last_name, date_of_birth, contact }
 * Answers yes (and shows the record to review) only when name, date of birth and a phone/email the school holds
 * all match; any other outcome is the same `verified: false`. Tighter rate limit than the rest.
 */
publicRouter.post('/shared/:token/check', studentCheckLimiter, wrap(async (req, res) => {
  if (req.body?.website) throw new AppError('Could not be sent', 400, 'INVALID');
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: await svc.verifyShared(req.params.token, req.body || {}) });
}));
/** The checked parent confirms or corrects the record: POST { session, values }. */
publicRouter.post('/shared/:token/verified', wrap(async (req, res) => {
  if (req.body?.website) throw new AppError('Could not be sent', 400, 'INVALID');
  res.set('Cache-Control', 'no-store');
  res.status(201).json({ success: true, data: await svc.submitVerified(req.params.token, req.body?.session, req.body?.values) });
}));
publicRouter.get('/:token', wrap(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: await svc.openLink(req.params.token) });
}));
publicRouter.post('/:token', wrap(async (req, res) => {
  if (req.body?.website) throw new AppError('Could not be sent', 400, 'INVALID');
  res.set('Cache-Control', 'no-store');
  res.status(201).json({ success: true, data: await svc.submitLink(req.params.token, req.body?.values ?? req.body) });
}));
