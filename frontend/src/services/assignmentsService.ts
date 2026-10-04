/**
 * Assignments API Service
 * Wraps /api/v1/assignments endpoints.
 */

import { apiClient } from '@lib/apiClient';
import useAuthStore from '@store/authStore';
import { assignmentsRepo } from '../offline/repositories/assignmentsRepo';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssignmentType = 'homework' | 'classwork' | 'essay' | 'practical' | 'project' | 'quiz' | 'test' | 'presentation' | 'group_work' | 'revision' | 'reading' | 'exercise';
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
  // Student (or a parent's selected child): their own submission, if any.
  my_submission_status?: string | null;
  my_submitted_at?: string | null;
  my_marks?: number | null;
  my_feedback?: string | null;
  my_graded_at?: string | null;
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
  academic_year?: string;
  search?: string;
  /** Parent: which linked child (verified server-side). */
  child_id?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const ASSIGNMENT_TYPES: { value: AssignmentType; label: string }[] = [
  { value: 'homework', label: 'Homework' },
  { value: 'classwork', label: 'Classwork' },
  { value: 'essay', label: 'Essay / Composition' },
  { value: 'practical', label: 'Practical / Lab Work' },
  { value: 'project', label: 'Project' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'test', label: 'Test' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'group_work', label: 'Group Work' },
  { value: 'revision', label: 'Revision Exercise' },
  { value: 'reading', label: 'Reading Assignment' },
  { value: 'exercise', label: 'Exercise / Drill' },
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
    // Offline-first: teachers with no connectivity queue locally + sync later.
    const user = useAuthStore.getState().user;
    if (!navigator.onLine && user?.role === 'teacher') {
      await assignmentsRepo.create(user.id, {
        classId: data.class_id,
        subjectId: data.subject_id,
        title: data.title,
        description: data.description,
        type: data.type,
        assignedDate: data.assigned_date,
        dueDate: data.due_date,
        maxMarks: data.max_marks,
        instructions: data.instructions,
        status: data.status,
      });
      return { offline: true, message: 'Assignment saved offline — will sync when you reconnect.' } as any;
    }
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
