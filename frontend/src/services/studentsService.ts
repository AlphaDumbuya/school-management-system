/**
 * Students API Service
 * Wraps /api/v1/students endpoints.
 */

import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StudentRecord {
  id: string;
  student_id: string; // admission/roll number
  first_name: string;
  last_name: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  status: 'active' | 'inactive' | 'suspended' | 'graduated';
  enrollment_date?: string;
  created_at: string;
}

export interface StudentFormData {
  first_name: string;
  last_name: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  status?: string;
  enrollment_date?: string;
  photo_url?: string;
}

export interface ListStudentsParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const studentsService = {
  async listStudents(params: ListStudentsParams = {}) {
    return apiClient.get<{ data: StudentRecord[]; pagination: any }>(
      '/api/v1/students',
      { params }
    );
  },

  async getStudent(id: string) {
    return apiClient.get<StudentRecord>(`/api/v1/students/${id}`);
  },

  async createStudent(data: StudentFormData) {
    return apiClient.post<StudentRecord>('/api/v1/students', data);
  },

  async updateStudent(id: string, data: Partial<StudentFormData>) {
    return apiClient.put<StudentRecord>(`/api/v1/students/${id}`, data);
  },

  async deactivateStudent(id: string) {
    return apiClient.delete(`/api/v1/students/${id}`);
  },

  async reactivateStudent(id: string) {
    return apiClient.post(`/api/v1/students/${id}/reactivate`);
  },
};

export default studentsService;
