/**
 * Support staff — /api/v1/staff
 *
 * Security, cleaners, cooks, drivers, gardeners, maintenance: an easy-onboarding
 * staff record with NO login (they don't use the portal). Principal / super
 * admin only, tenant-scoped.
 *
 * Professional staff (teachers, accountants / bursars, admissions officers) are
 * onboarded with the full staff process under /api/v1/teachers, with the same
 * profile, staff ID, credentials and directory for all of them.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../utils/database.js';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { UserRole } from '../types/auth';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);
router.use(authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN));

export const SUPPORT_JOB_TYPES = ['security', 'cleaner', 'cook', 'driver', 'gardener', 'maintenance', 'other'] as const;
const VALID_STATUSES = ['active', 'inactive', 'suspended', 'dismissed'];
const VALID_EMPLOYMENT = ['full_time', 'part_time', 'contract', 'casual'];

const tenantOf = (req: Request): string => {
  const t = (req as any).user?.tenant_id;
  if (!t) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  return t;
};

const clean = (v: unknown, max = 255): string | null => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

/** Validate + normalise the editable fields (create: names required). */
function readBody(body: any, creating: boolean) {
  const out: Record<string, any> = {};
  const set = (k: string, v: any) => { if (v !== undefined) out[k] = v; };
  if (creating || body.first_name !== undefined) {
    const v = clean(body.first_name, 100);
    if (!v) throw new AppError('First name is required', 400, 'VALIDATION_ERROR');
    out.first_name = v;
  }
  if (creating || body.last_name !== undefined) {
    const v = clean(body.last_name, 100);
    if (!v) throw new AppError('Last name is required', 400, 'VALIDATION_ERROR');
    out.last_name = v;
  }
  if (creating || body.job_type !== undefined) {
    const jt = String(body.job_type ?? 'other');
    if (!SUPPORT_JOB_TYPES.includes(jt as any)) throw new AppError('Choose a valid job', 400, 'VALIDATION_ERROR');
    out.job_type = jt;
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(String(body.status))) throw new AppError(`Status must be one of: ${VALID_STATUSES.join(', ')}`, 400, 'VALIDATION_ERROR');
    out.status = body.status;
  }
  if (body.employment_type !== undefined && body.employment_type !== '') {
    if (!VALID_EMPLOYMENT.includes(String(body.employment_type))) throw new AppError('Invalid employment type', 400, 'VALIDATION_ERROR');
    out.employment_type = body.employment_type;
  }
  if (body.hire_date !== undefined) {
    const d = clean(body.hire_date, 10);
    if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new AppError('Hire date must be a date', 400, 'VALIDATION_ERROR');
    out.hire_date = d;
  }
  set('job_title', body.job_title !== undefined ? clean(body.job_title, 100) : undefined);
  set('gender', body.gender !== undefined ? clean(body.gender, 20) : undefined);
  set('phone', body.phone !== undefined ? clean(body.phone, 30) : undefined);
  set('address', body.address !== undefined ? clean(body.address) : undefined);
  set('photo_url', body.photo_url !== undefined ? clean(body.photo_url, 2_000_000) : undefined);
  set('emergency_contact_name', body.emergency_contact_name !== undefined ? clean(body.emergency_contact_name, 150) : undefined);
  set('emergency_contact_phone', body.emergency_contact_phone !== undefined ? clean(body.emergency_contact_phone, 30) : undefined);
  set('notes', body.notes !== undefined ? clean(body.notes, 2000) : undefined);
  return out;
}

/** Next support staff number for the school: SUP-0001, SUP-0002 … */
async function nextStaffId(trx: any, tenantId: string): Promise<string> {
  const rows = await trx('support_staff').where({ tenant_id: tenantId }).select('staff_id');
  const max = rows.reduce((m: number, r: any) => {
    const n = Number(String(r.staff_id).replace(/\D/g, ''));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `SUP-${String(max + 1).padStart(4, '0')}`;
}

/** GET /api/v1/staff?job_type=&status=&search= — list + KPI counts. */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantOf(req);
    const { job_type, status, search } = req.query as Record<string, string | undefined>;
    const applySearch = (q: any) => {
      if (!search?.trim()) return q;
      const term = `%${search.trim()}%`;
      return q.where((w: any) => {
        w.where('first_name', 'ilike', term).orWhere('last_name', 'ilike', term)
          .orWhere('staff_id', 'ilike', term).orWhere('phone', 'ilike', term).orWhere('job_title', 'ilike', term)
          .orWhereRaw("CONCAT_WS(' ', first_name, last_name) ILIKE ?", [term]);
      });
    };
    let q = applySearch(db('support_staff').where({ tenant_id: tenantId }));
    if (job_type) q = q.where('job_type', job_type);
    if (status) q = q.where('status', status);
    const rows = await q.orderBy('first_name', 'asc').orderBy('last_name', 'asc');

    const all = await applySearch(db('support_staff').where({ tenant_id: tenantId })).select('job_type', 'status');
    const stats: Record<string, number> = { total: all.length, active: 0, inactive: 0 };
    for (const r of all as any[]) {
      if (r.status === 'active') stats.active++; else stats.inactive++;
      stats[r.job_type] = (stats[r.job_type] || 0) + 1;
    }
    res.json({ success: true, data: rows, stats });
  } catch (error) { next(error); }
});

/** POST /api/v1/staff — add a support staff member (no login). */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const trx = await db.transaction();
  try {
    const tenantId = tenantOf(req);
    const data = readBody(req.body ?? {}, true);
    const [row] = await trx('support_staff').insert({
      ...data,
      tenant_id: tenantId,
      staff_id: await nextStaffId(trx, tenantId),
      status: data.status || 'active',
      employment_type: data.employment_type || 'full_time',
      hire_date: data.hire_date || new Date().toISOString().slice(0, 10),
      created_by: (req as any).user?.id ?? null,
    }).returning('*');
    await trx.commit();
    logger.info(`Support staff added: ${row.staff_id} (${row.job_type})`);
    res.status(201).json({ success: true, message: 'Support staff member added', data: row });
  } catch (error) {
    await trx.rollback();
    next(error);
  }
});

/** PUT /api/v1/staff/:id — edit details or status. */
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = tenantOf(req);
    const existing = await db('support_staff').where({ id: req.params.id, tenant_id: tenantId }).first('id');
    if (!existing) throw new AppError('Staff member not found', 404, 'NOT_FOUND');
    const data = readBody(req.body ?? {}, false);
    const [row] = await db('support_staff').where({ id: existing.id })
      .update({ ...data, updated_at: new Date() }).returning('*');
    res.json({ success: true, message: 'Staff member updated', data: row });
  } catch (error) { next(error); }
});

export default router;
