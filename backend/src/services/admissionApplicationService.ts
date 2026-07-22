/**
 * Admission Application Service
 * Handles CRUD operations and workflow management for admission applications
 */

import { db } from '../utils/database';
import {
  AdmissionApplication,
  ApplicationStatus,
  CreateApplicationDTO,
  UpdateApplicationDTO,
  UpdateApplicationStatusDTO,
  ApplicationListQuery,
  ApplicationTimeline
} from '../types/admission';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generate unique application number
 */
async function generateApplicationNumber(tenantId?: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `APP${year}`;
  
  let query = db('admission_applications')
    .where('application_number', 'like', `${prefix}%`)
    .orderBy('application_number', 'desc');

  // Scope to tenant when available to avoid cross-tenant number collisions
  if (tenantId) {
    query = query.where('tenant_id', tenantId);
  }

  const lastApplication = await query.first();
  
  let sequence = 1;
  if (lastApplication) {
    const lastNumber = parseInt(lastApplication.application_number.replace(prefix, ''));
    sequence = isNaN(lastNumber) ? 1 : lastNumber + 1;
  }
  
  return `${prefix}${sequence.toString().padStart(5, '0')}`;
}

/**
 * Create timeline entry
 */
async function createTimelineEntry(
  applicationId: string,
  statusFrom: string | undefined,
  statusTo: string,
  notes: string | undefined,
  userId: string | undefined
): Promise<void> {
  await db('application_timeline').insert({
    id: uuidv4(),
    application_id: applicationId,
    status_from: statusFrom,
    status_to: statusTo,
    notes,
    changed_by: userId,
    changed_at: new Date()
  });
}

/**
 * Create a new admission application
 */
export async function createApplication(
  data: CreateApplicationDTO,
  userId?: string
): Promise<AdmissionApplication> {
  const tenantId = (data as any).tenant_id as string | undefined;
  const applicationNumber = await generateApplicationNumber(tenantId);
  
  const applicationData = {
    id: uuidv4(),
    application_number: applicationNumber,
    ...data,
    status: ApplicationStatus.SUBMITTED,
    application_date: new Date(),
    created_by: userId,
    updated_by: userId
  };
  
  const [application] = await db('admission_applications')
    .insert(applicationData)
    .returning('*');
  
  // Create timeline entry
  await createTimelineEntry(
    application.id,
    undefined,
    ApplicationStatus.SUBMITTED,
    'Application submitted',
    userId
  );
  
  return application;
}

/**
 * Get application by ID
 */
export async function getApplicationById(id: string, tenantId?: string): Promise<AdmissionApplication | null> {
  let query = db('admission_applications')
    .where('admission_applications.id', id);

  if (tenantId) {
    // Filter by the direct tenant_id column (more reliable than joining through users)
    query = query.where('admission_applications.tenant_id', tenantId);
  }

  const application = await query.select('admission_applications.*').first();
  return application || null;
}

/**
 * List applications with filters and pagination
 */
export async function listApplications(
  query: ApplicationListQuery,
  tenantId?: string
): Promise<{ applications: AdmissionApplication[]; total: number; page: number; limit: number }> {
  const { status, grade_id, assigned_to, date_from, date_to, search, page = 1, limit = 20 } = query;
  
  let queryBuilder = db('admission_applications').select('admission_applications.*');

  if (tenantId) {
    // Filter directly by the tenant_id column stored on the application row
    queryBuilder = queryBuilder.where('admission_applications.tenant_id', tenantId);
  }
  
  // Apply filters
  if (status) {
    queryBuilder = queryBuilder.where({ status });
  }
  
  if (grade_id) {
    queryBuilder = queryBuilder.where({ grade_id });
  }
  
  if (assigned_to) {
    queryBuilder = queryBuilder.where({ assigned_to });
  }
  
  if (date_from) {
    queryBuilder = queryBuilder.where('application_date', '>=', date_from);
  }
  
  if (date_to) {
    queryBuilder = queryBuilder.where('application_date', '<=', date_to);
  }
  
  if (search) {
    queryBuilder = queryBuilder.where(function() {
      this.where('first_name', 'ilike', `%${search}%`)
        .orWhere('last_name', 'ilike', `%${search}%`)
        .orWhere('email', 'ilike', `%${search}%`)
        .orWhere('application_number', 'ilike', `%${search}%`);
    });
  }
  
  // Get total count
  const [{ count }] = await queryBuilder.clone().count('admission_applications.id as count');
  const total = parseInt(count as string);
  
  // Apply pagination
  const offset = (page - 1) * limit;
  const applications = await queryBuilder
    .orderBy('application_date', 'desc')
    .limit(limit)
    .offset(offset);
  
  return {
    applications,
    total,
    page,
    limit
  };
}

/**
 * Update application details
 */
export async function updateApplication(
  id: string,
  data: UpdateApplicationDTO,
  userId?: string,
  tenantId?: string
): Promise<AdmissionApplication | null> {
  if (tenantId) {
    const check = await getApplicationById(id, tenantId);
    if (!check) return null;
  }

  const [application] = await db('admission_applications')
    .where({ id })
    .update({
      ...data,
      updated_by: userId,
      updated_at: new Date()
    })
    .returning('*');
  
  return application || null;
}

/**
 * Update application status
 */
export async function updateApplicationStatus(
  id: string,
  data: UpdateApplicationStatusDTO,
  userId?: string,
  tenantId?: string
): Promise<AdmissionApplication | null> {
  // Get current status
  const current = await getApplicationById(id, tenantId);
  if (!current) {
    return null;
  }
  
  const updateData: any = {
    status: data.status,
    updated_by: userId,
    updated_at: new Date()
  };
  
  // If accepting or rejecting, add decision date and notes
  if (data.status === ApplicationStatus.ACCEPTED || 
      data.status === ApplicationStatus.REJECTED ||
      data.status === ApplicationStatus.WAITLIST) {
    updateData.decision_date = new Date();
    if (data.decision_notes) {
      updateData.decision_notes = data.decision_notes;
    }
  }
  
  const [application] = await db('admission_applications')
    .where({ id })
    .update(updateData)
    .returning('*');
  
  // Create timeline entry
  if (application) {
    await createTimelineEntry(
      application.id,
      current.status,
      data.status,
      data.decision_notes,
      userId
    );

    // Auto-create/sync student record if approved or enrolled
    const autoCreateStatuses = ['accepted', 'approved', 'enrolled', ApplicationStatus.ACCEPTED, ApplicationStatus.ENROLLED];
    if (autoCreateStatuses.includes(data.status)) {
      try {
        const app = application as any;
        const firstName = (app.child_first_name || app.first_name || '').trim();
        const lastName = (app.child_last_name || app.last_name || '').trim();
        // Always prefer the tenantId passed from the route handler (from req.user.tenant_id).
        // Fall back to app.tenant_id only as a safety net.
        const appTenantId = tenantId || app.tenant_id;

        if (firstName && lastName && appTenantId) {
          const existing = await db('students')
            .where('tenant_id', appTenantId)
            .where(function (this: any) {
              this.where(db.raw('LOWER(first_name) = ?', [firstName.toLowerCase()]))
                .andWhere(db.raw('LOWER(last_name) = ?', [lastName.toLowerCase()]));
            })
            .first();

          if (!existing) {
            const { generateNextId } = await import('../utils/idGenerator');
            const studentId = await generateNextId(db, appTenantId, 'student');
            const dob = app.child_dob || app.date_of_birth || null;
            const gender = app.child_gender || app.gender || null;
            const email = app.guardian_email || app.email || null;
            const phone = app.guardian_phone || app.phone_number || app.parent_phone || null;
            const address = app.child_address || app.address || null;
            const classId = app.class_applying_for || app.grade_id || null;

            const [newStudent] = await db('students').insert({
              tenant_id: appTenantId,
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
              created_at: new Date(),
              updated_at: new Date(),
            }).returning('*');

            if (classId && newStudent?.id) {
              await db('enrollments').insert({
                student_id: newStudent.id,
                class_id: classId,
                enrollment_date: new Date().toISOString().split('T')[0],
                status: 'active',
                created_at: new Date(),
                updated_at: new Date(),
              }).catch(() => {});
            }
          }
        }
      } catch (syncErr) {
        console.error('Error auto-creating student from admission status update:', syncErr);
      }
    }
  }

  return application || null;
}

/**
 * Delete application
 */
export async function deleteApplication(id: string, tenantId?: string): Promise<boolean> {
  if (tenantId) {
    const check = await getApplicationById(id, tenantId);
    if (!check) return false;
  }

  const deleted = await db('admission_applications')
    .where({ id })
    .delete();
  
  return deleted > 0;
}

/**
 * Get application timeline
 */
export async function getApplicationTimeline(applicationId: string): Promise<ApplicationTimeline[]> {
  const timeline = await db('application_timeline')
    .where({ application_id: applicationId })
    .orderBy('changed_at', 'desc');
  
  return timeline;
}

/**
 * Assign application to user
 */
export async function assignApplication(
  applicationId: string,
  assignedTo: string,
  userId?: string
): Promise<AdmissionApplication | null> {
  const [application] = await db('admission_applications')
    .where({ id: applicationId })
    .update({
      assigned_to: assignedTo,
      updated_by: userId,
      updated_at: new Date()
    })
    .returning('*');
  
  if (application) {
    await createTimelineEntry(
      applicationId,
      undefined,
      application.status,
      `Application assigned to user ${assignedTo}`,
      userId
    );
  }
  
  return application || null;
}

/**
 * Get applications assigned to a specific user
 */
export async function getAssignedApplications(userId: string): Promise<AdmissionApplication[]> {
  return await db('admission_applications')
    .where({ assigned_to: userId })
    .orderBy('application_date', 'desc');
}
