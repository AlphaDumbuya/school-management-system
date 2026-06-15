import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import knex from 'knex';
import knexConfig from '../../knexfile';

const router = Router();
const db = knex(knexConfig.development);

/**
 * POST /api/v1/attendance
 * Record attendance for a student
 */
router.post('/', authenticate, authorize('principal', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { student_id, class_id, date, status, remarks } = req.body;
    const recordedBy = (req as any).user.id;

    if (!student_id || !class_id || !date || !status) {
      throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
    }

    const validStatuses = ['present', 'absent', 'late', 'excused'];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Status must be one of: ${validStatuses.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    // Verify student exists
    const student = await db('students').where('id', student_id).first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check duplicate attendance record
    const existing = await db('attendance')
      .where('student_id', student_id)
      .where('class_id', class_id)
      .where('date', date)
      .first();

    if (existing) {
      throw new AppError('Attendance already recorded for this date', 409, 'CONFLICT');
    }

    const [id] = await db('attendance').insert({
      student_id,
      class_id,
      date,
      status,
      remarks: remarks || null,
      recorded_by: recordedBy,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const attendance = await db('attendance').where('id', id).first();

    res.status(201).json({
      message: 'Attendance recorded successfully',
      attendance,
    });

    logger.info(`Attendance recorded for student ${student.student_id}: ${status}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/attendance
 * List attendance records with filtering
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const studentId = req.query.studentId as string;
    const classId = req.query.classId as string;
    const status = req.query.status as string;

    let query = db('attendance').select('id', 'student_id', 'class_id', 'date', 'status', 'remarks', 'created_at');

    if (studentId) {
      query = query.where('student_id', studentId);
    }
    if (classId) {
      query = query.where('class_id', classId);
    }
    if (status) {
      query = query.where('status', status);
    }

    const total = await query.clone().count('* as count').first();
    const records = await query.limit(limit).offset(offset).orderBy('date', 'desc');

    res.json({
      data: records,
      pagination: {
        page,
        limit,
        total: total.count,
        total_pages: Math.ceil(total.count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId/attendance
 * Get attendance record for a student
 */
router.get('/student/:studentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = (req as any).user;

    const student = await db('students').where('id', studentId).orWhere('student_id', studentId).first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check authorization
    if (currentUser.role === 'student' && student.user_id !== currentUser.id && currentUser.role !== 'principal') {
      throw new AppError('Insufficient permissions', 403, 'AUTHORIZATION_ERROR');
    }

    const attendance = await db('attendance')
      .select('id', 'class_id', 'date', 'status')
      .where('student_id', student.id)
      .orderBy('date', 'desc');

    // Calculate attendance percentage
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
 * Update an attendance record
 */
router.put('/:attendanceId', authenticate, authorize('admin', 'principal', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { attendanceId } = req.params;
    const { status, remarks } = req.body;
    const updatedBy = (req as any).user.id;

    const attendance = await db('attendance').where('id', attendanceId).first();
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
    if (remarks !== undefined) updateData.remarks = remarks;

    updateData.updated_at = new Date();
    updateData.updated_by = updatedBy;

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
 * GET /api/v1/classes/:classId/attendance
 * Get class attendance summary
 */
router.get('/class/:classId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params;
    const date = req.query.date as string;

    const classData = await db('classes').where('id', classId).first();
    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    let query = db('attendance').where('class_id', classData.id);

    if (date) {
      query = query.where('date', date);
    }

    const records = await query
      .select('student_id', 'status', 'date')
      .orderBy('date', 'desc')
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

export default router;
