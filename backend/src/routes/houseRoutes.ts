/**
 * Houses and the house ballot: /api/v1/admissions/houses
 * Managed by the principal and the admissions officer (a teacher holding the
 * admissions job counts as the admissions officer on this path).
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { UserRole } from '../types/auth';
import { sendExport } from '@utils/exportResponse';
import { houseService as svc } from '../services/houseService.js';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);
router.use(authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER));

const T = (req: Request) => {
  const t = req.user?.tenant_id;
  if (!t) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  return t;
};
const U = (req: Request) => String(req.user?.id || req.auth?.userId || '');
const wrap = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** `class_ids=a,b,c` → the valid ids, or undefined when none were sent. */
const idList = (v: unknown): string[] | undefined => {
  if (typeof v !== 'string') return undefined;
  const ids = v.split(',').map((s) => s.trim()).filter((s) => UUID_RE.test(s));
  return ids.length ? ids : undefined;
};

/** GET /: houses with head-counts, the ballot settings and how many students have no house. */
router.get('/', wrap(async (req, res) => {
  res.json({ success: true, data: await svc.overview(T(req)) });
}));

/** GET /summary: counts by house and by class. */
router.get('/summary', wrap(async (req, res) => {
  res.json({ success: true, data: await svc.summary(T(req)) });
}));

/** GET /settings, PUT /settings: how the ballot balances the houses. */
router.get('/settings', wrap(async (req, res) => {
  res.json({ success: true, data: await svc.getSettings(T(req)) });
}));
router.put('/settings', wrap(async (req, res) => {
  res.json({ success: true, data: await svc.updateSettings(T(req), U(req), req.body || {}) });
}));

/** GET /students?house_id=<id|none>&class_id&search&limit: who is in which house. */
router.get('/students', wrap(async (req, res) => {
  const rows = await svc.roster(T(req), { house_id: str(req.query.house_id), class_id: str(req.query.class_id), class_ids: idList(req.query.class_ids), search: str(req.query.search), limit: Number(req.query.limit) || undefined });
  res.json({ success: true, data: rows });
}));

/** GET /export?format=csv|excel|pdf&house_id&class_id: house lists for sports day. */
router.get('/export', wrap(async (req, res) => {
  const rows = (await svc.roster(T(req), { house_id: str(req.query.house_id), class_id: str(req.query.class_id), class_ids: idList(req.query.class_ids), limit: 5000 })).map((r: any) => ({
    house: r.house_name || 'No house yet', student_number: r.student_number, name: `${r.first_name} ${r.last_name}`.trim(),
    gender: r.gender || '', class_name: r.class_name || '',
  }));
  rows.sort((a: any, b: any) => a.house.localeCompare(b.house) || a.class_name.localeCompare(b.class_name, undefined, { numeric: true }) || a.name.localeCompare(b.name));
  await sendExport(res, {
    format: req.query.format as string, tenantId: T(req), rows,
    columns: { House: 'house', 'Student No': 'student_number', Name: 'name', Sex: 'gender', Class: 'class_name' },
    filename: 'house_lists', title: 'House Lists', sheetName: 'Houses',
  });
}));

/** GET /log: the latest draws and changes (audit trail). */
router.get('/log', wrap(async (req, res) => {
  res.json({ success: true, data: await svc.recentDraws(T(req), Number(req.query.limit) || 60) });
}));

/** GET /teachers: active teachers and whether each may draw houses for their own classes. */
router.get('/teachers', wrap(async (req, res) => {
  res.json({ success: true, data: await svc.teacherOptions(T(req)) });
}));

/** PUT /permissions/:userId { can_draw }: allow or stop allowing a teacher to run the ballot for their own classes. */
router.put('/permissions/:userId', wrap(async (req, res) => {
  if (typeof req.body?.can_draw !== 'boolean') throw new AppError('Send can_draw as true or false.', 400, 'VALIDATION_ERROR');
  await svc.setBallotPermission(T(req), U(req), req.params.userId, req.body.can_draw);
  res.json({ success: true, data: { user_id: req.params.userId, can_draw: req.body.can_draw } });
}));

/** PUT /:id/staff { user_id, position: 'master' | 'staff' }: put a teacher on a house. */
router.put('/:id/staff', wrap(async (req, res) => {
  const userId = str(req.body?.user_id);
  if (!userId) throw new AppError('Choose the teacher.', 400, 'VALIDATION_ERROR');
  await svc.assignStaff(T(req), U(req), req.params.id, userId, req.body?.position);
  res.json({ success: true });
}));

/** DELETE /:id/staff/:userId: take a teacher off a house. */
router.delete('/:id/staff/:userId', wrap(async (req, res) => {
  await svc.removeStaff(T(req), req.params.id, req.params.userId);
  res.json({ success: true });
}));

/** POST /draw { student_id }: ballot one student. */
router.post('/draw', wrap(async (req, res) => {
  const id = str(req.body?.student_id);
  if (!id) throw new AppError('Choose the student to draw for.', 400, 'VALIDATION_ERROR');
  res.json({ success: true, data: await svc.draw(T(req), U(req), id, 'ballot') });
}));

/**
 * POST /import { rows: [{ student_number, house }], overwrite?, create_missing? }:
 * bring in house lists the school already has. Declared before the /:id routes.
 */
router.post('/import', wrap(async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  res.json({ success: true, data: await svc.importAssignments(T(req), U(req), rows, { overwrite: req.body?.overwrite === true, create_missing: req.body?.create_missing === true }) });
}));

/** POST /draw-many { student_ids? , class_id?, class_ids?, search? }: ballot a list, or everyone without a house who matches. */
router.post('/draw-many', wrap(async (req, res) => {
  const ids = Array.isArray(req.body?.student_ids) ? req.body.student_ids.filter((x: unknown) => typeof x === 'string') : undefined;
  res.json({ success: true, data: await svc.drawMany(T(req), U(req), { student_ids: ids, class_id: str(req.body?.class_id), class_ids: idList(req.body?.class_ids), search: str(req.body?.search) }) });
}));

/** PUT /assign { student_id, house_id | null, reason }: move a student (or clear the house). */
router.put('/assign', wrap(async (req, res) => {
  const studentId = str(req.body?.student_id);
  if (!studentId) throw new AppError('Choose the student.', 400, 'VALIDATION_ERROR');
  const houseId = req.body?.house_id === null ? null : str(req.body?.house_id);
  if (houseId === undefined) throw new AppError('Choose the house, or send null to clear it.', 400, 'VALIDATION_ERROR');
  res.json({ success: true, data: await svc.assign(T(req), U(req), studentId, houseId, str(req.body?.reason)) });
}));

/**
 * POST /reset-ballot { reason, confirm: true, class_ids? }: take students off their
 * house so the ballot can be run again (whole school, or the listed classes). Only the
 * house is cleared; the draw log keeps a record of every student. Principal / super admin only.
 */
router.post('/reset-ballot', wrap(async (req, res) => {
  const role = String(req.user?.role || '');
  if (role !== 'principal' && role !== 'super_admin') {
    throw new AppError('Only the principal or the school owner can reset the ballot.', 403, 'FORBIDDEN');
  }
  if (req.body?.confirm !== true) throw new AppError('Confirm the reset to continue.', 400, 'CONFIRM_REQUIRED');
  const classIds = Array.isArray(req.body?.class_ids) ? req.body.class_ids.filter((x: unknown): x is string => typeof x === 'string' && UUID_RE.test(x)) : undefined;
  res.json({ success: true, data: await svc.resetBallot(T(req), U(req), { reason: req.body?.reason, class_ids: classIds }) });
}));

/** POST /: add a house. */
router.post('/', wrap(async (req, res) => {
  res.status(201).json({ success: true, data: await svc.createHouse(T(req), U(req), req.body || {}) });
}));

/** PUT /:id: rename, recolour, switch on/off. */
router.put('/:id', wrap(async (req, res) => {
  res.json({ success: true, data: await svc.updateHouse(T(req), req.params.id, req.body || {}) });
}));

/** DELETE /:id: only a house with no students. */
router.delete('/:id', wrap(async (req, res) => {
  await svc.deleteHouse(T(req), req.params.id);
  res.json({ success: true });
}));

export default router;
