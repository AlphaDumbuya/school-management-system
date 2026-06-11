import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import knex from 'knex';
import knexConfig from '../../knexfile';

const router = Router();
const db = knex(knexConfig.development);

/**
 * POST /api/v1/classes
 * Create a new class
 */
router.post('/', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, level, section, capacity, academic_session_id, class_teacher_id, room_number, floor, building } = req.body;
    const createdBy = (req as any).user.id;

    if (!name || !level || !capacity) {
      throw new AppError('Missing required fields: name, level, capacity', 400, 'VALIDATION_ERROR');
    }

    if (capacity < 5 || capacity > 100) {
      throw new AppError('Capacity must be between 5 and 100', 400, 'VALIDATION_ERROR');
    }

    const [id] = await db('classes').insert({
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
    });

    const classData = await db('classes').where('id', id).first();

    res.status(201).json({
      message: 'Class created successfully',
      class: classData,
    });

    logger.info(`Class created: ${name}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/classes
 * List all classes
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const level = req.query.level as string;

    let query = db('classes').select('id', 'name', 'level', 'section', 'capacity', 'status', 'created_at');

    if (level) {
      query = query.where('level', level);
    }

    const total = await query.clone().count('* as count').first();
    const classes = await query.limit(limit).offset(offset).orderBy('level', 'asc').orderBy('name', 'asc');

    res.json({
      data: classes,
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
    classData.enrolled_students = enrollmentCount.count;

    res.json(classData);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/classes/:classId
 * Update class
 */
router.put('/:classId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params;
    const { name, level, section, capacity, class_teacher_id, room_number, status } = req.body;
    const updatedBy = (req as any).user.id;

    const classData = await db('classes').where('id', classId).first();
    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (level) updateData.level = level;
    if (section) updateData.section = section;
    if (capacity) {
      if (capacity < 5 || capacity > 100) {
        throw new AppError('Capacity must be between 5 and 100', 400, 'VALIDATION_ERROR');
      }
      updateData.capacity = capacity;
    }
    if (class_teacher_id) updateData.class_teacher_id = class_teacher_id;
    if (room_number) updateData.room_number = room_number;
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
router.delete('/:classId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response, next: NextFunction) => {
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
