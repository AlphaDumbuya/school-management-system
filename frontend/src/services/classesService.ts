/**
 * Classes & Streams API Service
 * Wraps /api/v1/classes endpoints.
 */

import { apiClient } from '@lib/apiClient';
import useAuthStore from '@store/authStore';
import { rosterRepo } from '../offline/repositories/rosterRepo';
import { getCachedAcademicSessions } from './schoolConfigService';
import { filterClassesToSchool } from '@lib/classScope';

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
  /** Scope to the classes of a specific academic year (e.g. "2024/2025"). */
  academic_year?: string;
  /** Scope to a specific academic session id. */
  academic_session_id?: string;
  /**
   * By default only classes within the school's level are listed (a Primary
   * school gets no JSS/SSS classes). 'all' lists every class regardless.
   */
  level_scope?: 'all';
}

// ── Service ───────────────────────────────────────────────────────────────────

export const classesService = {
  /**
   * GET /api/v1/classes — paginated list.
   *
   * Offline fallback: for a teacher offline (or when the network yields
   * nothing), serve the classes cached by the offline sync engine so the
   * academic modules (attendance register, grade entry, assignments) still
   * populate their class selectors without a connection.
   */
  async listClasses(params: ListClassesParams = {}) {
    const res = await apiClient
      .get<{ data: ClassRecord[]; pagination: any }>('/api/v1/classes', { params })
      .catch(() => null as any);
    // Trust a successful online answer EVEN WHEN EMPTY. An empty list is a real
    // result (a past year the teacher didn't teach, or a new year they aren't
    // assigned in yet); replacing it with the cache would show other years'
    // classes under the selected year.
    if (res && (res as any).success !== false && navigator.onLine) {
      return res;
    }
    const cached = await classesService._cachedClasses(params);
    if (cached.length) {
      return { success: true, data: cached, pagination: { total: cached.length }, offline: true } as any;
    }
    return res ?? ({ success: false, data: [] } as any);
  },

  /**
   * GET /api/v1/classes for ADMIN selectors (finance, reports). Always hits the
   * API and NEVER falls back to the teacher offline roster cache (which can
   * hold a partial set), so staff always see the full tenant class list.
   */
  async listAllClasses(params: ListClassesParams = {}) {
    const res = await apiClient
      .get<{ data: ClassRecord[]; pagination: any }>('/api/v1/classes', { params: { limit: 100, ...params } })
      .catch(() => null as any);
    return res ?? ({ success: false, data: [] } as any);
  },

  /**
   * Read classes from the teacher offline cache (best-effort), applying the
   * same filters the API would. The cache holds every year's classes, so the
   * year filter matters: legacy classes with no session count as the active year.
   */
  async _cachedClasses(params: ListClassesParams = {}): Promise<ClassRecord[]> {
    const authUser = useAuthStore.getState().user as any;
    const uid = authUser?.id;
    if (!uid) return [];
    let rows: ClassRecord[] = await rosterRepo.list(uid, 'classes').catch(() => []);
    // Same school-level scope the API applies (no JSS/SSS in a Primary school).
    if (params.level_scope !== 'all') rows = filterClassesToSchool(rows, authUser?.schoolType);

    if (params.academic_session_id) {
      rows = rows.filter((c) => String(c.academic_session_id ?? '') === String(params.academic_session_id));
    } else if (params.academic_year !== 'all') {
      // Same rule as the API: the requested year, else the active year.
      const sessions = getCachedAcademicSessions();
      if (sessions.length) {
        const session = params.academic_year
          ? sessions.find((s) => s.name === params.academic_year)
          : sessions.find((s) => s.is_active);
        rows = session
          ? rows.filter((c) => (c.academic_session_id
              ? String(c.academic_session_id) === String(session.id)
              : session.is_active))
          : [];
      }
      // No sessions remembered on this device yet: can't tell years apart, so
      // serve the cache unfiltered rather than nothing.
    }
    if (params.level) rows = rows.filter((c) => c.level === params.level);
    if (params.status) rows = rows.filter((c) => c.status === params.status);
    if (params.search) {
      const t = params.search.trim().toLowerCase();
      rows = rows.filter((c) => [c.name, c.room_number, c.building].some((v) => String(v ?? '').toLowerCase().includes(t)));
    }
    return rows;
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

  /**
   * GET /api/v1/classes/:id/students — students enrolled in a class.
   *
   * Offline fallback: resolve the class roster from the cached enrollments +
   * students so grade entry / attendance / report cards can list students
   * without a connection.
   */
  async getClassStudents(id: string | number) {
    const res = await apiClient
      .get<ClassStudentsResponse>(`/api/v1/classes/${id}/students`)
      .catch(() => null as any);
    const list = (res as any)?.data?.students ?? (res as any)?.students ?? [];
    if (res && (list.length > 0 || navigator.onLine)) {
      return res;
    }
    const uid = (useAuthStore.getState().user as any)?.id;
    if (uid) {
      const cached = await rosterRepo.studentsForClass(uid, String(id)).catch(() => []);
      const students = cached.map((s: any) => ({
        id: s.id,
        student_id: s.student_id || s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        photo_url: s.photo_url,
        roll_number: s.roll_number || s.student_id || '',
        status: s.status || 'active',
      }));
      return {
        success: true,
        data: { class_id: String(id), class_name: '', total_students: students.length, students },
      } as any;
    }
    return res ?? ({ success: false, data: { students: [] } } as any);
  },
};

export default classesService;
