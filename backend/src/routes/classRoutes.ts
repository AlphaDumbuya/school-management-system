import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { UserRole } from '../types/auth';
import knex from 'knex';
import knexConfig from '../../knexfile';

const router = Router();
const env = (process.env.NODE_ENV || "development") as keyof typeof knexConfig;
const db = knex(knexConfig[env] || knexConfig.development);

/**
 * POST /api/v1/classes
 * Create a new class
 */
router.post('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, level, section, capacity, academic_session_id, class_teacher_id, room_number, floor, building } = req.body;
    const createdBy = req.auth?.userId ?? null;

    if (!name || !level || !capacity) {
      throw new AppError('Missing required fields: name, level, capacity', 400, 'VALIDATION_ERROR');
    }

    if (capacity < 5 || capacity > 100) {
      throw new AppError('Capacity must be between 5 and 100', 400, 'VALIDATION_ERROR');
    }

    const [inserted] = await db('classes').insert({
      name: name.trim(),
      level,
      section: section || null,
      capacity,
      academic_session_id: academic_session_id || null,
      class_teacher_id: class_teacher_id || null,
      room_number: room_number || null,
      floor: floor || null,
      building: building || null,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
      created_by: createdBy,
    }).returning('*');

    res.status(201).json({
      message: 'Class created successfully',
      class: inserted,
    });

    logger.info(`Class created: ${name}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/classes
 * List all classes with enrolled_students count, search, and status filter
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const level = req.query.level as string;
    const status = req.query.status as string;
    const search = req.query.search as string;

    let query = db('classes')
      .select(
        'classes.id',
        'classes.name',
        'classes.level',
        'classes.section',
        'classes.capacity',
        'classes.status',
        'classes.room_number',
        'classes.floor',
        'classes.building',
        'classes.created_at',
        db.raw('COALESCE(enrollment_counts.enrolled_students, 0) as enrolled_students')
      )
      .leftJoin(
        db('enrollments')
          .select('class_id')
          .count('* as enrolled_students')
          .where('status', 'enrolled')
          .groupBy('class_id')
          .as('enrollment_counts'),
        'classes.id',
        'enrollment_counts.class_id'
      );

    if (level) {
      query = query.where('classes.level', level);
    }

    if (status) {
      query = query.where('classes.status', status);
    }

    if (search) {
      const term = `%${search.trim()}%`;
      query = query.where(function () {
        this.where('classes.name', 'like', term)
          .orWhere('classes.room_number', 'like', term)
          .orWhere('classes.building', 'like', term);
      });
    }

    const totalResult = await query.clone().clearSelect().clearOrder().count('classes.id as count').first();
    const total = Number(totalResult?.count ?? 0);

    const classes = await query.limit(limit).offset(offset).orderBy('classes.level', 'asc').orderBy('classes.name', 'asc');

    res.json({
      data: classes,
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
 * GET /api/v1/classes/:classId
 * Get class details
 */
router.get('/:classId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params;

    const classData = await db('classes').where('id', classId).first();
    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    // Get enrollment count
    const enrollmentCount = await db('enrollments').where('class_id', classData.id).where('status', 'enrolled').count('* as count').first();
    classData.enrolled_students = Number(enrollmentCount?.count ?? 0);

    res.json(classData);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/classes/:classId
 * Update class
 */
router.put('/:classId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params;
    const { name, level, section, capacity, class_teacher_id, room_number, floor, building, status } = req.body;
    const updatedBy = req.auth?.userId ?? null;

    const classData = await db('classes').where('id', classId).first();
    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (level) updateData.level = level;
    if (section !== undefined) updateData.section = section || null;
    if (capacity) {
      if (capacity < 5 || capacity > 100) {
        throw new AppError('Capacity must be between 5 and 100', 400, 'VALIDATION_ERROR');
      }
      updateData.capacity = capacity;
    }
    if (class_teacher_id) updateData.class_teacher_id = class_teacher_id;
    if (room_number !== undefined) updateData.room_number = room_number || null;
    if (floor !== undefined) updateData.floor = floor || null;
    if (building !== undefined) updateData.building = building || null;
    if (status) updateData.status = status;

    updateData.updated_at = new Date();
    updateData.updated_by = updatedBy;

    await db('classes').where('id', classId).update(updateData);

    const updated = await db('classes').where('id', classId).first();

    res.json({
      message: 'Class updated successfully',
      class: updated,
    });

    logger.info(`Class updated: ${classId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/classes/:classId
 * Delete class (soft delete)
 */
router.delete('/:classId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params;

    const classData = await db('classes').where('id', classId).first();
    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    await db('classes').where('id', classId).update({
      status: 'inactive',
      updated_at: new Date(),
    });

    res.json({
      message: 'Class deactivated successfully',
    });

    logger.info(`Class deactivated: ${classId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/classes/:classId/permanent
 * Permanently delete a class (only if no enrollments)
 */
router.delete('/:classId/permanent', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params;

    const classData = await db('classes').where('id', classId).first();
    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    // Check if class has any enrollments
    const enrollmentCount = await db('enrollments').where('class_id', classId).count('* as count').first();
    if (Number(enrollmentCount?.count ?? 0) > 0) {
      throw new AppError('Cannot delete a class with enrollment history. Use deactivate instead.', 400, 'HAS_ENROLLMENTS');
    }

    // Permanently remove
    await db('classes').where('id', classId).del();

    res.json({
      message: 'Class permanently deleted',
    });

    logger.info(`Class permanently deleted: ${classId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/classes/:classId/students
 * Get enrolled students in a class
 */
router.get('/:classId/students', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params;

    const classData = await db('classes').where('id', classId).first();
    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    const students = await db('students')
      .join('enrollments', 'students.id', '=', 'enrollments.student_id')
      .select('students.id', 'students.student_id', 'students.first_name', 'students.last_name', 'enrollments.roll_number', 'enrollments.status')
      .where('enrollments.class_id', classData.id)
      .where('enrollments.status', 'enrolled')
      .orderBy('enrollments.roll_number', 'asc');

    res.json({
      class_id: classId,
      class_name: classData.name,
      total_students: students.length,
      students,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
