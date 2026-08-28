import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { UserRole } from '../types/auth';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

/**
 * POST /api/v1/classes
 * Create a new class
 */
router.post('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, level, section, capacity, academic_session_id, class_teacher_id, room_number, floor, building, next_class_id, is_final_year } = req.body;
    const createdBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!name || !level || !capacity) {
      throw new AppError('Missing required fields: name, level, capacity', 400, 'VALIDATION_ERROR');
    }

    if (capacity < 5 || capacity > 100) {
      throw new AppError('Capacity must be between 5 and 100', 400, 'VALIDATION_ERROR');
    }

    // Auto-resolve active academic session if none is provided
    let sessionId = academic_session_id;
    if (!sessionId) {
      const activeSession = await db('academic_sessions')
        .where({ tenant_id: tenantId, is_active: true })
        .first();
      if (activeSession) {
        sessionId = activeSession.id;
      }
    } else {
      const validSession = await db('academic_sessions')
        .where({ id: sessionId, tenant_id: tenantId })
        .first();
      if (!validSession) {
        throw new AppError('Academic session not found or access denied', 400, 'VALIDATION_ERROR');
      }
    }

    const [inserted] = await db('classes').insert({
      name: name.trim(),
      level,
      section: section || null,
      capacity,
      academic_session_id: sessionId || null,
      class_teacher_id: class_teacher_id || null,
      room_number: room_number || null,
      floor: floor || null,
      building: building || null,
      next_class_id: next_class_id || null,
      is_final_year: is_final_year ?? false,
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
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    let query = db('classes')
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
      .where(function () {
        // A class belongs to this tenant if:
        // (a) its session belongs to the tenant, OR
        // (b) it has no session but was created by a user of this tenant
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function () {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
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
        'classes.next_class_id',
        'classes.is_final_year',
        'classes.created_at',
        db.raw('COALESCE(enrollment_counts.enrolled_students, 0) as enrolled_students')
      )
      .leftJoin(
        db('enrollments')
          .select('class_id')
          .count('* as enrolled_students')
          .whereIn('status', ['enrolled', 'active'])
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
 * GET /api/v1/classes/:classId/students
 * Get enrolled students in a class
 */
router.get('/:classId/students', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { classId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const classData = await db('classes')
      .select('classes.*')
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
      .first();

    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    const students = await db('students')
      .join('enrollments', 'students.id', '=', 'enrollments.student_id')
      .leftJoin('users', 'students.user_id', 'users.id')
      .select(
        'students.id',
        'students.student_id',
        db.raw("COALESCE(students.first_name, users.first_name, '') as first_name"),
        db.raw("COALESCE(students.last_name, users.last_name, '') as last_name"),
        db.raw("COALESCE(students.photo_url, users.photo_url) as photo_url"),
        'enrollments.roll_number',
        'enrollments.status'
      )
      .where('enrollments.class_id', classData.id)
      .where(function () {
        this.where('students.tenant_id', tenantId)
          .orWhere('users.tenant_id', tenantId)
          .orWhereNull('students.tenant_id');
      })
      .where(function () {
        this.whereIn('enrollments.status', ['enrolled', 'active'])
          .orWhereNull('enrollments.status');
      })
      .orderBy('enrollments.roll_number', 'asc');

    res.json({
      success: true,
      data: {
        class_id: classId,
        class_name: classData.name,
        total_students: students.length,
        students,
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

    // Get enrollment count
    const enrollmentCount = await db('enrollments').where('class_id', classData.id).whereIn('status', ['enrolled', 'active']).count('* as count').first();
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
    const { name, level, section, capacity, class_teacher_id, room_number, floor, building, status, next_class_id, is_final_year } = req.body;
    const updatedBy = req.auth?.userId ?? null;
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
      .first();

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
    if (next_class_id !== undefined) updateData.next_class_id = next_class_id || null;
    if (is_final_year !== undefined) updateData.is_final_year = !!is_final_year;
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
      .first();

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
      .first();

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

export default router;
