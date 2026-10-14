/**
 * Admissions API Service
 */

import { apiClient } from '@lib/apiClient';

export type AdmissionStatus = 'pending' | 'under_review' | 'interview_scheduled' | 'approved' | 'waitlist' | 'rejected' | 'withdrawn' | 'enrolled';

export interface AdmissionRecord {
  id: string;
  application_number: string;
  academic_year: string;
  child_first_name: string;
  child_middle_name?: string;
  child_last_name: string;
  child_dob: string;
  child_gender: string;
  child_nationality?: string;
  child_religion?: string;
  child_place_of_birth?: string;
  class_applying_for?: string;
  class_name?: string;
  child_address?: string;
  previous_school?: string;
  last_grade_attained?: string;
  child_photo_url?: string;
  /**
   * Read-only, from the list/detail API: the photo to display. The enrolled
   * student's current photo, else the one uploaded with the application.
   */
  photo_url?: string | null;
  guardian_first_name: string;
  guardian_middle_name?: string;
  guardian_last_name: string;
  guardian_relationship: string;
  guardian_phone: string;
  guardian_alt_phone?: string;
  guardian_email?: string;
  guardian_occupation?: string;
  guardian_address?: string;
  guardian_nationality?: string;
  guardian_religion?: string;
  guardian_national_id?: string;
  takes_medication: boolean;
  medication_details?: string;
  has_allergies: boolean;
  allergy_details?: string;
  has_chronic_illness: boolean;
  chronic_illness_details?: string;
  allow_first_aid: boolean;
  emergency_contact_name?: string;
  emergency_contact_relationship?: string;
  emergency_contact_phone?: string;
  documents_submitted?: string;
  status: AdmissionStatus;
  date_received?: string;
  interview_date?: string;
  interview_location?: string;
  assessment_score?: number;
  decision_notes?: string;
  created_at: string;
  email_sent?: boolean | null;
  application_source?: string;
  documents?: Record<string, boolean>;
  student_id?: string | null;
  student_number?: string | null;
  enrolled_class_id?: string | null;
  enrolled_class_name?: string | null;
  enrolled_at?: string | null;
  withdrawn_reason?: string | null;
  decided_by_name?: string | null;
}

export interface AdmissionEvent {
  id: string; kind: string; from_status?: string | null; to_status?: string | null;
  note?: string | null; by_name?: string | null; created_at: string;
}

/** One application with its timeline and what can happen next. */
export interface AdmissionDetail extends AdmissionRecord {
  events: AdmissionEvent[];
  duplicates: { applications: { id: string; application_number: string; status: string; academic_year: string }[]; students: { id: string; student_id: string; status: string }[] };
  allowed: AdmissionStatus[];
  can_enrol: boolean;
  class_is_current: boolean;
  documents_list: { key: string; label: string }[];
}

export interface AdmissionClass { id: string; name: string; level: string; section?: string | null; capacity: number | null; enrolled: number; full: boolean; billed_terms: string[] }

export interface AdmissionsMeta {
  statuses: AdmissionStatus[];
  transitions: Record<AdmissionStatus, AdmissionStatus[]>;
  labels: Record<AdmissionStatus, string>;
  documents: { key: string; label: string }[];
  active_year: string;
  classes: AdmissionClass[];
}

export interface EnrolResult {
  already: boolean;
  student: { id: string; student_id: string };
  class?: { id: string; name: string };
  /** Set when the school draws houses automatically on enrolment. */
  house?: { id: string; name: string; color: string; motto: string | null } | null;
  warnings?: string[];
  fees?: { billed: string[]; amount: number; not_billed: string[] };
  accounts: { student_username: string | null; student_password: string | null; parent_email: string | null; parent_password: string | null } | null;
  application: AdmissionDetail;
}

export interface ListAdmissionsParams {
  page?: number;
  limit?: number;
  status?: string;
  academic_year?: string;
  search?: string;
  class_id?: string;
  source?: 'online' | 'office';
}

export interface PublicAdmissionInfo {
  school: { name: string; logo_url: string | null };
  classes: { id: string; name: string; level: string }[];
  /** Cloudflare Turnstile site key when the school's server has it switched on. */
  captcha_site_key?: string | null;
}

export const ADMISSION_STATUSES: { value: AdmissionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'approved', label: 'Approved' },
  { value: 'waitlist', label: 'Waitlist' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'enrolled', label: 'Enrolled' },
];

export interface AdmissionsOverview {
  academicYear: string | null;
  totalApplications: number;
  thisMonth: number;
  online: number;
  acceptanceRate: number;
  enrollmentRate: number;
  upcomingInterviews: { id: string; applicationNumber: string; studentName: string; at: string; location?: string | null }[];
  byClass: { class_name: string; applications: number; enrolled: number; open: number }[];
  /** Applications received per month (YYYY-MM), online vs office, zero-filled. */
  byMonth?: { month: string; total: number; online: number; office: number }[];
  byStatus: Record<AdmissionStatus, number>;
  applications: {
    id: string;
    applicationNumber: string;
    studentName: string;
    parentName: string;
    className: string;
    status: AdmissionStatus;
    applicationDate: string;
  }[];
}

export const admissionsService = {
  async getShareLink() {
    return apiClient.get<{ path: string; school_name: string; public_base_url: string | null }>('/api/v1/admissions/share-link');
  },

  async getPublicAdmissionInfo(slug: string) {
    return apiClient.get<PublicAdmissionInfo>(`/api/v1/public/admissions/${encodeURIComponent(slug)}`);
  },

  async submitPublicApplication(slug: string, data: Record<string, unknown>) {
    return apiClient.post<{ application_number: string; email_sent: boolean }>(`/api/v1/public/admissions/${encodeURIComponent(slug)}`, data);
  },
  async getOverview(academicYear?: string) {
    return apiClient.get<{ success: boolean; data: AdmissionsOverview }>(
      '/api/v1/dashboards/admissions/overview',
      { params: academicYear ? { academic_year: academicYear } : {} }
    );
  },

  async listApplications(params: ListAdmissionsParams = {}) {
    return apiClient.get<{ data: AdmissionRecord[]; pagination: any; counts: Record<AdmissionStatus, number> }>('/api/v1/admissions', { params });
  },

  async getMeta() {
    return apiClient.get<{ success: boolean; data: AdmissionsMeta }>('/api/v1/admissions/meta');
  },

  async getDetail(id: string) {
    return apiClient.get<{ success: boolean; data: AdmissionDetail }>(`/api/v1/admissions/${id}`);
  },

  async updateApplication(id: string, data: Record<string, unknown>) {
    return apiClient.put<{ success: boolean; data: AdmissionDetail & { email_sent?: boolean | null } }>(`/api/v1/admissions/${id}`, data);
  },

  async addNote(id: string, note: string) {
    return apiClient.post<{ success: boolean; data: AdmissionDetail }>(`/api/v1/admissions/${id}/notes`, { note });
  },

  async enrol(id: string, data: { class_id: string; allow_over_capacity?: boolean; bill_terms?: string[] }) {
    return apiClient.post<{ success: boolean; data: EnrolResult }>(`/api/v1/admissions/${id}/enrol`, data);
  },

  async getApplication(id: string) {
    return apiClient.get<AdmissionRecord>(`/api/v1/admissions/${id}`);
  },

  async submitApplication(data: any) {
    return apiClient.post<{ success: boolean; data: AdmissionDetail & { enrolment?: EnrolResult | null } }>('/api/v1/admissions', data);
  },

  async updateStatus(id: string, data: { status: string; note?: string; interview_date?: string; interview_location?: string; assessment_score?: number | string }) {
    return apiClient.put<{ success: boolean; data: AdmissionDetail & { email_sent?: boolean | null } }>(`/api/v1/admissions/${id}/status`, data);
  },

  async deleteApplication(id: string) {
    return apiClient.delete(`/api/v1/admissions/${id}`);
  },
};

export default admissionsService;
