import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { UserRole } from '../types/auth';
import { PasswordService } from '@services/passwordService';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import knex from 'knex';
import knexConfig from '../../knexfile';

const router = Router();
const env = (process.env.NODE_ENV || "development") as keyof typeof knexConfig;
const db = knex(knexConfig[env] || knexConfig.development);

/**
 * GET /api/v1/teachers
 * List all teachers with pagination, status, specialization, and search filters
 */
router.get('/', authenticate, attachUserContext, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const { status, specialization, search } = req.query;

    let query = db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .select(
        'teachers.id',
        'teachers.teacher_id',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.photo_url',
        'users.status as user_status',
        'users.temp_password',
        'teachers.phone',
        'teachers.specialization',
        'teachers.experience_years',
        'teachers.office_location',
        'teachers.qualifications',
        'teachers.hire_date',
        'teachers.status as teacher_status',
        'teachers.designation',
        'teachers.department',
        'teachers.employment_type',
        'teachers.created_at',
        db.raw('(SELECT name FROM classes WHERE class_teacher_id = teachers.id LIMIT 1) as form_class_name'),
        db.raw('(SELECT id FROM classes WHERE class_teacher_id = teachers.id LIMIT 1) as form_class_id')
      );

    if (status) {
      query = query.where('users.status', status as string);
    }

    if (specialization) {
      query = query.where('teachers.specialization', specialization as string);
    }

    if (search) {
      const term = `%${(search as string).trim()}%`;
      query = query.where(function() {
        this.where('users.first_name', 'ilike', term)
          .orWhere('users.last_name', 'ilike', term)
          .orWhere('users.email', 'ilike', term)
          .orWhere('teachers.teacher_id', 'ilike', term)
          .orWhere('teachers.specialization', 'ilike', term);
      });
    }

    const totalResult = await query.clone().clearSelect().clearOrder().count('teachers.id as count').first();
    const total = Number(totalResult?.count ?? 0);
    
    const teachersList = await query
      .limit(limit)
      .offset(offset)
      .orderBy('users.first_name', 'asc');

    res.json({
      data: teachersList.map(t => ({
        ...t,
        status: t.user_status, // Use user account status as main status
      })),
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
 * GET /api/v1/teachers/:id
 * Get teacher profile details with active class and subject assignments
 */
router.get('/:id', authenticate, attachUserContext, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teacherId = req.params.id;

    const teacher = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .select(
        'teachers.id',
        'teachers.user_id',
        'teachers.teacher_id',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.photo_url',
        'users.status as user_status',
        'users.temp_password',
        'teachers.phone',
        'teachers.specialization',
        'teachers.experience_years',
        'teachers.office_location',
        'teachers.qualifications',
        'teachers.hire_date',
        'teachers.designation',
        'teachers.department',
        'teachers.employment_type',
        'teachers.created_at',
        'teachers.updated_at',
        db.raw('(SELECT name FROM classes WHERE class_teacher_id = teachers.id LIMIT 1) as form_class_name'),
        db.raw('(SELECT id FROM classes WHERE class_teacher_id = teachers.id LIMIT 1) as form_class_id')
      )
      .where('teachers.id', teacherId)
      .first();

    if (!teacher) {
      throw new AppError('Teacher not found', 404, 'NOT_FOUND');
    }

    // Fetch assignments
    const assignments = await db('teacher_assignments')
      .join('classes', 'teacher_assignments.class_id', 'classes.id')
      .join('subjects', 'teacher_assignments.subject_id', 'subjects.id')
      .select(
        'teacher_assignments.id as id',
        'teacher_assignments.class_id',
        'classes.name as class_name',
        'teacher_assignments.subject_id',
        'subjects.name as subject_name',
        'subjects.code as subject_code'
      )
      .where('teacher_assignments.teacher_id', teacherId)
      .where(function() {
        this.where('teacher_assignments.end_date', '>=', new Date()).orWhereNull('teacher_assignments.end_date');
      });

    res.json({
      ...teacher,
      status: teacher.user_status,
      assignments,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/teachers
 * Create a new teacher user and corresponding teacher record
 */
router.post('/', authenticate, attachUserContext, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  const trx = await db.transaction();
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      specialization,
      experience_years,
      office_location,
      qualifications,
      hire_date,
      status,
      photo_url,
      designation,
      department,
      employment_type,
      form_class_id,
      assigned_classes = [],
      assigned_subjects = [],
    } = req.body;

    logger.info('POST /api/v1/teachers request body received:', {
      email,
      assigned_classes,
      assigned_subjects,
      form_class_id
    });

    if (!email || !first_name || !last_name) {
      throw new AppError('Missing required profile fields: email, first_name, last_name', 400, 'VALIDATION_ERROR');
    }

    // Check if email already registered in users
    const existingUser = await trx('users').where('email', email).first();
    if (existingUser) {
      throw new AppError('Email is already registered', 409, 'CONFLICT');
    }

    const tenantId = (req as any).user.tenant_id;

    // Create user credentials
    const tempPassword = PasswordService.generateTemporaryPassword();
    const passwordHash = await PasswordService.hashPassword(tempPassword);

    const [insertedUser] = await trx('users').insert({
      tenant_id: tenantId,
      email: email.toLowerCase(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      password_hash: passwordHash,
      temp_password: tempPassword,
      role: 'teacher',
      status: status || 'active',
      photo_url: photo_url || null,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    // Generate unique teacher ID (TCH-YYYY-XXX format)
    const year = new Date().getFullYear();
    const maxResult = await trx.raw(
      "SELECT COALESCE(MAX(CAST(SPLIT_PART(teacher_id, '-', 3) AS INTEGER)), 0) as max_num FROM teachers WHERE teacher_id LIKE ?",
      [`TCH-${year}-%`]
    );
    const nextNum = (Number(maxResult.rows?.[0]?.max_num) || 0) + 1;
    const teacherIdStr = `TCH-${year}-${String(nextNum).padStart(3, '0')}`;

    // Create teacher record
    const [insertedTeacher] = await trx('teachers').insert({
      user_id: insertedUser.id,
      teacher_id: teacherIdStr,
      qualifications: qualifications || null,
      experience_years: experience_years ? parseInt(experience_years) : 0,
      specialization: specialization || null,
      phone: phone || null,
      office_location: office_location || null,
      status: status || 'active',
      hire_date: hire_date || new Date().toISOString().split('T')[0],
      designation: designation || 'subject_teacher',
      department: department || 'none',
      employment_type: employment_type || 'full_time',
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    // Assign Form Class if provided
    if (form_class_id) {
      await trx('classes').where('id', form_class_id).update({ class_teacher_id: insertedTeacher.id });
    }

    // Create assignments
    if (assigned_classes.length > 0 && assigned_subjects.length > 0) {
      const start_date = new Date().toISOString().split('T')[0];
      const assignments = [];
      for (const classId of assigned_classes) {
        for (const subjectId of assigned_subjects) {
          assignments.push({
            teacher_id: insertedTeacher.id,
            class_id: classId,
            subject_id: subjectId,
            start_date,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      }
      if (assignments.length > 0) {
        await trx('teacher_assignments').insert(assignments);
      }
    }

    await trx.commit();

    res.status(201).json({
      message: 'Teacher created successfully',
      user: {
        id: insertedTeacher.id,
        email: insertedUser.email,
        first_name: insertedUser.first_name,
        last_name: insertedUser.last_name,
        role: insertedUser.role,
        status: insertedUser.status,
        photo_url: insertedUser.photo_url,
        teacher_id: insertedTeacher.teacher_id,
        created_at: insertedTeacher.created_at,
      },
      temporary_password: tempPassword,
    });

    logger.info(`Teacher account & profile created: ${email} (Staff ID: ${teacherIdStr})`);
  } catch (error) {
    await trx.rollback();
    next(error);
  }
});

/**
 * PUT /api/v1/teachers/:id
 * Update teacher profile, record, and assigned subjects/classes
 */
router.put('/:id', authenticate, attachUserContext, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  const trx = await db.transaction();
  try {
    const teacherId = req.params.id;
    const {
      first_name,
      last_name,
      phone,
      specialization,
      experience_years,
      office_location,
      qualifications,
      hire_date,
      status,
      photo_url,
      designation,
      department,
      employment_type,
      form_class_id,
      assigned_classes = [],
      assigned_subjects = [],
    } = req.body;

    const teacher = await trx('teachers').where('id', teacherId).first();
    if (!teacher) {
      throw new AppError('Teacher not found', 404, 'NOT_FOUND');
    }

    // Update user record
    const userUpdate: any = {};
    if (first_name) userUpdate.first_name = first_name.trim();
    if (last_name) userUpdate.last_name = last_name.trim();
    if (status) userUpdate.status = status;
    if (photo_url !== undefined) userUpdate.photo_url = photo_url || null;
    userUpdate.updated_at = new Date();

    await trx('users').where('id', teacher.user_id).update(userUpdate);

    // Update teacher record
    const teacherUpdate: any = {
      updated_at: new Date(),
    };
    if (phone !== undefined) teacherUpdate.phone = phone || null;
    if (specialization !== undefined) teacherUpdate.specialization = specialization || null;
    if (experience_years !== undefined) teacherUpdate.experience_years = experience_years ? parseInt(experience_years) : 0;
    if (office_location !== undefined) teacherUpdate.office_location = office_location || null;
    if (qualifications !== undefined) teacherUpdate.qualifications = qualifications || null;
    if (hire_date !== undefined) teacherUpdate.hire_date = hire_date || null;
    if (status) teacherUpdate.status = status;
    if (designation !== undefined) teacherUpdate.designation = designation || 'subject_teacher';
    if (department !== undefined) teacherUpdate.department = department || 'none';
    if (employment_type !== undefined) teacherUpdate.employment_type = employment_type || 'full_time';

    await trx('teachers').where('id', teacherId).update(teacherUpdate);

    // Update Form Class if provided
    if (form_class_id !== undefined) {
      // Clear old Form Class associations for this teacher
      await trx('classes').where('class_teacher_id', teacherId).update({ class_teacher_id: null });
      
      // Associate new Form Class
      if (form_class_id) {
        await trx('classes').where('id', form_class_id).update({ class_teacher_id: teacherId });
      }
    }

    // Replace assignments if provided
    if (req.body.assigned_classes !== undefined || req.body.assigned_subjects !== undefined) {
      // Clear existing active assignments
      await trx('teacher_assignments').where('teacher_id', teacherId).del();

      if (assigned_classes.length > 0 && assigned_subjects.length > 0) {
        const start_date = new Date().toISOString().split('T')[0];
        const assignments = [];
        for (const classId of assigned_classes) {
          for (const subjectId of assigned_subjects) {
            assignments.push({
              teacher_id: teacherId,
              class_id: classId,
              subject_id: subjectId,
              start_date,
              created_at: new Date(),
              updated_at: new Date(),
            });
          }
        }
        if (assignments.length > 0) {
          await trx('teacher_assignments').insert(assignments);
        }
      }
    }

    await trx.commit();

    // Fetch updated teacher
    const updated = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .select(
        'teachers.id',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.photo_url',
        'users.status as user_status',
        'teachers.teacher_id',
        'teachers.phone',
        'teachers.specialization',
        'teachers.experience_years',
        'teachers.office_location',
        'teachers.qualifications',
        'teachers.hire_date',
        'teachers.designation',
        'teachers.department',
        'teachers.employment_type',
        'teachers.updated_at',
        db.raw('(SELECT name FROM classes WHERE class_teacher_id = teachers.id LIMIT 1) as form_class_name'),
        db.raw('(SELECT id FROM classes WHERE class_teacher_id = teachers.id LIMIT 1) as form_class_id')
      )
      .where('teachers.id', teacherId)
      .first();

    res.json({
      message: 'Teacher profile updated successfully',
      user: {
        ...updated,
        status: updated.user_status,
      },
    });

    logger.info(`Teacher profile updated: (Staff ID: ${teacher.teacher_id})`);
  } catch (error) {
    await trx.rollback();
    next(error);
  }
});

/**
 * DELETE /api/v1/teachers/:id
 * Deactivate teacher user (soft delete)
 */
router.delete('/:id', authenticate, attachUserContext, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  const trx = await db.transaction();
  try {
    const teacherId = req.params.id;

    const teacher = await trx('teachers').where('id', teacherId).first();
    if (!teacher) {
      throw new AppError('Teacher not found', 404, 'NOT_FOUND');
    }

    await trx('users').where('id', teacher.user_id).update({
      status: 'inactive',
      updated_at: new Date(),
    });

    await trx('teachers').where('id', teacherId).update({
      status: 'inactive',
      updated_at: new Date(),
    });

    // End assignments
    await trx('teacher_assignments')
      .where('teacher_id', teacherId)
      .update({
        end_date: new Date().toISOString().split('T')[0],
        updated_at: new Date(),
      });

    await trx.commit();

    res.json({
      message: 'Teacher deactivated successfully',
    });

    logger.info(`Teacher account deactivated: (Staff ID: ${teacher.teacher_id})`);
  } catch (error) {
    await trx.rollback();
    next(error);
  }
});

export default router;
