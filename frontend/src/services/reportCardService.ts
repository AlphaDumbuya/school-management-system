/**
 * Sierra Leone Report Card Service (frontend)
 * Wires to /api/v1/report-cards — the real SL booklet flow.
 *
 * Cognitive:  Test 1 + Test 2 → Mean → Subject Rank
 * Aggregates: Combined Score, Percentage, Class Position, Yearly Mean/Rank
 * Domains:    Affective (12 traits) + Psychomotor (12 skills), rated 1-5 per term
 */

import { apiClient } from '@lib/apiClient';
import { API_CONFIG } from '@config/api.config';

const BASE = '/api/v1/report-cards';

// ── Terms ─────────────────────────────────────────────────────────────────────

export const SL_TERMS = [
  { value: 'first_term', label: 'First Term' },
  { value: 'second_term', label: 'Second Term' },
  { value: 'third_term', label: 'Third Term' },
] as const;

export type SLTerm = 'first_term' | 'second_term' | 'third_term';

// ── Grading method (fetched from tenant config, falls back to SL default) ────

export const SL_GRADING_METHOD_DEFAULT = [
  { letter: 'A', remark: 'Excellent', min: 85, max: 100, isFail: false },
  { letter: 'B', remark: 'Very Good', min: 75, max: 84, isFail: false },
  { letter: 'C', remark: 'Good', min: 60, max: 74, isFail: false },
  { letter: 'D', remark: 'Satisfactory', min: 50, max: 59, isFail: false },
  { letter: 'F', remark: 'Unsatisfactory', min: 0, max: 49, isFail: true },
];

/** Active grading method — fetched from API on first use, cached in memory */
let _cachedGradingMethod: typeof SL_GRADING_METHOD_DEFAULT | null = null;

/** @deprecated Use SL_GRADING_METHOD_DEFAULT or getGradingMethod() instead */
export const SL_GRADING_METHOD = SL_GRADING_METHOD_DEFAULT;

export async function getGradingMethod() {
  if (_cachedGradingMethod) return _cachedGradingMethod;
  try {
    const res = await apiClient.get<{ data: { grading_method: { letter: string; remark: string; min: number; max: number }[] } }>(`${BASE}/config`);
    const gm = (res as any)?.data?.grading_method;
    if (Array.isArray(gm) && gm.length > 0) {
      _cachedGradingMethod = gm.map((g: any) => ({ ...g, isFail: g.letter === 'F' }));
      return _cachedGradingMethod;
    }
  } catch {
    // API failed (e.g. 401 during module pre-load before auth is ready).
    // Don't cache the failure — return a non-cached copy of the default so
    // a later authenticated call can still populate the real tenant grading scale.
    return SL_GRADING_METHOD_DEFAULT.map((g) => ({ ...g }));
  }
  _cachedGradingMethod = SL_GRADING_METHOD_DEFAULT;
  return _cachedGradingMethod;
}

/** Sync helper — uses cached grading method or SL default */
export function getGrade(score: number | null): { letter: string; remark: string; isFail: boolean } {
  if (score == null) return { letter: '-', remark: '', isFail: false };
  const method = _cachedGradingMethod || SL_GRADING_METHOD_DEFAULT;
  for (const g of method) {
    if (score >= g.min && score <= g.max) return { letter: g.letter, remark: g.remark, isFail: g.isFail };
  }
  return { letter: 'F', remark: 'Unsatisfactory', isFail: true };
}

// ── Fixed legends (back cover) ──────────────────────────────────────────────────

export const AFFECTIVE_TRAITS = [
  'Class Participation', 'Sociability', 'Helpfulness', 'Honesty',
  'Effort', 'Initiative', 'Self-Discipline', 'Demeanor',
  'Sporting Prowess', 'Dependability', 'Punctuality / Regularity',
  'School and Community Involvement',
];

export const PSYCHOMOTOR_SKILLS = [
  'Physical Dexterity', 'Stamina', 'Physical Agility', 'Sporting in Ball Game',
  'Ability to Function as Team Player', 'Sporting Prowess in Athletics',
  'Drawing / Painting', 'Handwriting', 'Voice Control',
  'Physical Co-ordination (in dance)', 'Musical Instrument Playing',
  'Bodily Control / Sense of Balance',
];

export const RATING_LEGEND = [
  { value: 5, label: 'Great / Exceptional / Always' },
  { value: 4, label: 'Good / Often' },
  { value: 3, label: 'Fair / Reasonable' },
  { value: 2, label: 'Some / Sometimes / Little / Rarely' },
  { value: 1, label: 'Negligible / Never / Very Poor' },
];

export const CONDUCT_CODES = [
  { code: 'V.G', label: 'Very Good' },
  { code: 'G', label: 'Good' },
  { code: 'S', label: 'Satisfactory' },
  { code: 'PT', label: 'Play Truant (Must See Principal)', isAlert: true },
  { code: 'N', label: 'Neglected Work', isAlert: true },
  { code: 'Abs', label: 'Absent', isAlert: true },
];

export const PROMOTION_OPTIONS = [
  'PROMOTED TO NEXT FORM',
  'ALLOWED TO PASS',
  'TO REPEAT',
  'PROMOTED ON TRIAL',
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ScoreGridRow {
  student_id: string;
  roll_number: string;
  student_name: string;
  test1: number | null;
  test2: number | null;
  mean: number | null;
  subject_rank: number | null;
}

export interface SaveScoresPayload {
  class_id: string;
  subject_id: string;
  academic_year: string;
  term: SLTerm;
  scores: { student_id: string; test1: number | null; test2: number | null }[];
}

export interface TermScore {
  test1: number | null;
  test2: number | null;
  mean: number | null;
  rank: number | null;
}

export interface ReportSubject {
  subject_id: string;
  subject_name: string;
  subject_code?: string;
  terms: Partial<Record<SLTerm, TermScore>>;
  yearly_mean: number | null;
  yearly_rank?: number;
}

export interface DomainTraitRatings {
  terms: Partial<Record<SLTerm, { r1: number | null; r2: number | null; mean: number | null }>>;
  yearly_mean: number | null;
  yearly_rank?: number;
}

export interface TermSummary {
  combined_score: number | null;
  percentage: number | null;
  position: number | null;
  class_size: number | null;
  on_time: number;
  late: number;
  absent: number;
  conduct: string | null;
  teacher_comment: string | null;
}

export interface ClassRankingStudent {
  student_id: string;
  name: string;
  admission_no: string | null;
  photo_url: string | null;
  combined_score: number | null;
  percentage: number | null;
  position: number | null;
  class_size: number | null;
  is_top: boolean;
}

export interface ClassRanking {
  class_id: string;
  class_name: string | null;
  academic_year: string;
  term: string | null;
  is_year: boolean;
  published: boolean;
  students: ClassRankingStudent[];
}

export interface PublicationRecord {
  id: string;
  class_id: string;
  class_name: string | null;
  academic_year: string;
  term: string | null;
  term_label: string;
  is_published: boolean;
  published_at: string | null;
  published_by_name: string | null;
  /** Reason recorded when the results were unreleased (shown to families). */
  unpublish_reason: string | null;
}

export interface ReportCard {
  tenant_id?: string;
  class_id?: string;
  student_id?: string;
  verify_url?: string;
  /** Whether any results for this class+year have been released. */
  is_published?: boolean;
  /** Which terms are released (single-term sheets). */
  published_terms?: string[];
  /** Whether the full year (Term 3 booklet + promotion) is released. */
  year_released?: boolean;
  student: {
    id: string;
    admission_no: string;
    name: string;
    class_name?: string;
    class_level?: string;
    form_teacher_name?: string | null;
    pupil_age?: number | null;
    class_average_age?: number | null;
    number_in_form?: number | null;
    photo_url?: string | null;
  };
  academic_year: string;
  subjects: ReportSubject[];
  term_summaries: Record<SLTerm, TermSummary | null>;
  yearly_summary: {
    combined_score: number | null;
    percentage: number | null;
    position: number | null;
    class_size: number | null;
    promotion_recommendation: string | null;
    outcome: 'fail' | 'promoted_effort' | 'promoted' | null;
  };
  domain_ratings: {
    affective: Record<number, DomainTraitRatings>;
    psychomotor: Record<number, DomainTraitRatings>;
  };
  affective_traits: string[];
  psychomotor_skills: string[];
  conduct_legend: Record<string, string>;
  meta: {
    principal_comment?: string;
    promotion_status?: string;
    average_age?: string;
  } | null;
}

// ── Service ─────────────────────────────────────────────────────────────────────

export const reportCardService = {
  /** Reference config (terms, traits, legend, grading method) */
  async getConfig() {
    return apiClient.get(`${BASE}/config`);
  },

  /** Score grid for a class+subject+term (pre-fills existing values) */
  async getGrid(params: { class_id: string; subject_id: string; term: SLTerm; academic_year: string }) {
    return apiClient.get<{ success: boolean; data: ScoreGridRow[] }>(`${BASE}/grid`, { params });
  },

  /** Bulk-save Test1/Test2 for a class+subject+term */
  async saveScores(payload: SaveScoresPayload) {
    return apiClient.post(`${BASE}/scores`, payload);
  },

  /** Save affective + psychomotor ratings (two ratings per trait) for a student+term */
  async saveRatings(payload: {
    student_id: string;
    class_id: string;
    academic_year: string;
    term: SLTerm;
    affective: Record<number, { r1: number | null; r2: number | null }>;
    psychomotor: Record<number, { r1: number | null; r2: number | null }>;
  }) {
    return apiClient.post(`${BASE}/ratings`, payload);
  },

  /**
   * Save conduct / teacher comment for a student+term.
   * Attendance (on time / late / absent) is auto-computed from the attendance
   * system when the report card is generated — it is NOT sent here.
   */
  async saveTermRecord(payload: {
    student_id: string;
    class_id: string;
    academic_year: string;
    term: SLTerm;
    conduct?: string;
    teacher_comment?: string;
  }) {
    return apiClient.post(`${BASE}/term-record`, payload);
  },

  /** Save principal comment / promotion / average age */
  async saveMeta(payload: {
    student_id: string;
    class_id: string;
    academic_year: string;
    principal_comment?: string;
    promotion_status?: string;
    average_age?: string;
  }) {
    return apiClient.post(`${BASE}/meta`, payload);
  },

  /** Full report card booklet (or single-term data) for a student */
  async getReportCard(studentId: string, params: { class_id: string; academic_year: string; term?: string }) {
    return apiClient.get<{ success: boolean; data: ReportCard }>(`${BASE}/${studentId}`, { params });
  },

  /** Class ranking (results directory) ordered by position; flags the leader(s). */
  async getClassRanking(params: { class_id: string; academic_year: string; term?: string }) {
    return apiClient.get<{ success: boolean; data: ClassRanking }>(`${BASE}/ranking`, { params });
  },

  /**
   * Download the server-generated PDF (clean, no browser header/footer).
   * Pass `term` (first_term/second_term) for a single-A4 terminal result sheet;
   * omit it for the full-year folded booklet.
   * Returns a Blob on success, or null if the server can't generate it (caller
   * should then fall back to the client-side print approach).
   */
  async downloadPdf(studentId: string, params: { class_id: string; academic_year: string; term?: string }): Promise<Blob | null> {
    const qs = new URLSearchParams(params as any).toString();
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    const base = API_CONFIG.baseURL;
    const res = await fetch(`${base}${BASE}/${studentId}/pdf?${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      credentials: 'include',
    });
    if (!res.ok) return null; // 501 fallback or any error → caller uses print
    const type = res.headers.get('content-type') || '';
    if (!type.includes('application/pdf')) return null;
    return res.blob();
  },

  // ── Principal-managed report settings ──────────────────────────────────────

  /** Get the tenant's report settings (locking / visibility / auto-promote). */
  async getSettings() {
    return apiClient.get<{ success: boolean; data: ReportSettings }>(`${BASE}/settings/config`);
  },

  /** Save (partial) report settings. */
  async saveSettings(data: Partial<ReportSettings>) {
    return apiClient.post(`${BASE}/settings/config`, data);
  },

  /** Lock / unlock scores for a class+subject+term (prevents edits). */
  async setLock(payload: { class_id: string; subject_id: string; term: SLTerm; academic_year: string; locked: boolean }) {
    return apiClient.post(`${BASE}/lock`, payload);
  },

  /** Publish / unpublish results for a class (gates parent/student visibility). */
  async setPublication(payload: { class_id: string; academic_year: string; term?: SLTerm | null; published: boolean; reason?: string | null }) {
    return apiClient.post(`${BASE}/publish`, payload);
  },

  /** Publish history — which classes/terms have been released, when, by whom. */
  async getPublications(academicYear?: string) {
    return apiClient.get<{ success: boolean; data: PublicationRecord[] }>(
      `${BASE}/publications`,
      { params: academicYear ? { academic_year: academicYear } : {} },
    );
  },

  /** Classes the caller may act on (all for staff-admin, assigned for teachers). */
  async getMyClasses() {
    return apiClient.get<{ success: boolean; data: Array<{ id: string; name: string; level: string }> }>(`${BASE}/my/classes`);
  },

  /**
   * Subject ids the caller may enter scores for in a class.
   * data === null means no restriction (staff-admin); otherwise an id list.
   */
  async getMySubjects(classId: string) {
    return apiClient.get<{ success: boolean; data: string[] | null; scoped: boolean }>(
      `${BASE}/my/subjects`, { params: { class_id: classId } },
    );
  },

  /**
   * All SL subject results for a student (Test1/Test2/Mean + grade) for the
   * profile Academics tab — the correct SL source, not the legacy CA/Exam table.
   */
  async getStudentResultsSummary(studentId: string, academicYear?: string) {
    return apiClient.get<{
      success: boolean;
      data: {
        stats: { subjects: number; avg_test1: number; avg_test2: number; avg_mean: number };
        results: Array<{
          id: string;
          subject_name: string;
          subject_code: string | null;
          academic_year: string;
          term: string;
          test1: number | null;
          test2: number | null;
          mean: number | null;
          subject_rank: number | null;
          grade_letter: string;
          remark: string;
        }>;
      };
    }>(`${BASE}/student/${studentId}/summary`, {
      params: academicYear ? { academic_year: academicYear } : undefined,
    });
  },
};

export interface ReportSettings {
  auto_lock_on_entry: boolean;
  allow_teacher_edit_after_lock: boolean;
  allow_teacher_view_results: boolean;
  auto_promote_on_publish: boolean;
}

export default reportCardService;
