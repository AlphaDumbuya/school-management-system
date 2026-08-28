/**
 * Classes & Streams API Service
 * Wraps /api/v1/classes endpoints.
 */

import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ClassRecord {
  id: number;
  name: string;
  level: string;
  section?: string;
  capacity: number;
  status: 'active' | 'inactive';
  class_teacher_id?: string;
  room_number?: string;
  floor?: string;
  building?: string;
  academic_session_id?: string;
  enrolled_students?: number;
  next_class_id?: string | null;
  is_final_year?: boolean;
  created_at: string;
}

export interface ClassStudent {
  id: number;
  student_id: string;
  first_name: string;
  last_name: string;
  photo_url?: string;
  roll_number: string;
  status: string;
}

export interface ClassStudentsResponse {
  class_id: string;
  class_name: string;
  total_students: number;
  students: ClassStudent[];
}

export interface ClassFormData {
  name: string;
  level: string;
  section?: string;
  capacity: number;
  room_number?: string;
  floor?: string;
  building?: string;
  class_teacher_id?: string;
  academic_session_id?: string;
  next_class_id?: string | null;
  is_final_year?: boolean;
}

export interface ListClassesParams {
  page?: number;
  limit?: number;
  level?: string;
  status?: string;
  search?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const classesService = {
  /** GET /api/v1/classes — paginated list */
  async listClasses(params: ListClassesParams = {}) {
    return apiClient.get<{ data: ClassRecord[]; pagination: any }>(
      '/api/v1/classes',
      { params }
    );
  },

  /** GET /api/v1/classes/:id — single class with enrollment count */
  async getClass(id: string | number) {
    return apiClient.get<ClassRecord>(`/api/v1/classes/${id}`);
  },

  /** POST /api/v1/classes — create a new class */
  async createClass(data: ClassFormData) {
    return apiClient.post<ClassRecord>('/api/v1/classes', data);
  },

  /** PUT /api/v1/classes/:id — update an existing class */
  async updateClass(id: string | number, data: Partial<ClassFormData>) {
    return apiClient.put<ClassRecord>(`/api/v1/classes/${id}`, data);
  },

  /** DELETE /api/v1/classes/:id — soft-delete (sets status=inactive) */
  async deactivateClass(id: string | number) {
    return apiClient.delete(`/api/v1/classes/${id}`);
  },

  /** DELETE /api/v1/classes/:id/permanent — hard delete */
  async deleteClass(id: string | number) {
    return apiClient.delete(`/api/v1/classes/${id}/permanent`);
  },

  /** GET /api/v1/classes/:id/students — students enrolled in a class */
  async getClassStudents(id: string | number) {
    return apiClient.get<ClassStudentsResponse>(`/api/v1/classes/${id}/students`);
  },
};

export default classesService;
