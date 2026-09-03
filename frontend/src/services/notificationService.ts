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
    // apiClient.get already returns the parsed JSON body. The endpoint responds
    // { data: [...], total }, but be defensive about every shape so the caller
    // ALWAYS receives an array.
    const res: any = await apiClient.get('/api/v1/notifications', { params });
    const arr =
      (Array.isArray(res?.data) && res.data) ||
      (Array.isArray(res?.data?.data) && res.data.data) ||
      (Array.isArray(res?.notifications) && res.notifications) ||
      (Array.isArray(res) && res) ||
      [];
    const total = Number(res?.total ?? res?.data?.total ?? arr.length ?? 0);
    return { data: arr as AppNotification[], total } as NotificationListResponse;
  },

  /** Unread count. Falls back to list(total) if the count endpoint misbehaves. */
  unreadCount: async (): Promise<number> => {
    try {
      const res = await notificationService.list({ unreadOnly: true, limit: 1 });
      return res.total;
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
