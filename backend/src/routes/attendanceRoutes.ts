import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { UserRole } from '../types/auth';
import { logger } from '@utils/logger';
import { db } from '@utils/database';
import { sendExport } from '@utils/exportResponse';
import teacherAttendanceRoutes from './teacherAttendanceRoutes';

const router = Router();
router.use('/teachers', teacherAttendanceRoutes);

async function teacherClassIds(userId: string, tenantId: string): Promise<string[]> {
  const teacher = await db('teachers')
    .join('users as u', 'teachers.user_id', 'u.id')
    .where('teachers.user_id', userId)
    .where('u.tenant_id', tenantId)
    .select('teachers.id')
    .first();
  if (!teacher) return [];
  const assigned = await db('teacher_assignments').where('teacher_id', teacher.id).distinct('class_id');
  const led = await db('classes').where('class_teacher_id', teacher.id).select('id');
  return Array.from(new Set<string>([...assigned.map((r: any) => r.class_id), ...led.map((r: any) => r.id)]));
}

/** Pretty "8:05 AM" from a HH:MM[:SS] time string. */
function prettyTime(t?: string | null): string {
  if (!t) return '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t);
  let h = parseInt(m[1], 10); const min = m[2];
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ap}`;
}

/**
 * Notify a student's guardians (in-app + best-effort email) that their child
 * was checked IN (arrived) or checked OUT (left for home). Also notifies the
 * student's own account. Best-effort — never blocks attendance marking.
 *
 * `kind` = 'check_in' | 'check_out'. Tenant-scoped via the student lookup.
 */
async function notifyGuardiansOfAttendance(
  tenantId: string,
  studentId: string,
  kind: 'check_in' | 'check_out',
  time: string | null,
  attendanceDate: string,
): Promise<void> {
  try {
    const student = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
    if (!student) return;
    const studentName = [student.first_name, student.last_name].filter(Boolean).join(' ') || 'Your child';
    const when = prettyTime(time);

    const isIn = kind === 'check_in';
    const subject = isIn
      ? `${studentName} arrived at school`
      : `${studentName} has left school`;
    const message = isIn
      ? `${studentName} was marked present${when ? ` at ${when}` : ''} today.`
      : `${studentName} checked out${when ? ` at ${when}` : ''} and has left school for home.`;

    const data = {
      kind: isIn ? 'attendance_check_in' : 'attendance_check_out',
      student_id: studentId,
      student_name: studentName,
      time: time || null,
      date: attendanceDate,
      url: '/students/attendance',
    };

    const { default: notificationService } = await import('@services/notificationService');
    let emailService: any = null;
    try { emailService = (await import('@services/emailService')).default; } catch { /* optional */ }

    // Notify the student's own account.
    if (student.user_id) {
      await notificationService.createNotification({
        notificationType: 'attendance', recipientId: student.user_id,
        subject, message, data, channels: ['in_app'], sourceType: 'attendance', sourceId: studentId,
      }).catch(() => {});
    }

    // Notify linked guardians (in-app + email). Defense-in-depth: join through
    // students and re-assert the tenant, so a guardian row can only ever be
    // reached for a student in THIS tenant (guardians has no tenant_id column).
    const guardians = await db('guardians')
      .join('students', 'guardians.student_id', 'students.id')
      .where('guardians.student_id', studentId)
      .where('students.tenant_id', tenantId)
      .select('guardians.user_id', 'guardians.email', 'guardians.first_name', 'guardians.last_name')
      .catch(() => [] as any[]);

    for (const g of guardians) {
      if (g.user_id) {
        await notificationService.createNotification({
          notificationType: 'attendance', recipientId: g.user_id,
          subject, message, data, channels: ['in_app'], sourceType: 'attendance', sourceId: studentId,
        }).catch(() => {});
      }
      if (g.email && emailService?.sendAttendanceAlertEmail) {
        await emailService.sendAttendanceAlertEmail(tenantId, g.email, {
          recipientName: [g.first_name, g.last_name].filter(Boolean).join(' ') || 'Parent/Guardian',
          studentName, kind, time: when, date: attendanceDate,
        }).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn(`Attendance guardian notify failed for student ${studentId}: ${(err as any)?.message || err}`);
  }
}

const EXPORT_COLUMNS: Record<string, string> = {
  Student: 'student_name',
  'Admission No': 'admission_no',
  Class: 'class_name',
  Date: 'attendance_date',
  Session: 'session_type',
  Status: 'status',
  'Arrived at': 'check_in_time',
  'Left at': 'check_out_time',
  'Recorded at': 'marked_at',
  Remarks: 'remarks',
};

/**
 * GET /api/v1/attendance/export?format=csv|excel|pdf&date=&classId=
 * Download attendance records. Tenant-scoped; teachers limited to their classes.
 * Declared before any /:id route so the literal path isn't captured.
 */
router.get('/export', authenticate, attachUserContext, authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');

    // Treat literal "undefined"/"null"/empty as absent so a stray query value
    // (e.g. ?date=undefined) can't become a filter — a non-date string against
    // the date column would otherwise throw and 500 the request.
    const clean = (v: any): string => {
      const s = (v ?? '').toString().trim();
      return s === '' || s === 'undefined' || s === 'null' ? '' : s;
    };
    const date = clean(req.query.date);
    const classId = clean(req.query.classId);

    let query = db('attendance')
      .leftJoin('students', 'attendance.student_id', 'students.id')
      .leftJoin('classes', 'attendance.class_id', 'classes.id')
      .where('students.tenant_id', tenantId);

    // Teacher scoping: only classes they teach or lead.
    if (req.user?.role === 'teacher') {
      const classIds = await teacherClassIds(req.user.id, tenantId);
      if (classIds.length === 0) return sendExport(res, { format: req.query.format as string, tenantId, rows: [], columns: EXPORT_COLUMNS, filename: 'attendance_export', title: 'Attendance Export', sheetName: 'Attendance' });
      query = query.whereIn('attendance.class_id', classIds);
    }

    if (date) query = query.where('attendance.attendance_date', date);
    if (classId) query = query.where('attendance.class_id', classId);

    const rows = await query
      .select(
        db.raw("COALESCE(students.first_name || ' ' || students.last_name, students.student_id) as student_name"),
        'students.student_id as admission_no',
        'classes.name as class_name',
        'attendance.attendance_date',
        'attendance.session_type',
        'attendance.status',
        'attendance.check_in_time',
        'attendance.check_out_time',
        'attendance.marked_at',
        'attendance.remarks',
      )
      .orderBy('attendance.attendance_date', 'desc')
      .limit(20000);

    const formatted = rows.map((r: any) => ({
      ...r,
      attendance_date: r.attendance_date ? new Date(r.attendance_date).toLocaleDateString() : '',
    }));

    await sendExport(res, {
      format: req.query.format as string,
      tenantId,
      rows: formatted,
      columns: EXPORT_COLUMNS,
      filename: 'attendance_export',
      title: 'Attendance Export',
      sheetName: 'Attendance',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/attendance
 * Record attendance for a student with session support
 */
router.post('/', authenticate, attachUserContext, authorize(UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { student_id, class_id, date, status, session_type, check_in_time, check_out_time, remarks, client_id } = req.body;
    const recordedBy = (req as any).user?.id || (req as any).auth?.userId;

    if (!recordedBy) {
      throw new AppError('Authenticated user context is required', 401, 'UNAUTHENTICATED');
    }

    if (!student_id || !date || !status) {
      throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
    }

    const validStatuses = ['present', 'absent', 'late', 'excused'];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Status must be one of: ${validStatuses.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    const validSessions = ['morning', 'afternoon', 'full_day'];
    const sessionType = session_type || 'full_day';
    if (!validSessions.includes(sessionType)) {
      throw new AppError(`Session type must be one of: ${validSessions.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    // Verify student exists and belongs to this tenant
    const student = await db('students').where('id', student_id).andWhere('tenant_id', tenantId).first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    if (req.user?.role === 'teacher') {
      if (!class_id || !(await teacherClassIds(req.user.id, tenantId)).includes(class_id)) {
        throw new AppError('You are not assigned to this class', 403, 'FORBIDDEN');
      }
      const enrollment = await db('enrollments')
        .where({ student_id, class_id })
        .where(function () { this.whereIn('status', ['active', 'enrolled']).orWhereNull('status'); })
        .first();
      if (!enrollment) throw new AppError('Student is not enrolled in this class', 403, 'FORBIDDEN');
    }
    if (class_id) {
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', class_id)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () { this.whereNull('classes.academic_session_id').where('class_creator.tenant_id', tenantId); });
        })
        .first();
      if (!classCheck) throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
    }

    // Idempotency must be checked only within this tenant and permitted class.
    if (client_id) {
      const byClient = await db('attendance as a')
        .join('students as s', 'a.student_id', 's.id')
        .where('a.client_id', client_id)
        .where('s.tenant_id', tenantId)
        .where('a.student_id', student_id)
        .where('a.class_id', class_id || null)
        .select('a.*')
        .first();
      if (byClient) return res.status(200).json({ message: 'Attendance already recorded (idempotent)', attendance: byClient });
    }

    // Check duplicate attendance record for same student, date, and session
    const existing = await db('attendance')
      .where('student_id', student_id)
      .where('attendance_date', date)
      .where('session_type', sessionType)
      .andWhere(function() {
        if (class_id) {
          this.where('class_id', class_id);
        }
      })
      .first();

    if (existing) {
      throw new AppError('Attendance already recorded for this date and session', 409, 'CONFLICT');
    }

    const attendanceData: any = {
      student_id,
      attendance_date: date,
      status,
      session_type: sessionType,
      check_in_time: ['absent', 'excused'].includes(status) ? null : (check_in_time || null),
      check_out_time: ['absent', 'excused'].includes(status) ? null : (check_out_time || null),
      remarks: remarks || null,
      marked_by: recordedBy,
      marked_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    if (class_id) {
      attendanceData.class_id = class_id;
    }
    if (client_id) {
      attendanceData.client_id = client_id;
    }

    const [id] = await db('attendance').insert(attendanceData).returning('id');

    const insertedId = typeof id === 'object' ? id.id : id;
    const attendance = await db('attendance').where('id', insertedId).first();

    res.status(201).json({
      message: 'Attendance recorded successfully',
      attendance,
    });

    logger.info(`Attendance recorded for student ${student.student_id}: ${status} (${sessionType} session)`);

    // Notify parents (best-effort) — arrival on check-in, "left school" on check-out.
    if (attendanceData.check_in_time) {
      void notifyGuardiansOfAttendance(tenantId, student_id, 'check_in', attendanceData.check_in_time, date);
    }
    if (attendanceData.check_out_time) {
      void notifyGuardiansOfAttendance(tenantId, student_id, 'check_out', attendanceData.check_out_time, date);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/attendance
 * List attendance records with filtering, joins, search, pagination, and session support
 */
router.get('/', authenticate, attachUserContext, authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const studentId = req.query.studentId as string;
    const classId = req.query.classId as string;
    const status = req.query.status as string;
    const date = req.query.date as string;
    const session_type = req.query.session_type as string;
    const search = req.query.search as string;

    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    let query = db('attendance')
      .leftJoin('students', 'attendance.student_id', 'students.id')
      .leftJoin('classes', 'attendance.class_id', 'classes.id')
      .where('students.tenant_id', tenantId);

    // Teacher scoping: teachers only see attendance for classes they teach or lead.
    if (req.user?.role === 'teacher') {
      const classIds = await teacherClassIds(req.user.id, tenantId);
      if (classIds.length === 0) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      query = query.whereIn('attendance.class_id', classIds);
    }

    if (studentId) {
      query = query.where('attendance.student_id', studentId);
    }
    if (classId) {
      query = query.where('attendance.class_id', classId);
    }
    if (status) {
      query = query.where('attendance.status', status);
    }
    if (date) {
      query = query.where('attendance.attendance_date', date);
    }
    if (session_type) {
      query = query.where('attendance.session_type', session_type);
    }
    if (search) {
      const term = `%${search.trim()}%`;
      query = query.where(function () {
        this.where('students.first_name', 'ilike', term)
          .orWhere('students.last_name', 'ilike', term)
          .orWhere('students.student_id', 'ilike', term);
      });
    }

    const totalResult = await query.clone().count('attendance.id as count').first();
    const total = Number(totalResult?.count ?? 0);

    const records = await query
      .select(
        'attendance.id',
        'attendance.student_id',
        'attendance.class_id',
        'attendance.attendance_date as date',
        'attendance.status',
        'attendance.session_type',
        'attendance.check_in_time',
        'attendance.check_out_time',
        'attendance.marked_at',
        'attendance.remarks',
        'attendance.created_at',
        db.raw("students.first_name || ' ' || students.last_name as student_name"),
        'students.student_id as student_id_code',
        'students.photo_url',
        'classes.name as class_name'
      )
      .limit(limit)
      .offset(offset)
      .orderBy('attendance.attendance_date', 'desc')
      .orderBy('attendance.session_type', 'asc')
      .orderBy('students.first_name', 'asc');

    res.json({
      data: records,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('Error in GET /api/v1/attendance:', error);
    next(error);
  }
});

/**
 * GET /api/v1/attendance/analytics?classId=
 * Server-side attendance analytics so we never pull thousands of rows into the
 * browser. Returns totals, per-status counts, overall rate, per-class rates and
 * the at-risk students (< 75% presence). Tenant-scoped + teacher-class scoped.
 */
router.get('/analytics', authenticate, attachUserContext, authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    const classId = req.query.classId as string | undefined;

    // Base scope shared by every aggregate.
    const scoped = () => {
      let q = db('attendance')
        .join('students', 'attendance.student_id', 'students.id')
        .leftJoin('classes', 'attendance.class_id', 'classes.id')
        .where('students.tenant_id', tenantId);
      if (classId) q = q.where('attendance.class_id', classId);
      return q;
    };

    // Teacher scoping: restrict to their own classes.
    let teacherClasses: string[] | null = null;
    if (req.user?.role === 'teacher') {
      teacherClasses = await teacherClassIds(req.user.id, tenantId);
      if (teacherClasses.length === 0) {
        return res.json({ success: true, data: { total: 0, present: 0, late: 0, absent: 0, excused: 0, rate: 0, atRisk: [], classRates: [] } });
      }
    }
    const applyTeacher = (q: any) => (teacherClasses ? q.whereIn('attendance.class_id', teacherClasses) : q);

    // Status totals in one grouped query.
    const statusRows = await applyTeacher(scoped()).groupBy('attendance.status').select('attendance.status').count('attendance.id as count');
    const counts: Record<string, number> = { present: 0, late: 0, absent: 0, excused: 0 };
    statusRows.forEach((r: any) => { counts[r.status] = Number(r.count) || 0; });
    const total = counts.present + counts.late + counts.absent + counts.excused;
    // Present + late count as "in attendance" for the rate.
    const rate = total > 0 ? Math.round(((counts.present + counts.late) / total) * 1000) / 10 : 0;

    // Per-student presence rate → at-risk (< 75%).
    const perStudent = await applyTeacher(scoped())
      .groupBy('students.id', 'students.first_name', 'students.last_name', 'students.student_id')
      .select(
        'students.id',
        db.raw("students.first_name || ' ' || students.last_name as name"),
        'students.student_id as admission_no',
        db.raw('COUNT(attendance.id) as total'),
        db.raw("COUNT(CASE WHEN attendance.status IN ('present','late') THEN 1 END) as present"),
      );
    const atRisk = perStudent
      .map((s: any) => {
        const t = Number(s.total) || 0; const p = Number(s.present) || 0;
        return { name: s.name, admissionNo: s.admission_no, rate: t > 0 ? Math.round((p / t) * 100) : 0, total: t, p };
      })
      .filter((s: any) => s.total > 0 && s.rate < 75)
      .sort((a: any, b: any) => a.rate - b.rate)
      .slice(0, 50);

    // Per-class presence rate.
    const perClass = await applyTeacher(scoped())
      .whereNotNull('classes.name')
      .groupBy('classes.name')
      .select(
        'classes.name',
        db.raw('COUNT(attendance.id) as total'),
        db.raw("COUNT(CASE WHEN attendance.status IN ('present','late') THEN 1 END) as present"),
      );
    const classRates = perClass
      .map((c: any) => {
        const t = Number(c.total) || 0; const p = Number(c.present) || 0;
        return { name: c.name, rate: t > 0 ? Math.round((p / t) * 100) : 0, total: t };
      })
      .sort((a: any, b: any) => b.rate - a.rate);

    res.json({ success: true, data: { total, present: counts.present, late: counts.late, absent: counts.absent, excused: counts.excused, rate, atRisk, classRates } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/attendance/my
 * Attendance records & summary for the currently logged-in student.
 * Resolves the student's own record from the auth context (no id needed).
 */
router.get('/my', authenticate, attachUserContext, authorize(UserRole.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const currentUser = (req as any).user;
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const student = await db('students')
      .where('user_id', currentUser.id)
      .where('tenant_id', tenantId)
      .first();
    if (!student) {
      return res.json({
        student_id: null,
        summary: { total_days: 0, present: 0, late: 0, absent: 0, excused: 0, attendance_percentage: 0, at_risk: false },
        records: [],
      });
    }

    const attendance = await db('attendance')
      .select('id', 'class_id', 'attendance_date as date', 'status', 'session_type', 'check_in_time', 'check_out_time', 'marked_at', 'remarks')
      .where('student_id', student.id)
      .orderBy('attendance_date', 'desc')
      .orderBy('session_type', 'asc');

    const total = attendance.length;
    const present = attendance.filter((a: any) => a.status === 'present').length;
    const late = attendance.filter((a: any) => a.status === 'late').length;
    const absent = attendance.filter((a: any) => a.status === 'absent').length;
    const excused = attendance.filter((a: any) => a.status === 'excused').length;
    const attendancePercentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    res.json({
      student_id: student.student_id,
      summary: {
        total_days: total,
        present,
        late,
        absent,
        excused,
        attendance_percentage: attendancePercentage,
        at_risk: attendancePercentage < 75,
      },
      records: attendance,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/attendance/student/:studentId
 * Get attendance records & summary statistics for a specific student
 */
router.get('/student/:studentId', authenticate, attachUserContext, authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER, UserRole.STUDENT), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = (req as any).user;
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const student = await db('students')
      .where('tenant_id', tenantId)
      .where(function () { this.where('id', studentId).orWhere('student_id', studentId); })
      .first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check authorization
    if (currentUser.role === 'student' && student.user_id !== currentUser.id) {
      throw new AppError('Insufficient permissions', 403, 'AUTHORIZATION_ERROR');
    }

    let allowedClassIds: string[] | undefined;
    if (currentUser.role === 'teacher') {
      allowedClassIds = await teacherClassIds(currentUser.id, tenantId);
      if (allowedClassIds.length === 0) throw new AppError('Insufficient permissions', 403, 'AUTHORIZATION_ERROR');
      const enrollment = await db('enrollments')
        .where('student_id', student.id)
        .whereIn('class_id', allowedClassIds)
        .where(function () { this.whereIn('status', ['active', 'enrolled']).orWhereNull('status'); })
        .first();
      if (!enrollment) throw new AppError('Insufficient permissions', 403, 'AUTHORIZATION_ERROR');
    }

    // Academic-year scope: attendance rows belong to a class, and classes are
    // session-scoped. Restrict to classes whose session name matches the year
    // (null-session classes are always included so legacy rows aren't hidden).
    // Omitting the year returns the student's full lifetime attendance.
    const academicYear = req.query.academic_year as string | undefined;
    let yearClassIds: string[] | undefined;
    if (academicYear) {
      const rows = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .where(function (this: any) {
          this.where('academic_sessions.name', academicYear)
            .orWhereNull('classes.academic_session_id');
        })
        .distinct('classes.id');
      yearClassIds = rows.map((r: any) => r.id);
    }

    let attendanceQuery = db('attendance')
      .select('id', 'class_id', 'attendance_date as date', 'status', 'session_type', 'check_in_time', 'check_out_time', 'marked_at', 'remarks')
      .where('student_id', student.id)
      .orderBy('attendance_date', 'desc')
      .orderBy('session_type', 'asc');
    if (allowedClassIds) attendanceQuery = attendanceQuery.whereIn('class_id', allowedClassIds);
    if (yearClassIds) {
      // No matching classes for that year → no rows.
      attendanceQuery = yearClassIds.length
        ? attendanceQuery.whereIn('class_id', yearClassIds)
        : attendanceQuery.whereRaw('1 = 0');
    }
    const attendance = await attendanceQuery;

    const total = attendance.length;
    const present = attendance.filter((a: any) => a.status === 'present').length;
    const late = attendance.filter((a: any) => a.status === 'late').length;
    const absent = attendance.filter((a: any) => a.status === 'absent').length;
    const excused = attendance.filter((a: any) => a.status === 'excused').length;

    const attendancePercentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    res.json({
      student_id: student.student_id,
      summary: {
        total_days: total,
        present,
        late,
        absent,
        excused,
        attendance_percentage: attendancePercentage,
        at_risk: attendancePercentage < 75,
      },
      records: attendance,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/attendance/:attendanceId
 * Update an attendance record with session support
 */
router.put('/:attendanceId', authenticate, attachUserContext, authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { attendanceId } = req.params;
    const { status, session_type, check_in_time, check_out_time, remarks } = req.body;
    const updatedBy = (req as any).user?.id || (req as any).auth?.userId;
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const attendance = await db('attendance')
      .join('students', 'attendance.student_id', 'students.id')
      .where('attendance.id', attendanceId)
      .where('students.tenant_id', tenantId)
      .select('attendance.*')
      .first();
    if (!attendance) {
      throw new AppError('Attendance record not found', 404, 'NOT_FOUND');
    }

    if (req.user?.role === 'teacher' && !(await teacherClassIds(req.user.id, tenantId)).includes(attendance.class_id)) {
      throw new AppError('You are not assigned to this class', 403, 'FORBIDDEN');
    }

    const updateData: any = {};
    
    if (status) {
      const validStatuses = ['present', 'absent', 'late', 'excused'];
      if (!validStatuses.includes(status)) {
        throw new AppError(`Status must be one of: ${validStatuses.join(', ')}`, 400, 'VALIDATION_ERROR');
      }
      updateData.status = status;
    }

    if (session_type) {
      const validSessions = ['morning', 'afternoon', 'full_day'];
      if (!validSessions.includes(session_type)) {
        throw new AppError(`Session type must be one of: ${validSessions.join(', ')}`, 400, 'VALIDATION_ERROR');
      }
      updateData.session_type = session_type;
    }

    if (check_in_time !== undefined) updateData.check_in_time = check_in_time;
    if (check_out_time !== undefined) updateData.check_out_time = check_out_time;
    if (['absent', 'excused'].includes(status || attendance.status)) {
      updateData.check_in_time = null;
      updateData.check_out_time = null;
    }
    if (remarks !== undefined) updateData.remarks = remarks;

    updateData.updated_at = new Date();
    updateData.marked_by = updatedBy;
    updateData.marked_at = new Date();

    await db('attendance').where('id', attendanceId).update(updateData);

    const updated = await db('attendance').where('id', attendanceId).first();

    res.json({
      message: 'Attendance record updated successfully',
      attendance: updated,
    });

    logger.info(`Attendance record updated: ${attendanceId}`);

    // Notify parents when a check-in / check-out time is NEWLY set via edit.
    const dateStr = updated?.attendance_date ? String(updated.attendance_date).slice(0, 10) : '';
    if (updated?.check_in_time && !attendance.check_in_time) {
      void notifyGuardiansOfAttendance(tenantId, updated.student_id, 'check_in', updated.check_in_time, dateStr);
    }
    if (updated?.check_out_time && !attendance.check_out_time) {
      void notifyGuardiansOfAttendance(tenantId, updated.student_id, 'check_out', updated.check_out_time, dateStr);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/attendance/class/:classId
 * Get class attendance summary with session support
 */
router.get('/class/:classId', authenticate, attachUserContext, authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params;
    const date = req.query.date as string;
    const session_type = req.query.session_type as string;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const classData = await db('classes')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .where('classes.id', classId)
      .where(function () {
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function () {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
      .select('classes.*')
      .first();
    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    if (req.user?.role === 'teacher' && !(await teacherClassIds(req.user.id, tenantId)).includes(classId)) {
      throw new AppError('You are not assigned to this class', 403, 'FORBIDDEN');
    }

    let query = db('attendance').where('class_id', classData.id);

    if (date) {
      query = query.where('attendance_date', date);
    }
    if (session_type) {
      query = query.where('session_type', session_type);
    }

    const records = await query
      .select(
        'id', 
        'student_id', 
        'status', 
        'session_type',
        'check_in_time',
        'check_out_time',
        'marked_at',
        'remarks', 
        'attendance_date as date'
      )
      .orderBy('attendance_date', 'desc')
      .orderBy('session_type', 'asc')
      .orderBy('student_id', 'asc');

    res.json({
      class_id: classId,
      class_name: classData.name,
      attendance_records: records,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/attendance/bulk
 * Record attendance for multiple students (batch/bulk upsert) with session support
 */
router.post('/bulk', authenticate, attachUserContext, authorize(UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { class_id, date, session_type, records } = req.body;
    const recordedBy = (req as any).user?.id || (req as any).auth?.userId;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!date || !records || !Array.isArray(records)) {
      throw new AppError('Missing required fields or invalid records format', 400, 'VALIDATION_ERROR');
    }

    const sessionTypeValue = session_type || 'full_day';
    const validSessions = ['morning', 'afternoon', 'full_day'];
    if (!validSessions.includes(sessionTypeValue)) {
      throw new AppError(`Session type must be one of: ${validSessions.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    // Teachers must mark attendance for a specific class they teach/lead —
    // they cannot use the all-students (no class_id) bulk mode.
    if (req.user?.role === 'teacher') {
      if (!class_id) {
        throw new AppError('Teachers must select a class to mark attendance', 400, 'CLASS_REQUIRED');
      }
      const teacher = await db('teachers')
        .join('users as u', 'teachers.user_id', 'u.id')
        .where('teachers.user_id', req.user.id)
        .where('u.tenant_id', tenantId)
        .select('teachers.id')
        .first();
      let allowed = false;
      if (teacher) {
        const assigned = await db('teacher_assignments').where({ teacher_id: teacher.id, class_id }).first();
        const led = await db('classes').where({ id: class_id, class_teacher_id: teacher.id }).first();
        allowed = !!(assigned || led);
      }
      if (!allowed) {
        throw new AppError('You are not assigned to this class', 403, 'FORBIDDEN');
      }
    }

    // Verify class belongs to this tenant if class_id provided
    if (class_id) {
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', class_id)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }
    }

    // Collect NEW check-in / check-out transitions to notify parents after commit.
    const checkInNotify: Array<{ student_id: string; time: string }> = [];
    const checkOutNotify: Array<{ student_id: string; time: string }> = [];

    // Insert or update attendance records in a transaction
    await db.transaction(async (trx) => {
      for (const record of records) {
        const { student_id, status, check_in_time, check_out_time, remarks } = record;

        // Validations
        const validStatuses = ['present', 'absent', 'late', 'excused'];
        if (!validStatuses.includes(status)) continue;

        // Verify student belongs to this tenant
        const studentCheck = await trx('students').where({ id: student_id, tenant_id: tenantId }).first();
        if (!studentCheck) continue;
        if (req.user?.role === 'teacher') {
          const enrollment = await trx('enrollments')
            .where({ student_id, class_id })
            .where(function () { this.whereIn('status', ['active', 'enrolled']).orWhereNull('status'); })
            .first();
          if (!enrollment) continue;
        }

        // Check if duplicate exists (same student, date, and session)
        const existing = await trx('attendance')
          .where('student_id', student_id)
          .where('attendance_date', date)
          .where('session_type', sessionTypeValue)
          .andWhere(function() {
            if (class_id) {
              this.where('class_id', class_id);
            }
          })
          .first();

        const nulled = ['absent', 'excused'].includes(status);
        if (existing) {
          const newCheckIn = nulled ? null : (check_in_time ?? existing.check_in_time ?? null);
          const newCheckOut = nulled ? null : (check_out_time ?? existing.check_out_time ?? null);
          // Only notify when a check-in/out time is NEWLY set (transition), not
          // on every re-save of an unchanged value.
          if (newCheckIn && !existing.check_in_time) checkInNotify.push({ student_id, time: newCheckIn });
          if (newCheckOut && !existing.check_out_time) checkOutNotify.push({ student_id, time: newCheckOut });
          await trx('attendance')
            .where('id', existing.id)
            .update({
              status,
              check_in_time: newCheckIn,
              check_out_time: newCheckOut,
              remarks: remarks || null,
              marked_by: recordedBy,
              marked_at: new Date(),
              updated_at: new Date()
            });
        } else {
          // Insert new record
          const ci = nulled ? null : (check_in_time || null);
          const co = nulled ? null : (check_out_time || null);
          if (ci) checkInNotify.push({ student_id, time: ci });
          if (co) checkOutNotify.push({ student_id, time: co });
          const attendanceData: any = {
            student_id,
            attendance_date: date,
            status,
            session_type: sessionTypeValue,
            check_in_time: ci,
            check_out_time: co,
            remarks: remarks || null,
            marked_by: recordedBy,
            marked_at: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          };

          if (class_id) {
            attendanceData.class_id = class_id;
          }

          await trx('attendance').insert(attendanceData);
        }
      }
    });

    // Notify parents (best-effort, after commit) of arrivals + departures.
    for (const c of checkInNotify) void notifyGuardiansOfAttendance(tenantId, c.student_id, 'check_in', c.time, date);
    for (const c of checkOutNotify) void notifyGuardiansOfAttendance(tenantId, c.student_id, 'check_out', c.time, date);

    res.status(200).json({
      success: true,
      message: 'Bulk attendance recorded successfully'
    });

    logger.info(`Bulk attendance recorded for ${class_id ? `class ${class_id}` : 'all students'} on ${date} (${sessionTypeValue} session) by ${recordedBy}`);
  } catch (error) {
    logger.error('Error in POST /api/v1/attendance/bulk:', error);
    next(error);
  }
});

export default router;
