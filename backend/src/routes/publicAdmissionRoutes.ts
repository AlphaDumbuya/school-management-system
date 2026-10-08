import { Router, Request, Response, NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import { db } from '@utils/database';
import { AppError } from '@middleware/errorHandler';
import { generateNextId } from '@utils/idGenerator';
import { logger } from '@utils/logger';
import emailService from '../services/emailService.js';
import { resolveActiveYear } from '@utils/academicYear';

const router = Router();
const submitLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });

const textFields = [
  'child_first_name', 'child_middle_name', 'child_last_name', 'child_nationality',
  'child_religion', 'child_place_of_birth', 'child_address', 'previous_school',
  'last_grade_attained', 'guardian_first_name', 'guardian_middle_name',
  'guardian_last_name', 'guardian_relationship', 'guardian_phone',
  'guardian_alt_phone', 'guardian_email', 'guardian_occupation', 'guardian_address',
  'guardian_nationality', 'guardian_national_id', 'medication_details',
  'allergy_details', 'chronic_illness_details', 'emergency_contact_name',
  'emergency_contact_relationship', 'emergency_contact_phone',
] as const;

async function findSchool(slug: string) {
  if (!/^[a-z0-9-]{1,100}$/i.test(slug)) return null;
  const tenant = await db('tenants').where({ slug, status: 'active' }).select('id', 'name', 'logo_url').first();
  if (!tenant) return null;
  // The principal-uploaded logo lives on the `schools` table (Settings writes
  // there). Prefer that; fall back to the tenant's logo, then the tenant name.
  const school = await db('schools')
    .where({ tenant_id: tenant.id })
    .select('name', 'logo_url')
    .first();
  return {
    id: tenant.id,
    name: school?.name || tenant.name,
    logo_url: school?.logo_url || tenant.logo_url || null,
  };
}

function schoolClasses(tenantId: string) {
  return db('classes')
    .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
    .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
    // Applicants apply into the CURRENT year's classes only (no past-year copies).
    .where(function () {
      this.where({ 'academic_sessions.tenant_id': tenantId, 'academic_sessions.is_active': true })
        .orWhere(function () {
          this.whereNull('classes.academic_session_id').andWhere('class_creator.tenant_id', tenantId);
        });
    })
    .where('classes.status', 'active')
    .select('classes.id', 'classes.name', 'classes.level')
    .orderBy('classes.name');
}

router.get('/:schoolSlug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const school = await findSchool(req.params.schoolSlug);
    if (!school) throw new AppError('School application page not found', 404, 'SCHOOL_NOT_FOUND');
    const classes = await schoolClasses(school.id);
    res.json({ success: true, data: { school: { name: school.name, logo_url: school.logo_url }, classes } });
  } catch (error) {
    next(error);
  }
});

router.post('/:schoolSlug', submitLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const school = await findSchool(req.params.schoolSlug);
    if (!school) throw new AppError('School application page not found', 404, 'SCHOOL_NOT_FOUND');
    const input = req.body ?? {};
    if (input.website) throw new AppError('Application could not be submitted', 400, 'INVALID_APPLICATION');
    const required = ['child_first_name', 'child_last_name', 'child_dob', 'child_gender', 'guardian_first_name', 'guardian_last_name', 'guardian_relationship', 'guardian_phone'];
    if (required.some((field) => typeof input[field] !== 'string' || !input[field].trim())
      || typeof input.guardian_email !== 'string' || !input.guardian_email.trim()) {
      throw new AppError('Please complete all required child and guardian fields', 400, 'MISSING_FIELDS');
    }
    if (textFields.some((field) => input[field] != null && (typeof input[field] !== 'string' || input[field].length > 500))) {
      throw new AppError('One or more fields are too long', 400, 'INVALID_FIELDS');
    }
    if (['child_first_name', 'child_last_name', 'guardian_first_name', 'guardian_last_name'].some((field) => input[field].trim().length > 100)
      || input.guardian_phone.trim().length > 20
      || (input.guardian_email && input.guardian_email.length > 255)) {
      throw new AppError('One or more fields are too long', 400, 'INVALID_FIELDS');
    }
    if (!['male', 'female'].includes(input.child_gender)) throw new AppError('Invalid sex', 400, 'INVALID_GENDER');
    const dob = new Date(input.child_dob);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.child_dob) || Number.isNaN(dob.getTime())
      || dob.toISOString().slice(0, 10) !== input.child_dob || dob > new Date()) {
      throw new AppError('Invalid date of birth', 400, 'INVALID_DOB');
    }
    if (input.guardian_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.guardian_email.trim())) {
      throw new AppError('Invalid guardian email', 400, 'INVALID_EMAIL');
    }
    const selectedClass = input.class_applying_for
      ? (await schoolClasses(school.id)).find((schoolClass) => schoolClass.id === input.class_applying_for)
      : null;
    if (input.class_applying_for && !selectedClass) {
      throw new AppError('Selected class is not available at this school', 400, 'INVALID_CLASS');
    }

    // Intake year = the school's ACTIVE academic year (not a calendar guess).
    const { yearString: intakeYear } = await resolveActiveYear(school.id);
    const now = new Date();
    const row: Record<string, unknown> = {
      tenant_id: school.id,
      academic_year: intakeYear,
      first_name: input.child_first_name.trim(),
      last_name: input.child_last_name.trim(),
      date_of_birth: input.child_dob,
      gender: input.child_gender,
      parent_name: `${input.guardian_first_name.trim()} ${input.guardian_last_name.trim()}`,
      parent_phone: input.guardian_phone.trim(),
      parent_email: input.guardian_email?.trim() || null,
      child_dob: input.child_dob,
      child_gender: input.child_gender,
      class_applying_for: input.class_applying_for || null,
      takes_medication: input.takes_medication === true,
      has_allergies: input.has_allergies === true,
      has_chronic_illness: input.has_chronic_illness === true,
      allow_first_aid: input.allow_first_aid !== false,
      status: 'pending',
      application_source: 'online',
      created_by: null,
      created_at: now,
      updated_at: now,
    };
    for (const field of textFields) row[field] = input[field]?.trim() || null;
    // The legacy and newer admissions schemas coexist in deployed databases.
    const columns = await db('admission_applications').columnInfo();
    const allowedRow = Object.fromEntries(Object.entries(row).filter(([key]) => key in columns));
    // The same child sent twice (double submit, or the family applying again
    // while the first is still open) returns the first application.
    const digits = (v: unknown) => String(v || '').replace(/\D/g, '').slice(-8);
    const open = await db('admission_applications').where({ tenant_id: school.id, academic_year: intakeYear })
      .whereNotIn('status', ['rejected', 'withdrawn'])
      .whereRaw('LOWER(TRIM(COALESCE(child_first_name, first_name))) = LOWER(?) AND LOWER(TRIM(COALESCE(child_last_name, last_name))) = LOWER(?)', [input.child_first_name.trim(), input.child_last_name.trim()])
      .whereRaw('COALESCE(child_dob, date_of_birth)::date = ?::date', [input.child_dob])
      .select('application_number', 'guardian_phone', 'parent_phone');
    const dup = open.find((o: any) => digits(o.guardian_phone || o.parent_phone) === digits(input.guardian_phone));
    if (dup) {
      res.status(200).json({ success: true, data: { application_number: dup.application_number, email_sent: false, duplicate: true } });
      return;
    }
    let createdId: string | null = null;
    const applicationNumber = await db.transaction(async (trx) => {
      // The ID generator scans existing numbers; serialize public submissions.
      await trx.raw('SELECT pg_advisory_xact_lock(?)', [62106125]);
      const nextId = await generateNextId(trx, school.id, 'admission');
      const [created] = await trx('admission_applications')
        .insert({ ...allowedRow, application_number: nextId, ...(columns.application_id ? { application_id: nextId } : {}) })
        .returning(['id', 'application_number']);
      createdId = created.id;
      return created.application_number;
    });
    // Timeline + tell the admissions team (best-effort).
    if (createdId) {
      await db('admission_application_events').insert({ tenant_id: school.id, application_id: createdId, kind: 'created', to_status: 'pending', note: 'Applied online' }).catch(() => null);
      const { notifyAdmissionsStaff } = await import('../services/admissions/admissionPipelineService.js');
      await notifyAdmissionsStaff(school.id, {
        subject: 'New online application',
        message: `${input.child_first_name.trim()} ${input.child_last_name.trim()}${selectedClass?.name ? ` applied for ${selectedClass.name}` : ' applied'} (${applicationNumber}).`,
        url: '/students/admissions', sourceId: createdId,
      });
    }
    let emailSent = false;
    try {
      const result = await emailService.sendAdmissionSubmissionEmail(school.id, input.guardian_email.trim(), {
        guardianName: `${input.guardian_first_name.trim()} ${input.guardian_last_name.trim()}`,
        studentName: `${input.child_first_name.trim()} ${input.child_last_name.trim()}`,
        applicationNumber,
        className: selectedClass?.name,
      });
      emailSent = result.status === 'sent';
    } catch (mailError) {
      logger.error(`Could not send admission receipt for ${applicationNumber}: ${mailError}`);
    }
    res.status(201).json({ success: true, data: { application_number: applicationNumber, email_sent: emailSent } });
  } catch (error) {
    next(error);
  }
});

export default router;
