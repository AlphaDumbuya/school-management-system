import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { UserRole } from '../types/auth';
import { logger } from '@utils/logger';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

/**
 * POST /api/v1/enrollments
 * Create a new enrollment
 */
router.post('/', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { student_id, class_id, academic_session_id, enrollment_date, roll_number, status } = req.body;
    const createdBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!student_id || !class_id || !academic_session_id || !enrollment_date) {
      throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
    }

    // Check student exists and belongs to tenant
    const student = await db('students').where({ id: student_id, tenant_id: tenantId }).first();
    if (!student) {
      throw new AppError('Student not found or access denied', 404, 'NOT_FOUND');
    }

    // Check class exists and belongs to tenant
    const classData = await db('classes')
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
      .select('classes.*')
      .first();
    if (!classData) {
      throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
    }

    // Check capacity
    const enrolled = await db('enrollments').where('class_id', class_id).whereIn('status', ['enrolled', 'active']).count('* as count').first();
    const currentEnrolledCount = Number(enrolled?.count ?? 0);
    if (currentEnrolledCount >= classData.capacity) {
      throw new AppError('Class is at full capacity', 400, 'VALIDATION_ERROR');
    }

    // Check duplicate enrollment
    const existing = await db('enrollments')
      .where('student_id', student_id)
      .where('class_id', class_id)
      .where('academic_session_id', academic_session_id)
      .whereIn('status', ['enrolled', 'active'])
      .first();

    if (existing) {
      throw new AppError('Student already enrolled in this class', 409, 'CONFLICT');
    }

    const [id] = await db('enrollments').insert({
      student_id,
      class_id,
      academic_session_id,
      enrollment_date,
      roll_number: roll_number || (currentEnrolledCount + 1),
      status: status || 'enrolled',
      created_at: new Date(),
      updated_at: new Date(),
      created_by: createdBy,
    }).returning('id');

    const insertedId = typeof id === 'object' ? id.id : id;
    const enrollment = await db('enrollments').where('id', insertedId).first();

    res.status(201).json({
      message: 'Enrollment created successfully',
      enrollment,
    });

    logger.info(`Student ${student.student_id} enrolled in class ${classData.name}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/enrollments
 * List enrollments with filtering
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    let query = db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .select('enrollments.id', 'enrollments.student_id', 'enrollments.class_id', 'enrollments.academic_session_id', 'enrollments.enrollment_date', 'enrollments.status', 'enrollments.roll_number', 'enrollments.created_at');

    if (status) {
      query = query.where('enrollments.status', status);
    }

    const total = await query.clone().count('* as count').first();
    const enrollments = await query.limit(limit).offset(offset).orderBy('enrollments.enrollment_date', 'desc');

    res.json({
      data: enrollments,
      pagination: {
        page,
        limit,
        total: Number(total?.count ?? 0),
        total_pages: Math.ceil(Number(total?.count ?? 0) / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/enrollments/:enrollmentId
 * Get enrollment details
 */
router.get('/:enrollmentId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enrollmentId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const enrollment = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .where('enrollments.id', enrollmentId)
      .where('students.tenant_id', tenantId)
      .select('enrollments.*')
      .first();

    if (!enrollment) {
      throw new AppError('Enrollment not found or access denied', 404, 'NOT_FOUND');
    }

    res.json(enrollment);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/enrollments/:enrollmentId
 * Update enrollment
 */
router.put('/:enrollmentId', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enrollmentId } = req.params;
    const { roll_number, status } = req.body;
    const updatedBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const enrollment = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .where('enrollments.id', enrollmentId)
      .where('students.tenant_id', tenantId)
      .select('enrollments.*')
      .first();

    if (!enrollment) {
      throw new AppError('Enrollment not found or access denied', 404, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (roll_number !== undefined) updateData.roll_number = roll_number;
    if (status) updateData.status = status;

    updateData.updated_at = new Date();
    updateData.updated_by = updatedBy;

    await db('enrollments').where('id', enrollmentId).update(updateData);

    const updated = await db('enrollments').where('id', enrollmentId).first();

    res.json({
      message: 'Enrollment updated successfully',
      enrollment: updated,
    });

    logger.info(`Enrollment updated: ${enrollmentId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/enrollments/:enrollmentId/drop
 * Drop student from class
 */
router.post('/:enrollmentId/drop', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enrollmentId } = req.params;
    const { reason } = req.body;
    const droppedBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const enrollment = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .where('enrollments.id', enrollmentId)
      .where('students.tenant_id', tenantId)
      .select('enrollments.*')
      .first();

    if (!enrollment) {
      throw new AppError('Enrollment not found or access denied', 404, 'NOT_FOUND');
    }

    await db('enrollments').where('id', enrollmentId).update({
      status: 'dropped',
      updated_at: new Date(),
      updated_by: droppedBy,
    });

    res.json({
      message: 'Student dropped successfully',
    });

    logger.info(`Student dropped from enrollment: ${enrollmentId}. Reason: ${reason || 'Not specified'}`);
  } catch (error) {
    next(error);
  }
});

export default router;
