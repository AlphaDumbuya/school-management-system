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
 * POST /api/v1/admissions
 * Submit an admission application
 */
router.post('/', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.ADMISSIONS_OFFICER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const createdBy = req.auth?.userId ?? null;
    const year = new Date().getFullYear();
    const nextYear = year + 1;
    const academicYear = req.body.academic_year || `${year}/${nextYear}`;

    // Generate application ID using MAX to prevent duplicates
    const count = await db('admission_applications')
      .where('application_number', 'like', `ADM-${year}-%`)
      .max(db.raw("CAST(SPLIT_PART(application_number, '-', 3) AS INTEGER) as max_num"));
    const nextNum = (Number(count[0]?.max_num) || 0) + 1;
    const applicationId = `ADM-${year}-${String(nextNum).padStart(5, '0')}`;

    const [inserted] = await db('admission_applications').insert({
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
      // Status
      status: 'pending',
      created_by: createdBy,
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    res.status(201).json({ message: 'Application submitted successfully', data: inserted });
    logger.info(`Admission application created: ${applicationId}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admissions
 * List all admission applications
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const { status, academic_year, search } = req.query;

    let query = db('admission_applications')
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

    let countQuery = db('admission_applications').count('id as count');
    if (status) countQuery = countQuery.where('status', status as string);
    if (academic_year) countQuery = countQuery.where('academic_year', academic_year as string);

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
router.get('/:appId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const app = await db('admission_applications')
      .select('admission_applications.*', 'classes.name as class_name')
      .leftJoin('classes', 'admission_applications.class_applying_for', 'classes.id')
      .where('admission_applications.id', req.params.appId)
      .orWhere('admission_applications.application_number', req.params.appId)
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

    const app = await db('admission_applications').where('id', appId).first();
    if (!app) throw new AppError('Application not found', 404, 'NOT_FOUND');

    const updateData: any = { status, updated_at: new Date() };
    if (interview_date) updateData.interview_date = interview_date;
    if (assessment_score !== undefined) updateData.assessment_score = assessment_score;
    if (decision_notes) updateData.decision_notes = decision_notes;
    if (['approved', 'rejected'].includes(status)) {
      updateData.decided_by = decidedBy;
      updateData.decided_at = new Date();
    }

    await db('admission_applications').where('id', appId).update(updateData);
    const updated = await db('admission_applications').where('id', appId).first();

    res.json({ message: `Application ${status}`, data: updated });
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
    const app = await db('admission_applications').where('id', req.params.appId).first();
    if (!app) throw new AppError('Application not found', 404, 'NOT_FOUND');
    await db('admission_applications').where('id', req.params.appId).del();
    res.json({ message: 'Application deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
