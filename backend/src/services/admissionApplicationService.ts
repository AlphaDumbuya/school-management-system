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
async function generateApplicationNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `APP${year}`;
  
  const lastApplication = await db('admission_applications')
    .where('application_number', 'like', `${prefix}%`)
    .orderBy('application_number', 'desc')
    .first();
  
  let sequence = 1;
  if (lastApplication) {
    const lastNumber = parseInt(lastApplication.application_number.replace(prefix, ''));
    sequence = lastNumber + 1;
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
  const applicationNumber = await generateApplicationNumber();
  
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
    query = query
      .join('users', 'admission_applications.created_by', 'users.id')
      .where('users.tenant_id', tenantId)
      .select('admission_applications.*');
  }

  const application = await query.first();
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
  
  let queryBuilder = db('admission_applications');

  if (tenantId) {
    queryBuilder = queryBuilder
      .join('users', 'admission_applications.created_by', 'users.id')
      .where('users.tenant_id', tenantId)
      .select('admission_applications.*');
  } else {
    queryBuilder = queryBuilder.select('*');
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
