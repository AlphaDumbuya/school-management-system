/**
 * announcementService — client for /api/v1/announcements (tenant-scoped).
 */
import { apiClient } from '@lib/apiClient';

/**
 * 'owner' = the school owner(s); 'principal' = the school's leaders, shown as
 * "Head Teacher" or "Principal" by school level (owners are principals too).
 */
export type AnnouncementAudience =
  | 'all' | 'owner' | 'principal' | 'teacher' | 'student' | 'parent' | 'accountant' | 'admissions_officer';
export type AnnouncementPriority = 'normal' | 'high';

export interface Announcement {
  id: string;
  tenant_id: string;
  author_id: string;
  author_name?: string;
  /** Respectful role-based display name, e.g. "Head Teacher Alpha Dumbuya" or "School Owner Alpha Dumbuya". */
  author_display?: string;
  author_role?: string;
  /** The author is a named school owner. */
  author_is_owner?: boolean;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  priority: AnnouncementPriority;
  email_sent: boolean;
  is_read?: boolean;
  /** Class-scoped post: which class it went to. */
  class_id?: string | null;
  class_name?: string | null;
  /** Posted in a past academic year — read-only history. */
  is_history?: boolean;
  created_at: string;
}

export interface CreateAnnouncementPayload {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  priority?: AnnouncementPriority;
  notifyByEmail?: boolean;
  /** Optional class scope (required for teachers). */
  classId?: string | null;
}

export interface TeacherClass {
  id: string;
  name: string;
  level?: string;
}

export const announcementService = {
  /** List announcements visible to the current user. */
  async list(params: { limit?: number; offset?: number; academic_year?: string } = {}) {
    return apiClient.get<Announcement[]>('/api/v1/announcements', { params });
  },

  /** Create a new announcement. */
  async create(payload: CreateAnnouncementPayload) {
    return apiClient.post<Announcement>('/api/v1/announcements', payload);
  },

  /** Update an existing announcement. */
  async update(id: string, payload: Partial<CreateAnnouncementPayload>) {
    return apiClient.put<Announcement>(`/api/v1/announcements/${id}`, payload);
  },

  /** Delete an announcement by id. */
  async remove(id: string) {
    return apiClient.delete(`/api/v1/announcements/${id}`);
  },

  /** Number of unread announcements for the current user. */
  async unreadCount() {
    return apiClient.get<{ count: number }>('/api/v1/announcements/unread-count');
  },

  /** Mark one announcement as read. */
  async markRead(id: string) {
    return apiClient.post(`/api/v1/announcements/${id}/read`);
  },

  /** Mark all visible announcements as read. */
  async markAllRead() {
    return apiClient.post('/api/v1/announcements/read-all');
  },

  /** Classes the current teacher can announce to (empty for non-teachers). */
  async myClasses() {
    return apiClient.get<TeacherClass[]>('/api/v1/announcements/my-classes');
  },
};

export default announcementService;
