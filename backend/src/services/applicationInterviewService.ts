/**
 * Application Interview Service
 * Handles interview scheduling and management
 */

import { db } from '../utils/database';
import {
  ApplicationInterview,
  InterviewStatus,
  ScheduleInterviewDTO,
  UpdateInterviewDTO
} from '../types/admission';
import { v4 as uuidv4 } from 'uuid';

/**
 * Schedule an interview
 */
export async function scheduleInterview(
  applicationId: string,
  data: ScheduleInterviewDTO,
  userId?: string
): Promise<ApplicationInterview> {
  const interviewData = {
    id: uuidv4(),
    application_id: applicationId,
    interview_date: new Date(data.interview_date),
    interview_time: data.interview_time,
    interview_location: data.interview_location,
    interview_mode: data.interview_mode,
    interview_link: data.interview_link,
    interviewer_id: data.interviewer_id,
    status: InterviewStatus.SCHEDULED,
    created_by: userId
  };
  
  const [interview] = await db('application_interviews')
    .insert(interviewData)
    .returning('*');
  
  return interview;
}

/**
 * Get interview by ID. When `tenantId` is supplied the interview is scoped to
 * that tenant via its parent application (admission_applications.tenant_id).
 */
export async function getInterviewById(id: string, tenantId?: string): Promise<ApplicationInterview | null> {
  const query = db('application_interviews').where({ 'application_interviews.id': id });
  if (tenantId) {
    query
      .join('admission_applications', 'application_interviews.application_id', 'admission_applications.id')
      .where('admission_applications.tenant_id', tenantId)
      .select('application_interviews.*');
  }
  const interview = await query.first();
  return interview || null;
}

/**
 * Get interviews for an application
 */
export async function getApplicationInterviews(applicationId: string): Promise<ApplicationInterview[]> {
  return await db('application_interviews')
    .where({ application_id: applicationId })
    .orderBy('interview_date', 'desc');
}

/**
 * Update interview details
 */
export async function updateInterview(
  id: string,
  data: UpdateInterviewDTO,
  tenantId?: string,
): Promise<ApplicationInterview | null> {
  // Tenant guard: ensure the interview belongs to this tenant before updating.
  if (tenantId) {
    const owned = await getInterviewById(id, tenantId);
    if (!owned) return null;
  }
  const updateData: any = {
    ...data,
    updated_at: new Date()
  };
  
  // If marking as completed, set completed_at
  if (data.status === InterviewStatus.COMPLETED) {
    updateData.completed_at = new Date();
  }
  
  const [interview] = await db('application_interviews')
    .where({ id })
    .update(updateData)
    .returning('*');
  
  return interview || null;
}

/**
 * Reschedule an interview
 */
export async function rescheduleInterview(
  id: string,
  newDate: string,
  newTime?: string,
  userId?: string
): Promise<ApplicationInterview | null> {
  const [interview] = await db('application_interviews')
    .where({ id })
    .update({
      interview_date: new Date(newDate),
      interview_time: newTime,
      status: InterviewStatus.RESCHEDULED,
      updated_at: new Date()
    })
    .returning('*');
  
  return interview || null;
}

/**
 * Cancel an interview
 */
export async function cancelInterview(id: string): Promise<ApplicationInterview | null> {
  const [interview] = await db('application_interviews')
    .where({ id })
    .update({
      status: InterviewStatus.CANCELLED,
      updated_at: new Date()
    })
    .returning('*');
  
  return interview || null;
}

/**
 * Get upcoming interviews for an interviewer
 */
export async function getInterviewerSchedule(
  interviewerId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<ApplicationInterview[]> {
  let query = db('application_interviews')
    .where({ interviewer_id: interviewerId })
    .whereIn('status', [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED]);
  
  if (dateFrom) {
    query = query.where('interview_date', '>=', dateFrom);
  }
  
  if (dateTo) {
    query = query.where('interview_date', '<=', dateTo);
  }
  
  return await query.orderBy('interview_date', 'asc');
}

export async function getUpcomingInterviews(days: number = 7, tenantId?: string): Promise<ApplicationInterview[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);
  
  let query = db('application_interviews')
    .where('application_interviews.interview_date', '>=', today)
    .where('application_interviews.interview_date', '<=', futureDate)
    .whereIn('application_interviews.status', [InterviewStatus.SCHEDULED, InterviewStatus.RESCHEDULED]);

  if (tenantId) {
    query = query
      .join('admission_applications', 'application_interviews.application_id', 'admission_applications.id')
      .join('users as creator', 'admission_applications.created_by', 'creator.id')
      .where('creator.tenant_id', tenantId)
      .select('application_interviews.*');
  }
  
  return await query.orderBy('application_interviews.interview_date', 'asc');
}

/**
 * Complete an interview with score and recommendation
 */
export async function completeInterview(
  id: string,
  score: number,
  recommendation: string,
  notes?: string
): Promise<ApplicationInterview | null> {
  const [interview] = await db('application_interviews')
    .where({ id })
    .update({
      interview_score: score,
      recommendation,
      interview_notes: notes,
      status: InterviewStatus.COMPLETED,
      completed_at: new Date(),
      updated_at: new Date()
    })
    .returning('*');
  
  return interview || null;
}

/**
 * Get interviews pending completion
 */
export async function getPendingInterviews(): Promise<ApplicationInterview[]> {
  const now = new Date();
  
  return await db('application_interviews')
    .where('interview_date', '<', now)
    .where('status', InterviewStatus.SCHEDULED)
    .orderBy('interview_date', 'asc');
}
