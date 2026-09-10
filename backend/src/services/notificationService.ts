import { Request } from 'express';
import { logger } from '@utils/logger';
import db from '@utils/database';

export interface CreateNotificationRequest {
  notificationType?: string; // 'grade', 'attendance', 'payment', 'schedule', 'enrollment'
  recipientId?: string;
  subject?: string;
  message: string;
  data?: Record<string, any>;
  channels?: string[]; // ['email', 'sms', 'in_app']
  sourceType?: string;
  sourceId?: string;
  createdBy?: string;
  // ── Legacy field aliases (used by discipline/appeal services) ──────────────
  // Accepted and normalised so those callers create real, targeted notifications
  // instead of rows with a null recipient (which never showed in the bell).
  user_id?: string;
  tenant_id?: string;
  type?: string;
  title?: string;
  related_entity?: string;
  related_id?: string;
}

export interface NotificationFilter {
  recipientId?: string;
  notificationType?: string;
  status?: string;
  isRead?: boolean;
  limit?: number;
  offset?: number;
}

export interface Notification {
  id: string;
  notificationType: string;
  recipientId: string;
  subject?: string;
  message: string;
  data?: Record<string, any>;
  channels: string[];
  readAt?: string;
  status: string;
  sourceType?: string;
  sourceId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification(req: CreateNotificationRequest): Promise<Notification> {
    try {
      const channels = req.channels || ['in_app'];

      // Normalise legacy field aliases so all callers create targeted rows.
      const recipientId = req.recipientId || req.user_id;
      const notificationType = req.notificationType || req.type || 'info';
      const subject = req.subject || req.title;
      const sourceType = req.sourceType || req.related_entity;
      const sourceId = req.sourceId || req.related_id;

      if (!recipientId) {
        logger.warn('createNotification called without a recipient — skipping');
        throw new Error('recipientId (or user_id) is required');
      }

      const [notification] = await db('notifications')
        .insert({
          notificationType,
          recipientId,
          subject,
          message: req.message,
          data: req.data ? JSON.stringify(req.data) : null,
          channels,
          sourceType,
          sourceId,
          createdBy: req.createdBy,
          status: 'pending',
        })
        .returning('*');

      logger.info(`Notification created: ${notification.id} for user: ${recipientId}`);
      return this.formatNotification(notification);
    } catch (error) {
      logger.error(`Error creating notification: ${error}`);
      throw new Error(`Failed to create notification: ${error}`);
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(notificationId: string): Promise<Notification | null> {
    try {
      const notification = await db('notifications')
        .where({ id: notificationId })
        .first();

      if (!notification) {
        return null;
      }

      return this.formatNotification(notification);
    } catch (error) {
      logger.error(`Error fetching notification ${notificationId}: ${error}`);
      throw new Error(`Failed to fetch notification: ${error}`);
    }
  }

  /**
   * Get user notifications with filtering
   */
  async getUserNotifications(recipientId: string, filter: NotificationFilter = {}): Promise<{
    notifications: Notification[];
    total: number;
  }> {
    try {
      const limit = filter.limit || 20;
      const offset = filter.offset || 0;

      let query = db('notifications').where({ recipientId });

      if (filter.notificationType) {
        query = query.where({ notificationType: filter.notificationType });
      }

      if (filter.status) {
        query = query.where({ status: filter.status });
      }

      if (filter.isRead !== undefined) {
        if (filter.isRead) {
          query = query.whereNotNull('readAt');
        } else {
          query = query.whereNull('readAt');
        }
      }

      const total = await query.clone().count('* as count').first();
      const notifications = await query
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset);

      return {
        notifications: notifications.map(n => this.formatNotification(n)),
        total: total.count,
      };
    } catch (error) {
      logger.error(`Error fetching user notifications: ${error}`);
      throw new Error(`Failed to fetch notifications: ${error}`);
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<Notification> {
    try {
      const [updated] = await db('notifications')
        .where({ id: notificationId })
        .update({
          readAt: db.fn.now(),
          status: 'read',
          updatedAt: db.fn.now(),
        })
        .returning('*');

      if (!updated) {
        throw new Error('Notification not found');
      }

      logger.info(`Notification marked as read: ${notificationId}`);
      return this.formatNotification(updated);
    } catch (error) {
      logger.error(`Error marking notification as read: ${error}`);
      throw new Error(`Failed to mark notification as read: ${error}`);
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(recipientId: string): Promise<number> {
    try {
      const updated = await db('notifications')
        .where({ recipientId })
        .whereNull('readAt')
        .update({
          readAt: db.fn.now(),
          status: 'read',
          updatedAt: db.fn.now(),
        });

      logger.info(`Marked ${updated} notifications as read for user: ${recipientId}`);
      return updated;
    } catch (error) {
      logger.error(`Error marking all notifications as read: ${error}`);
      throw new Error(`Failed to mark all notifications as read: ${error}`);
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const deleted = await db('notifications')
        .where({ id: notificationId })
        .delete();

      if (deleted === 0) {
        throw new Error('Notification not found');
      }

      logger.info(`Notification deleted: ${notificationId}`);
    } catch (error) {
      logger.error(`Error deleting notification: ${error}`);
      throw new Error(`Failed to delete notification: ${error}`);
    }
  }

  /**
   * Get unread notification count for user
   */
  async getUnreadCount(recipientId: string): Promise<number> {
    try {
      const result = await db('notifications')
        .where({ recipientId })
        .whereNull('readAt')
        .count('* as count')
        .first();

      return result.count || 0;
    } catch (error) {
      logger.error(`Error fetching unread count: ${error}`);
      throw new Error(`Failed to fetch unread count: ${error}`);
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(recipientId?: string): Promise<Record<string, any>> {
    try {
      let query = db('notifications');
      
      if (recipientId) {
        query = query.where({ recipientId });
      }

      const totalCount = await query.clone().count('* as count').first();
      const unreadCount = await query
        .clone()
        .whereNull('readAt')
        .count('* as count')
        .first();

      const byType = await query
        .clone()
        .groupBy('notificationType')
        .select('notificationType')
        .count('* as count');

      const byStatus = await query
        .clone()
        .groupBy('status')
        .select('status')
        .count('* as count');

      const byChannel = await db.raw(`
        SELECT channel, COUNT(*) as count 
        FROM notifications, unnest(channels) as channel
        ${recipientId ? `WHERE "recipientId" = :recipientId` : ''}
        GROUP BY channel
      `, { recipientId });

      return {
        total: totalCount.count,
        unread: unreadCount.count,
        byType: byType.reduce((acc, row) => {
          acc[row.notificationType] = row.count;
          return acc;
        }, {}),
        byStatus: byStatus.reduce((acc, row) => {
          acc[row.status] = row.count;
          return acc;
        }, {}),
        byChannel: byChannel.rows.reduce((acc, row) => {
          acc[row.channel] = row.count;
          return acc;
        }, {}),
      };
    } catch (error) {
      logger.error(`Error fetching notification stats: ${error}`);
      throw new Error(`Failed to fetch notification stats: ${error}`);
    }
  }

  /**
   * Bulk create notifications
   */
  async bulkCreateNotifications(notifications: CreateNotificationRequest[]): Promise<Notification[]> {
    try {
      const created = await db('notifications')
        .insert(
          notifications.map(n => ({
            notificationType: n.notificationType,
            recipientId: n.recipientId,
            subject: n.subject,
            message: n.message,
            data: n.data ? JSON.stringify(n.data) : null,
            channels: n.channels || ['in_app'],
            sourceType: n.sourceType,
            sourceId: n.sourceId,
            createdBy: n.createdBy,
            status: 'pending',
          }))
        )
        .returning('*');

      logger.info(`Bulk created ${created.length} notifications`);
      return created.map(n => this.formatNotification(n));
    } catch (error) {
      logger.error(`Error bulk creating notifications: ${error}`);
      throw new Error(`Failed to bulk create notifications: ${error}`);
    }
  }

  /**
   * Update notification status
   */
  async updateNotificationStatus(notificationId: string, status: string): Promise<Notification> {
    try {
      const [updated] = await db('notifications')
        .where({ id: notificationId })
        .update({
          status,
          updatedAt: db.fn.now(),
        })
        .returning('*');

      if (!updated) {
        throw new Error('Notification not found');
      }

      logger.info(`Notification status updated: ${notificationId} -> ${status}`);
      return this.formatNotification(updated);
    } catch (error) {
      logger.error(`Error updating notification status: ${error}`);
      throw new Error(`Failed to update notification status: ${error}`);
    }
  }

  /**
   * Get notifications for delivery (pending)
   */
  async getNotificationsForDelivery(channel: string, limit: number = 100): Promise<Notification[]> {
    try {
      const notifications = await db('notifications')
        .where({ status: 'pending' })
        .whereRaw("? = ANY(channels)", [channel])
        .limit(limit)
        .orderBy('createdAt', 'asc');

      return notifications.map(n => this.formatNotification(n));
    } catch (error) {
      logger.error(`Error fetching notifications for delivery: ${error}`);
      throw new Error(`Failed to fetch notifications for delivery: ${error}`);
    }
  }

  /**
   * Archive old notifications (older than specified days)
   */
  async archiveOldNotifications(daysOld: number = 90): Promise<number> {
    try {
      const archived = await db('notifications')
        .where('createdAt', '<', db.raw(`NOW() - INTERVAL '${daysOld} days'`))
        .del();

      logger.info(`Archived ${archived} old notifications`);
      return archived;
    } catch (error) {
      logger.error(`Error archiving old notifications: ${error}`);
      throw new Error(`Failed to archive notifications: ${error}`);
    }
  }

  /**
   * Helper method to format notification response
   */
  private formatNotification(notification: any): Notification {
    return {
      id: notification.id,
      notificationType: notification.notificationType,
      recipientId: notification.recipientId,
      subject: notification.subject,
      message: notification.message,
      // The `data` column is a Postgres json type, so the pg driver already
      // returns it parsed. Only JSON.parse when it's actually a string, and
      // never let a malformed value crash the whole notifications list.
      data: (() => {
        const d = notification.data;
        if (d == null) return undefined;
        if (typeof d === 'object') return d;
        try { return JSON.parse(d); } catch { return undefined; }
      })(),
      channels: Array.isArray(notification.channels) ? notification.channels : [],
      readAt: notification.readAt,
      status: notification.status,
      sourceType: notification.sourceType,
      sourceId: notification.sourceId,
      createdBy: notification.createdBy,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }
}

export default new NotificationService();
