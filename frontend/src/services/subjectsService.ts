/**
 * Subjects API Service
 * Wraps /api/v1/subjects endpoints.
 */

import { apiClient } from '@lib/apiClient';
import useAuthStore from '@store/authStore';
import { rosterRepo } from '../offline/repositories/rosterRepo';

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
  /**
   * GET /api/v1/subjects — paginated list.
   *
   * Offline fallback: serve the subjects cached by the teacher offline sync
   * engine so grade-entry subject selectors still populate without a
   * connection.
   */
  async listSubjects(params: ListSubjectsParams = {}) {
    const res = await apiClient
      .get<{ data: SubjectRecord[]; pagination: any }>('/api/v1/subjects', { params })
      .catch(() => null as any);
    const list = (res as any)?.data?.data ?? (res as any)?.data ?? [];
    if (res && (Array.isArray(list) ? list.length > 0 : true) && navigator.onLine) {
      return res;
    }
    const uid = (useAuthStore.getState().user as any)?.id;
    if (uid) {
      const cached = await rosterRepo.list(uid, 'subjects').catch(() => []);
      if (cached.length) {
        return { success: true, data: cached, pagination: { total: cached.length } } as any;
      }
    }
    return res ?? ({ success: false, data: [] } as any);
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
  async updateSubject(id: string | number, data: Partial<SubjectFormData> & { status?: 'active' | 'inactive' }) {
    return apiClient.put<SubjectRecord>(`/api/v1/subjects/${id}`, data);
  },

  /** PUT /api/v1/subjects/:id — activate subject */
  async activateSubject(id: string | number) {
    return apiClient.put<SubjectRecord>(`/api/v1/subjects/${id}`, { status: 'active' });
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
