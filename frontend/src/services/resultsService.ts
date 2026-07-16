/**
 * Results & Grades API Service
 * Handles grade entry, retrieval, and grade calculations.
 * 
 * Sierra Leone internal school grading:
 * - CA (30%) + Exam (70%) = Total (100%)
 * - Grade letters derived from percentage
 * - Schools can customize their grading scale
 */

import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GradeRecord {
  id: string;
  student_id: string;
  subject_id: string;
  class_id: string;
  examination_id?: string;
  academic_year: string;
  term: string;
  ca_score: number;       // Continuous Assessment score (out of 30)
  exam_score: number;     // Exam score (out of 70)
  total_score: number;    // CA + Exam (out of 100)
  grade_letter: string;   // A, B, C, D, E, F
  remark: string;         // Excellent, Very Good, Good, Pass, Weak Pass, Fail
  position?: number;      // Class position for this subject
  // Joined
  student_name?: string;
  student_roll_number?: string;
  subject_name?: string;
  subject_code?: string;
  class_name?: string;
  created_at: string;
}

export interface GradeEntryData {
  student_id: string;
  subject_id: string;
  class_id: string;
  examination_id?: string;
  academic_year: string;
  term: string;
  ca_score: number;
  exam_score: number;
}

export interface BulkGradeEntry {
  class_id: string;
  subject_id: string;
  academic_year: string;
  term: string;
  examination_id?: string;
  grades: { student_id: string; ca_score: number; exam_score: number }[];
}

export interface ListGradesParams {
  page?: number;
  limit?: number;
  class_id?: string;
  subject_id?: string;
  student_id?: string;
  term?: string;
  academic_year?: string;
  search?: string;
}

export interface ClassResultSummary {
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  term: string;
  academic_year: string;
  total_students: number;
  highest_score: number;
  lowest_score: number;
  average_score: number;
  pass_count: number;
  fail_count: number;
}

// ── Default Grading Scale ─────────────────────────────────────────────────────

export const DEFAULT_GRADING_SCALE = [
  { min: 75, max: 100, letter: 'A', remark: 'Excellent' },
  { min: 65, max: 74, letter: 'B', remark: 'Very Good' },
  { min: 50, max: 64, letter: 'C', remark: 'Good' },
  { min: 40, max: 49, letter: 'D', remark: 'Pass' },
  { min: 30, max: 39, letter: 'E', remark: 'Weak Pass' },
  { min: 0, max: 29, letter: 'F', remark: 'Fail' },
];

export function getGradeLetter(totalScore: number): { letter: string; remark: string } {
  for (const grade of DEFAULT_GRADING_SCALE) {
    if (totalScore >= grade.min && totalScore <= grade.max) {
      return { letter: grade.letter, remark: grade.remark };
    }
  }
  return { letter: 'F', remark: 'Fail' };
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const TERMS = [
  { value: 'first_term', label: 'First Term' },
  { value: 'second_term', label: 'Second Term' },
  { value: 'third_term', label: 'Third Term' },
];

// ── Service ───────────────────────────────────────────────────────────────────

export const resultsService = {
  /** GET /api/v1/results — list grades with filters */
  async listGrades(params: ListGradesParams = {}) {
    return apiClient.get<{ data: GradeRecord[]; pagination: any }>(
      '/api/v1/results',
      { params }
    );
  },

  /** GET /api/v1/results/summary — class result summary */
  async getClassSummary(classId: string, subjectId: string, term: string, academicYear: string) {
    return apiClient.get<ClassResultSummary>(
      '/api/v1/results/summary',
      { params: { class_id: classId, subject_id: subjectId, term, academic_year: academicYear } }
    );
  },

  /** POST /api/v1/results — enter a single grade */
  async enterGrade(data: GradeEntryData) {
    return apiClient.post<GradeRecord>('/api/v1/results', data);
  },

  /** POST /api/v1/results/bulk — enter grades for entire class */
  async bulkEnterGrades(data: BulkGradeEntry) {
    return apiClient.post<{ message: string; count: number }>('/api/v1/results/bulk', data);
  },

  /** PUT /api/v1/results/:id — update a grade */
  async updateGrade(id: string, data: Partial<GradeEntryData>) {
    return apiClient.put<GradeRecord>(`/api/v1/results/${id}`, data);
  },

  /** DELETE /api/v1/results/:id — delete a grade */
  async deleteGrade(id: string) {
    return apiClient.delete(`/api/v1/results/${id}`);
  },
};

export default resultsService;
