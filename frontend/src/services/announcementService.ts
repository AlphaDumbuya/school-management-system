/**
 * announcementService — client for /api/v1/announcements (tenant-scoped).
 */
import { apiClient } from '@lib/apiClient';

export type AnnouncementAudience =
  | 'all' | 'teacher' | 'student' | 'parent' | 'accountant' | 'admissions_officer';
export type AnnouncementPriority = 'normal' | 'high';

export interface Announcement {
  id: string;
  tenant_id: string;
  author_id: string;
  author_name?: string;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  priority: AnnouncementPriority;
  email_sent: boolean;
  is_read?: boolean;
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
  async list(params: { limit?: number; offset?: number } = {}) {
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
