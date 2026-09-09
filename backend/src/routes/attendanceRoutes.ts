import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { UserRole } from '../types/auth';
import { logger } from '@utils/logger';
import { db } from '@utils/database';
import { sendExport } from '@utils/exportResponse';

const router = Router();

const EXPORT_COLUMNS: Record<string, string> = {
  Student: 'student_name',
  'Admission No': 'admission_no',
  Class: 'class_name',
  Date: 'attendance_date',
  Session: 'session_type',
  Status: 'status',
  Remarks: 'remarks',
};

/**
 * GET /api/v1/attendance/export?format=csv|excel|pdf&date=&classId=
 * Download attendance records. Tenant-scoped; teachers limited to their classes.
 * Declared before any /:id route so the literal path isn't captured.
 */
router.get('/export', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');

    const date = req.query.date as string;
    const classId = req.query.classId as string;

    let query = db('attendance')
      .leftJoin('students', 'attendance.student_id', 'students.id')
      .leftJoin('classes', 'attendance.class_id', 'classes.id')
      .where('students.tenant_id', tenantId);

    // Teacher scoping: only classes they teach or lead.
    if (req.user?.role === 'teacher') {
      const teacher = await db('teachers')
        .join('users as u', 'teachers.user_id', 'u.id')
        .where('teachers.user_id', req.user.id)
        .where('u.tenant_id', tenantId)
        .select('teachers.id')
        .first();
      if (!teacher) return sendExport(res, { format: req.query.format as string, rows: [], columns: EXPORT_COLUMNS, filename: 'attendance_export', title: 'Attendance Export', sheetName: 'Attendance' });
      const assigned = await db('teacher_assignments').where('teacher_id', teacher.id).distinct('class_id');
      const led = await db('classes').where('class_teacher_id', teacher.id).select('id');
      const classIds = Array.from(new Set<string>([...assigned.map((r: any) => r.class_id), ...led.map((r: any) => r.id)]));
      if (classIds.length === 0) return sendExport(res, { format: req.query.format as string, rows: [], columns: EXPORT_COLUMNS, filename: 'attendance_export', title: 'Attendance Export', sheetName: 'Attendance' });
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

    // Idempotency: if this exact offline write (same client_id) already landed,
    // return it as success so a retried sync push never errors or duplicates.
    if (client_id) {
      const byClient = await db('attendance').where('client_id', client_id).first();
      if (byClient) {
        return res.status(200).json({ message: 'Attendance already recorded (idempotent)', attendance: byClient });
      }
    }

    // Verify student exists and belongs to this tenant
    const student = await db('students').where('id', student_id).andWhere('tenant_id', tenantId).first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
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
      check_in_time: check_in_time || null,
      check_out_time: check_out_time || null,
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
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/attendance
 * List attendance records with filtering, joins, search, pagination, and session support
 */
router.get('/', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
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
      const teacher = await db('teachers')
        .join('users as u', 'teachers.user_id', 'u.id')
        .where('teachers.user_id', req.user.id)
        .where('u.tenant_id', tenantId)
        .select('teachers.id')
        .first();
      if (!teacher) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      const assigned = await db('teacher_assignments').where('teacher_id', teacher.id).distinct('class_id');
      const led = await db('classes').where('class_teacher_id', teacher.id).select('id');
      const classIds = Array.from(new Set<string>([
        ...assigned.map((r: any) => r.class_id),
        ...led.map((r: any) => r.id),
      ]));
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
 * GET /api/v1/attendance/my
 * Attendance records & summary for the currently logged-in student.
 * Resolves the student's own record from the auth context (no id needed).
 */
router.get('/my', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
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
      .select('id', 'class_id', 'attendance_date as date', 'status', 'remarks')
      .where('student_id', student.id)
      .orderBy('attendance_date', 'desc');

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
router.get('/student/:studentId', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = (req as any).user;
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const student = await db('students').where('id', studentId).orWhere('student_id', studentId).andWhere('tenant_id', tenantId).first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check authorization
    if (currentUser.role === 'student' && student.user_id !== currentUser.id && currentUser.role !== 'principal') {
      throw new AppError('Insufficient permissions', 403, 'AUTHORIZATION_ERROR');
    }

    const attendance = await db('attendance')
      .select('id', 'class_id', 'attendance_date as date', 'status')
      .where('student_id', student.id)
      .orderBy('attendance_date', 'desc');

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
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/attendance/class/:classId
 * Get class attendance summary with session support
 */
router.get('/class/:classId', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
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

        if (existing) {
          // Update existing record
          await trx('attendance')
            .where('id', existing.id)
            .update({
              status,
              check_in_time: check_in_time || existing.check_in_time || null,
              check_out_time: check_out_time || existing.check_out_time || null,
              remarks: remarks || null,
              marked_by: recordedBy,
              marked_at: new Date(),
              updated_at: new Date()
            });
        } else {
          // Insert new record
          const attendanceData: any = {
            student_id,
            attendance_date: date,
            status,
            session_type: sessionTypeValue,
            check_in_time: check_in_time || null,
            check_out_time: check_out_time || null,
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
