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
import { parseDuties, sanitizeDuties } from '@utils/staffDuties';
import { assertPortalAllowed } from '@services/entitlementService';

const router = Router();

/**
 * Professional staff (teachers, accountants / bursars, admissions officers)
 * share ONE onboarding, profile and directory here. `staff_type` filters it:
 * teaching = role teacher (incl. teachers with extra duties); accountant /
 * admissions_officer = that job, full-time or as a teacher's duty.
 */
function applyStaffType(q: any, staffType: unknown) {
  const t = String(staffType || '');
  if (t === 'teaching') return q.where('users.role', 'teacher');
  if (t === 'accountant' || t === 'admissions_officer') {
    return q.where((w: any) => w.where('users.role', t)
      .orWhere((x: any) => x.where('users.role', 'teacher').whereRaw("COALESCE(users.staff_duties, '[]'::jsonb) \\? ?", [t])));
  }
  if (t === 'leadership') return q.where('users.role', 'principal');
  return q;
}

// A teacher's form class / assignments shown and edited here are the CURRENT
// year's. Past-year classes keep their form teacher + assignments as history
// (after a year change both old and new copies point at the same teacher).
// Use with classes aliased "c" and academic_sessions aliased "s".
const CURRENT_CLASS_SQL = '(s.is_active = true OR c.academic_session_id IS NULL)';

/** Ids of the tenant's current-year classes (active session + legacy no-session). */
async function currentYearClassIds(trx: any, tenantId: string): Promise<string[]> {
  const rows = await trx('classes as c')
    .leftJoin('academic_sessions as s', 'c.academic_session_id', 's.id')
    .leftJoin('users as cc', 'c.created_by', 'cc.id')
    .where((q: any) => q.where({ 's.tenant_id': tenantId, 's.is_active': true })
      .orWhere((q2: any) => q2.whereNull('c.academic_session_id').where('cc.tenant_id', tenantId)))
    .select('c.id');
  return rows.map((r: any) => r.id);
}
router.use(authenticate);
router.use(attachUserContext);

/**
 * Ensure every class id belongs to the given tenant. Classes are tenant-scoped
 * either directly (via their academic session) or through their creator, so we
 * check both paths. Throws a 400 if any id is foreign/unknown.
 */
async function assertClassesInTenant(dbx: any, tenantId: string, classIds: string[]): Promise<void> {
  const ids = Array.from(new Set((classIds || []).filter(Boolean)));
  if (ids.length === 0) return;
  const rows = await dbx('classes')
    .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
    .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
    .whereIn('classes.id', ids)
    .where(function (this: any) {
      this.where('academic_sessions.tenant_id', tenantId)
        .orWhere(function (this: any) {
          this.whereNull('classes.academic_session_id').where('class_creator.tenant_id', tenantId);
        });
    })
    .select('classes.id');
  if (rows.length !== ids.length) {
    throw new AppError('One or more selected classes do not belong to this school', 400, 'INVALID_CLASS');
  }
}

/**
 * Map a staff DESIGNATION (organisational title) → the SYSTEM ROLE that decides
 * which portal and permissions the user gets. Promoting someone migrates them
 * to the matching portal automatically.
 *
 * The system covers both primary (Head Teacher / Vice) and secondary
 * (Principal / Vice Principal) leadership — all of which are admin-level and
 * therefore map to 'principal'. Bursar → accountant portal; Administrator
 * (admissions) → admissions portal; teaching titles stay on the teacher portal.
 */
const DESIGNATION_TO_ROLE: Record<string, string> = {
  // Admin-level leadership (primary + secondary)
  head_teacher: 'principal',
  vice_head_teacher: 'principal',
  principal: 'principal',
  vice_principal: 'principal',
  // Finance
  bursar: 'accountant',
  // Admissions / general administration
  administrator: 'admissions_officer',
  // Teaching titles — remain on the teacher portal
  hod: 'teacher',
  senior_teacher: 'teacher',
  class_teacher: 'teacher',  // primary: class teacher / class master
  form_teacher: 'teacher',   // secondary: form teacher / form master
  subject_teacher: 'teacher',
};

/** The system roles this promotion flow is allowed to assign/rescind. It must
 *  never touch a platform super_admin. */
const PROMOTABLE_ROLES = new Set(['teacher', 'principal', 'accountant', 'admissions_officer']);

/**
 * Ensure every subject id belongs to the given tenant. Subjects are scoped to a
 * tenant through their creator (there is no direct subjects.tenant_id column),
 * so we join users on subjects.created_by.
 */
async function assertSubjectsInTenant(dbx: any, tenantId: string, subjectIds: string[]): Promise<void> {
  const ids = Array.from(new Set((subjectIds || []).filter(Boolean)));
  if (ids.length === 0) return;
  const count = await dbx('subjects')
    .join('users', 'subjects.created_by', 'users.id')
    .whereIn('subjects.id', ids)
    .where('users.tenant_id', tenantId)
    .countDistinct('subjects.id as c')
    .first();
  if (Number(count?.c ?? 0) !== ids.length) {
    throw new AppError('One or more selected subjects do not belong to this school', 400, 'INVALID_SUBJECT');
  }
}

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
        db.raw(`(SELECT c.name FROM classes c LEFT JOIN academic_sessions s ON s.id = c.academic_session_id WHERE c.class_teacher_id = teachers.id AND ${CURRENT_CLASS_SQL} LIMIT 1) as form_class_name`),
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
        // The system role (teacher / principal / accountant / admissions_officer).
        'users.role as user_role',
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
        // Extra duties (Bursar / Admissions) for a teacher who does both.
        'users.staff_duties',
        db.raw(`(SELECT c.name FROM classes c LEFT JOIN academic_sessions s ON s.id = c.academic_session_id WHERE c.class_teacher_id = teachers.id AND ${CURRENT_CLASS_SQL} LIMIT 1) as form_class_name`),
        db.raw(`(SELECT c.id FROM classes c LEFT JOIN academic_sessions s ON s.id = c.academic_session_id WHERE c.class_teacher_id = teachers.id AND ${CURRENT_CLASS_SQL} LIMIT 1) as form_class_id`)
      );

    if (status) {
      query = query.where('users.status', status as string);
    }
    // ?staff_type=teaching | accountant | admissions_officer | leadership
    query = applyStaffType(query, req.query.staff_type);

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

    // Tenant-wide status counts so the KPI cards reflect ALL teachers, not just
    // the current page. These honour the same search/specialization filters but
    // ignore the status filter (so each card always shows its own total).
    let statsQuery = db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('users.tenant_id', tenantId);
    statsQuery = applyStaffType(statsQuery, req.query.staff_type);
    if (specialization) statsQuery = statsQuery.where('teachers.specialization', specialization as string);
    if (search) {
      const term = `%${(search as string).trim()}%`;
      statsQuery = statsQuery.where(function () {
        this.where('users.first_name', 'ilike', term)
          .orWhere('users.last_name', 'ilike', term)
          .orWhere('users.email', 'ilike', term)
          .orWhere('teachers.teacher_id', 'ilike', term)
          .orWhere('teachers.specialization', 'ilike', term)
          .orWhereRaw("CONCAT_WS(' ', users.first_name, users.last_name) ILIKE ?", [term])
          .orWhereRaw("CONCAT_WS(' ', users.last_name, users.first_name) ILIKE ?", [term]);
      });
    }
    const statusRows = await statsQuery
      .select('users.status')
      .count('teachers.id as count')
      .groupBy('users.status');
    const stats = statusRows.reduce(
      (acc: any, r: any) => {
        const c = Number(r.count) || 0;
        acc.all += c;
        if (r.status === 'active') acc.active += c;
        else acc.inactive += c;
        return acc;
      },
      { all: 0, active: 0, inactive: 0 },
    );

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
      stats,
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
        'users.role as user_role',
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
        'users.staff_duties',
        db.raw(`(SELECT c.name FROM classes c LEFT JOIN academic_sessions s ON s.id = c.academic_session_id WHERE c.class_teacher_id = teachers.id AND ${CURRENT_CLASS_SQL} LIMIT 1) as form_class_name`),
        db.raw(`(SELECT c.id FROM classes c LEFT JOIN academic_sessions s ON s.id = c.academic_session_id WHERE c.class_teacher_id = teachers.id AND ${CURRENT_CLASS_SQL} LIMIT 1) as form_class_id`)
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
      })
      // Current-year classes only (the form edits this year's assignments).
      .where(function () {
        this.where('academic_sessions.is_active', true).orWhereNull('classes.academic_session_id');
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
      staff_duties,
      primary_role,
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

    // The system role follows the designation so a staff member created as a
    // bursar/administrator/head lands in the correct portal from day one.
    // Professional staff share one onboarding. `primary_role` is their main
    // job: teacher (the designation then decides teacher vs leadership), or a
    // full-time accountant (Bursar) / admissions officer, who gets the same
    // profile, staff ID and credentials but no classes.
    const primary = ['teacher', 'accountant', 'admissions_officer'].includes(String(primary_role)) ? String(primary_role) : null;
    const effDesignation = primary === 'accountant' ? 'bursar'
      : primary === 'admissions_officer' ? 'administrator'
      : designation;
    const initialRole = primary && primary !== 'teacher'
      ? primary
      : (DESIGNATION_TO_ROLE[String(effDesignation)] || 'teacher');
    const teaches = initialRole === 'teacher' || initialRole === 'principal';
    // A teacher can also hold Bursar / Admissions duties (extra portals).
    const duties = initialRole === 'teacher' ? sanitizeDuties(staff_duties) : [];
    // Accounts / duties only for portals the school's plan includes.
    await assertPortalAllowed(tenantId, initialRole, { forAccountCreation: true });
    for (const d of duties) await assertPortalAllowed(tenantId, d, { forAccountCreation: true });

    const [insertedUser] = await trx('users').insert({
      tenant_id: tenantId,
      email: email.toLowerCase(),
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      password_hash: passwordHash,
      temp_password: tempPassword,
      role: initialRole,
      status: status || 'active',
      photo_url: photo_url || null,
      ...(duties.length ? { staff_duties: JSON.stringify(duties) } : {}),
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    // Validate that any class/subject IDs the client sent actually belong to
    // THIS tenant, so a teacher can never be linked to another school's data.
    // Classes / subjects only for someone who teaches.
    const formClassId = teaches ? (form_class_id || null) : null;
    const classList: string[] = teaches ? assigned_classes : [];
    const subjectList: string[] = teaches ? assigned_subjects : [];
    await assertClassesInTenant(trx, tenantId, [
      ...(formClassId ? [formClassId] : []),
      ...classList,
    ]);
    await assertSubjectsInTenant(trx, tenantId, subjectList);

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
      designation: effDesignation || 'subject_teacher',
      department: department || 'none',
      employment_type: employment_type || 'full_time',
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    // Assign Form Class if provided
    if (formClassId) {
      await trx('classes').where('id', formClassId).update({ class_teacher_id: insertedTeacher.id });
    }

    // Create assignments
    if (classList.length > 0 && subjectList.length > 0) {
      const start_date = new Date().toISOString().split('T')[0];
      const assignments = [];
      for (const classId of classList) {
        for (const subjectId of subjectList) {
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
    let designation: string | undefined = req.body?.designation;
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
      department,
      employment_type,
      form_class_id,
      assigned_classes = [],
      assigned_subjects = [],
      status_reason,
      staff_duties,
      primary_role,
    } = req.body;
    // Main job change (teacher ↔ full-time accountant / admissions officer)
    // maps onto the designation the rest of this handler already understands.
    const primaryJob = ['teacher', 'accountant', 'admissions_officer'].includes(String(primary_role)) ? String(primary_role) : null;
    if (primaryJob === 'accountant') designation = 'bursar';
    else if (primaryJob === 'admissions_officer') designation = 'administrator';
    else if (primaryJob === 'teacher' && (designation === 'bursar' || designation === 'administrator')) {
      // Back to teaching needs a teaching title.
      designation = 'subject_teacher';
    }

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
      .select(
        'teachers.*',
        'users.role as user_role',
        'users.staff_duties',
        'users.email as user_email',
        db.raw("TRIM(CONCAT_WS(' ', users.first_name, users.last_name)) as user_name"),
      )
      .first();
    if (!teacher) {
      throw new AppError('Teacher not found', 404, 'NOT_FOUND');
    }
    // A full-time accountant / admissions officer moving to teaching with no
    // title chosen starts as Subject Teacher.
    if (primaryJob === 'teacher' && designation === undefined && (teacher.user_role === 'accountant' || teacher.user_role === 'admissions_officer')) {
      designation = 'subject_teacher';
    }

    // Remember the teacher's current form class BEFORE we change it, so the
    // notification email can tell whether they were newly assigned or removed.
    const currentClassIds = await currentYearClassIds(trx, tenantId);
    const prevFormClass = await trx('classes')
      .where('class_teacher_id', teacherId)
      .whereIn('id', currentClassIds.length ? currentClassIds : ['00000000-0000-0000-0000-000000000000'])
      .select('id', 'name')
      .first()
      .catch(() => null);

    // Guard against cross-tenant class/subject assignment — same as create.
    await assertClassesInTenant(trx, tenantId, [
      ...(form_class_id ? [form_class_id] : []),
      ...assigned_classes,
    ]);
    await assertSubjectsInTenant(trx, tenantId, assigned_subjects);

    // Update user record
    const userUpdate: any = {};
    if (first_name) userUpdate.first_name = first_name.trim();
    if (last_name) userUpdate.last_name = last_name.trim();
    if (status) userUpdate.status = status;
    if (photo_url !== undefined) userUpdate.photo_url = photo_url || null;

    // Promotion must take REAL effect in the portal, not just relabel a title.
    // We map the chosen designation → its system role and, when it differs from
    // the user's current role, migrate them to the matching portal (admin /
    // finance / admissions / teacher). Because we also enforce role on every
    // request, the migration is reflected the moment they next load — no manual
    // re-provision. We only ever move BETWEEN promotable roles, so a genuine
    // super_admin is never touched.
    if (designation !== undefined) {
      const targetRole = DESIGNATION_TO_ROLE[String(designation)] || 'teacher';
      if (
        targetRole !== teacher.user_role &&
        PROMOTABLE_ROLES.has(teacher.user_role) &&
        PROMOTABLE_ROLES.has(targetRole)
      ) {
        userUpdate.role = targetRole;
      }
    }

    // Extra duties (Bursar / Admissions) only exist on the teacher role. Moving
    // to another role (principal, full-time accountant…) drops them.
    const effectiveRole = userUpdate.role ?? teacher.user_role;
    const prevDuties = parseDuties(teacher.staff_duties);
    let nextDuties = prevDuties;
    if (effectiveRole !== 'teacher') nextDuties = [];
    else if (staff_duties !== undefined) nextDuties = sanitizeDuties(staff_duties);
    const dutiesChanged = JSON.stringify([...nextDuties].sort()) !== JSON.stringify([...prevDuties].sort());
    // New duties / a move to a portal role need that portal in the plan.
    const portalTenant = (req as any).user?.tenant_id || teacher.tenant_id;
    for (const d of nextDuties.filter((x) => !prevDuties.includes(x))) await assertPortalAllowed(portalTenant, d, { forAccountCreation: true });
    if (userUpdate.role && userUpdate.role !== teacher.user_role) await assertPortalAllowed(portalTenant, userUpdate.role, { forAccountCreation: true });
    if (dutiesChanged) userUpdate.staff_duties = JSON.stringify(nextDuties);

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
      // Clear this teacher's CURRENT-year form class only — past years keep
      // their form teacher as history.
      await trx('classes').where('class_teacher_id', teacherId)
        .whereIn('id', currentClassIds.length ? currentClassIds : ['00000000-0000-0000-0000-000000000000'])
        .update({ class_teacher_id: null });
      
      // Associate new Form Class
      if (form_class_id) {
        await trx('classes').where('id', form_class_id).update({ class_teacher_id: teacherId });
      }
    }

    // Replace assignments if provided
    if (req.body.assigned_classes !== undefined || req.body.assigned_subjects !== undefined) {
      // Replace this teacher's CURRENT-year assignments only. Deleting all of
      // them erased past years' teaching history (who taught what, when).
      await trx('teacher_assignments').where('teacher_id', teacherId)
        .whereIn('class_id', currentClassIds.length ? currentClassIds : ['00000000-0000-0000-0000-000000000000'])
        .del();

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

    // Full-force enforcement when the account becomes NON-ACTIVE (suspended /
    // dismissed / deactivated), on par with the deactivate (DELETE) path:
    //  - release any form-class they lead so it doesn't point at them,
    //  - end their active subject/class assignments,
    //  - revoke all refresh tokens so any live session is cut off immediately.
    const becomingInactive =
      status !== undefined && String(status).toLowerCase() !== 'active' &&
      String(teacher.status).toLowerCase() === 'active';
    if (becomingInactive) {
      await trx('classes').where('class_teacher_id', teacherId).update({ class_teacher_id: null });
      await trx('teacher_assignments')
        .where('teacher_id', teacherId)
        .update({ end_date: new Date().toISOString().split('T')[0], updated_at: new Date() });
      await trx('refresh_tokens').where('user_id', teacher.user_id).del().catch(() => { /* best effort */ });
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
        'users.role as user_role',
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
        db.raw(`(SELECT c.name FROM classes c LEFT JOIN academic_sessions s ON s.id = c.academic_session_id WHERE c.class_teacher_id = teachers.id AND ${CURRENT_CLASS_SQL} LIMIT 1) as form_class_name`),
        db.raw(`(SELECT c.id FROM classes c LEFT JOIN academic_sessions s ON s.id = c.academic_session_id WHERE c.class_teacher_id = teachers.id AND ${CURRENT_CLASS_SQL} LIMIT 1) as form_class_id`)
      )
      .where('teachers.id', teacherId)
      .first();

    res.json({
      message: 'Teacher profile updated successfully',
      user: {
        ...updated,
        status: updated.user_status,
        role: updated.user_role,
      },
    });

    // Notify the staff member whenever their ROLE/TITLE or FORM-CLASS changes.
    // Three channels, all best-effort (never fail the update over comms):
    //   1. In-app notification (bell)   — designation change
    //   2. One-time portal welcome flag — designation change (dismissible guide)
    //   3. Branded email                — designation and/or form-class change
    const DESIGNATION_LABEL: Record<string, string> = {
      subject_teacher: 'Subject Teacher',
      class_teacher: 'Class Master',
      form_teacher: 'Form Master',
      hod: 'Head of Department',
      senior_teacher: 'Senior Teacher',
      head_teacher: 'Head Teacher',
      vice_head_teacher: 'Deputy Head Teacher',
      vice_principal: 'Vice Principal',
      principal: 'Principal',
      bursar: 'Bursar',
      administrator: 'Administrator',
    };
    const designationChanged = designation !== undefined && designation !== teacher.designation;
    const roleLabel = DESIGNATION_LABEL[String(designation)] || 'a new role';
    const prevRoleLabel = DESIGNATION_LABEL[String(teacher.designation)] || undefined;
    const portalChanged = !!(userUpdate.role && userUpdate.role !== teacher.user_role) || dutiesChanged;

    // New duty (Bursar / Admissions) on top of teaching: tell them their portal grew.
    const addedDuties = nextDuties.filter((d) => !prevDuties.includes(d));
    if (addedDuties.length) {
      const DUTY_LABEL: Record<string, string> = { accountant: 'Accountant (Bursar)', admissions_officer: 'Admissions Officer' };
      const label = addedDuties.map((d) => DUTY_LABEL[d] || d).join(' and ');
      try {
        const { default: notificationService } = await import('@services/notificationService');
        await notificationService.createNotification({
          notificationType: 'promotion',
          recipientId: teacher.user_id,
          subject: `You're now also ${label}`,
          message: `Alongside your classes, you now have ${label} access. The new pages appear in your menu.`,
          channels: ['in_app'],
          sourceType: 'staff_duty',
          sourceId: teacherId,
          createdBy: (req as any).user?.id,
        }).catch(() => { /* non-fatal */ });
      } catch { /* non-fatal */ }
    }

    // Did the form-class assignment change?
    const prevFormId = prevFormClass?.id || null;
    const newFormId = form_class_id !== undefined ? (form_class_id || null) : prevFormId;
    const formClassChanged = form_class_id !== undefined && newFormId !== prevFormId;
    const newFormName = updated?.form_class_name || null; // reflects the just-applied class
    const formClassAssigned = formClassChanged && !!newFormId;
    const formClassRemoved = formClassChanged && !newFormId;

    if (designationChanged) {
      try {
        const { default: notificationService } = await import('@services/notificationService');
        await notificationService.createNotification({
          notificationType: 'promotion',
          recipientId: teacher.user_id,
          subject: `You've been appointed ${roleLabel}`,
          message: `Congratulations! You are now ${roleLabel} at your school. Your portal has been updated with the access and tools for this role. Look out for the welcome guide when you next open your dashboard.`,
          channels: ['in_app'],
          sourceType: 'teacher_promotion',
          sourceId: teacherId,
          createdBy: (req as any).user?.id,
        }).catch(() => { /* non-fatal */ });

        // One-time welcome flag the portal reads then clears (see /auth/me).
        await db('users').where('id', teacher.user_id).update({
          promotion_welcome: JSON.stringify({ role: designation, label: roleLabel, at: new Date().toISOString() }),
        }).catch(() => { /* column may not exist yet — safe to ignore */ });
      } catch (e) {
        logger.warn(`Promotion welcome notification failed for teacher ${teacher.teacher_id}: ${String((e as any)?.message || e)}`);
      }
    }

    // The class-leadership term differs by school level: primary schools call it
    // "Class Teacher" (Class Master), secondary schools "Form Teacher" (Form
    // Master). Pick the term from the staff member's effective designation.
    const effectiveDesignation = String(designation ?? teacher.designation ?? '');
    const classRoleTerm = ['class_teacher', 'head_teacher', 'vice_head_teacher'].includes(effectiveDesignation)
      ? 'Class Master'
      : 'Form Master';

    // Also drop an in-app notification for a pure form-class assignment change
    // (no designation change) so it's visible in their bell.
    if (formClassChanged && !designationChanged) {
      try {
        const { default: notificationService } = await import('@services/notificationService');
        await notificationService.createNotification({
          notificationType: 'assignment',
          recipientId: teacher.user_id,
          subject: formClassAssigned ? `You're now ${classRoleTerm} of ${newFormName}` : 'Your class assignment changed',
          message: formClassAssigned
            ? `You have been assigned as the ${classRoleTerm} of ${newFormName}. Open your portal to manage your class.`
            : 'Your class-teacher assignment has been removed.',
          channels: ['in_app'],
          sourceType: 'teacher_form_class',
          sourceId: teacherId,
          createdBy: (req as any).user?.id,
        }).catch(() => { /* non-fatal */ });
      } catch { /* non-fatal */ }
    }

    // Account STATUS change (suspend / dismiss / deactivate / reactivate) →
    // notify the staff member by email + in-app so they know their access
    // changed. Only fires when the status actually changed.
    const statusChanged = status !== undefined && status !== null && String(status) !== String(teacher.status);
    if (statusChanged && teacher.user_email) {
      try {
        const { default: emailService } = await import('@services/emailService');
        await emailService.sendAccountStatusEmail(tenantId, teacher.user_email, {
          userName: teacher.user_name || 'there',
          status: String(status) as 'active' | 'inactive' | 'suspended' | 'dismissed',
          reason: status_reason ? String(status_reason) : undefined,
        }).catch(() => { /* non-fatal */ });
      } catch (e) {
        logger.warn(`Account-status email failed for teacher ${teacher.teacher_id}: ${String((e as any)?.message || e)}`);
      }
      try {
        const STATUS_MSG: Record<string, { subject: string; message: string }> = {
          active: { subject: 'Your account has been reactivated', message: 'Your account has been reactivated. You can sign in again and resume your work.' },
          suspended: { subject: 'Your account has been suspended', message: 'Your account has been temporarily suspended. Please contact your school administrator.' },
          dismissed: { subject: 'Your account has been closed', message: 'Your account has been closed and access removed. Please contact your school administrator.' },
          inactive: { subject: 'Your account has been deactivated', message: 'Your account has been deactivated. Please contact your school administrator.' },
        };
        const m = STATUS_MSG[String(status)] || STATUS_MSG.inactive;
        const { polishReason } = await import('@services/email/reasonPolish');
        const polished = status_reason ? polishReason(status_reason, String(status) as any) : null;
        const reasonSuffix = polished ? ` Reason: ${polished.summary}` : '';
        const { default: notificationService } = await import('@services/notificationService');
        await notificationService.createNotification({
          notificationType: 'account_status',
          recipientId: teacher.user_id,
          subject: m.subject,
          message: m.message + reasonSuffix,
          channels: ['in_app'],
          sourceType: 'teacher_status',
          sourceId: teacherId,
          createdBy: (req as any).user?.id,
        }).catch(() => { /* non-fatal */ });
      } catch { /* non-fatal */ }
    }

    // Branded email covering whatever changed (role and/or class assignment).
    if ((designationChanged || formClassChanged) && teacher.user_email) {
      try {
        const { default: emailService } = await import('@services/emailService');
        await emailService.sendStaffRoleChangeEmail(tenantId, teacher.user_email, {
          userName: teacher.user_name || 'there',
          newDesignation: designationChanged ? roleLabel : undefined,
          previousDesignation: designationChanged ? prevRoleLabel : undefined,
          classRoleTerm,
          formClassName: formClassAssigned ? newFormName : null,
          formClassRemoved,
          portalChanged,
        }).catch(() => { /* non-fatal */ });
      } catch (e) {
        logger.warn(`Role-change email failed for teacher ${teacher.teacher_id}: ${String((e as any)?.message || e)}`);
      }
    }

    // Audit the effective system-role change so a promotion is traceable.
    if (userUpdate.role && userUpdate.role !== teacher.user_role) {
      logger.info(`Teacher ${teacher.teacher_id} system role changed: ${teacher.user_role} → ${userUpdate.role} (designation: ${designation})`);
    }
    if (dutiesChanged) {
      logger.info(`Staff ${teacher.teacher_id} duties changed: [${prevDuties.join(', ')}] → [${nextDuties.join(', ')}]`);
    }

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
    const deactivateReason = req.query.reason ? String(req.query.reason) : undefined;
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const teacher = await trx('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.id', teacherId)
      .where('users.tenant_id', tenantId)
      .select(
        'teachers.*',
        'users.email as user_email',
        db.raw("TRIM(CONCAT_WS(' ', users.first_name, users.last_name)) as user_name"),
      )
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

    // Release any form-class this teacher was leading so the class no longer
    // points at an inactive teacher (otherwise it lingers as "Form Teacher").
    await trx('classes').where('class_teacher_id', teacherId).update({ class_teacher_id: null });

    // End assignments
    await trx('teacher_assignments')
      .where('teacher_id', teacherId)
      .update({
        end_date: new Date().toISOString().split('T')[0],
        updated_at: new Date(),
      });

    // Revoke all refresh tokens so any live session is cut off immediately.
    await trx('refresh_tokens').where('user_id', teacher.user_id).del().catch(() => { /* best effort */ });

    await trx.commit();

    res.json({
      message: 'Teacher deactivated successfully',
    });

    // Notify the staff member their account was deactivated (email + in-app).
    if (teacher.user_email) {
      try {
        const { default: emailService } = await import('@services/emailService');
        await emailService.sendAccountStatusEmail(tenantId, teacher.user_email, {
          userName: teacher.user_name || 'there',
          status: 'inactive',
          reason: deactivateReason,
        }).catch(() => { /* non-fatal */ });
      } catch (e) {
        logger.warn(`Deactivation email failed for teacher ${teacher.teacher_id}: ${String((e as any)?.message || e)}`);
      }
      try {
        const { polishReason } = await import('@services/email/reasonPolish');
        const polished = deactivateReason ? polishReason(deactivateReason, 'inactive') : null;
        const { default: notificationService } = await import('@services/notificationService');
        await notificationService.createNotification({
          notificationType: 'account_status',
          recipientId: teacher.user_id,
          subject: 'Your account has been deactivated',
          message: 'Your account has been deactivated. Please contact your school administrator.' + (polished ? ` Reason: ${polished.summary}` : ''),
          channels: ['in_app'],
          sourceType: 'teacher_status',
          sourceId: teacherId,
          createdBy: (req as any).user?.id,
        }).catch(() => { /* non-fatal */ });
      } catch { /* non-fatal */ }
    }

    logger.info(`Teacher account deactivated: (Staff ID: ${teacher.teacher_id})`);
  } catch (error) {
    await trx.rollback();
    next(error);
  }
});

export default router;
