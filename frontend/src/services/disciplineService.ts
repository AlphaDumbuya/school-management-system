/**
 * Discipline & Conduct API Service
 * Phase 2.3 — wraps /api/v1/discipline endpoints
 */

import apiClient from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export type InfractionStatus = 'recorded' | 'acknowledged' | 'resolved' | 'appealed';
export type InfractionSeverity = 'minor' | 'moderate' | 'serious' | 'critical';
export type ActionType = 'warning' | 'detention' | 'suspension' | 'expulsion' | 'counseling';
export type ActionStatus = 'active' | 'completed' | 'appealed' | 'cancelled';
export type AppealStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'escalated';
export type NoteType = 'positive' | 'concern' | 'observation' | 'commendation';
export type DetentionStatus = 'scheduled' | 'attended' | 'absent' | 'incomplete' | 'rescheduled';
export type BehaviorTrend = 'improving' | 'stable' | 'declining';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface StudentInfraction {
  infraction_id: string;
  student_id: string;
  infraction_type_id: string;
  recorded_by: string;
  incident_date: string;
  incident_description?: string;
  incident_location?: string;
  status: InfractionStatus;
  severity_override?: number;
  notes?: string;
  parent_notified: boolean;
  parent_notification_date?: string;
  evidence_type?: string;
  evidence_urls?: string[];
  is_confidential: boolean;
  class_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  student_name?: string;
  infraction_type_name?: string;
  recorded_by_name?: string;
  severity_level?: InfractionSeverity;
}

export interface DisciplineAction {
  action_id: string;
  student_id: string;
  infraction_id: string;
  action_type: ActionType;
  action_subtype?: string;
  assigned_by: string;
  action_description?: string;
  action_date: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  status: ActionStatus;
  parent_notified: boolean;
  conditions?: string;
  requires_follow_up: boolean;
  follow_up_date?: string;
  notes?: string;
  created_at: string;
  // Joined fields
  student_name?: string;
  assigned_by_name?: string;
}

export interface DetentionRecord {
  detention_id: string;
  action_id: string;
  student_id: string;
  detention_type: string;
  scheduled_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  supervised_by?: string;
  status: DetentionStatus;
  attended_date?: string;
  supervisor_notes?: string;
  parent_notified: boolean;
  created_at: string;
  student_name?: string;
}

export interface DisciplineAppeal {
  appeal_id: string;
  action_id: string;
  student_id: string;
  submitted_by: string;
  submitted_by_type: string;
  appeal_reason?: string;
  status: AppealStatus;
  submitted_date: string;
  reviewed_by?: string;
  review_notes?: string;
  review_date?: string;
  appeal_decision?: string;
  decision_type?: string;
  created_at: string;
  student_name?: string;
  action_type?: ActionType;
}

export interface BehavioralNote {
  note_id: string;
  student_id: string;
  recorded_by: string;
  note_type: NoteType;
  content?: string;
  category?: string;
  rating?: number;
  class_id?: string;
  note_date: string;
  parent_notified: boolean;
  is_shared_with_student: boolean;
  is_confidential: boolean;
  created_at: string;
  student_name?: string;
  recorded_by_name?: string;
}

export type ReportPeriod = 'term' | 'semester' | 'year' | 'custom';

export interface ConductReport {
  report_id: string;
  student_id: string;
  generated_by?: string;
  report_period: ReportPeriod;
  period_start_date?: string;
  period_end_date?: string;
  total_infractions: number;
  total_points: number;
  behavioral_rating?: number;
  strengths?: string;
  areas_for_improvement?: string;
  teacher_comments?: string;
  overall_assessment?: string;
  parent_shared: boolean;
  parent_share_date?: string;
  parent_acknowledged: boolean;
  created_at: string;
  // Joined fields
  student_name?: string;
  generated_by_name?: string;
}

export interface StudentDisciplineStats {
  student_id: string;
  total_infractions: number;
  total_points: number;
  active_actions: number;
  pending_appeals: number;
  positive_notes: number;
  last_infraction_date?: string;
  behavior_trend: BehaviorTrend;
  risk_level: RiskLevel;
}

export interface DisciplineDashboardSummary {
  total_infractions: number;
  open_infractions: number;
  active_actions: number;
  pending_appeals: number;
  detentions_this_week: number;
  high_risk_students: number;
  infractions_by_severity: Record<string, number>;
  infractions_by_type?: Record<string, number>;
  recent_infractions?: StudentInfraction[];
  monthly_trend?: { month: string; count: number }[];
}

export interface InfractionTrend {
  date: string;
  count: number;
  severity?: string;
}

export interface HighRiskStudent {
  student_id: string;
  student_name: string;
  class_name?: string;
  risk_level: RiskLevel;
  total_infractions: number;
  total_points: number;
  behavior_trend: BehaviorTrend;
}

export interface RepeatOffender {
  student_id: string;
  student_name: string;
  class_name?: string;
  infraction_count: number;
  most_recent_date: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

// ── Infraction helpers ────────────────────────────────────────────────────────

export const SEVERITY_COLORS: Record<InfractionSeverity, string> = {
  minor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  moderate: 'bg-orange-100 text-orange-800 border-orange-200',
  serious: 'bg-red-100 text-red-800 border-red-200',
  critical: 'bg-red-200 text-red-900 border-red-300',
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  warning: 'Warning',
  detention: 'Detention',
  suspension: 'Suspension',
  expulsion: 'Expulsion',
  counseling: 'Counseling',
};

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: 'text-green-600 bg-green-50',
  medium: 'text-amber-600 bg-amber-50',
  high: 'text-orange-600 bg-orange-50',
  critical: 'text-red-700 bg-red-50',
};

// ── Service ───────────────────────────────────────────────────────────────────

export const disciplineService = {
  // Infractions
  listAllInfractions: (params?: { search?: string; status?: string; severity?: string; page?: number; limit?: number; academic_year?: string }) =>
    apiClient.get<PaginatedResult<StudentInfraction>>('/api/v1/discipline/infractions', { params }),

  recordInfraction: (data: Record<string, unknown>) =>
    apiClient.post('/api/v1/discipline/infractions', data),

  getStudentInfractions: (
    studentId: string,
    params?: { status?: string; severity?: string; date_from?: string; date_to?: string; page?: number; limit?: number }
  ) => apiClient.get<PaginatedResult<StudentInfraction>>(`/api/v1/discipline/infractions/${studentId}`, { params }),

  getInfraction: (studentId: string, infractionId: string) =>
    apiClient.get(`/api/v1/discipline/infractions/${studentId}/${infractionId}`),

  updateInfraction: (infractionId: string, data: Record<string, unknown>) =>
    apiClient.put(`/api/v1/discipline/infractions/${infractionId}`, data),

  acknowledgeInfraction: (infractionId: string) =>
    apiClient.post(`/api/v1/discipline/infractions/${infractionId}/acknowledge`, {}),

  resolveInfraction: (infractionId: string, resolution_notes: string) =>
    apiClient.post(`/api/v1/discipline/infractions/${infractionId}/resolve`, { resolution_notes }),

  getClassInfractions: (
    classId: string,
    params?: { status?: string; date_from?: string; date_to?: string; page?: number; limit?: number }
  ) => apiClient.get<PaginatedResult<StudentInfraction>>(`/api/v1/discipline/classes/${classId}/infractions`, { params }),

  getRepeatOffenders: (params?: { class_id?: string; limit?: number }) =>
    apiClient.get<{ repeat_offenders: RepeatOffender[] }>('/api/v1/discipline/repeat-offenders', { params }),

  // Actions
  listAllActions: (params?: { search?: string; status?: string; action_type?: string; page?: number; limit?: number; academic_year?: string }) =>
    apiClient.get<PaginatedResult<DisciplineAction>>('/api/v1/discipline/actions', { params }),

  assignAction: (data: Record<string, unknown>) =>
    apiClient.post('/api/v1/discipline/actions', data),

  getStudentActions: (
    studentId: string,
    params?: { status?: string; action_type?: string; page?: number; limit?: number }
  ) => apiClient.get<PaginatedResult<DisciplineAction>>(`/api/v1/discipline/actions/${studentId}`, { params }),

  updateActionStatus: (actionId: string, data: { status: string; notes?: string }) =>
    apiClient.put(`/api/v1/discipline/actions/${actionId}/status`, data),

  cancelAction: (actionId: string, reason: string) =>
    apiClient.post(`/api/v1/discipline/actions/${actionId}/cancel`, { reason }),

  // Detentions
  scheduleDetention: (data: Record<string, unknown>) =>
    apiClient.post('/api/v1/discipline/detentions', data),

  getStudentDetentions: (
    studentId: string,
    params?: { status?: string; date_from?: string; date_to?: string; page?: number; limit?: number }
  ) => apiClient.get<PaginatedResult<DetentionRecord>>(`/api/v1/discipline/detentions/${studentId}`, { params }),

  markDetentionAttended: (detentionId: string, supervisor_notes?: string) =>
    apiClient.post(`/api/v1/discipline/detentions/${detentionId}/attend`, { supervisor_notes }),

  markDetentionAbsent: (detentionId: string, reason?: string) =>
    apiClient.post(`/api/v1/discipline/detentions/${detentionId}/absent`, { reason }),

  rescheduleDetention: (detentionId: string, data: { new_date: string; reason?: string }) =>
    apiClient.post(`/api/v1/discipline/detentions/${detentionId}/reschedule`, data),

  getDetentionCalendar: (params: { start_date: string; end_date: string; location?: string }) =>
    apiClient.get('/api/v1/discipline/detention-calendar', { params }),

  // Appeals
  listAllAppeals: (params?: { search?: string; status?: string; page?: number; limit?: number; academic_year?: string }) =>
    apiClient.get<PaginatedResult<DisciplineAppeal>>('/api/v1/discipline/appeals', { params }),

  submitAppeal: (data: Record<string, unknown>) =>
    apiClient.post('/api/v1/discipline/appeals', data),

  getStudentAppeals: (
    studentId: string,
    params?: { status?: string; page?: number; limit?: number }
  ) => apiClient.get<PaginatedResult<DisciplineAppeal>>(`/api/v1/discipline/appeals/${studentId}`, { params }),

  reviewAppeal: (appealId: string) =>
    apiClient.post(`/api/v1/discipline/appeals/${appealId}/review`, {}),

  approveAppeal: (appealId: string, data: { decision_notes?: string; modified_action?: string }) =>
    apiClient.post(`/api/v1/discipline/appeals/${appealId}/approve`, data),

  rejectAppeal: (appealId: string, decision_notes?: string) =>
    apiClient.post(`/api/v1/discipline/appeals/${appealId}/reject`, { decision_notes }),

  escalateAppeal: (appealId: string, reason?: string) =>
    apiClient.post(`/api/v1/discipline/appeals/${appealId}/escalate`, { reason }),

  getPendingAppeals: (params?: { limit?: number }) =>
    apiClient.get<{ pending_appeals: DisciplineAppeal[] }>('/api/v1/discipline/appeals/pending', { params }),

  // Behavioral Notes
  listAllNotes: (params?: { search?: string; note_type?: string; page?: number; limit?: number; academic_year?: string }) =>
    apiClient.get<PaginatedResult<BehavioralNote>>('/api/v1/discipline/notes', { params }),

  createNote: (data: Record<string, unknown>) =>
    apiClient.post('/api/v1/discipline/notes', data),

  getStudentNotes: (
    studentId: string,
    params?: { note_type?: string; page?: number; limit?: number }
  ) => apiClient.get<PaginatedResult<BehavioralNote>>(`/api/v1/discipline/notes/${studentId}`, { params }),

  getNoteSummary: (studentId: string) =>
    apiClient.get(`/api/v1/discipline/notes/summary/${studentId}`),

  updateNote: (noteId: string, data: Record<string, unknown>) =>
    apiClient.put(`/api/v1/discipline/notes/${noteId}`, data),

  deleteNote: (noteId: string) =>
    apiClient.delete(`/api/v1/discipline/notes/${noteId}`),

  shareNote: (noteId: string) =>
    apiClient.post(`/api/v1/discipline/notes/${noteId}/share`, {}),

  // Conduct Reports
  listAllReports: (params?: { search?: string; report_period?: string; shared?: string; page?: number; limit?: number; academic_year?: string }) =>
    apiClient.get<PaginatedResult<ConductReport>>('/api/v1/discipline/reports', { params }),

  generateReport: (data: {
    student_id: string;
    report_period: string;
    start_date?: string;
    end_date?: string;
  }) => apiClient.post('/api/v1/discipline/reports/generate', data),

  getStudentReports: (studentId: string) =>
    apiClient.get(`/api/v1/discipline/reports/${studentId}`),

  shareReport: (reportId: string) =>
    apiClient.post(`/api/v1/discipline/reports/${reportId}/share`, {}),

  acknowledgeReport: (reportId: string) =>
    apiClient.post(`/api/v1/discipline/reports/${reportId}/acknowledge`, {}),

  // Analytics
  getDashboardSummary: () =>
    apiClient.get<DisciplineDashboardSummary>('/api/v1/discipline/analytics/dashboard'),

  getInfractionTrends: (params?: { days?: number }) =>
    apiClient.get<{ trends: InfractionTrend[] }>('/api/v1/discipline/analytics/trends', { params }),

  getHighRiskStudents: (params?: { limit?: number }) =>
    apiClient.get<{ high_risk_students: HighRiskStudent[] }>('/api/v1/discipline/analytics/high-risk', { params }),

  getComprehensiveReport: () =>
    apiClient.get('/api/v1/discipline/analytics/report'),

  // Statistics
  getStudentStats: (studentId: string) =>
    apiClient.get<StudentDisciplineStats>(`/api/v1/discipline/statistics/student/${studentId}`),

  getClassStats: (classId: string) =>
    apiClient.get(`/api/v1/discipline/statistics/class/${classId}`),
};

export default disciplineService;
