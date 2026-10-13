/**
 * Houses and the house ballot API (principal and admissions officer).
 */
import { apiClient } from '@lib/apiClient';

export interface HouseStaff {
  user_id: string;
  name: string;
  position: 'master' | 'staff';
}

export interface HouseTeacherOption {
  user_id: string;
  name: string;
  /** May draw houses for the students of their own classes. */
  can_draw: boolean;
}

/** What a teacher may see or do on the Houses page. */
export interface TeacherHouseAccess {
  houses: { id: string; name: string; color: string; motto: string | null; position: 'master' | 'staff' }[];
  can_draw: boolean;
  /** The registered (active) houses, shown on the draw screen. Empty unless the teacher may draw. */
  draw_houses: { id: string; name: string; color: string; motto: string | null }[];
  has_access: boolean;
}

export interface House {
  id: string;
  name: string;
  color: string;
  motto: string | null;
  sort_order: number;
  is_active: boolean;
  staff: HouseStaff[];
  total: number;
  male: number;
  female: number;
  other: number;
}

export interface HouseSettings {
  balance_scope: 'school' | 'class';
  balance_gender: boolean;
  keep_siblings: boolean;
  auto_assign_on_enrol: boolean;
  /** A sibling follows a brother or sister only while the house stays within this many students of the smallest house. */
  level_gap: number;
}

export interface HouseOverview {
  /** Students in the biggest active house minus the smallest. 0 or 1 means level. */
  spread: number;
  houses: House[];
  settings: HouseSettings;
  unassigned: number;
}

export interface HouseSummary extends HouseOverview {
  by_class: { class_id: string | null; class_name: string; total: number; unassigned: number; houses: Record<string, number> }[];
}

export interface HouseStudent {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  gender: string | null;
  house_id: string | null;
  house_name: string | null;
  house_color: string | null;
  class_id: string | null;
  class_name: string | null;
}

/** A sport-house badge on someone's profile. */
export interface SportBadgeItem {
  /** student = their own house, child = a parent's child, staff = house master / teacher. */
  kind: 'student' | 'child' | 'staff';
  position?: 'master' | 'staff';
  student_id?: string;
  student_name?: string;
  house: { id: string; name: string; color: string; motto: string | null };
}

export interface DrawResult {
  student: { id: string; student_number: string; first_name: string; last_name: string; class_name: string | null; photo_url?: string | null };
  house: { id: string; name: string; color: string; motto: string | null };
  method: 'ballot' | 'auto' | 'sibling';
}

export interface DrawManyResult {
  /** True when more students match than one batch (1,000) can take: draw again for the rest. */
  more?: boolean;
  drawn: number;
  results: DrawResult[];
  failed: { student_id: string; error: string }[];
}

export interface HouseImportResult {
  assigned: number;
  unchanged: number;
  skipped_has_house: number;
  blank: number;
  created_houses: string[];
  problems: { row: number; student_number: string; reason: string }[];
  problem_count: number;
}

export interface HouseLogEntry {
  id: string;
  method: 'ballot' | 'auto' | 'sibling' | 'manual' | 'removed';
  reason: string | null;
  created_at: string;
  student_pk: string;
  student_number: string;
  first_name: string;
  last_name: string;
  house_name: string | null;
  house_color: string | null;
  previous_house_name: string | null;
  by_name: string | null;
}

const base = '/api/v1/admissions/houses';

export const houseService = {
  overview: () => apiClient.get<HouseOverview>(base),
  summary: () => apiClient.get<HouseSummary>(`${base}/summary`),
  /** `class_ids` is a comma separated list of class ids (any of them). */
  students: (params: { house_id?: string; class_id?: string; class_ids?: string; search?: string; limit?: number } = {}) =>
    apiClient.get<HouseStudent[]>(`${base}/students`, { params }),
  log: () => apiClient.get<HouseLogEntry[]>(`${base}/log`),
  create: (body: { name: string; color: string; motto?: string }) => apiClient.post<House>(base, body),
  update: (id: string, body: Partial<Pick<House, 'name' | 'color' | 'motto' | 'is_active'>>) =>
    apiClient.put<House>(`${base}/${id}`, body),
  remove: (id: string) => apiClient.delete<unknown>(`${base}/${id}`),
  updateSettings: (body: Partial<HouseSettings>) => apiClient.put<HouseSettings>(`${base}/settings`, body),
  draw: (student_id: string) => apiClient.post<DrawResult>(`${base}/draw`, { student_id }),
  drawMany: (body: { student_ids?: string[]; class_ids?: string; search?: string }) => apiClient.post<DrawManyResult>(`${base}/draw-many`, body),
  assign: (body: { student_id: string; house_id: string | null; reason?: string }) =>
    apiClient.put<{ unchanged: boolean }>(`${base}/assign`, body),

  /** Bring in house lists a school already has: rows of student number + house name. */
  importAssignments: (body: { rows: { student_number: string; house: string }[]; overwrite: boolean; create_missing: boolean }) =>
    apiClient.post<HouseImportResult>(`${base}/import`, body),

  // Teachers on houses (principal / admissions officer)
  teachers: () => apiClient.get<HouseTeacherOption[]>(`${base}/teachers`),
  assignStaff: (houseId: string, body: { user_id: string; position: 'master' | 'staff' }) => apiClient.put<unknown>(`${base}/${houseId}/staff`, body),
  removeStaff: (houseId: string, userId: string) => apiClient.delete<unknown>(`${base}/${houseId}/staff/${userId}`),
  setBallotPermission: (userId: string, can_draw: boolean) => apiClient.put<{ user_id: string; can_draw: boolean }>(`${base}/permissions/${userId}`, { can_draw }),

  // Sport-house badges for profiles (own badges, or another person's house posts for managers)
  badges: (userId?: string) => apiClient.get<SportBadgeItem[]>('/api/v1/sport-badge', { params: userId ? { user_id: userId } : {} }),

  // A teacher's own view
  myAccess: () => apiClient.get<TeacherHouseAccess>('/api/v1/houses/me'),
  myStudents: (params: { house_id?: string; search?: string } = {}) => apiClient.get<HouseStudent[]>('/api/v1/houses/me/students', { params }),
  myWaiting: (search?: string) => apiClient.get<HouseStudent[]>('/api/v1/houses/me/waiting', { params: search ? { search } : {} }),
  myDraw: (student_id: string) => apiClient.post<DrawResult>('/api/v1/houses/me/draw', { student_id }),
};

export default houseService;
