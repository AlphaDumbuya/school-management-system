import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext, authorize } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { UserRole } from '../types/auth';
import { db } from '@utils/database';
import { resolveYearScope, applyYearScope } from '../utils/academicYear.js';
// "Today" = the school's day (tenants.timezone); teacher attendance has no
// class, so a past year is a date before the active year's start.
import { tenantToday, isPastYearDate } from '../utils/schoolDate.js';

const router = Router();
router.use(authenticate, attachUserContext);
const validId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const tenantFor = (req: Request) => {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  return tenantId;
};
const requireCurrentRole = (req: Request, ...roles: UserRole[]) => {
  // authorize checks the JWT; this also observes role changes made since the
  // token was issued, using the current user row loaded by attachUserContext.
  if (!roles.includes(req.user?.role as UserRole)) throw new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
};
const adminRoles = [UserRole.PRINCIPAL, UserRole.SUPER_ADMIN] as const;
// Every professional staff member signs in / out here, not only teachers:
// accountants (Bursar) and admissions officers are employed the same way.
const STAFF_ROLES = [UserRole.TEACHER, UserRole.ACCOUNTANT, UserRole.ADMISSIONS_OFFICER];
const STAFF_ROLE_VALUES = STAFF_ROLES.map(String);
const validComment = (value: unknown) => value == null || (typeof value === 'string' && value.length <= 500);
const ownTeacher = async (req: Request, tenantId: string) => {
  return db('teachers as t')
    .join('users as u', 'u.id', 't.user_id')
    .where({ 't.user_id': req.user?.id, 'u.tenant_id': tenantId }).whereIn('u.role', STAFF_ROLE_VALUES)
    .select('t.id', 'u.status as user_status', 't.status as teacher_status')
    .first();
};

/** Principal's dated register; teachers from other schools are never returned. */
router.get('/roster', authorize(...adminRoles), async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireCurrentRole(req, ...adminRoles);
    const tenantId = tenantFor(req);
    const date = req.query.date ?? (await tenantToday(tenantId));
    if (!validDate(date)) throw new AppError('A valid date is required', 400, 'VALIDATION_ERROR');

    // Active teachers, PLUS anyone with a record on that date (a teacher who
    // has since left must still appear in that day's history).
    const teachers = await db('teachers as t')
      .join('users as u', 'u.id', 't.user_id')
      .where({ 'u.tenant_id': tenantId }).whereIn('u.role', STAFF_ROLE_VALUES)
      .where((q) => {
        q.where({ 'u.status': 'active', 't.status': 'active' })
          .orWhereExists(
            db('teacher_attendance as ta').whereRaw('ta.teacher_id = t.id')
              .where({ 'ta.tenant_id': tenantId, 'ta.attendance_date': date }),
          );
      })
      .select('t.id', 't.teacher_id as staff_code', 'u.first_name', 'u.last_name', 't.designation', 't.department',
        db.raw("(u.status = 'active' AND t.status = 'active') as is_active"))
      .orderBy('u.first_name').orderBy('u.last_name');

    const records = teachers.length
      ? await db('teacher_attendance')
        .where({ tenant_id: tenantId, attendance_date: date })
        .whereIn('teacher_id', teachers.map((teacher) => teacher.id))
        .select('id', 'teacher_id', 'status', 'remarks', 'marked_at', 'marked_by', 'signed_in_at', 'signed_out_at', 'sign_in_comment', 'sign_out_comment')
      : [];
    const byTeacher = new Map(records.map((record) => [record.teacher_id, record]));
    // A date in a past academic year is history: the page shows it read-only.
    const readOnly = await isPastYearDate(tenantId, date);
    res.json({ success: true, data: { date, read_only: readOnly, teachers: teachers.map((teacher) => ({
      ...teacher,
      attendance: byTeacher.get(teacher.id) ?? null,
    })) } });
  } catch (error) { next(error); }
});

/** A teacher can see only their own attendance history. */
router.get('/my', authorize(...STAFF_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireCurrentRole(req, ...STAFF_ROLES);
    const tenantId = tenantFor(req);
    const teacher = await ownTeacher(req, tenantId);
    if (!teacher) throw new AppError('Teacher profile not found', 404, 'NOT_FOUND');
    // Optional academic year → that year's date window (no year = recent history).
    const scope = await resolveYearScope(tenantId, req.query.academic_year);
    const base = applyYearScope(
      db('teacher_attendance').where({ tenant_id: tenantId, teacher_id: teacher.id }),
      scope, null, 'attendance_date',
    );
    const records = await base.clone()
      .select('id', 'attendance_date as date', 'status', 'remarks', 'marked_at', 'marked_by', 'signed_in_at', 'signed_out_at', 'sign_in_comment', 'sign_out_comment')
      .orderBy('attendance_date', 'desc').limit(scope ? 400 : 90);

    // Summary over the whole scope (not just the rows returned).
    const statusRows = await base.clone().groupBy('status').select('status').count('id as count');
    const counts: Record<string, number> = { present: 0, late: 0, absent: 0, excused: 0 };
    statusRows.forEach((r: any) => { if (r.status in counts) counts[r.status] = Number(r.count) || 0; });
    const total = counts.present + counts.late + counts.absent + counts.excused;
    const stats = { total, ...counts, rate: total > 0 ? Math.round(((counts.present + counts.late) / total) * 100) : 0 };

    res.json({ success: true, data: { records, stats, today: await tenantToday(tenantId) } });
  } catch (error) { next(error); }
});

/** Self check-in can be made once, for the current day, while active. */
router.post('/check-in', authorize(...STAFF_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireCurrentRole(req, ...STAFF_ROLES);
    const tenantId = tenantFor(req);
    const teacher = await ownTeacher(req, tenantId);
    if (!teacher || teacher.user_status !== 'active' || teacher.teacher_status !== 'active') {
      throw new AppError('Active teacher profile required', 403, 'FORBIDDEN');
    }
    const { status, comment } = req.body ?? {};
    if (status !== 'present' && status !== 'late') {
      throw new AppError('Self check-in must be present or late', 400, 'VALIDATION_ERROR');
    }
    if (!validComment(comment)) throw new AppError('Comment must be at most 500 characters', 400, 'VALIDATION_ERROR');
    const date = await tenantToday(tenantId);
    const signedInAt = new Date();
    const inserted = await db('teacher_attendance').insert({
      tenant_id: tenantId, teacher_id: teacher.id, attendance_date: date,
      status, sign_in_comment: comment?.trim() || null,
      signed_in_at: signedInAt, marked_by: req.user!.id, marked_at: signedInAt,
    }).onConflict(['tenant_id', 'teacher_id', 'attendance_date']).ignore().returning('id');
    if (inserted.length) {
      return res.status(201).json({ success: true, data: { id: inserted[0].id, date, status, signed_in_at: signedInAt } });
    }

    // A record already exists. If the principal marked today before the
    // teacher arrived (no sign-in yet), record the arrival on it — otherwise
    // the teacher could neither sign in nor sign out. The principal's remarks
    // are kept and they can still correct the status afterwards.
    const [claimed] = await db('teacher_attendance')
      .where({ tenant_id: tenantId, teacher_id: teacher.id, attendance_date: date })
      .whereNull('signed_in_at')
      .update({
        status, signed_in_at: signedInAt, sign_in_comment: comment?.trim() || null,
        marked_by: req.user!.id, marked_at: signedInAt, updated_at: signedInAt,
      })
      .returning('id');
    if (!claimed) throw new AppError('You have already signed in today', 409, 'CONFLICT');
    res.status(201).json({ success: true, data: { id: claimed.id ?? claimed, date, status, signed_in_at: signedInAt } });
  } catch (error) { next(error); }
});

/** Departure is recorded once against the teacher's own sign-in for today. */
router.post('/sign-out', authorize(...STAFF_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireCurrentRole(req, ...STAFF_ROLES);
    const tenantId = tenantFor(req);
    const teacher = await ownTeacher(req, tenantId);
    if (!teacher || teacher.user_status !== 'active' || teacher.teacher_status !== 'active') {
      throw new AppError('Active teacher profile required', 403, 'FORBIDDEN');
    }
    const { comment } = req.body ?? {};
    if (!validComment(comment)) throw new AppError('Comment must be at most 500 characters', 400, 'VALIDATION_ERROR');
    const signedOutAt = new Date();
    const [record] = await db('teacher_attendance')
      .where({ tenant_id: tenantId, teacher_id: teacher.id, attendance_date: await tenantToday(tenantId) })
      .whereIn('status', ['present', 'late'])
      .whereNotNull('signed_in_at').whereNull('signed_out_at')
      .where('signed_in_at', '<=', signedOutAt)
      .update({ signed_out_at: signedOutAt, sign_out_comment: comment?.trim() || null, updated_at: signedOutAt })
      .returning(['id', 'attendance_date', 'status', 'signed_in_at', 'signed_out_at', 'sign_in_comment', 'sign_out_comment']);
    if (!record) throw new AppError('Sign in first, or you have already signed out today', 409, 'CONFLICT');
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
});

/** Principals may create or correct attendance only for their own teachers. */
router.put('/:teacherId/:date', authorize(...adminRoles), async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireCurrentRole(req, ...adminRoles);
    const tenantId = tenantFor(req);
    const { teacherId, date } = req.params;
    const { status, remarks } = req.body ?? {};
    if (!validId(teacherId)) throw new AppError('Invalid teacher ID', 400, 'VALIDATION_ERROR');
    if (!validDate(date) || date > (await tenantToday(tenantId))) throw new AppError('Choose today or an earlier valid date', 400, 'VALIDATION_ERROR');
    if (!['present', 'late', 'absent', 'excused'].includes(status)) {
      throw new AppError('Invalid attendance status', 400, 'VALIDATION_ERROR');
    }
    if (remarks != null && (typeof remarks !== 'string' || remarks.length > 500)) {
      throw new AppError('Remarks must be at most 500 characters', 400, 'VALIDATION_ERROR');
    }
    const teacher = await db('teachers as t')
      .join('users as u', 'u.id', 't.user_id')
      .where({ 't.id': teacherId, 'u.tenant_id': tenantId }).whereIn('u.role', STAFF_ROLE_VALUES)
      .select('t.id').first();
    if (!teacher) throw new AppError('Teacher not found', 404, 'NOT_FOUND');
    if (await isPastYearDate(tenantId, date)) {
      throw new AppError('This date belongs to a past academic year; teacher attendance is read-only.', 409, 'PAST_YEAR_READ_ONLY');
    }

    const [record] = await db('teacher_attendance').insert({
      tenant_id: tenantId, teacher_id: teacherId, attendance_date: date,
      status, remarks: remarks?.trim() || null, marked_by: req.user!.id, marked_at: new Date(),
    }).onConflict(['tenant_id', 'teacher_id', 'attendance_date']).merge({
      status, remarks: remarks?.trim() || null, marked_by: req.user!.id,
      marked_at: new Date(), updated_at: new Date(),
    }).returning(['id', 'teacher_id', 'attendance_date', 'status', 'remarks', 'marked_at', 'signed_in_at', 'signed_out_at', 'sign_in_comment', 'sign_out_comment']);
    res.json({ success: true, data: record });
  } catch (error) { next(error); }
});

export default router;
