/**
 * Assignments API Service
 * Wraps /api/v1/assignments endpoints.
 */

import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssignmentType = 'homework' | 'classwork' | 'project' | 'test' | 'quiz';
export type AssignmentStatus = 'active' | 'closed' | 'draft';

export interface AssignmentRecord {
  id: string;
  title: string;
  description?: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  type: AssignmentType;
  assigned_date: string;
  due_date: string;
  max_marks: number;
  status: AssignmentStatus;
  instructions?: string;
  resources?: string;
  // Joined fields
  class_name?: string;
  class_level?: string;
  subject_name?: string;
  subject_code?: string;
  teacher_name?: string;
  total_submissions?: number;
  graded_count?: number;
  created_at: string;
}

export interface AssignmentFormData {
  title: string;
  description?: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  type?: AssignmentType;
  assigned_date: string;
  due_date: string;
  max_marks?: number;
  instructions?: string;
  status?: AssignmentStatus;
}

export interface ListAssignmentsParams {
  page?: number;
  limit?: number;
  class_id?: string;
  subject_id?: string;
  teacher_id?: string;
  status?: string;
  type?: string;
  search?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const ASSIGNMENT_TYPES: { value: AssignmentType; label: string }[] = [
  { value: 'homework', label: 'Homework' },
  { value: 'classwork', label: 'Classwork' },
  { value: 'project', label: 'Project' },
  { value: 'test', label: 'Test' },
  { value: 'quiz', label: 'Quiz' },
];

// ── Service ───────────────────────────────────────────────────────────────────

export const assignmentsService = {
  async listAssignments(params: ListAssignmentsParams = {}) {
    return apiClient.get<{ data: AssignmentRecord[]; pagination: any }>(
      '/api/v1/assignments',
      { params }
    );
  },

  async getAssignment(id: string) {
    return apiClient.get<AssignmentRecord>(`/api/v1/assignments/${id}`);
  },

  async createAssignment(data: AssignmentFormData) {
    return apiClient.post<AssignmentRecord>('/api/v1/assignments', data);
  },

  async updateAssignment(id: string, data: Partial<AssignmentFormData>) {
    return apiClient.put<AssignmentRecord>(`/api/v1/assignments/${id}`, data);
  },

  async deleteAssignment(id: string) {
    return apiClient.delete(`/api/v1/assignments/${id}`);
  },
};

export default assignmentsService;
