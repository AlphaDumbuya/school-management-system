/**
 * Examinations API Service
 * Wraps /api/v1/examinations endpoints.
 */

import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExamType = 'mid_term' | 'end_of_term' | 'mock' | 'promotion' | 'continuous_assessment';
export type ExamTerm = 'first_term' | 'second_term' | 'third_term';
export type ExamStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export interface ExaminationRecord {
  id: string;
  title: string;
  description?: string;
  type: ExamType;
  term: ExamTerm;
  academic_year: string;
  class_id?: string;
  subject_id?: string;
  start_date: string;
  end_date?: string;
  total_marks: number;
  pass_marks: number;
  duration_minutes: number;
  venue?: string;
  status: ExamStatus;
  instructions?: string;
  // Joined
  class_name?: string;
  class_level?: string;
  subject_name?: string;
  subject_code?: string;
  created_at: string;
}

export interface ExamFormData {
  title: string;
  description?: string;
  type: ExamType;
  term: ExamTerm;
  academic_year: string;
  class_id?: string;
  subject_id?: string;
  start_date: string;
  end_date?: string;
  total_marks?: number;
  pass_marks?: number;
  duration_minutes?: number;
  venue?: string;
  instructions?: string;
  status?: ExamStatus;
}

export interface ListExamsParams {
  page?: number;
  limit?: number;
  type?: string;
  term?: string;
  academic_year?: string;
  class_id?: string;
  status?: string;
  search?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const EXAM_TYPES: { value: ExamType; label: string; description: string }[] = [
  { value: 'continuous_assessment', label: 'Continuous Assessment', description: 'Ongoing CA tests (30% of final)' },
  { value: 'mid_term', label: 'Mid-Term Exam', description: 'Halfway through the term' },
  { value: 'end_of_term', label: 'End of Term Exam', description: 'Final exam for the term (70% of final)' },
  { value: 'mock', label: 'Mock Exam', description: 'Practice exam before external exams' },
  { value: 'promotion', label: 'Promotion Exam', description: 'Determines advancement to next class' },
];

export const EXAM_TERMS: { value: ExamTerm; label: string }[] = [
  { value: 'first_term', label: 'First Term' },
  { value: 'second_term', label: 'Second Term' },
  { value: 'third_term', label: 'Third Term' },
];

export const EXAM_STATUSES: { value: ExamStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

// ── Service ───────────────────────────────────────────────────────────────────

export const examinationsService = {
  async listExaminations(params: ListExamsParams = {}) {
    return apiClient.get<{ data: ExaminationRecord[]; pagination: any }>(
      '/api/v1/examinations',
      { params }
    );
  },

  async getExamination(id: string) {
    return apiClient.get<ExaminationRecord>(`/api/v1/examinations/${id}`);
  },

  async createExamination(data: ExamFormData) {
    return apiClient.post<ExaminationRecord>('/api/v1/examinations', data);
  },

  async updateExamination(id: string, data: Partial<ExamFormData>) {
    return apiClient.put<ExaminationRecord>(`/api/v1/examinations/${id}`, data);
  },

  async deleteExamination(id: string) {
    return apiClient.delete(`/api/v1/examinations/${id}`);
  },
};

export default examinationsService;
