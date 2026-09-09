/**
 * Admissions API Service
 */

import { apiClient } from '@lib/apiClient';

export type AdmissionStatus = 'pending' | 'under_review' | 'interview_scheduled' | 'approved' | 'rejected' | 'enrolled';

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
  assessment_score?: number;
  decision_notes?: string;
  created_at: string;
}

export interface ListAdmissionsParams {
  page?: number;
  limit?: number;
  status?: string;
  academic_year?: string;
  search?: string;
}

export const ADMISSION_STATUSES: { value: AdmissionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'enrolled', label: 'Enrolled' },
];

export interface AdmissionsOverview {
  totalApplications: number;
  thisMonth: number;
  enrollmentRate: number;
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
  async getOverview(academicYear?: string) {
    return apiClient.get<{ success: boolean; data: AdmissionsOverview }>(
      '/api/v1/dashboards/admissions/overview',
      { params: academicYear ? { academic_year: academicYear } : {} }
    );
  },

  async listApplications(params: ListAdmissionsParams = {}) {
    return apiClient.get<{ data: AdmissionRecord[]; pagination: any }>('/api/v1/admissions', { params });
  },

  async getApplication(id: string) {
    return apiClient.get<AdmissionRecord>(`/api/v1/admissions/${id}`);
  },

  async submitApplication(data: any) {
    return apiClient.post<AdmissionRecord>('/api/v1/admissions', data);
  },

  async updateStatus(id: string, data: { status: string; interview_date?: string; assessment_score?: number; decision_notes?: string }) {
    return apiClient.put<AdmissionRecord>(`/api/v1/admissions/${id}/status`, data);
  },

  async deleteApplication(id: string) {
    return apiClient.delete(`/api/v1/admissions/${id}`);
  },
};

export default admissionsService;
