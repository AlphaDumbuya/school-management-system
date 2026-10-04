import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { UserRole } from '../types/auth';

const STAFF_READ = [UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER];
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

/**
 * POST /api/v1/grades
 * Create/record a grade for a student
 */
router.post('/', authenticate, authorize('principal', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { student_id, subject_id, class_id, marks_obtained, total_marks, grade, remarks, client_id } = req.body;
    const recordedBy = (req as any).user.id;

    if (!student_id || !subject_id || marks_obtained === undefined || total_marks === undefined) {
      throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
    }

    // Idempotency: a retried offline push with the same client_id returns the
    // already-created grade instead of creating a duplicate.
    if (client_id) {
      const byClient = await db('grades').where('client_id', client_id).first();
      if (byClient) {
        return res.status(200).json({ message: 'Grade already recorded (idempotent)', grade: byClient });
      }
    }

    if (marks_obtained < 0 || marks_obtained > total_marks) {
      throw new AppError('Marks obtained must be between 0 and total marks', 400, 'VALIDATION_ERROR');
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

    // Verify subject exists (belongs to this tenant via its creator user context)
    const subject = await db('subjects')
      .join('users', 'subjects.created_by', 'users.id')
      .where('subjects.id', subject_id)
      .where('users.tenant_id', tenantId)
      .select('subjects.*')
      .first();
    if (!subject) {
      throw new AppError('Subject not found', 404, 'NOT_FOUND');
    }

    // Calculate percentage
    const percentage = (marks_obtained / total_marks) * 100;

    // Assign grade letter if not provided
    let gradeValue = grade;
    if (!gradeValue) {
      if (percentage >= 90) gradeValue = 'A+';
      else if (percentage >= 80) gradeValue = 'A';
      else if (percentage >= 70) gradeValue = 'B';
      else if (percentage >= 60) gradeValue = 'C';
      else if (percentage >= 50) gradeValue = 'D';
      else gradeValue = 'F';
    }

    const [id] = await db('grades').insert({
      student_id,
      subject_id,
      class_id: class_id || null,
      marks_obtained,
      total_marks,
      percentage,
      grade: gradeValue,
      remarks: remarks || null,
      status: 'draft',
      recorded_by: recordedBy,
      recorded_date: new Date(),
      client_id: client_id || null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const gradeRecord = await db('grades').where('id', id).first();

    res.status(201).json({
      message: 'Grade recorded successfully',
      grade: gradeRecord,
    });

    logger.info(`Grade recorded for student ${student.student_id}: ${marks_obtained}/${total_marks}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/grades
 * List grades with filtering
 */
// Staff only: unscoped, unpublished legacy grades (students/parents use the
// publish-gated dashboards and report cards).
router.get('/', authenticate, authorize(STAFF_READ), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const studentId = req.query.studentId as string;
    const classId = req.query.classId as string;
    const status = req.query.status as string;
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    let query = db('grades')
      .join('students', 'grades.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .select('grades.id', 'grades.student_id', 'grades.subject_id', 'grades.class_id', 'grades.marks_obtained', 'grades.total_marks', 'grades.percentage', 'grades.grade', 'grades.status', 'grades.recorded_date');

    if (studentId) {
      query = query.where('grades.student_id', studentId);
    }
    if (classId) {
      query = query.where('grades.class_id', classId);
    }
    if (status) {
      query = query.where('grades.status', status);
    }

    const totalResult = await query.clone().clearSelect().clearOrder().count('grades.id as count').first();
    const total = Number(totalResult?.count ?? 0);
    const grades = await query.limit(limit).offset(offset).orderBy('grades.recorded_date', 'desc');

    res.json({
      data: grades,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId/grades
 * Get all grades for a student
 */
router.get('/student/:studentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = (req as any).user;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const student = await db('students')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('id', studentId).orWhere('student_id', studentId);
      })
      .first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check authorization: staff; the student themself; or a linked parent.
    // Every other role (and a parent of someone else) is refused.
    const role = String(currentUser.role || '');
    if (!['principal', 'super_admin', 'teacher'].includes(role)) {
      let allowed = false;
      if (role === 'student') allowed = student.user_id === currentUser.id;
      else if (role === 'parent' || role === 'guardian') {
        allowed = !!(await db('guardians').where({ user_id: currentUser.id, student_id: student.id }).first('id'));
      }
      if (!allowed) throw new AppError('Insufficient permissions', 403, 'AUTHORIZATION_ERROR');
    }

    const grades = await db('grades')
      .select('id', 'subject_id', 'marks_obtained', 'total_marks', 'percentage', 'grade', 'status', 'recorded_date')
      .where('student_id', student.id)
      .orderBy('recorded_date', 'desc');

    // Calculate average
    const avgGrade = await db('grades').where('student_id', student.id).avg('percentage').first();

    res.json({
      student_id: student.student_id,
      average_percentage: avgGrade.avg ? Math.round(avgGrade.avg) : 0,
      total_subjects: grades.length,
      grades,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/grades/:gradeId
 * Update a grade
 */
router.put('/:gradeId', authenticate, authorize('principal', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gradeId } = req.params;
    const { marks_obtained, remarks, status } = req.body;
    const updatedBy = (req as any).user.id;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const grade = await db('grades')
      .join('students', 'grades.student_id', 'students.id')
      .where('grades.id', gradeId)
      .where('students.tenant_id', tenantId)
      .select('grades.*')
      .first();
    if (!grade) {
      throw new AppError('Grade not found', 404, 'NOT_FOUND');
    }

    if (grade.status === 'finalized') {
      throw new AppError('Cannot update finalized grades', 400, 'VALIDATION_ERROR');
    }

    const updateData: any = {};
    if (marks_obtained !== undefined) {
      if (marks_obtained < 0 || marks_obtained > grade.total_marks) {
        throw new AppError('Invalid marks', 400, 'VALIDATION_ERROR');
      }
      updateData.marks_obtained = marks_obtained;
      const percentage = (marks_obtained / grade.total_marks) * 100;
      updateData.percentage = percentage;
      
      // Recalculate grade letter
      if (percentage >= 90) updateData.grade = 'A+';
      else if (percentage >= 80) updateData.grade = 'A';
      else if (percentage >= 70) updateData.grade = 'B';
      else if (percentage >= 60) updateData.grade = 'C';
      else if (percentage >= 50) updateData.grade = 'D';
      else updateData.grade = 'F';
    }
    if (remarks !== undefined) updateData.remarks = remarks;
    if (status) updateData.status = status;

    updateData.updated_at = new Date();
    updateData.updated_by = updatedBy;

    await db('grades').where('id', gradeId).update(updateData);

    const updated = await db('grades').where('id', gradeId).first();

    res.json({
      message: 'Grade updated successfully',
      grade: updated,
    });

    logger.info(`Grade updated: ${gradeId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/grades/:gradeId/finalize
 * Finalize a grade (lock it from further changes)
 */
router.post('/:gradeId/finalize', authenticate, authorize('principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gradeId } = req.params;
    const finalizedBy = (req as any).user.id;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const grade = await db('grades')
      .join('students', 'grades.student_id', 'students.id')
      .where('grades.id', gradeId)
      .where('students.tenant_id', tenantId)
      .select('grades.*')
      .first();
    if (!grade) {
      throw new AppError('Grade not found', 404, 'NOT_FOUND');
    }

    await db('grades').where('id', gradeId).update({
      status: 'finalized',
      finalized_at: new Date(),
      finalized_by: finalizedBy,
    });

    res.json({
      message: 'Grade finalized successfully',
    });

    logger.info(`Grade finalized: ${gradeId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/classes/:classId/grades
 * Get class grades summary
 */
router.get('/class/:classId', authenticate, authorize(STAFF_READ), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params;
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

    const grades = await db('grades')
      .join('students', 'grades.student_id', 'students.id')
      .select('grades.student_id', 'grades.subject_id', 'grades.marks_obtained', 'grades.total_marks', 'grades.percentage', 'grades.grade')
      .where('grades.class_id', classData.id)
      .where('students.tenant_id', tenantId)
      .orderBy('grades.student_id', 'asc');

    // Calculate class statistics
    const stats = await db('grades')
      .join('students', 'grades.student_id', 'students.id')
      .where('grades.class_id', classData.id)
      .where('students.tenant_id', tenantId)
      .select(
        db.raw('AVG(percentage) as avg_percentage'),
        db.raw('MAX(percentage) as max_percentage'),
        db.raw('MIN(percentage) as min_percentage'),
        db.raw('COUNT(DISTINCT student_id) as total_students')
      )
      .first();

    res.json({
      class_id: classId,
      class_name: classData.name,
      statistics: {
        average_percentage: stats.avg_percentage ? Math.round(stats.avg_percentage) : 0,
        highest_percentage: stats.max_percentage,
        lowest_percentage: stats.min_percentage,
        total_students: stats.total_students,
      },
      grades,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
