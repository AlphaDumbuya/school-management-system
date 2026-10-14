/**
 * Weekly student review API service
 * Wraps /api/v1/weekly-reviews. apiClient never throws: callers must check
 * `success === false` on every response.
 */

import { apiClient } from '@lib/apiClient';
import type { ApiResponse } from '@appTypes/index';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WeeklyDayStatus = 'present' | 'late' | 'excused' | 'absent' | 'none';

export interface WeeklyProgressRow {
  class_id: string | number;
  class_name: string;
  students: number;
  reviewed: number;
}

export interface WeeklyAttendanceDay {
  date: string;
  /** 'Mon'..'Fri' */
  label: string;
  status: WeeklyDayStatus;
}

export interface WeeklyAttendanceSummary {
  present: number;
  late: number;
  excused: number;
  absent: number;
  recorded: number;
  /** Attendance rate as a percentage (0-100). */
  rate: number;
}

export interface WeeklyReviewEntry {
  performance_rating: number;
  behaviour_rating: number | null;
  comment: string | null;
  author_name: string | null;
  updated_at: string;
}

export interface WeeklyClassStudent {
  student_id: string;
  student_number: string | null;
  name: string;
  attendance: { days: WeeklyAttendanceDay[]; summary: WeeklyAttendanceSummary };
  review: WeeklyReviewEntry | null;
}

export interface WeeklyClassData {
  week_start: string;
  week_end: string;
  class: { id: string | number; name: string };
  can_edit: boolean;
  students: WeeklyClassStudent[];
}

export interface WeeklyReviewInput {
  student_id: string;
  performance_rating: number;
  /** Omit when none; null removes a previously saved behaviour rating. */
  behaviour_rating?: number | null;
  /** Omit when none; null removes a previously saved comment. */
  comment?: string | null;
  /** Remove the saved review for this student. */
  clear?: boolean;
}

export interface WeeklySavePayload {
  week: string;
  reviews: WeeklyReviewInput[];
}

export interface WeeklySaveResult {
  saved: number;
  cleared: number;
  skipped: number;
  notified: number;
}

export interface WeeklyReviewItem {
  week_start: string;
  week_end: string;
  term: string | null;
  academic_year: string | null;
  performance_rating: number;
  behaviour_rating: number | null;
  comment: string | null;
  teacher_name: string | null;
  updated_at: string;
}

export interface WeeklyReviewHistoryData {
  student: { id: string; name: string };
  /** Newest first. */
  reviews: WeeklyReviewItem[];
}

export interface WeeklyHistoryParams {
  academic_year?: string;
  term?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

const BASE = '/api/v1/weekly-reviews';

export const weeklyReviewService = {
  /** Per-class "x of y reviewed" for the week (classes this user may review). */
  getProgress(week: string) {
    return apiClient.get<WeeklyProgressRow[]>(`${BASE}/progress`, { params: { week } });
  },

  /** One class for one week: roster, Mon-Fri attendance and any saved reviews. */
  getClassWeek(classId: string | number, week: string) {
    return apiClient.get<WeeklyClassData>(`${BASE}/class/${encodeURIComponent(String(classId))}`, { params: { week } });
  },

  /** Save (or clear) the changed rows only. */
  saveClassWeek(classId: string | number, payload: WeeklySavePayload) {
    return apiClient.put<WeeklySaveResult>(`${BASE}/class/${encodeURIComponent(String(classId))}`, payload);
  },

  /** The logged-in student's own reviews. */
  async getMy(params: WeeklyHistoryParams = {}) {
    return normalizeHistory(await apiClient.get<WeeklyReviewItem[] | WeeklyReviewHistoryData>(`${BASE}/my`, {
      params: { academic_year: params.academic_year || undefined, term: params.term || undefined },
    }));
  },

  /** A parent's child's reviews. */
  async getChild(studentId: string, params: WeeklyHistoryParams = {}) {
    return normalizeHistory(await apiClient.get<WeeklyReviewItem[] | WeeklyReviewHistoryData>(`${BASE}/child/${encodeURIComponent(studentId)}`, {
      params: { academic_year: params.academic_year || undefined, term: params.term || undefined },
    }), studentId);
  },
};

/**
 * The history endpoints answer with the list of weeks, newest first. Wrap it as
 * { student, reviews } (and accept that shape too) so the pages read one thing.
 */
function normalizeHistory(
  res: ApiResponse<WeeklyReviewItem[] | WeeklyReviewHistoryData>,
  studentId = '',
): ApiResponse<WeeklyReviewHistoryData> {
  if (res.success === false || res.data == null) return res as unknown as ApiResponse<WeeklyReviewHistoryData>;
  const d = res.data;
  const data: WeeklyReviewHistoryData = Array.isArray(d)
    ? { student: { id: studentId, name: '' }, reviews: d }
    : { student: d.student ?? { id: studentId, name: '' }, reviews: Array.isArray(d.reviews) ? d.reviews : [] };
  return { ...res, data };
}

export default weeklyReviewService;
