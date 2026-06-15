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
  academicYear?: string
): Promise<AdmissionStatistics> {
  let baseQuery = db('admission_applications');
  
  if (academicYear) {
    baseQuery = baseQuery.where({ academic_year: academicYear });
  }
  
  // Total applications
  const [{ count: totalApplications }] = await baseQuery.clone().count('* as count');
  
  // By status
  const statusCounts = await baseQuery.clone()
    .select('status')
    .count('* as count')
    .groupBy('status');
  
  const byStatus: Record<string, number> = {};
  statusCounts.forEach((row: any) => {
    byStatus[row.status] = parseInt(row.count);
  });
  
  // By source
  const sourceCounts = await baseQuery.clone()
    .select('application_source')
    .count('* as count')
    .whereNotNull('application_source')
    .groupBy('application_source');
  
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
    .avg('application_score as avg')
    .whereNotNull('application_score');
  
  // Interview statistics
  let interviewQuery = db('application_interviews');
  if (academicYear) {
    interviewQuery = interviewQuery
      .whereIn('application_id', baseQuery.clone().select('id'));
  }
  
  const [{ count: interviewsPending }] = await interviewQuery.clone()
    .where('status', InterviewStatus.SCHEDULED)
    .count('* as count');
  
  const [{ count: interviewsCompleted }] = await interviewQuery.clone()
    .where('status', InterviewStatus.COMPLETED)
    .count('* as count');
  
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
export async function getPipelineMetrics(): Promise<{
  stages: Array<{
    status: ApplicationStatus;
    count: number;
    percentage: number;
  }>;
}> {
  const [{ count: total }] = await db('admission_applications').count('* as count');
  const totalCount = parseInt(total as string);
  
  if (totalCount === 0) {
    return { stages: [] };
  }
  
  const statusCounts = await db('admission_applications')
    .select('status')
    .count('* as count')
    .groupBy('status');
  
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
export async function getApplicationTrends(months: number = 12): Promise<Array<{
  month: string;
  count: number;
}>> {
  const results = await db('admission_applications')
    .select(db.raw("TO_CHAR(application_date, 'YYYY-MM') as month"))
    .count('* as count')
    .where('application_date', '>=', db.raw(`NOW() - INTERVAL '${months} months'`))
    .groupBy(db.raw("TO_CHAR(application_date, 'YYYY-MM')"))
    .orderBy('month', 'asc');
  
  return results.map((row: any) => ({
    month: row.month,
    count: parseInt(row.count)
  }));
}

/**
 * Get top performing interviewers by average score
 */
export async function getInterviewerPerformance(): Promise<Array<{
  interviewer_id: string;
  interviewer_name: string;
  total_interviews: number;
  average_score: number;
}>> {
  const results = await db('application_interviews')
    .select('interviewer_id')
    .select(db.raw("CONCAT(users.first_name, ' ', users.last_name) as interviewer_name"))
    .count('* as total_interviews')
    .avg('interview_score as average_score')
    .leftJoin('users', 'application_interviews.interviewer_id', 'users.id')
    .whereNotNull('interviewer_id')
    .whereNotNull('interview_score')
    .groupBy('interviewer_id', 'users.first_name', 'users.last_name')
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
export async function getActionableApplications(): Promise<{
  pendingReview: number;
  missingDocuments: number;
  pendingInterviews: number;
  pendingDecisions: number;
}> {
  const [{ count: pendingReview }] = await db('admission_applications')
    .where('status', ApplicationStatus.SUBMITTED)
    .count('* as count');
  
  const [{ count: pendingInterviews }] = await db('admission_applications')
    .where('status', ApplicationStatus.INTERVIEW_SCHEDULED)
    .count('* as count');
  
  const [{ count: pendingDecisions }] = await db('admission_applications')
    .where('status', ApplicationStatus.INTERVIEWED)
    .count('* as count');
  
  // Applications with unverified documents
  const [{ count: missingDocuments }] = await db('admission_applications')
    .whereIn('id', 
      db('application_documents')
        .select('application_id')
        .where('verification_status', 'pending')
    )
    .count('* as count');
  
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
export async function getConversionBySource(): Promise<Array<{
  source: ApplicationSource;
  total: number;
  accepted: number;
  conversion_rate: number;
}>> {
  const results = await db('admission_applications')
    .select('application_source as source')
    .count('* as total')
    .sum(
      db.raw("CASE WHEN status = 'accepted' THEN 1 ELSE 0 END as accepted")
    )
    .whereNotNull('application_source')
    .groupBy('application_source');
  
  return results.map((row: any) => {
    const total = parseInt(row.total);
    const accepted = parseInt(row.accepted);
    return {
      source: row.source,
      total,
      accepted,
      conversion_rate: total > 0 ? (accepted / total) * 100 : 0
    };
  });
}
