import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { checkSubscriptionLimit } from '@middleware/subscriptionGuard';
import { StudentService } from '@services/studentService';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { PasswordService } from '@services/passwordService';
import { generateNextId } from '@utils/idGenerator';
import { linkGuardianForStudent } from '@utils/guardianLinking';
import { provisionStudentAccounts } from '@utils/studentAccounts';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);
const studentService = new StudentService(db);

/**
 * POST /api/v1/students
 * Create a new student
 * @requires admin, principal, teacher
 */
router.post('/', authenticate, attachUserContext, authorize('principal', 'super_admin', 'admissions_officer'), checkSubscriptionLimit('students'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { first_name, last_name, date_of_birth, gender, email, phone, address, city, state, postal_code, country, enrollment_date, status, photo_url, religion, nationality, place_of_birth, guardian_name, guardian_email, guardian_phone, guardian_relationship, guardian_occupation, emergency_contact, previous_school, medical_conditions, class_id } = req.body;
    const createdBy = req.auth?.userId ?? null;
    const tenantId = (req as any).user.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    // Validate required fields
    if (!first_name || !last_name || !enrollment_date) {
      throw new AppError('Missing required fields: first_name, last_name, enrollment_date', 400, 'VALIDATION_ERROR');
    }

    // Validate date_of_birth format if provided
    if (date_of_birth) {
      const dob = new Date(date_of_birth);
      if (isNaN(dob.getTime())) {
        throw new AppError('Invalid date_of_birth format', 400, 'VALIDATION_ERROR');
      }

      // Calculate age
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()) ? age - 1 : age;

      if (actualAge < 3 || actualAge > 30) {
        throw new AppError('Student age must be between 3 and 30 years', 400, 'VALIDATION_ERROR');
      }
    }

    // Validate email uniqueness if provided within this tenant
    if (email) {
      const existingStudent = await db('students').where({ email, tenant_id: tenantId }).first();
      if (existingStudent) {
        throw new AppError('Email already registered as a student', 409, 'CONFLICT');
      }
    }

    // Generate unique student ID according to tenant settings
    const studentId = await generateNextId(db, tenantId, 'student');

    // Create student
    const [inserted] = await db('students').insert({
      tenant_id: tenantId,
      user_id: null, // Can be linked later to user account
      student_id: studentId,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email ? email.toLowerCase() : null,
      date_of_birth: date_of_birth || null,
      gender: gender || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      state: state || null,
      postal_code: postal_code || null,
      country: country || null,
      enrollment_date: enrollment_date,
      photo_url: photo_url || null,
      religion: religion || null,
      nationality: nationality || null,
      place_of_birth: place_of_birth || null,
      guardian_name: guardian_name || null,
      guardian_phone: guardian_phone || null,
      guardian_relationship: guardian_relationship || null,
      guardian_occupation: guardian_occupation || null,
      emergency_contact: emergency_contact || null,
      previous_school: previous_school || null,
      medical_conditions: medical_conditions || null,
      status: status || 'active',
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    // If class_id provided, enroll student in that class
    if (class_id && inserted.id) {
      await db('enrollments').insert({
        student_id: inserted.id,
        class_id: class_id,
        enrollment_date: enrollment_date || new Date().toISOString().split('T')[0],
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }).catch(() => { /* ignore if enrollment fails */ });
    }

    // ── Smart parent/guardian linking ─────────────────────────────────────────
    // If guardian details are provided, create a guardians row for this new
    // student and — if a parent already exists in this tenant (matched by email
    // or phone) — link it to that same parent user so the parent portal shows
    // all their children. This lets one parent be reused across siblings.
    let linkedParent: any = null;
    if (inserted.id) {
      linkedParent = await linkGuardianForStudent(
        db,
        tenantId,
        inserted.id,
        last_name,
        { guardian_name, guardian_email, guardian_phone, guardian_relationship, guardian_occupation },
        createdBy,
      );

      // Provision login accounts up-front so credentials work immediately.
      await provisionStudentAccounts(db, tenantId, {
        student_id: inserted.id,
        reg_id: inserted.student_id,
        email: inserted.email,
        first_name: inserted.first_name,
        last_name: inserted.last_name,
        guardian_name,
        guardian_email,
        guardian_phone,
      });
    }

    res.status(201).json({
      message: linkedParent
        ? `Student created and linked to existing parent ${linkedParent.name}`
        : 'Student created successfully',
      student: inserted,
      linked_parent: linkedParent,
    });

    logger.info(`Student created: ${inserted.student_id} (${first_name} ${last_name})`);
  } catch (error) {
    next(error);
  }
});

async function syncEnrolledApplicationsToStudents(dbInstance: any, tenantId: string) {
  try {
    if (!tenantId) return;

    // Fetch admission applications SPECIFIC TO THIS TENANT
    const applications = await dbInstance('admission_applications')
      .where('tenant_id', tenantId)
      .andWhere(function(this: any) {
        this.whereRaw('LOWER(status) NOT IN (?, ?)', ['rejected', 'waitlist']);
      });

    for (const app of applications) {
      const firstName = (app.child_first_name || app.first_name || '').trim();
      const lastName = (app.child_last_name || app.last_name || '').trim();
      if (!firstName || !lastName) continue;

      const existing = await dbInstance('students')
        .where('tenant_id', tenantId)
        .andWhere(function (this: any) {
          this.where(dbInstance.raw('LOWER(first_name) = ?', [firstName.toLowerCase()]))
            .andWhere(dbInstance.raw('LOWER(last_name) = ?', [lastName.toLowerCase()]));
        })
        .first();

      if (!existing) {
        const studentId = await generateNextId(dbInstance, tenantId, 'student');
        const dob = app.child_dob || app.date_of_birth || null;
        const gender = app.child_gender || app.gender || null;
        const email = app.guardian_email || app.email || null;
        const phone = app.guardian_phone || app.phone_number || app.parent_phone || null;
        const address = app.child_address || app.address || null;
        const classId = app.class_applying_for || app.grade_id || null;

        const [newStudent] = await dbInstance('students').insert({
          tenant_id: tenantId,
          user_id: null,
          student_id: studentId,
          first_name: firstName,
          last_name: lastName,
          email: email ? email.toLowerCase() : null,
          date_of_birth: dob,
          gender: gender,
          phone: phone,
          address: address,
          country: app.child_nationality || 'Sierra Leone',
          enrollment_date: app.created_at ? new Date(app.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          photo_url: app.child_photo_url || null,
          religion: app.child_religion || null,
          nationality: app.child_nationality || null,
          place_of_birth: app.child_place_of_birth || null,
          guardian_name: [app.guardian_first_name || app.parent_name, app.guardian_last_name].filter(Boolean).join(' ') || app.parent_name || null,
          guardian_phone: app.guardian_phone || app.parent_phone || null,
          guardian_relationship: app.guardian_relationship || null,
          guardian_occupation: app.guardian_occupation || null,
          emergency_contact: app.emergency_contact_phone || null,
          previous_school: app.previous_school || null,
          medical_conditions: [app.medication_details, app.allergy_details, app.chronic_illness_details].filter(Boolean).join('; ') || null,
          status: 'active',
          created_at: app.created_at || new Date(),
          updated_at: new Date(),
        }).returning('*');

        if (classId && newStudent?.id) {
          await dbInstance('enrollments').insert({
            student_id: newStudent.id,
            class_id: classId,
            enrollment_date: new Date().toISOString().split('T')[0],
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          }).catch(() => {});
        }

        // Smart parent/guardian linking — reuse an existing parent (sibling) if one matches.
        if (newStudent?.id) {
          await linkGuardianForStudent(
            dbInstance,
            tenantId,
            newStudent.id,
            lastName,
            {
              guardian_name: [app.guardian_first_name || app.parent_name, app.guardian_last_name].filter(Boolean).join(' ') || app.parent_name || null,
              guardian_email: app.guardian_email || app.email || null,
              guardian_phone: app.guardian_phone || app.parent_phone || null,
              guardian_relationship: app.guardian_relationship || null,
              guardian_occupation: app.guardian_occupation || null,
            },
            null,
          );
        }
        logger.info(`Auto-synced enrolled admission application ${app.id} to student ${studentId} for tenant ${tenantId}`);
      }
    }
  } catch (err) {
    logger.error(`Error in syncEnrolledApplicationsToStudents: ${err}`);
  }
}

/**
 * GET /api/v1/students/parent/children
 * Get all children linked to the currently logged in parent user (multi-child portal support)
 */
router.get('/parent/children', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    const tenantId = user?.tenant_id;

    if (!user) {
      throw new AppError('Authentication required', 401, 'NOT_AUTHENTICATED');
    }

    const userEmail = (user.email || '').toLowerCase().trim();
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.toLowerCase().trim();

    // Query all students linked to this parent by email, guardian_name, or guardians table
    let childrenQuery = db('students')
      .select(
        'students.*',
        'classes.name as class_name',
        'classes.level as class_level'
      )
      .leftJoin('enrollments', function () {
        this.on('students.id', '=', 'enrollments.student_id')
          .andOnIn('enrollments.status', ['enrolled', 'active']);
      })
      .leftJoin('classes', 'enrollments.class_id', 'classes.id');

    if (tenantId) {
      childrenQuery = childrenQuery.where('students.tenant_id', tenantId);
    }

    const children = await childrenQuery
      .andWhere(function (this: any) {
        if (userEmail) {
          this.whereRaw('LOWER(students.email) = ?', [userEmail])
            .orWhereRaw('LOWER(students.guardian_name) LIKE ?', [`%${userName}%`]);
        } else {
          this.whereRaw('LOWER(students.guardian_name) LIKE ?', [`%${userName}%`]);
        }
      })
      .orderBy('students.created_at', 'desc');

    res.json({
      success: true,
      count: children.length,
      data: children,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students
 * List all students with pagination and filtering
 * @requires admin, principal, teacher
 */
router.get('/', authenticate, authorize('admin', 'principal', 'super_admin', 'teacher', 'admissions_officer'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const userRole = req.user?.role;
    const tenantId = req.user?.tenant_id;
    const requestedTenantId = req.query.tenant_id as string;

    if (userRole !== 'super_admin' && !tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const effectiveTenantId = requestedTenantId || tenantId || '';

    // Auto-sync any approved/enrolled admissions applications to students table
    if (effectiveTenantId) {
      await syncEnrolledApplicationsToStudents(db, effectiveTenantId);
    }

    let query = db('students')
      .select(
        'students.*',
        'classes.name as class_name',
        'classes.level as class_level'
      )
      .leftJoin('enrollments', function () {
        this.on('students.id', '=', 'enrollments.student_id')
          .andOnIn('enrollments.status', ['enrolled', 'active']);
      })
      .leftJoin('classes', 'enrollments.class_id', 'classes.id');

    if (userRole !== 'super_admin') {
      query = query.where('students.tenant_id', tenantId);
    } else if (requestedTenantId && requestedTenantId !== 'all') {
      query = query.where('students.tenant_id', requestedTenantId);
    }

    // Teacher scoping: teachers only see students enrolled in classes they
    // teach (teacher_assignments) or lead (class_teacher_id). Resolve the
    // eligible student ids once and constrain both data + count queries.
    let teacherStudentIds: string[] | null = null;
    if (userRole === 'teacher') {
      const teacher = await db('teachers')
        .join('users as u', 'teachers.user_id', 'u.id')
        .where('teachers.user_id', req.user!.id)
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
      const enrolled = await db('enrollments')
        .whereIn('class_id', classIds)
        .whereIn('status', ['enrolled', 'active'])
        .distinct('student_id');
      teacherStudentIds = enrolled.map((r: any) => r.student_id);
      if (teacherStudentIds.length === 0) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      query = query.whereIn('students.id', teacherStudentIds);
    }

    // Apply filters
    if (status) {
      if (status === 'active') {
        query = query.whereIn('students.status', ['active', 'enrolled']);
      } else {
        query = query.where('students.status', status);
      }
    }

    if (search) {
      const term = `%${search.trim()}%`;
      query = query.where(function () {
        this.where('students.first_name', 'ilike', term)
          .orWhere('students.last_name', 'ilike', term)
          .orWhere('students.student_id', 'ilike', term)
          .orWhere('students.email', 'ilike', term);
      });
    }

    // Separate count query
    let countQuery = db('students');
    if (userRole !== 'super_admin') {
      countQuery = countQuery.where('students.tenant_id', tenantId);
    } else if (requestedTenantId && requestedTenantId !== 'all') {
      countQuery = countQuery.where('students.tenant_id', requestedTenantId);
    }
    if (teacherStudentIds) {
      countQuery = countQuery.whereIn('students.id', teacherStudentIds);
    }
    countQuery = countQuery.count('* as totalCount');
    if (status) {
      if (status === 'active') {
        countQuery = countQuery.whereIn('students.status', ['active', 'enrolled']);
      } else {
        countQuery = countQuery.where('students.status', status);
      }
    }
    if (search) {
      const term = `%${search.trim()}%`;
      countQuery = countQuery.where(function () {
        this.where('students.first_name', 'ilike', term)
          .orWhere('students.last_name', 'ilike', term)
          .orWhere('students.student_id', 'ilike', term)
          .orWhere('students.email', 'ilike', term);
      });
    }

    const totalResult: any = await countQuery.first();
    const totalRaw = totalResult?.totalCount ?? totalResult?.count;

    // Get paginated results
    const students = await query
      .limit(limit)
      .offset(offset)
      .orderBy('created_at', 'desc');

    const total = Math.max(Number(totalRaw ?? 0), students.length);

    res.json({
      data: students,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit) || 1,
      },
    });

    logger.info(`Listed students: page ${page}, limit ${limit}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId
 * Get student by ID
 * @requires authenticated user (authorized if not their own record)
 */
router.get('/:studentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = req.auth;
    const userRole = currentUser?.role;
    const tenantId = req.user?.tenant_id;

    if (userRole !== 'super_admin' && !tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!currentUser) {
      throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    }

    let studentQuery = db('students')
      .select(
        'students.*',
        'classes.name as class_name',
        'classes.level as class_level'
      )
      .leftJoin('enrollments', function () {
        this.on('students.id', '=', 'enrollments.student_id')
          .andOnIn('enrollments.status', ['enrolled', 'active']);
      })
      .leftJoin('classes', 'enrollments.class_id', 'classes.id');

    if (userRole !== 'super_admin') {
      studentQuery = studentQuery.where('students.tenant_id', tenantId);
    }

    const student = await studentQuery
      .andWhere(function() {
        this.where('students.student_id', studentId)
          .orWhere('students.id', studentId);
      })
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check authorization: students can view their own record, others need principal/teacher
    if (currentUser.role === 'student' && student.user_id !== currentUser?.userId && currentUser.role !== 'principal') {
      throw new AppError('Insufficient permissions to view this student record', 403, 'AUTHORIZATION_ERROR');
    }

    // Ensure student user account exists
    let studentUser = null;
    if (student.user_id) {
      studentUser = await db('users').where('id', student.user_id).first();
    }
    if (!studentUser) {
      const studentEmail = (student.email || `${student.student_id.toLowerCase()}@student.school.com`).toLowerCase();
      studentUser = await db('users').where('email', studentEmail).first();
      if (!studentUser) {
        const passHash = await PasswordService.hashPassword('Student123!');
        const [inserted] = await db('users').insert({
          tenant_id: tenantId,
          email: studentEmail,
          first_name: student.first_name || 'Student',
          last_name: student.last_name || student.student_id,
          password_hash: passHash,
          role: 'student',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }).returning('*');
        studentUser = inserted;
      }
      if (studentUser && student.id) {
        await db('students').where('id', student.id).update({ user_id: studentUser.id });
      }
    }

    // If the student account is still a system default (never logged in) but is
    // active, ensure its password matches the advertised default and it can log
    // in. This heals older accounts that had an unknown/legacy password.
    if (studentUser && !studentUser.last_login) {
      const patch: any = { updated_at: new Date() };
      if (studentUser.status !== 'active') patch.status = 'active';
      patch.password_hash = await PasswordService.hashPassword('Student123!');
      await db('users').where('id', studentUser.id).update(patch).catch(() => {});
    }

    // ── Ensure a parent user account exists (so displayed credentials work) ──
    // Prefer a real guardian email (from the guardians table or student record).
    // Falls back to a deterministic address so a demo/default account can exist.
    const safeStudentId = (student.student_id || 'student').toLowerCase();

    // Try to find a linked guardian with an email first.
    let guardianRecord: any = null;
    try {
      if (await db.schema.hasTable('guardians')) {
        guardianRecord = await db('guardians')
          .where('student_id', student.id)
          .orderBy('is_primary_guardian', 'desc')
          .orderBy('created_at', 'desc')
          .first();
      }
    } catch (_) { /* ignore */ }

    const parentEmail = (
      guardianRecord?.email ||
      `${safeStudentId}@parent.school.com`
    ).toLowerCase().trim();

    let parentUser = await db('users').where('email', parentEmail).first();
    let parentDefaultPassword = 'Parent123!';

    if (!parentUser) {
      // Provision a parent account so the advertised credentials are valid.
      const parentPassHash = await PasswordService.hashPassword(parentDefaultPassword);
      const [gFirst, ...gRest] = (student.guardian_name || guardianRecord ? `${guardianRecord?.first_name ?? ''} ${guardianRecord?.last_name ?? ''}`.trim() || student.guardian_name || 'Parent' : 'Parent').split(' ');
      try {
        const [insertedParent] = await db('users').insert({
          tenant_id: tenantId,
          email: parentEmail,
          first_name: guardianRecord?.first_name || gFirst || 'Parent',
          last_name: guardianRecord?.last_name || gRest.join(' ') || student.last_name || safeStudentId,
          password_hash: parentPassHash,
          role: 'parent',
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }).returning('*');
        parentUser = insertedParent;

        // Link the guardian record to this parent user for portal aggregation.
        if (guardianRecord && !guardianRecord.user_id) {
          await db('guardians').where('id', guardianRecord.id).update({ user_id: parentUser.id, updated_at: new Date() }).catch(() => {});
        }
      } catch (e) {
        // If insert races or fails, re-fetch.
        parentUser = await db('users').where('email', parentEmail).first();
      }
    } else if (!parentUser.last_login) {
      // Existing parent account that has never logged in — heal it to the
      // advertised default so the shown credentials work.
      const patch: any = { updated_at: new Date() };
      if (parentUser.status !== 'active') patch.status = 'active';
      patch.password_hash = await PasswordService.hashPassword(parentDefaultPassword);
      await db('users').where('id', parentUser.id).update(patch).catch(() => {});
    } else {
      parentDefaultPassword = '(Existing account — use its own password)';
    }

    student.demo_login = {
      student_email: studentUser?.email || `${safeStudentId}@student.school.com`,
      student_password: 'Student123!',
      parent_email: parentUser?.email || parentEmail,
      parent_password: parentUser && parentDefaultPassword.startsWith('(') ? parentDefaultPassword : 'Parent123!',
      has_parent_account: !!parentUser,
    };

    // Fetch all linked guardians for multi-guardian tracking
    // Gracefully handle cases where the guardians table doesn't exist yet
    let guardiansList: any[] = [];
    try {
      const tableExists = await db.schema.hasTable('guardians');
      if (tableExists) {
        guardiansList = await db('guardians')
          .where('student_id', student.id)
          .orderBy('is_primary_guardian', 'desc')
          .orderBy('created_at', 'desc');
      }
    } catch (_) {
      // guardians table not yet migrated — return empty list
    }
    student.guardians_list = guardiansList;

    res.json(student);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/students/:studentId
 * Update student information
 * @requires admin, principal, teacher, or student (self)
 */
router.put('/:studentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = req.auth;
    const tenantId = req.user?.tenant_id;
    const { first_name, last_name, gender, email, phone, address, city, state, postal_code, country, status, date_of_birth, enrollment_date, photo_url, religion, nationality, place_of_birth, guardian_name, guardian_phone, guardian_relationship, guardian_occupation, emergency_contact, previous_school, medical_conditions } = req.body;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!currentUser) {
      throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    }

    // Get student
    const student = await db('students')
      .select('*')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('student_id', studentId)
          .orWhere('id', studentId);
      })
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check authorization.
    //  - Owner (the student) may edit their own record.
    //  - Managers (principal / super_admin / admissions_officer) may edit any
    //    student in the tenant.
    //  - Teachers may edit ONLY students enrolled in a class they are assigned to
    //    (class-scoped, mirroring the directory list scoping).
    const isOwner = student.user_id === currentUser?.userId;
    const MANAGER_ROLES = ['principal', 'super_admin', 'admissions_officer'];
    const isManager = MANAGER_ROLES.includes(currentUser.role);

    let isScopedTeacher = false;
    if (!isManager && currentUser.role === 'teacher') {
      // Resolve the teacher record for this user (classes/assignments reference
      // teachers.id, not users.id).
      const teacher = await db('teachers').where('user_id', currentUser.userId).first().catch(() => null);
      if (teacher?.id) {
        const assigned = await db('enrollments')
          .join('classes', 'enrollments.class_id', 'classes.id')
          .where('enrollments.student_id', student.id)
          .whereIn('enrollments.status', ['enrolled', 'active'])
          .andWhere(function (this: any) {
            this.where('classes.class_teacher_id', teacher.id)
              .orWhereExists(function (this: any) {
                this.select(db.raw('1'))
                  .from('teacher_assignments')
                  .whereRaw('teacher_assignments.class_id = classes.id')
                  .andWhere('teacher_assignments.teacher_id', teacher.id);
              });
          })
          .first()
          .catch(() => null);
        isScopedTeacher = !!assigned;
      }
    }

    const isAuthorized = isManager || isScopedTeacher;

    if (!isOwner && !isAuthorized) {
      throw new AppError('Insufficient permissions to update this student', 403, 'AUTHORIZATION_ERROR');
    }

    const updateData: any = {};

    if (first_name) updateData.first_name = first_name.trim();
    if (last_name) updateData.last_name = last_name.trim();
    if (gender !== undefined) updateData.gender = gender || null;
    if (email !== undefined) updateData.email = email ? email.toLowerCase() : null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (address !== undefined) updateData.address = address || null;
    if (city !== undefined) updateData.city = city || null;
    if (state !== undefined) updateData.state = state || null;
    if (postal_code !== undefined) updateData.postal_code = postal_code || null;
    if (country !== undefined) updateData.country = country || null;
    if (status && isAuthorized) updateData.status = status;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth || null;
    if (enrollment_date !== undefined) updateData.enrollment_date = enrollment_date || null;
    if (photo_url !== undefined) updateData.photo_url = photo_url || null;
    if (religion !== undefined) updateData.religion = religion || null;
    if (nationality !== undefined) updateData.nationality = nationality || null;
    if (place_of_birth !== undefined) updateData.place_of_birth = place_of_birth || null;
    if (guardian_name !== undefined) updateData.guardian_name = guardian_name || null;
    if (guardian_phone !== undefined) updateData.guardian_phone = guardian_phone || null;
    if (guardian_relationship !== undefined) updateData.guardian_relationship = guardian_relationship || null;
    if (guardian_occupation !== undefined) updateData.guardian_occupation = guardian_occupation || null;
    if (emergency_contact !== undefined) updateData.emergency_contact = emergency_contact || null;
    if (previous_school !== undefined) updateData.previous_school = previous_school || null;
    if (medical_conditions !== undefined) updateData.medical_conditions = medical_conditions || null;

    updateData.updated_at = new Date();

    await db('students').where('id', student.id).andWhere('tenant_id', tenantId).update(updateData);

    const updatedStudent = await db('students')
      .select('id', 'student_id', 'first_name', 'last_name', 'email', 'date_of_birth', 'gender', 'phone', 'status', 'created_at', 'updated_at')
      .where('id', student.id)
      .andWhere('tenant_id', tenantId)
      .first();

    res.json({
      message: 'Student updated successfully',
      student: updatedStudent,
    });

    logger.info(`Student updated: ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/students/:studentId
 * Deactivate student (soft delete)
 * @requires admin, principal
 */
router.delete('/:studentId', authenticate, authorize('principal', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = req.auth;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!currentUser) {
      throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    }

    const student = await db('students')
      .select('*')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('student_id', studentId)
          .orWhere('id', studentId);
      })
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Soft delete
    await db('students')
      .where('id', student.id)
      .andWhere('tenant_id', tenantId)
      .update({
        status: 'inactive',
        updated_at: new Date(),
      });

    res.json({
      message: 'Student deactivated successfully',
    });

    logger.info(`Student deactivated: ${student.student_id} by ${currentUser.email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/students/:studentId/permanent
 * Permanently delete a student record
 */
router.delete('/:studentId/permanent', authenticate, authorize('principal', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const student = await db('students')
      .select('*')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('student_id', studentId)
          .orWhere('id', studentId);
      })
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check for linked records
    const enrollments = await db('enrollments').where('student_id', student.id).count('* as count').first();
    if (Number(enrollments?.count ?? 0) > 0) {
      throw new AppError('Cannot permanently delete a student with enrollment history. Use deactivate instead.', 400, 'HAS_ENROLLMENTS');
    }

    await db('students')
      .where('id', student.id)
      .andWhere('tenant_id', tenantId)
      .del();

    res.json({ message: 'Student permanently deleted' });
    logger.info(`Student permanently deleted: ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/students/:studentId/reactivate
 * Reactivate a deactivated student
 * @requires admin, principal
 */
router.post('/:studentId/reactivate', authenticate, authorize('principal', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = req.auth;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    if (!currentUser) {
      throw new AppError('Not authenticated', 401, 'NOT_AUTHENTICATED');
    }

    const student = await db('students')
      .select('*')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('student_id', studentId)
          .orWhere('id', studentId);
      })
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    if (student.status !== 'inactive') {
      throw new AppError('Only inactive students can be reactivated', 400, 'VALIDATION_ERROR');
    }

    await db('students')
      .where('id', student.id)
      .andWhere('tenant_id', tenantId)
      .update({
        status: 'active',
        updated_at: new Date(),
      });

    res.json({
      message: 'Student reactivated successfully',
    });

    logger.info(`Student reactivated: ${student.student_id} by ${currentUser.email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId/enrollments
 * Get all enrollments for a student
 */
router.get('/:studentId/enrollments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const student = await db('students')
      .select('*')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('student_id', studentId)
          .orWhere('id', studentId);
      })
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    const enrollments = await db('enrollments')
      .select('id', 'enrollment_id', 'class_id', 'academic_session_id', 'enrollment_date', 'status', 'roll_number', 'created_at')
      .where('student_id', student.id)
      .orderBy('enrollment_date', 'desc');

    res.json({
      student_id: student.student_id,
      enrollments,
    });

    logger.info(`Retrieved enrollments for student: ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId/grades
 * Get all grades for a student
 */
router.get('/:studentId/grades', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const student = await db('students')
      .select('*')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('student_id', studentId)
          .orWhere('id', studentId);
      })
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    const grades = await db('grades')
      .select('id', 'subject_id', 'class_id', 'marks_obtained', 'total_marks', 'grade', 'status', 'created_at')
      .where('student_id', student.id)
      .orderBy('created_at', 'desc');

    res.json({
      student_id: student.student_id,
      grades,
    });

    logger.info(`Retrieved grades for student: ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId/attendance
 * Get attendance record for a student
 */
router.get('/:studentId/attendance', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const classId = req.query.classId as string;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const student = await db('students')
      .select('*')
      .where('tenant_id', tenantId)
      .andWhere(function() {
        this.where('student_id', studentId)
          .orWhere('id', studentId);
      })
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    let query = db('attendance')
      .select('id', 'class_id', 'date', 'status', 'remarks', 'created_at')
      .where('student_id', student.id);

    if (classId) {
      query = query.where('class_id', classId);
    }

    const attendance = await query.orderBy('date', 'desc');

    // Calculate attendance percentage
    const total = attendance.length;
    const present = attendance.filter((a: any) => a.status === 'present').length;
    const attendancePercentage = total > 0 ? Math.round((present / total) * 100) : 0;

    res.json({
      student_id: student.student_id,
      total_records: total,
      present,
      attendance_percentage: attendancePercentage,
      records: attendance,
    });

    logger.info(`Retrieved attendance for student: ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

export default router;
