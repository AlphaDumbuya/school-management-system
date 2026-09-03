/**
 * notificationService (frontend) — reads the user's in-app notifications from
 * the canonical /notifications API and supports mark-read actions.
 */
import apiClient from '@lib/apiClient';

export interface AppNotification {
  id: string;
  notificationType: string;
  recipientId: string;
  subject?: string;
  message: string;
  data?: Record<string, any>;
  readAt?: string | null;
  status: string;
  sourceType?: string;
  sourceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  data: AppNotification[];
  total: number;
}

const notificationService = {
  /** List notifications (most recent first). Optionally only unread. */
  list: async (opts?: { unreadOnly?: boolean; limit?: number; offset?: number }) => {
    const params: Record<string, any> = {
      limit: opts?.limit ?? 20,
      offset: opts?.offset ?? 0,
    };
    if (opts?.unreadOnly) params.isRead = 'false';
    // The backend wraps as { data, total } (not the ApiResponse shape), so read raw.
    const res: any = await apiClient.get('/api/v1/notifications', { params });
    const body = res?.data ?? res ?? {};
    return {
      data: (body.data ?? body ?? []) as AppNotification[],
      total: Number(body.total ?? 0),
    } as NotificationListResponse;
  },

  /** Unread count. Falls back to list(total) if the count endpoint misbehaves. */
  unreadCount: async (): Promise<number> => {
    try {
      const res: any = await apiClient.get('/api/v1/notifications', {
        params: { isRead: 'false', limit: 1, offset: 0 },
      });
      const body = res?.data ?? res ?? {};
      return Number(body.total ?? 0);
    } catch {
      return 0;
    }
  },

  markRead: async (id: string) => {
    return apiClient.patch(`/api/v1/notifications/${id}/read`);
  },

  markAllRead: async () => {
    return apiClient.patch('/api/v1/notifications/mark-all-read');
  },

  remove: async (id: string) => {
    return apiClient.delete(`/api/v1/notifications/${id}`);
  },
};

export default notificationService;
