/**
 * Teachers API Service
 * Wraps /api/v1/teachers endpoints for managing staff with the 'teacher' role and detailed record profiles.
 */

import { apiClient } from '@lib/apiClient';

export interface TeacherAssignment {
  id?: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  subject_code?: string;
}

export interface TeacherRecord {
  id: string;
  user_id: string;
  teacher_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  photo_url?: string;
  specialization?: string;
  experience_years?: number;
  office_location?: string;
  qualifications?: string;
  hire_date: string;
  status: 'active' | 'inactive';
  last_login?: string;
  designation?: string;
  department?: string;
  employment_type?: string;
  form_class_name?: string;
  form_class_id?: string;
  temp_password?: string;
  created_at: string;
  updated_at?: string;
  assignments?: TeacherAssignment[];
  /** System role: teacher | principal | accountant | admissions_officer. */
  user_role?: string;
  /** Extra jobs on top of the main role: teacher, accountant and/or admissions_officer. */
  staff_duties?: string[] | string | null;
}

/** Display badges for a staff member's jobs (main role + duties). */
export function staffJobs(t: Pick<TeacherRecord, 'user_role' | 'staff_duties'>): string[] {
  let duties: string[] = [];
  const raw = t.staff_duties;
  try { duties = Array.isArray(raw) ? raw : raw ? JSON.parse(raw) : []; } catch { duties = []; }
  const jobs: string[] = [];
  if (t.user_role === 'principal') jobs.push('Leadership');
  if (!t.user_role || t.user_role === 'teacher' || t.user_role === 'principal' || duties.includes('teacher')) jobs.push('Teaching');
  if (t.user_role === 'accountant' || duties.includes('accountant')) jobs.push('Accountant');
  if (t.user_role === 'admissions_officer' || duties.includes('admissions_officer')) jobs.push('Admissions');
  return jobs;
}

export interface TeacherFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  photo_url?: string;
  specialization?: string;
  experience_years?: number;
  office_location?: string;
  qualifications?: string;
  hire_date?: string;
  status?: string;
  designation?: string;
  department?: string;
  employment_type?: string;
  form_class_id?: string;
  assigned_classes?: string[];
  assigned_subjects?: string[];
  /** Reason for a status change (suspend/dismiss) — shown to the staff member. */
  status_reason?: string;
  /** Main job: teacher | accountant | admissions_officer. */
  primary_role?: string;
  /** A teacher's extra jobs (accountant / admissions_officer). */
  staff_duties?: string[];
}

export interface ListTeachersParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  /** teaching | accountant | admissions_officer | leadership */
  staff_type?: string;
}

export const teachersService = {
  async listTeachers(params: ListTeachersParams = {}) {
    return apiClient.get<{ data: TeacherRecord[]; pagination: any }>(
      '/api/v1/teachers',
      { params }
    );
  },

  async getTeacher(id: string) {
    return apiClient.get<TeacherRecord>(`/api/v1/teachers/${id}`);
  },

  async createTeacher(data: TeacherFormData) {
    return apiClient.post<{ message: string; user: TeacherRecord; temporary_password?: string }>(
      '/api/v1/teachers',
      data
    );
  },

  async updateTeacher(id: string, data: Partial<TeacherFormData>) {
    return apiClient.put<{ message: string; user: TeacherRecord }>(
      `/api/v1/teachers/${id}`,
      data
    );
  },

  async deactivateTeacher(id: string, reason?: string) {
    // Pass the reason as a query param so it reaches the DELETE handler.
    const qs = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    return apiClient.delete(`/api/v1/teachers/${id}${qs}`);
  },
};

export default teachersService;
