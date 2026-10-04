/**
 * Examinations API Service
 * Wraps /api/v1/examinations endpoints.
 */

import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExamType =
  | 'test_1'
  | 'test_2'
  | 'mid_term'
  | 'end_of_term'
  | 'mock'
  | 'promotion'
  | 'continuous_assessment';
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
  /** Parent: which linked child (verified server-side). */
  child_id?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const EXAM_TYPES: { value: ExamType; label: string; description: string }[] = [
  // Report-card aligned: each term has Test 1 (tests) + Test 2 (examination) → Mean
  { value: 'test_1', label: 'Test 1 (Tests)', description: 'First test of the term — feeds Test 1 on the report card' },
  { value: 'test_2', label: 'Test 2 (Examination)', description: 'Terminal examination — feeds Test 2 on the report card' },
  // Generic types retained — different schools use different structures
  { value: 'continuous_assessment', label: 'Continuous Assessment', description: 'Ongoing CA tests' },
  { value: 'mid_term', label: 'Mid-Term Exam', description: 'Halfway through the term' },
  { value: 'end_of_term', label: 'End of Term Exam', description: 'Final exam for the term' },
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

// ── Exam Timetable (grid builder, like the normal timetable) ───────────────────

/**
 * Exam sessions — the "columns" of the exam-timetable grid (like time periods
 * in the normal timetable). Each exam day has up to these sessions.
 */
export interface ExamSession {
  key: string;
  label: string;
  start: string; // HH:MM
  end: string;   // HH:MM
}

export const EXAM_SESSIONS: ExamSession[] = [
  { key: 'morning', label: 'Morning', start: '09:00', end: '11:00' },
  { key: 'afternoon', label: 'Afternoon', start: '12:00', end: '14:00' },
];

/** Map a start_date's time to a session key (morning/afternoon). */
export function sessionForTime(startDateIso?: string): string {
  if (!startDateIso) return 'morning';
  const d = new Date(startDateIso);
  if (isNaN(d.getTime())) return 'morning';
  // Times are composed and stored as UTC wall-clock (composeExamDateTime), so
  // read them back in UTC too; local hours would shift the session by timezone.
  return d.getUTCHours() < 12 ? 'morning' : 'afternoon';
}

/** Compose an ISO datetime from a YYYY-MM-DD date + HH:MM time. */
export function composeExamDateTime(dateStr: string, time: string): string {
  return `${dateStr}T${time}:00.000Z`;
}

/**
 * Build the exam-timetable grid from a flat list of exams for a class+term+year.
 * Rows = distinct exam dates (sorted); columns = sessions.
 * Returns { dates, grid } where grid[date][sessionKey] = exam | undefined.
 */
export function buildExamGrid(exams: ExaminationRecord[]): {
  dates: string[];
  grid: Record<string, Record<string, ExaminationRecord>>;
} {
  const grid: Record<string, Record<string, ExaminationRecord>> = {};
  const dateSet = new Set<string>();

  for (const ex of exams) {
    if (!ex.start_date) continue;
    const dateKey = ex.start_date.substring(0, 10); // YYYY-MM-DD
    dateSet.add(dateKey);
    const session = sessionForTime(ex.start_date);
    (grid[dateKey] ??= {})[session] = ex;
  }

  const dates = Array.from(dateSet).sort();
  return { dates, grid };
}

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
