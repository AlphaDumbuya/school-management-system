import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { UserRole } from '../types/auth';
import { logger } from '@utils/logger';
import knex from 'knex';
import knexConfig from '../../knexfile';

const router = Router();
const env = (process.env.NODE_ENV || "development") as keyof typeof knexConfig;
const db = knex(knexConfig[env] || knexConfig.development);

/**
 * POST /api/v1/enrollments
 * Create a new enrollment
 */
router.post('/', authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { student_id, class_id, academic_session_id, enrollment_date, roll_number, status } = req.body;
    const createdBy = (req as any).user.id;

    if (!student_id || !class_id || !academic_session_id || !enrollment_date) {
      throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
    }

    // Check student exists
    const student = await db('students').where('id', student_id).first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check class exists
    const classData = await db('classes').where('id', class_id).first();
    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
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
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    let query = db('enrollments').select('id', 'student_id', 'class_id', 'academic_session_id', 'enrollment_date', 'status', 'roll_number', 'created_at');

    if (status) {
      query = query.where('status', status);
    }

    const total = await query.clone().count('* as count').first();
    const enrollments = await query.limit(limit).offset(offset).orderBy('enrollment_date', 'desc');

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
router.get('/:enrollmentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enrollmentId } = req.params;

    const enrollment = await db('enrollments').where('id', enrollmentId).first();
    if (!enrollment) {
      throw new AppError('Enrollment not found', 404, 'NOT_FOUND');
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
router.put('/:enrollmentId', authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enrollmentId } = req.params;
    const { roll_number, status } = req.body;
    const updatedBy = (req as any).user.id;

    const enrollment = await db('enrollments').where('id', enrollmentId).first();
    if (!enrollment) {
      throw new AppError('Enrollment not found', 404, 'NOT_FOUND');
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
router.post('/:enrollmentId/drop', authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { enrollmentId } = req.params;
    const { reason } = req.body;
    const droppedBy = (req as any).user.id;

    const enrollment = await db('enrollments').where('id', enrollmentId).first();
    if (!enrollment) {
      throw new AppError('Enrollment not found', 404, 'NOT_FOUND');
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
