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
import { sendExport } from '@utils/exportResponse';
import { importStudents } from '@services/studentImportService';
import { isFinanceLookup } from '@utils/financeLookup';
import multer from 'multer';
import { normalizeAcademicYear } from '../utils/academicYear.js';

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5MB, one file
  // CSV only. Browsers report CSV under several MIME types, so the extension
  // is the reliable check.
  fileFilter: (_req, file, cb) => {
    if (/\.csv$/i.test(file.originalname || '')) return cb(null, true);
    cb(new AppError('Only .csv files can be imported. Save your spreadsheet as CSV and try again.', 400, 'INVALID_FILE_TYPE') as any);
  },
});

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

    // If enrolling into a class, it MUST belong to this tenant — otherwise the
    // new student could be enrolled into another school's class.
    if (class_id) {
      const cls = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', class_id)
        .where(function (this: any) {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function (this: any) {
              this.whereNull('classes.academic_session_id').where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!cls) throw new AppError('Selected class does not belong to this school', 400, 'INVALID_CLASS');
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
      }).catch((e) => {
        // Don't fail student creation on an enrollment hiccup, but surface it so
        // a "created but not enrolled" student can be diagnosed.
        logger.warn(`Student ${inserted.student_id} created but enrollment into class ${class_id} failed: ${e?.message || e}`);
      });
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

    // Tenant scoping is MANDATORY — without it the guardian_name/email LIKE
    // match below would span every school. A parent must have a tenant.
    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }
    childrenQuery = childrenQuery.where('students.tenant_id', tenantId);

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
// The bursar (accountant, or a teacher with the Bursar duty via ?scope=finance)
// searches the whole school to record payments and give discounts.
router.get('/', authenticate, authorize('admin', 'principal', 'super_admin', 'teacher', 'admissions_officer', 'accountant'), async (req: Request, res: Response, next: NextFunction) => {
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

    // Students come from admissions only through Enrol (admissionPipelineService).
    // The old "sync applications to students" pass that ran here turned every
    // non-rejected application (even new ones) into a student on each list load.

    // Academic-year scope. A year shows THAT year's roster, with the class each
    // student was in that year (not their class today). No year = everyone,
    // with their current class.
    const academicYear = (req.query.academic_year as string | undefined)?.trim() || undefined;
    let yearClassIds: string[] | null = null;
    if (academicYear) {
      const wantedYear = normalizeAcademicYear(academicYear);
      const session = (await db('academic_sessions').where({ tenant_id: effectiveTenantId }).select('id', 'name', 'is_active'))
        .find((s: any) => normalizeAcademicYear(s.name) === wantedYear);
      const rows = session
        ? await db('classes').leftJoin('users as cc', 'classes.created_by', 'cc.id')
            .where((q) => {
              q.where('classes.academic_session_id', session.id);
              if (session.is_active) q.orWhere((q2) => q2.whereNull('classes.academic_session_id').where('cc.tenant_id', effectiveTenantId));
            })
            .select('classes.id')
        : [];
      yearClassIds = rows.map((r: any) => r.id);
      if (yearClassIds.length === 0) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
    }
    const HISTORIC = ['enrolled', 'active', 'completed', 'promoted', 'repeated', 'graduated'];

    // Teacher scoping: teachers only see students in classes they teach
    // (teacher_assignments) or lead (class_teacher_id). With a year chosen, it's
    // the teacher's classes OF THAT YEAR and everyone who was in them that year
    // (historic statuses); with no year, who is enrolled in their classes now.
    let teacherStudentIds: string[] | null = null;
    let teacherYearClassIds: string[] | null = null;
    if (userRole === 'teacher' && !(await isFinanceLookup(req))) {
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
      let classIds = Array.from(new Set<string>([
        ...assigned.map((r: any) => r.class_id),
        ...led.map((r: any) => r.id),
      ]));
      if (yearClassIds) {
        const inYear = new Set(yearClassIds.map(String));
        classIds = classIds.filter((id) => inYear.has(String(id)));
        teacherYearClassIds = classIds;
      }
      if (classIds.length === 0) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      const enrolled = await db('enrollments')
        .whereIn('class_id', classIds)
        .whereIn('status', yearClassIds ? HISTORIC : ['enrolled', 'active'])
        .distinct('student_id');
      teacherStudentIds = enrolled.map((r: any) => r.student_id);
      if (teacherStudentIds.length === 0) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
    }
    // The class shown for each student in a chosen year: for a teacher, their
    // own class of that year (never another teacher's class).
    const rosterClassIds = teacherYearClassIds ?? yearClassIds;

    let query = db('students')
      .select(
        'students.*',
        'classes.id as class_id',
        'classes.name as class_name',
        'classes.level as class_level'
      );
    if (rosterClassIds) {
      // One row per student: their (latest) enrollment in that year's classes.
      query = query
        .join(
          db('enrollments').distinctOn('student_id')
            .select('student_id', 'class_id')
            .whereIn('class_id', rosterClassIds)
            .whereIn('status', HISTORIC)
            .orderBy('student_id').orderBy('created_at', 'desc')
            .as('ye'),
          'ye.student_id', 'students.id',
        )
        .leftJoin('classes', 'ye.class_id', 'classes.id');
    } else {
      query = query
        .leftJoin('enrollments', function () {
          this.on('students.id', '=', 'enrollments.student_id')
            .andOnIn('enrollments.status', ['enrolled', 'active']);
        })
        .leftJoin('classes', 'enrollments.class_id', 'classes.id');
    }

    if (userRole !== 'super_admin') {
      query = query.where('students.tenant_id', tenantId);
    } else if (requestedTenantId && requestedTenantId !== 'all') {
      query = query.where('students.tenant_id', requestedTenantId);
    }

    if (teacherStudentIds) query = query.whereIn('students.id', teacherStudentIds);

    // Academic-year scope: when a year is chosen, restrict to students who had
    // an enrollment (any status) in a class of THAT session — so a past year
    // shows that year's roster. Classes with no session are matched on the
    // active year only via null-session handling on the caller side; here we
    // match the session name. Omitted year = current roster (default).
    // Same year scope for the count query (students with an enrollment in that
    // year's classes).
    let yearStudentIds: string[] | null = null;
    if (yearClassIds) {
      const rows = await db('enrollments').whereIn('class_id', yearClassIds).whereIn('status', HISTORIC).distinct('student_id');
      yearStudentIds = rows.map((r: any) => r.student_id);
      if (yearStudentIds.length === 0) {
        return res.json({ data: [], pagination: { page, limit, total: 0, total_pages: 0 } });
      }
    }

    // Optional class filter (server-side, so it covers every page — not only
    // the rows currently loaded). In a chosen year it's who was in that class
    // that year; otherwise who is enrolled in it now.
    const classFilterId = (req.query.class_id as string | undefined)?.trim() || undefined;
    let classStudentIds: string[] | null = null;
    if (classFilterId) {
      const rows = await db('enrollments')
        .where('class_id', classFilterId)
        .whereIn('status', yearClassIds ? HISTORIC : ['enrolled', 'active'])
        .distinct('student_id');
      classStudentIds = rows.map((r: any) => r.student_id);
      if (classStudentIds.length === 0) {
        return res.json({ data: [], stats: { total: 0, active: 0, inactive: 0, graduated: 0 }, pagination: { page, limit, total: 0, total_pages: 0 } });
      }
      query = query.whereIn('students.id', classStudentIds);
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
          .orWhere('students.email', 'ilike', term)
          // Full-name search: match "First Last" (and "Last First") so typing the
          // whole name finds the student, not just a single name part or the ID.
          .orWhereRaw("CONCAT_WS(' ', students.first_name, students.last_name) ILIKE ?", [term])
          .orWhereRaw("CONCAT_WS(' ', students.last_name, students.first_name) ILIKE ?", [term]);
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
    if (yearStudentIds) {
      countQuery = countQuery.whereIn('students.id', yearStudentIds);
    }
    if (classStudentIds) {
      countQuery = countQuery.whereIn('students.id', classStudentIds);
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
          .orWhere('students.email', 'ilike', term)
          .orWhereRaw("CONCAT_WS(' ', students.first_name, students.last_name) ILIKE ?", [term])
          .orWhereRaw("CONCAT_WS(' ', students.last_name, students.first_name) ILIKE ?", [term]);
      });
    }

    const totalResult: any = await countQuery.first();
    const totalRaw = totalResult?.totalCount ?? totalResult?.count;

    // KPI totals across the WHOLE filtered set (not just this page). Same
    // tenant / teacher / year / search scope; ignores the status filter so each
    // card always shows its own count.
    let statsQuery = db('students');
    if (userRole !== 'super_admin') {
      statsQuery = statsQuery.where('students.tenant_id', tenantId);
    } else if (requestedTenantId && requestedTenantId !== 'all') {
      statsQuery = statsQuery.where('students.tenant_id', requestedTenantId);
    }
    if (teacherStudentIds) statsQuery = statsQuery.whereIn('students.id', teacherStudentIds);
    if (yearStudentIds) statsQuery = statsQuery.whereIn('students.id', yearStudentIds);
    if (classStudentIds) statsQuery = statsQuery.whereIn('students.id', classStudentIds);
    if (search) {
      const term = `%${search.trim()}%`;
      statsQuery = statsQuery.where(function () {
        this.where('students.first_name', 'ilike', term)
          .orWhere('students.last_name', 'ilike', term)
          .orWhere('students.student_id', 'ilike', term)
          .orWhere('students.email', 'ilike', term)
          .orWhereRaw("CONCAT_WS(' ', students.first_name, students.last_name) ILIKE ?", [term])
          .orWhereRaw("CONCAT_WS(' ', students.last_name, students.first_name) ILIKE ?", [term]);
      });
    }
    const statusRows: any[] = await statsQuery
      .select('students.status')
      .count('students.id as count')
      .groupBy('students.status');
    const stats = statusRows.reduce(
      (acc: any, r: any) => {
        const c = Number(r.count) || 0;
        acc.total += c;
        if (r.status === 'active' || r.status === 'enrolled') acc.active += c;
        else if (r.status === 'inactive' || r.status === 'suspended') acc.inactive += c;
        else if (r.status === 'graduated') acc.graduated += c;
        return acc;
      },
      { total: 0, active: 0, inactive: 0, graduated: 0 },
    );

    // Get paginated results — ordered by student ID (001, 002, 003 …). IDs are
    // zero-padded with a shared prefix so a plain ascending sort is correct;
    // students without an ID sort last, then by enrollment date.
    const students = await query
      .limit(limit)
      .offset(offset)
      .orderByRaw('students.student_id ASC NULLS LAST')
      .orderBy('created_at', 'asc');

    const total = Math.max(Number(totalRaw ?? 0), students.length);

    res.json({
      data: students,
      stats,
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
 * GET /api/v1/students/import/template?format=xlsx|csv
 * Download a professionally-formatted import template (branded XLSX by default,
 * matching the export styling) with the expected columns + a couple of sample
 * rows. Declared before /:studentId so the literal path isn't captured.
 */
router.get(
  '/import/template',
  authenticate,
  authorize('admin', 'principal', 'super_admin', 'admissions_officer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenant_id;
      const { IMPORT_COLUMNS } = await import('@services/studentImportService');

      // One column per import field; a couple of clearly-fake example rows so
      // users see the expected format (dates, phone, class name).
      const columns: Record<string, string> = {};
      IMPORT_COLUMNS.forEach((c) => { columns[c.header] = c.field; });

      const sampleRows = [
        {
          first_name: 'Aminata', last_name: 'Kamara', gender: 'female', date_of_birth: '2014-05-12',
          email: '', phone: '+23276000000', address: '12 Circular Rd, Freetown',
          guardian_name: 'Mariama Kamara', guardian_phone: '+23276111111', guardian_email: '',
          guardian_relationship: 'Mother', class_name: 'JSS 1',
        },
        {
          first_name: 'Mohamed', last_name: 'Sesay', gender: 'male', date_of_birth: '2013-09-30',
          email: '', phone: '', address: '5 Kissy Rd, Freetown',
          guardian_name: 'Ibrahim Sesay', guardian_phone: '+23278222222', guardian_email: '',
          guardian_relationship: 'Father', class_name: 'JSS 2',
        },
      ];

      await sendExport(res, {
        format: (req.query.format as string) || 'excel',
        tenantId,
        rows: sampleRows,
        columns,
        filename: 'student_import_template',
        title: 'Student Import Template',
        sheetName: 'Import Template',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/students/import  (multipart: field "file" = CSV)
 * Bulk-import students. Validates rows, enforces the plan student limit, and
 * inserts within a transaction scoped to the acting tenant. Returns a summary
 * { imported, skipped, failed, total, errors[] }.
 */
router.post(
  '/import',
  authenticate,
  authorize('admin', 'principal', 'super_admin', 'admissions_officer'),
  uploadCsv.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      if (!req.file?.buffer) throw new AppError('No CSV file uploaded (field "file").', 400, 'NO_FILE');

      const csvText = req.file.buffer.toString('utf-8');
      const result = await importStudents(csvText, tenantId, req.auth?.userId ?? null);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/students/export?format=csv|excel|pdf
 * Download the tenant's students. Staff-managers only (principal/super_admin/
 * admissions_officer); tenant-scoped. Declared BEFORE /:studentId so the
 * literal path isn't captured as an id param.
 */
router.get(
  '/export',
  authenticate,
  authorize('admin', 'principal', 'super_admin', 'admissions_officer'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');

      const rows = await db('students')
        .leftJoin('enrollments', function () {
          this.on('students.id', '=', 'enrollments.student_id').andOnIn('enrollments.status', ['enrolled', 'active']);
        })
        .leftJoin('classes', 'enrollments.class_id', 'classes.id')
        .where('students.tenant_id', tenantId)
        .select(
          'students.student_id as admission_no',
          'students.first_name',
          'students.last_name',
          'students.gender',
          'classes.name as class_name',
          'students.guardian_name',
          'students.guardian_phone',
          'students.status',
          'students.enrollment_date',
        )
        .orderBy('students.created_at', 'desc')
        .limit(10000);

      const formatted = rows.map((r: any) => ({
        ...r,
        enrollment_date: r.enrollment_date ? new Date(r.enrollment_date).toLocaleDateString() : '',
      }));

      await sendExport(res, {
        format: req.query.format as string,
        tenantId,
        rows: formatted,
        columns: {
          'Admission No': 'admission_no',
          'First Name': 'first_name',
          'Last Name': 'last_name',
          Gender: 'gender',
          Class: 'class_name',
          Guardian: 'guardian_name',
          'Guardian Phone': 'guardian_phone',
          Status: 'status',
          Enrolled: 'enrollment_date',
        },
        filename: 'students_export',
        title: 'Students Export',
        sheetName: 'Students',
      });
    } catch (error) {
      next(error);
    }
  }
);

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

    // Authorization for viewing a student profile:
    //  - Staff (principal / super_admin / teacher / admissions_officer): any
    //    student in their tenant.
    //  - Student: only their OWN record.
    //  - Parent/guardian: only a linked child.
    // (All already tenant-scoped above; this adds per-row ownership for the
    // non-staff roles so one family can't read another's records.)
    const STAFF_VIEW_ROLES = ['principal', 'super_admin', 'teacher', 'admissions_officer'];
    if (!STAFF_VIEW_ROLES.includes(currentUser.role as string)) {
      if (currentUser.role === 'student') {
        if (student.user_id !== currentUser.userId) {
          throw new AppError('Insufficient permissions to view this student record', 403, 'AUTHORIZATION_ERROR');
        }
      } else if (currentUser.role === 'parent' || currentUser.role === 'guardian') {
        const link = await db('guardians')
          .join('students', 'guardians.student_id', 'students.id')
          .where('guardians.user_id', currentUser.userId)
          .where('guardians.student_id', student.id)
          .where('students.tenant_id', tenantId)
          .first()
          .catch(() => null);
        if (!link) {
          throw new AppError('Insufficient permissions to view this student record', 403, 'AUTHORIZATION_ERROR');
        }
      } else {
        throw new AppError('Insufficient permissions to view this student record', 403, 'AUTHORIZATION_ERROR');
      }
    }

    // Teachers: only students who are (or were) in one of their classes —
    // the same scope as their directory list.
    if (currentUser.role === 'teacher') {
      const { teacherCanAccessStudent } = await import('../utils/teacherScope.js');
      // Non-super-admins always have a tenant here (checked above); '' fails closed.
      if (!(await teacherCanAccessStudent(currentUser.userId, tenantId ?? '', String(student.id)))) {
        throw new AppError('You can only view students in your classes', 403, 'AUTHORIZATION_ERROR');
      }
    }

    // Credential material (temp passwords) is SENSITIVE — only expose it to the
    // staff roles who legitimately hand out / reset credentials. Students,
    // parents and teachers viewing a profile never receive passwords.
    const canSeeCredentials = ['principal', 'super_admin', 'admissions_officer'].includes(currentUser.role as string);

    // Ensure student + parent login accounts exist with RANDOM per-account temp
    // passwords (no shared guessable defaults). Delegated to the hardened util,
    // which only (re)sets a password for accounts that have never logged in, so
    // a real user's chosen password is never overwritten. Only the roles that
    // hand out credentials trigger this — merely VIEWING a profile as a teacher,
    // student or parent must not create accounts as a side effect.
    const safeStudentId = (student.student_id || 'student').toLowerCase();
    if (canSeeCredentials) {
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

    const { provisionStudentAccounts } = await import('../utils/studentAccounts.js');
    const provisioned = await provisionStudentAccounts(db, tenantId, {
      student_id: student.id,
      reg_id: student.student_id || safeStudentId,
      email: student.email,
      first_name: student.first_name,
      last_name: student.last_name,
      guardian_name: guardianRecord
        ? `${guardianRecord.first_name ?? ''} ${guardianRecord.last_name ?? ''}`.trim() || student.guardian_name
        : student.guardian_name,
      guardian_email: guardianRecord?.email || null,
    });

    const studentUser = provisioned.studentUserId
      ? await db('users').where('id', provisioned.studentUserId).first()
      : null;
    const parentUser = provisioned.parentUserId
      ? await db('users').where('id', provisioned.parentUserId).first()
      : null;

      student.login_credentials = {
        // Students sign in with their student ID NUMBER as the username.
        student_username: studentUser?.username || provisioned.studentUsername || student.student_id || safeStudentId,
        student_email: studentUser?.email || `${safeStudentId}@student.school.com`,
        // Demo password: prefer the freshly-provisioned one, else the stored
        // temp_password on the account (both student & parent). Only null when a
        // real user has changed their own password (temp_password cleared).
        student_password: provisioned.studentPassword || studentUser?.temp_password || null,
        // User ids so the principal can trigger a password reset for either account.
        student_user_id: studentUser?.id || provisioned.studentUserId || null,
        parent_user_id: parentUser?.id || provisioned.parentUserId || null,
        parent_email: parentUser?.email || provisioned.parentEmail,
        parent_password: provisioned.parentPassword || parentUser?.temp_password || null,
        has_parent_account: !!parentUser,
      };
      // Back-compat alias for existing frontend that reads demo_login.
      student.demo_login = student.login_credentials;
    }

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

    // Class change: managers only, and only within the CURRENT academic year.
    // Past-year enrollments are history and are never rewritten here.
    const { class_id } = req.body;
    let moveToClass: any = null;
    if (class_id && isManager) {
      moveToClass = await db('classes')
        .join('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .where('classes.id', class_id)
        .where('academic_sessions.tenant_id', tenantId)
        .select('classes.id', 'classes.academic_session_id', 'academic_sessions.is_active')
        .first();
      if (!moveToClass) throw new AppError('Selected class does not belong to this school', 400, 'INVALID_CLASS');
      if (!moveToClass.is_active) {
        // Re-submitting the class they're already in (e.g. a form prefilled
        // with last year's class) is a no-op, not an error.
        const already = await db('enrollments')
          .where({ student_id: student.id, class_id: moveToClass.id })
          .first('id');
        if (!already) {
          throw new AppError('Students can only be moved into a class of the current academic year', 409, 'PAST_YEAR_READ_ONLY');
        }
        moveToClass = null;
      }
    }

    await db.transaction(async (trx) => {
      await trx('students').where('id', student.id).andWhere('tenant_id', tenantId).update(updateData);

      if (moveToClass) {
        // The student's live enrollment in the current year, if any.
        const current = await trx('enrollments')
          .join('classes', 'enrollments.class_id', 'classes.id')
          .where('enrollments.student_id', student.id)
          .where('classes.academic_session_id', moveToClass.academic_session_id)
          .whereIn('enrollments.status', ['enrolled', 'active'])
          .select('enrollments.id', 'enrollments.class_id')
          .first();

        if (!current) {
          await trx('enrollments').insert({
            student_id: student.id,
            class_id: moveToClass.id,
            academic_session_id: moveToClass.academic_session_id,
            enrollment_date: new Date().toISOString().split('T')[0],
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          });
        } else if (String(current.class_id) !== String(moveToClass.id)) {
          await trx('enrollments')
            .where('id', current.id)
            .update({ class_id: moveToClass.id, updated_at: new Date() });
        }
      }
    });

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
router.delete('/:studentId', authenticate, authorize('principal', 'super_admin', 'admissions_officer'), async (req: Request, res: Response, next: NextFunction) => {
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
router.post('/:studentId/reactivate', authenticate, authorize('principal', 'super_admin', 'admissions_officer'), async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/:studentId/enrollments', authorize('principal', 'super_admin', 'teacher', 'admissions_officer'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    // RLS-scoped: run in a tenant transaction so the DB itself enforces
    // isolation (defence-in-depth alongside the explicit tenant_id filter).
    const run = req.withTenant ?? ((fn: any) => fn(db));
    const { student, enrollments } = await run(async (trx: any) => {
      const student = await trx('students')
        .select('*')
        .where('tenant_id', tenantId)
        .andWhere(function (this: any) {
          this.where('student_id', studentId).orWhere('id', studentId);
        })
        .first();
      if (!student) return { student: null, enrollments: [] };

      const enrollments = await trx('enrollments')
        .select('id', 'enrollment_id', 'class_id', 'academic_session_id', 'enrollment_date', 'status', 'roll_number', 'created_at')
        .where('student_id', student.id)
        .orderBy('enrollment_date', 'desc');
      return { student, enrollments };
    });

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

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
router.get('/:studentId/grades', authorize('principal', 'super_admin', 'teacher', 'admissions_officer'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const run = req.withTenant ?? ((fn: any) => fn(db));
    const { student, grades } = await run(async (trx: any) => {
      const student = await trx('students')
        .select('*')
        .where('tenant_id', tenantId)
        .andWhere(function (this: any) {
          this.where('student_id', studentId).orWhere('id', studentId);
        })
        .first();
      if (!student) return { student: null, grades: [] };

      const grades = await trx('grades')
        .select('id', 'subject_id', 'class_id', 'marks_obtained', 'total_marks', 'grade', 'status', 'created_at')
        .where('student_id', student.id)
        .orderBy('created_at', 'desc');
      return { student, grades };
    });

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

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
router.get('/:studentId/attendance', authorize('principal', 'super_admin', 'teacher', 'admissions_officer'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const classId = req.query.classId as string;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const run = req.withTenant ?? ((fn: any) => fn(db));
    const { student, attendance } = await run(async (trx: any) => {
      const student = await trx('students')
        .select('*')
        .where('tenant_id', tenantId)
        .andWhere(function (this: any) {
          this.where('student_id', studentId).orWhere('id', studentId);
        })
        .first();
      if (!student) return { student: null, attendance: [] };

      let query = trx('attendance')
        .select('id', 'class_id', 'date', 'status', 'remarks', 'created_at')
        .where('student_id', student.id);
      if (classId) query = query.where('class_id', classId);
      const attendance = await query.orderBy('date', 'desc');
      return { student, attendance };
    });

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

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
