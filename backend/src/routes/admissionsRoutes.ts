import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { generateNextId } from '@utils/idGenerator';
import { linkGuardianForStudent } from '@utils/guardianLinking';
import { UserRole } from '../types/auth';
import { sendExport } from '@utils/exportResponse';
import emailService from '../services/emailService.js';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);

/** The authenticated school's public application address. */
router.get('/share-link', authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    const school = await db('tenants').where({ id: tenantId, status: 'active' }).select('name', 'slug').first();
    if (!school) throw new AppError('School is not available for online applications', 404, 'SCHOOL_NOT_FOUND');
    const configuredUrl = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL?.split(',')[0]?.trim();
    const publicBaseUrl = configuredUrl && /^https?:\/\//i.test(configuredUrl) ? configuredUrl : null;
    res.json({ success: true, data: { path: `/apply/${encodeURIComponent(school.slug)}`, school_name: school.name, public_base_url: publicBaseUrl } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admissions/export?format=csv|excel|pdf
 * Download admission applications for the tenant. Declared before /:appId.
 */
router.get('/export', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');

    const rows = await db('admission_applications')
      .leftJoin('classes', 'admission_applications.class_applying_for', 'classes.id')
      .where('admission_applications.tenant_id', tenantId)
      .select(
        'admission_applications.application_number',
        'admission_applications.child_first_name',
        'admission_applications.child_last_name',
        'admission_applications.child_gender',
        'classes.name as class_name',
        'admission_applications.guardian_first_name',
        'admission_applications.guardian_last_name',
        'admission_applications.guardian_phone',
        'admission_applications.status',
        'admission_applications.created_at',
      )
      .orderBy('admission_applications.created_at', 'desc')
      .limit(10000);

    const formatted = rows.map((r: any) => ({
      applicant: [r.child_first_name, r.child_last_name].filter(Boolean).join(' '),
      guardian: [r.guardian_first_name, r.guardian_last_name].filter(Boolean).join(' '),
      ...r,
      created_at: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
    }));

    await sendExport(res, {
      format: req.query.format as string,
      tenantId,
      rows: formatted,
      columns: {
        'Application No': 'application_number',
        Applicant: 'applicant',
        Gender: 'child_gender',
        'Class Applied': 'class_name',
        Guardian: 'guardian',
        'Guardian Phone': 'guardian_phone',
        Status: 'status',
        Received: 'created_at',
      },
      filename: 'admissions_export',
      title: 'Admissions Export',
      sheetName: 'Admissions',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admissions
 * Submit an admission application
 */
router.post('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createdBy = req.auth?.userId ?? null;
    const year = new Date().getFullYear();
    const nextYear = year + 1;
    const academicYear = req.body.academic_year || `${year}/${nextYear}`;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    // Generate application ID according to tenant settings
    const applicationId = await generateNextId(db, tenantId, 'admission');

    const [inserted] = await db('admission_applications').insert({
      tenant_id: tenantId,
      application_number: applicationId,
      academic_year: academicYear,
      // Legacy columns (from old schema - required NOT NULL)
      first_name: req.body.child_first_name,
      last_name: req.body.child_last_name,
      date_of_birth: req.body.child_dob || null,
      gender: req.body.child_gender || null,
      // Child info (new columns)
      child_first_name: req.body.child_first_name,
      child_middle_name: req.body.child_middle_name || null,
      child_last_name: req.body.child_last_name,
      child_dob: req.body.child_dob,
      child_gender: req.body.child_gender,
      child_nationality: req.body.child_nationality || null,
      child_religion: req.body.child_religion || null,
      child_place_of_birth: req.body.child_place_of_birth || null,
      class_applying_for: req.body.class_applying_for || null,
      child_address: req.body.child_address || null,
      previous_school: req.body.previous_school || null,
      last_grade_attained: req.body.last_grade_attained || null,
      child_photo_url: req.body.child_photo_url || null,
      // Guardian info
      guardian_first_name: req.body.guardian_first_name,
      guardian_middle_name: req.body.guardian_middle_name || null,
      guardian_last_name: req.body.guardian_last_name,
      guardian_relationship: req.body.guardian_relationship,
      guardian_phone: req.body.guardian_phone,
      guardian_alt_phone: req.body.guardian_alt_phone || null,
      guardian_email: req.body.guardian_email || null,
      guardian_occupation: req.body.guardian_occupation || null,
      guardian_address: req.body.guardian_address || null,
      guardian_nationality: req.body.guardian_nationality || null,
      guardian_national_id: req.body.guardian_national_id || null,
      // Medical
      takes_medication: req.body.takes_medication || false,
      medication_details: req.body.medication_details || null,
      has_allergies: req.body.has_allergies || false,
      allergy_details: req.body.allergy_details || null,
      has_chronic_illness: req.body.has_chronic_illness || false,
      chronic_illness_details: req.body.chronic_illness_details || null,
      allow_first_aid: req.body.allow_first_aid !== false,
      // Emergency
      emergency_contact_name: req.body.emergency_contact_name || null,
      emergency_contact_relationship: req.body.emergency_contact_relationship || null,
      emergency_contact_phone: req.body.emergency_contact_phone || null,
      // Documents
      // documents_submitted and date_received handled separately if columns exist
      // Status: auto-approved on creation
      status: 'approved',
      decided_by: createdBy,
      decided_at: new Date(),
      created_by: createdBy,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    // Auto-create a student record from the approved application
    try {
      const studentId = await generateNextId(db, tenantId, 'student');

      const [newStudent] = await db('students').insert({
        tenant_id: tenantId,
        user_id: null,
        student_id: studentId,
        first_name: inserted.child_first_name || inserted.first_name,
        last_name: inserted.child_last_name || inserted.last_name,
        email: inserted.guardian_email || null,
        date_of_birth: inserted.child_dob || inserted.date_of_birth || null,
        gender: inserted.child_gender || inserted.gender || null,
        phone: inserted.guardian_phone || null,
        address: inserted.child_address || inserted.address || null,
        city: null,
        country: inserted.child_nationality || 'Sierra Leone',
        enrollment_date: new Date().toISOString().split('T')[0],
        photo_url: inserted.child_photo_url || null,
        religion: inserted.child_religion || null,
        nationality: inserted.child_nationality || null,
        place_of_birth: inserted.child_place_of_birth || null,
        guardian_name: [inserted.guardian_first_name, inserted.guardian_last_name].filter(Boolean).join(' ') || null,
        guardian_phone: inserted.guardian_phone || null,
        guardian_relationship: inserted.guardian_relationship || null,
        guardian_occupation: inserted.guardian_occupation || null,
        emergency_contact: inserted.emergency_contact_phone || null,
        previous_school: inserted.previous_school || null,
        medical_conditions: [inserted.medication_details, inserted.allergy_details, inserted.chronic_illness_details].filter(Boolean).join('; ') || null,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*');

      // Enroll in the class they applied for
      if (inserted.class_applying_for && newStudent?.id) {
        await db('enrollments').insert({
          student_id: newStudent.id,
          class_id: inserted.class_applying_for,
          enrollment_date: new Date().toISOString().split('T')[0],
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }).catch(() => {});
      }

      // Smart parent/guardian linking — reuse an existing parent (sibling) if one matches.
      if (newStudent?.id) {
        await linkGuardianForStudent(
          db,
          tenantId,
          newStudent.id,
          inserted.child_last_name || inserted.last_name || '',
          {
            guardian_name: [inserted.guardian_first_name, inserted.guardian_last_name].filter(Boolean).join(' ') || null,
            guardian_email: inserted.guardian_email || null,
            guardian_phone: inserted.guardian_phone || null,
            guardian_relationship: inserted.guardian_relationship || null,
            guardian_occupation: inserted.guardian_occupation || null,
          },
          createdBy,
        );
      }

      // Provision login accounts up-front: student signs in with their ID
      // number (username) + demo password; parent uses their application email.
      if (newStudent?.id) {
        try {
          const { provisionStudentAccounts } = await import('../utils/studentAccounts.js');
          await provisionStudentAccounts(db, tenantId, {
            student_id: newStudent.id,
            reg_id: studentId,
            email: newStudent.email,
            first_name: newStudent.first_name,
            last_name: newStudent.last_name,
            guardian_name: [inserted.guardian_first_name, inserted.guardian_last_name].filter(Boolean).join(' ') || null,
            guardian_email: inserted.guardian_email || null,
            guardian_phone: inserted.guardian_phone || null,
          });
        } catch (accErr) {
          logger.warn(`Account provisioning failed for admission student ${studentId}: ${(accErr as any)?.message || accErr}`);
        }
      }

      // Mark application as enrolled
      await db('admission_applications').where('id', inserted.id).update({ status: 'enrolled' });
      inserted.status = 'enrolled';

      logger.info(`Student ${studentId} created from new admission ${applicationId}`);
    } catch (enrollErr) {
      logger.error(`Failed to auto-create student from admission: ${enrollErr}`);
      // Don't fail the admission creation — it's still approved
    }

    res.status(201).json({ message: 'Application submitted and student enrolled successfully', data: inserted });
    logger.info(`Admission application created: ${applicationId}`);
  } catch (error) {
    next(error);
  }
});


/**
 * GET /api/v1/admissions
 * List all admission applications
 */
router.get('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const { status, academic_year, search } = req.query;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    let query = db('admission_applications')
      .where('admission_applications.tenant_id', tenantId)
      .select('admission_applications.*', 'classes.name as class_name')
      .leftJoin('classes', 'admission_applications.class_applying_for', 'classes.id');

    if (status) query = query.where('admission_applications.status', status as string);
    if (academic_year) query = query.where('admission_applications.academic_year', academic_year as string);
    if (search) {
      const term = `%${(search as string).trim()}%`;
      query = query.where(function () {
        this.where('admission_applications.child_first_name', 'ilike', term)
          .orWhere('admission_applications.child_last_name', 'ilike', term)
          .orWhere('admission_applications.application_number', 'ilike', term)
          .orWhere('admission_applications.guardian_phone', 'ilike', term);
      });
    }

    let countQuery = db('admission_applications')
      .where('admission_applications.tenant_id', tenantId)
      .count('admission_applications.id as count');
    if (status) countQuery = countQuery.where('admission_applications.status', status as string);
    if (academic_year) countQuery = countQuery.where('admission_applications.academic_year', academic_year as string);

    const totalResult = await countQuery.first();
    const total = Number(totalResult?.count ?? 0);
    const applications = await query.limit(limit).offset(offset).orderBy('admission_applications.created_at', 'desc');

    res.json({ data: applications, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admissions/:id
 */
router.get('/:appId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const app = await db('admission_applications')
      .select('admission_applications.*', 'classes.name as class_name')
      .leftJoin('classes', 'admission_applications.class_applying_for', 'classes.id')
      .where('admission_applications.tenant_id', tenantId)
      .andWhere(function() {
        this.where('admission_applications.id', appId)
          .orWhere('admission_applications.application_number', appId);
      })
      .first();
    if (!app) throw new AppError('Application not found', 404, 'NOT_FOUND');

    res.json(app);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/admissions/:id/status
 * Update application status (approve, reject, schedule interview)
 */
router.put('/:appId/status', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appId } = req.params;
    const { status, interview_date, assessment_score, decision_notes } = req.body;
    const decidedBy = req.auth?.userId ?? null;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const app = await db('admission_applications')
      .where('admission_applications.id', appId)
      .where('admission_applications.tenant_id', tenantId)
      .select('admission_applications.*')
      .first();
    if (!app) throw new AppError('Application not found', 404, 'NOT_FOUND');

    if (status === 'approved' && app.status === 'enrolled') {
      throw new AppError('Application is already enrolled', 409, 'ALREADY_ENROLLED');
    }
    const newlyAccepted = status === 'approved' && app.status !== 'approved' && app.status !== 'enrolled';

    const updateData: any = { status, updated_at: new Date() };
    if (interview_date) updateData.interview_date = interview_date;
    if (assessment_score !== undefined) updateData.assessment_score = assessment_score;
    if (decision_notes) updateData.decision_notes = decision_notes;
    if (['approved', 'rejected'].includes(status)) {
      updateData.decided_by = decidedBy;
      updateData.decided_at = new Date();
    }

    // Claim this transition once so simultaneous approvals cannot enroll twice
    // or send duplicate acceptance messages.
    const changed = await db('admission_applications')
      .where({ id: appId, tenant_id: tenantId, status: app.status })
      .update(updateData);
    if (!changed) throw new AppError('Application was changed by another user; refresh and try again', 409, 'STATUS_CONFLICT');

    // If approved, automatically create a student record and enroll
    if (status === 'approved' && app.status !== 'enrolled') {
      try {
        const studentId = await generateNextId(db, tenantId, 'student');

        // Create student from application data
        const [newStudent] = await db('students').insert({
          tenant_id: tenantId,
          user_id: null,
          student_id: studentId,
          first_name: app.child_first_name || app.first_name,
          last_name: app.child_last_name || app.last_name,
          email: app.guardian_email || null,
          date_of_birth: app.child_dob || app.date_of_birth || null,
          gender: app.child_gender || app.gender || null,
          phone: app.guardian_phone || null,
          address: app.child_address || app.address || null,
          city: null,
          country: app.child_nationality || 'Sierra Leone',
          enrollment_date: new Date().toISOString().split('T')[0],
          photo_url: app.child_photo_url || null,
          religion: app.child_religion || null,
          nationality: app.child_nationality || null,
          place_of_birth: app.child_place_of_birth || null,
          guardian_name: [app.guardian_first_name, app.guardian_last_name].filter(Boolean).join(' ') || app.parent_name || null,
          guardian_phone: app.guardian_phone || app.parent_phone || null,
          guardian_relationship: app.guardian_relationship || null,
          guardian_occupation: app.guardian_occupation || null,
          emergency_contact: app.emergency_contact_phone || null,
          previous_school: app.previous_school || null,
          medical_conditions: [app.medication_details, app.allergy_details, app.chronic_illness_details].filter(Boolean).join('; ') || null,
          status: 'active',
          created_at: new Date(),
          updated_at: new Date(),
        }).returning('*');

        // Enroll in the class they applied for
        if (app.class_applying_for && newStudent?.id) {
          await db('enrollments').insert({
            student_id: newStudent.id,
            class_id: app.class_applying_for,
            enrollment_date: new Date().toISOString().split('T')[0],
            status: 'active',
            created_at: new Date(),
            updated_at: new Date(),
          }).catch(() => {});
        }

        // Smart parent/guardian linking — reuse an existing parent (sibling) if one matches.
        if (newStudent?.id) {
          await linkGuardianForStudent(
            db,
            tenantId,
            newStudent.id,
            app.child_last_name || app.last_name || '',
            {
              guardian_name: [app.guardian_first_name, app.guardian_last_name].filter(Boolean).join(' ') || app.parent_name || null,
              guardian_email: app.guardian_email || null,
              guardian_phone: app.guardian_phone || app.parent_phone || null,
              guardian_relationship: app.guardian_relationship || null,
              guardian_occupation: app.guardian_occupation || null,
            },
            decidedBy,
          );
        }

        // Provision login accounts up-front: student signs in with their ID
        // number (username) + demo password; parent uses their application email.
        if (newStudent?.id) {
          try {
            const { provisionStudentAccounts } = await import('../utils/studentAccounts.js');
            await provisionStudentAccounts(db, tenantId, {
              student_id: newStudent.id,
              reg_id: studentId,
              email: newStudent.email,
              first_name: newStudent.first_name,
              last_name: newStudent.last_name,
              guardian_name: [app.guardian_first_name, app.guardian_last_name].filter(Boolean).join(' ') || app.parent_name || null,
              guardian_email: app.guardian_email || null,
              guardian_phone: app.guardian_phone || app.parent_phone || null,
            });
          } catch (accErr) {
            logger.warn(`Account provisioning failed for admission student ${studentId}: ${(accErr as any)?.message || accErr}`);
          }
        }

        // Update application status to 'enrolled'
        await db('admission_applications').where('id', appId).update({ status: 'enrolled' });

        logger.info(`Student ${studentId} created from approved admission ${app.application_number}`);
      } catch (enrollErr) {
        logger.error(`Failed to create student from admission: ${enrollErr}`);
        // Don't fail the status update — application is still approved
      }
    }

    const updated = await db('admission_applications').where('id', appId).first();

    // Notify the guardian by email for every meaningful decision — accepted,
    // rejected, or waitlisted — not just acceptances. Only fire when the status
    // actually transitions to a decision state (guards against re-sends on
    // repeated saves of the same status).
    const DECISION_EMAILS: Record<string, string> = {
      approved: 'approved',
      rejected: 'rejected',
      waitlisted: 'waitlist',
      waitlist: 'waitlist',
    };
    const isNewDecision = status !== app.status && status in DECISION_EMAILS;

    let emailSent: boolean | null = null;
    if (isNewDecision) {
      const guardianEmail = app.guardian_email || app.parent_email;
      emailSent = false;
      if (guardianEmail) {
        try {
          const className = app.class_applying_for
            ? (await db('classes').where('id', app.class_applying_for).select('name').first())?.name
            : undefined;
          const result = await emailService.sendAdmissionDecisionEmail(tenantId, guardianEmail, {
            guardianName: [app.guardian_first_name, app.guardian_last_name].filter(Boolean).join(' ') || app.parent_name || 'Parent/Guardian',
            studentName: [app.child_first_name || app.first_name, app.child_last_name || app.last_name].filter(Boolean).join(' '),
            decision: DECISION_EMAILS[status],
            applicationNumber: app.application_number,
            className,
            notes: decision_notes,
            publicApplicant: app.application_source === 'online' && !app.created_by,
          });
          emailSent = result.status === 'sent';
        } catch (mailError) {
          logger.error(`Could not send admission ${status} email for ${app.application_number}: ${mailError}`);
        }
      }
    }

    res.json({ success: true, message: `Application ${status}`, data: { ...updated, email_sent: emailSent } });
    logger.info(`Admission ${appId} status changed to ${status}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/admissions/:id
 */
router.delete('/:appId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appId } = req.params;
    const tenantId = req.user?.tenant_id;

    if (!tenantId) {
      throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    }

    const app = await db('admission_applications')
      .where('admission_applications.id', appId)
      .where('admission_applications.tenant_id', tenantId)
      .select('admission_applications.*')
      .first();
    if (!app) throw new AppError('Application not found', 404, 'NOT_FOUND');
    await db('admission_applications').where('id', appId).del();
    res.json({ message: 'Application deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
