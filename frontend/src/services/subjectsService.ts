/**
 * Subjects API Service
 * Wraps /api/v1/subjects endpoints.
 */

import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SubjectRecord {
  id: number;
  code: string;
  name: string;
  description?: string;
  credit_points: number;
  max_marks: number;
  pass_marks: number;
  category?: 'core' | 'science' | 'arts' | 'commercial' | 'technical';
  level?: 'all' | 'primary' | 'jss' | 'sss';
  department?: string;
  is_elective: boolean;
  status: 'active' | 'inactive';
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface SubjectFormData {
  code: string;
  name: string;
  description?: string;
  credit_points?: number;
  max_marks?: number;
  pass_marks?: number;
  category?: string;
  level?: string;
  department?: string;
  is_elective?: boolean;
}

export interface ListSubjectsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  category?: string;
  level?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const subjectsService = {
  /** GET /api/v1/subjects — paginated list */
  async listSubjects(params: ListSubjectsParams = {}) {
    return apiClient.get<{ data: SubjectRecord[]; pagination: any }>(
      '/api/v1/subjects',
      { params }
    );
  },

  /** GET /api/v1/subjects/:id — single subject */
  async getSubject(id: string | number) {
    return apiClient.get<SubjectRecord>(`/api/v1/subjects/${id}`);
  },

  /** POST /api/v1/subjects — create a new subject */
  async createSubject(data: SubjectFormData) {
    return apiClient.post<SubjectRecord>('/api/v1/subjects', data);
  },

  /** PUT /api/v1/subjects/:id — update an existing subject */
  async updateSubject(id: string | number, data: Partial<SubjectFormData>) {
    return apiClient.put<SubjectRecord>(`/api/v1/subjects/${id}`, data);
  },

  /** DELETE /api/v1/subjects/:id — soft-delete (sets status=inactive) */
  async deactivateSubject(id: string | number) {
    return apiClient.delete(`/api/v1/subjects/${id}`);
  },

  /** DELETE /api/v1/subjects/:id/permanent — hard delete */
  async deleteSubject(id: string | number) {
    return apiClient.delete(`/api/v1/subjects/${id}/permanent`);
  },
};

export default subjectsService;
