import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { checkSubscriptionLimit } from '@middleware/subscriptionGuard';
import { UserRole } from '../types/auth';
import { PasswordService } from '@services/passwordService';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { generateNextId } from '@utils/idGenerator';
import { sendExport } from '@utils/exportResponse';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

/**
 * GET /api/v1/teachers/export?format=csv|excel|pdf
 * Download the tenant's teachers. Principal/super_admin only; tenant-scoped.
 * Declared before /:id so the literal path isn't captured.
 */
router.get('/export', authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');

    const format = (req.query.format as string) || 'csv';
    const isPdf = format.toLowerCase() === 'pdf';

    const rows = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('users.tenant_id', tenantId)
      .select(
        'teachers.teacher_id',
        'users.first_name',
        'users.last_name',
        'users.email',
        'teachers.phone',
        'teachers.specialization',
        'teachers.designation',
        'teachers.department',
        'teachers.employment_type',
        'teachers.hire_date',
        'users.status as status',
        db.raw('(SELECT name FROM classes WHERE class_teacher_id = teachers.id LIMIT 1) as form_class_name'),
      )
      .orderBy('teachers.created_at', 'desc')
      .limit(10000);

    const formatted = rows.map((r: any) => ({
      ...r,
      full_name: [r.first_name, r.last_name].filter(Boolean).join(' '),
      hire_date: r.hire_date ? new Date(r.hire_date).toLocaleDateString() : '',
    }));

    // The PDF has limited width, so use a leaner column set (single Name, no
    // email) to keep cells on one line — no wrapping. CSV/Excel keep the full
    // detail since they have unlimited width.
    const columns = isPdf
      ? {
          'Staff ID': 'teacher_id',
          Name: 'full_name',
          Phone: 'phone',
          Specialization: 'specialization',
          Designation: 'designation',
          Department: 'department',
          'Form Class': 'form_class_name',
          Status: 'status',
        }
      : {
          'Staff ID': 'teacher_id',
          Name: 'full_name',
          Email: 'email',
          Phone: 'phone',
          Specialization: 'specialization',
          Designation: 'designation',
          Department: 'department',
          'Employment Type': 'employment_type',
          'Form Class': 'form_class_name',
          Hired: 'hire_date',
          Status: 'status',
        };

    await sendExport(res, {
      format,
      tenantId,
      rows: formatted,
      columns,
      filename: 'teachers_export',
      title: 'Teachers Export',
      sheetName: 'Teachers',
    });
  } catch (error) {
    next(error);
  }
});

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
    const tenantId = (req as any).user.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    let query = db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('users.tenant_id', tenantId)
      .select(
        'teachers.id',
        'teachers.teacher_id',
        'users.id as user_id',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.photo_url',
        'users.status as user_status',
        // NOTE: temp_password is intentionally NOT selected in the bulk list —
        // returning every teacher's plaintext credential is a security risk.
        // It's exposed only on the single GET /:id detail view (principal
        // handing out one teacher's credentials).
        'users.last_login',
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
          .orWhere('teachers.specialization', 'ilike', term)
          // Full-name search so typing the whole name finds the teacher.
          .orWhereRaw("CONCAT_WS(' ', users.first_name, users.last_name) ILIKE ?", [term])
          .orWhereRaw("CONCAT_WS(' ', users.last_name, users.first_name) ILIKE ?", [term]);
      });
    }

    const totalResult = await query.clone().clearSelect().clearOrder().count('teachers.id as count').first();
    const total = Number(totalResult?.count ?? 0);
    
    const teachersList = await query
      .limit(limit)
      .offset(offset)
      // Ordered by staff ID (001, 002, 003 …); staff without an ID sort last.
      .orderByRaw('teachers.teacher_id ASC NULLS LAST')
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
    const tenantId = (req as any).user.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const teacher = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('users.tenant_id', tenantId)
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
        'users.last_login',
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
      .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
      .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
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
      .where(function () {
        this.where('academic_sessions.tenant_id', tenantId)
          .orWhere(function () {
            this.whereNull('classes.academic_session_id')
              .where('class_creator.tenant_id', tenantId);
          });
      })
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
router.post('/', authenticate, attachUserContext, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), checkSubscriptionLimit('staff'), async (req: Request, res: Response, next: NextFunction) => {
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

    // Validate status against a server-side whitelist.
    const VALID_STAFF_STATUSES = ['active', 'inactive', 'suspended', 'dismissed'];
    if (status !== undefined && status !== null && !VALID_STAFF_STATUSES.includes(String(status))) {
      throw new AppError(`Status must be one of: ${VALID_STAFF_STATUSES.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    const tenantId = (req as any).user.tenant_id;

    // Email uniqueness is scoped to THIS tenant (the users table is unique on
    // (tenant_id, email)), so the same email can exist across different schools.
    const existingUser = await trx('users')
      .where('tenant_id', tenantId)
      .whereRaw('LOWER(email) = ?', [String(email).toLowerCase()])
      .first();
    if (existingUser) {
      throw new AppError('Email is already registered in this school', 409, 'CONFLICT');
    }

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

    // Generate unique teacher ID according to tenant settings
    const teacherIdStr = await generateNextId(db, tenantId, 'teacher');

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
    const tenantId = (req as any).user.tenant_id;
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

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

    // Validate the status transition against a server-side whitelist so a bad
    // client value can never be persisted.
    const VALID_STAFF_STATUSES = ['active', 'inactive', 'suspended', 'dismissed'];
    if (status !== undefined && status !== null && !VALID_STAFF_STATUSES.includes(String(status))) {
      throw new AppError(`Status must be one of: ${VALID_STAFF_STATUSES.join(', ')}`, 400, 'VALIDATION_ERROR');
    }

    const teacher = await trx('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.id', teacherId)
      .where('users.tenant_id', tenantId)
      .select('teachers.*')
      .first();
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
    const tenantId = (req as any).user.tenant_id;
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const teacher = await trx('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.id', teacherId)
      .where('users.tenant_id', tenantId)
      .select('teachers.*')
      .first();
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
