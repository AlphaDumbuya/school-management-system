import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { UserRole } from '../types/auth';
import { sendExport } from '@utils/exportResponse';
import { admissionPipelineService as svc, currentYearClasses, STATUSES, TRANSITIONS, LABELS, DOCUMENTS } from '../services/admissions/admissionPipelineService.js';
import { resolveActiveYear } from '@utils/academicYear';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

/** The authenticated school's public application address. */
router.get('/share-link', authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    const school = await db('tenants').where({ id: tenantId, status: 'active' }).select('name', 'slug').first();
    if (!school) throw new AppError('School is not available for online applications', 404, 'SCHOOL_NOT_FOUND');
    const { publicAppUrl } = await import('../utils/publicUrl.js');
    const publicBaseUrl = publicAppUrl();
    res.json({ success: true, data: { path: `/apply/${encodeURIComponent(school.slug)}`, school_name: school.name, public_base_url: publicBaseUrl } });
  } catch (error) {
    next(error);
  }
});

const staff = authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER);
const T = (req: Request) => {
  const t = req.user?.tenant_id;
  if (!t) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  return t;
};
const U = (req: Request) => ({ id: String(req.user?.id || req.auth?.userId), role: String(req.user?.role || req.auth?.role) });
const wrap = (fn: (req: Request, res: Response) => Promise<any>) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/**
 * GET /api/v1/admissions/export?format=csv|excel|pdf&academic_year&status&search
 * Same filters as the list. Declared before /:appId.
 */
router.get('/export', staff, wrap(async (req, res) => {
  // The list caps pages at 100; the export walks every page (up to 10,000 rows).
  const first = await svc.list(T(req), { ...(req.query as any), page: 1, limit: 100 });
  let rows = first.data;
  for (let p = 2; p <= Math.min(first.pagination.total_pages, 100); p++) rows = rows.concat((await svc.list(T(req), { ...(req.query as any), page: p, limit: 100 })).data);
  const formatted = rows.map((r: any) => ({
    application_number: r.application_number,
    applicant: [r.child_first_name, r.child_last_name].filter(Boolean).join(' '),
    child_gender: r.child_gender, child_dob: r.child_dob ? String(r.child_dob).slice(0, 10) : '',
    class_name: r.enrolled_class_name || r.class_name || '',
    guardian: [r.guardian_first_name, r.guardian_last_name].filter(Boolean).join(' '),
    guardian_phone: r.guardian_phone, guardian_email: r.guardian_email || '',
    status: (LABELS as any)[r.status] || r.status, source: r.application_source === 'online' ? 'Online' : 'Office',
    student_number: r.student_number || '', academic_year: r.academic_year || '',
    created_at: r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
  }));
  await sendExport(res, {
    format: req.query.format as string, tenantId: T(req), rows: formatted,
    columns: {
      'Application No': 'application_number', Applicant: 'applicant', Sex: 'child_gender', 'Date of birth': 'child_dob',
      Class: 'class_name', Guardian: 'guardian', Phone: 'guardian_phone', Email: 'guardian_email', Status: 'status',
      Source: 'source', 'Student No': 'student_number', Year: 'academic_year', Received: 'created_at',
    },
    filename: 'admissions_export', title: 'Admissions Export', sheetName: 'Admissions',
  });
}));

/** GET /api/v1/admissions/meta: workflow rules, documents and current-year classes (with capacity). */
router.get('/meta', staff, wrap(async (req, res) => {
  const { yearString } = await resolveActiveYear(T(req));
  res.json({ success: true, data: { statuses: STATUSES, transitions: TRANSITIONS, labels: LABELS, documents: DOCUMENTS, active_year: yearString, classes: await currentYearClasses(T(req)) } });
}));

/** GET /api/v1/admissions/overview?academic_year=YYYY/YYYY|all (default: the active year). */
router.get('/overview', staff, wrap(async (req, res) => {
  res.json({ success: true, data: await svc.overview(T(req), req.query.academic_year as string) });
}));

/** POST /api/v1/admissions: an application entered at the office (enrol_now: true to enrol straight away). */
router.post('/', staff, wrap(async (req, res) => {
  const r = await svc.create(T(req), U(req), req.body);
  res.status(201).json({ success: true, data: { ...r.application, enrolment: r.enrolment } });
}));

/** GET /api/v1/admissions?page&limit&status&academic_year&search&class_id&source */
router.get('/', staff, wrap(async (req, res) => {
  const r = await svc.list(T(req), req.query as any);
  res.json({ success: true, ...r });
}));

router.get('/:appId', staff, wrap(async (req, res) => res.json({ success: true, data: await svc.get(T(req), req.params.appId) })));
router.put('/:appId', staff, wrap(async (req, res) => res.json({ success: true, data: await svc.update(T(req), U(req), req.params.appId, req.body) })));
router.post('/:appId/notes', staff, wrap(async (req, res) => res.json({ success: true, data: await svc.addNote(T(req), U(req), req.params.appId, req.body?.note) })));

/** PUT /api/v1/admissions/:id/status { status, note, interview_date, interview_location, assessment_score } */
router.put('/:appId/status', staff, wrap(async (req, res) => {
  const data = await svc.changeStatus(T(req), U(req), req.params.appId, req.body || {});
  res.json({ success: true, message: `Application ${(LABELS as any)[data.status] || data.status}`, data });
}));

/** POST /api/v1/admissions/:id/enrol { class_id, allow_over_capacity } — idempotent. */
router.post('/:appId/enrol', staff, wrap(async (req, res) => res.json({ success: true, data: await svc.enrol(T(req), U(req), req.params.appId, req.body || {}) })));

/** DELETE /api/v1/admissions/:id (principal; never an application that became a student). */
router.delete('/:appId', authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), wrap(async (req, res) => {
  res.json({ success: true, data: await svc.remove(T(req), U(req), req.params.appId) });
}));

export default router;
