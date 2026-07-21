/**
 * Admission Statistics Service
 * Provides analytics and reporting for admissions
 */

import { db } from '../utils/database';
import {
  AdmissionStatistics,
  ApplicationStatus,
  ApplicationSource,
  InterviewStatus
} from '../types/admission';

/**
 * Get comprehensive admission statistics
 */
export async function getAdmissionStatistics(
  academicYear?: string,
  tenantId?: string
): Promise<AdmissionStatistics> {
  let baseQuery = db('admission_applications');
  
  if (tenantId) {
    baseQuery = baseQuery
      .join('users as creator', 'admission_applications.created_by', 'creator.id')
      .where('creator.tenant_id', tenantId);
  }
  
  if (academicYear) {
    baseQuery = baseQuery.where({ 'admission_applications.academic_year': academicYear });
  }
  
  // Total applications
  const [{ count: totalApplications }] = await baseQuery.clone().count('admission_applications.id as count');
  
  // By status
  const statusCounts = await baseQuery.clone()
    .select('admission_applications.status')
    .count('admission_applications.id as count')
    .groupBy('admission_applications.status');
  
  const byStatus: Record<string, number> = {};
  statusCounts.forEach((row: any) => {
    byStatus[row.status] = parseInt(row.count);
  });
  
  // By source
  const sourceCounts = await baseQuery.clone()
    .select('admission_applications.application_source')
    .count('admission_applications.id as count')
    .whereNotNull('admission_applications.application_source')
    .groupBy('admission_applications.application_source');
  
  const bySource: Record<string, number> = {};
  sourceCounts.forEach((row: any) => {
    bySource[row.application_source] = parseInt(row.count);
  });
  
  // By grade
  const gradeCounts = await baseQuery.clone()
    .select('classes.name as grade_name')
    .count('admission_applications.id as count')
    .leftJoin('classes', 'admission_applications.grade_id', 'classes.id')
    .whereNotNull('admission_applications.grade_id')
    .groupBy('classes.name');
  
  const byGrade = gradeCounts.map((row: any) => ({
    grade_name: row.grade_name,
    count: parseInt(row.count)
  }));
  
  // Average score
  const [{ avg: averageScore }] = await baseQuery.clone()
    .avg('admission_applications.application_score as avg')
    .whereNotNull('admission_applications.application_score');
  
  // Interview statistics
  let interviewQuery = db('application_interviews');
  if (tenantId) {
    interviewQuery = interviewQuery
      .join('admission_applications', 'application_interviews.application_id', 'admission_applications.id')
      .join('users as creator', 'admission_applications.created_by', 'creator.id')
      .where('creator.tenant_id', tenantId);
  }
  if (academicYear) {
    interviewQuery = interviewQuery
      .whereIn('application_interviews.application_id', baseQuery.clone().select('admission_applications.id'));
  }
  
  const [{ count: interviewsPending }] = await interviewQuery.clone()
    .where('application_interviews.status', InterviewStatus.SCHEDULED)
    .count('application_interviews.id as count');
  
  const [{ count: interviewsCompleted }] = await interviewQuery.clone()
    .where('application_interviews.status', InterviewStatus.COMPLETED)
    .count('application_interviews.id as count');
  
  // Acceptance rate
  const acceptedCount = byStatus[ApplicationStatus.ACCEPTED] || 0;
  const totalProcessed = (
    (byStatus[ApplicationStatus.ACCEPTED] || 0) +
    (byStatus[ApplicationStatus.REJECTED] || 0) +
    (byStatus[ApplicationStatus.WAITLIST] || 0)
  );
  
  const acceptanceRate = totalProcessed > 0 ? (acceptedCount / totalProcessed) * 100 : undefined;
  
  return {
    totalApplications: parseInt(totalApplications as string),
    byStatus: byStatus as Record<ApplicationStatus, number>,
    bySource: bySource as Record<ApplicationSource, number>,
    byGrade,
    averageScore: averageScore ? parseFloat(averageScore) : undefined,
    interviewsPending: parseInt(interviewsPending as string),
    interviewsCompleted: parseInt(interviewsCompleted as string),
    acceptanceRate
  };
}

/**
 * Get application pipeline metrics
 */
export async function getPipelineMetrics(tenantId?: string): Promise<{
  stages: Array<{
    status: ApplicationStatus;
    count: number;
    percentage: number;
  }>;
}> {
  let query = db('admission_applications');
  if (tenantId) {
    query = query
      .join('users as creator', 'admission_applications.created_by', 'creator.id')
      .where('creator.tenant_id', tenantId);
  }

  const [{ count: total }] = await query.clone().count('admission_applications.id as count');
  const totalCount = parseInt(total as string);
  
  if (totalCount === 0) {
    return { stages: [] };
  }
  
  const statusCounts = await query.clone()
    .select('admission_applications.status')
    .count('admission_applications.id as count')
    .groupBy('admission_applications.status');
  
  const stages = statusCounts.map((row: any) => ({
    status: row.status as ApplicationStatus,
    count: parseInt(row.count),
    percentage: (parseInt(row.count) / totalCount) * 100
  }));
  
  return { stages };
}

/**
 * Get applications by month for trend analysis
 */
export async function getApplicationTrends(months: number = 12, tenantId?: string): Promise<Array<{
  month: string;
  count: number;
}>> {
  let query = db('admission_applications');
  if (tenantId) {
    query = query
      .join('users as creator', 'admission_applications.created_by', 'creator.id')
      .where('creator.tenant_id', tenantId);
  }

  const results = await query
    .select(db.raw("TO_CHAR(admission_applications.application_date, 'YYYY-MM') as month"))
    .count('admission_applications.id as count')
    .where('admission_applications.application_date', '>=', db.raw(`NOW() - INTERVAL '${months} months'`))
    .groupBy(db.raw("TO_CHAR(admission_applications.application_date, 'YYYY-MM')"))
    .orderBy('month', 'asc');
  
  return results.map((row: any) => ({
    month: row.month,
    count: parseInt(row.count)
  }));
}

/**
 * Get top performing interviewers by average score
 */
export async function getInterviewerPerformance(tenantId?: string): Promise<Array<{
  interviewer_id: string;
  interviewer_name: string;
  total_interviews: number;
  average_score: number;
}>> {
  let query = db('application_interviews')
    .select('application_interviews.interviewer_id')
    .select(db.raw("CONCAT(users.first_name, ' ', users.last_name) as interviewer_name"))
    .count('application_interviews.id as total_interviews')
    .avg('application_interviews.interview_score as average_score')
    .leftJoin('users', 'application_interviews.interviewer_id', 'users.id')
    .whereNotNull('application_interviews.interviewer_id')
    .whereNotNull('application_interviews.interview_score');

  if (tenantId) {
    query = query
      .join('admission_applications', 'application_interviews.application_id', 'admission_applications.id')
      .join('users as creator', 'admission_applications.created_by', 'creator.id')
      .where('creator.tenant_id', tenantId);
  }

  const results = await query
    .groupBy('application_interviews.interviewer_id', 'users.first_name', 'users.last_name')
    .orderBy('average_score', 'desc');
  
  return results.map((row: any) => ({
    interviewer_id: row.interviewer_id,
    interviewer_name: row.interviewer_name,
    total_interviews: parseInt(row.total_interviews),
    average_score: parseFloat(row.average_score)
  }));
}

/**
 * Get applications requiring action
 */
export async function getActionableApplications(tenantId?: string): Promise<{
  pendingReview: number;
  missingDocuments: number;
  pendingInterviews: number;
  pendingDecisions: number;
}> {
  let baseQuery = db('admission_applications');
  if (tenantId) {
    baseQuery = baseQuery
      .join('users as creator', 'admission_applications.created_by', 'creator.id')
      .where('creator.tenant_id', tenantId);
  }

  const [{ count: pendingReview }] = await baseQuery.clone()
    .where('admission_applications.status', ApplicationStatus.SUBMITTED)
    .count('admission_applications.id as count');
  
  const [{ count: pendingInterviews }] = await baseQuery.clone()
    .where('admission_applications.status', ApplicationStatus.INTERVIEW_SCHEDULED)
    .count('admission_applications.id as count');
  
  const [{ count: pendingDecisions }] = await baseQuery.clone()
    .where('admission_applications.status', ApplicationStatus.INTERVIEWED)
    .count('admission_applications.id as count');
  
  // Applications with unverified documents
  const [{ count: missingDocuments }] = await baseQuery.clone()
    .whereIn('admission_applications.id', 
      db('application_documents')
        .select('application_id')
        .where('verification_status', 'pending')
    )
    .count('admission_applications.id as count');
  
  return {
    pendingReview: parseInt(pendingReview as string),
    missingDocuments: parseInt(missingDocuments as string),
    pendingInterviews: parseInt(pendingInterviews as string),
    pendingDecisions: parseInt(pendingDecisions as string)
  };
}

/**
 * Get conversion rate by source
 */
export async function getConversionBySource(tenantId?: string): Promise<Array<{
  source: ApplicationSource;
  total: number;
  accepted: number;
  conversion_rate: number;
}>> {
  let query = db('admission_applications');
  if (tenantId) {
    query = query
      .join('users as creator', 'admission_applications.created_by', 'creator.id')
      .where('creator.tenant_id', tenantId);
  }

  const results = await query
    .select('admission_applications.application_source as source')
    .count('admission_applications.id as total')
    .sum(
      db.raw("CASE WHEN admission_applications.status = 'accepted' THEN 1 ELSE 0 END as accepted")
    )
    .whereNotNull('admission_applications.application_source')
    .groupBy('admission_applications.application_source');
  
  return results.map((row: any) => {
    const total = parseInt(row.total);
    const accepted = parseInt(row.accepted || '0');
    return {
      source: row.source,
      total,
      accepted,
      conversion_rate: total > 0 ? (accepted / total) * 100 : 0
    };
  });
}
