import { logger } from '@utils/logger';
import db from '@utils/database';

export interface InAppNotification {
  id: string;
  notificationId: string;
  recipientId: string;
  title: string;
  message: string;
  icon?: string;
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high'; // low | medium | high
  isRead: boolean;
  readAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

class InAppNotificationService {
  /**
   * Create in-app notification
   */
  async createInAppNotification(notificationId: string, data: {
    recipientId: string;
    title: string;
    message: string;
    icon?: string;
    actionUrl?: string;
    priority?: string;
    expiresIn?: number; // hours until expiration
  }): Promise<InAppNotification> {
    try {
      let expiresAt = null;
      if (data.expiresIn) {
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + data.expiresIn);
        expiresAt = expiry;
      }

      const [created] = await db('in_app_notifications')
        .insert({
          notificationId,
          recipientId: data.recipientId,
          title: data.title,
          message: data.message,
          icon: data.icon,
          actionUrl: data.actionUrl,
          priority: data.priority || 'medium',
          isRead: false,
          expiresAt,
        })
        .returning('*');

      logger.info(`In-app notification created: ${created.id} for user: ${data.recipientId}`);
      return this.formatNotification(created);
    } catch (error) {
      logger.error(`Error creating in-app notification: ${error}`);
      throw new Error(`Failed to create in-app notification: ${error}`);
    }
  }

  /**
   * Get user in-app notifications
   */
  async getUserInAppNotifications(recipientId: string, options: {
    limit?: number;
    offset?: number;
    includeRead?: boolean;
  } = {}): Promise<{
    notifications: InAppNotification[];
    total: number;
    unread: number;
  }> {
    try {
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      let query = db('in_app_notifications').where({ recipientId });

      if (options.includeRead === false) {
        query = query.where({ isRead: false });
      }

      // Exclude expired notifications
      query = query.where((qb: any) => {
        qb.whereNull('expiresAt').orWhere('expiresAt', '>', db.fn.now());
      });

      const total = await query.clone().count('* as count').first();
      const unread = await query
        .clone()
        .where({ isRead: false })
        .count('* as count')
        .first();

      const notifications = await query
        .orderBy('priority', 'desc')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset);

      return {
        notifications: notifications.map((n: any) => this.formatNotification(n)),
        total: total?.count || 0,
        unread: unread?.count || 0,
      };
    } catch (error) {
      logger.error(`Error fetching user in-app notifications: ${error}`);
      throw new Error(`Failed to fetch in-app notifications: ${error}`);
    }
  }

  /**
   * Mark in-app notification as read
   */
  async markAsRead(notificationId: string, recipientId: string): Promise<InAppNotification> {
    try {
      const [updated] = await db('in_app_notifications')
        .where({ notificationId, recipientId })
        .update({
          isRead: true,
          readAt: db.fn.now(),
          updatedAt: db.fn.now(),
        })
        .returning('*');

      if (!updated) {
        throw new Error('In-app notification not found');
      }

      logger.info(`In-app notification marked as read: ${notificationId}`);
      return this.formatNotification(updated);
    } catch (error) {
      logger.error(`Error marking in-app notification as read: ${error}`);
      throw new Error(`Failed to mark in-app notification as read: ${error}`);
    }
  }

  /**
   * Mark all in-app notifications as read for user
   */
  async markAllAsRead(recipientId: string): Promise<number> {
    try {
      const updated = await db('in_app_notifications')
        .where({ recipientId, isRead: false })
        .update({
          isRead: true,
          readAt: db.fn.now(),
          updatedAt: db.fn.now(),
        });

      logger.info(`Marked ${updated} in-app notifications as read for user: ${recipientId}`);
      return updated;
    } catch (error) {
      logger.error(`Error marking all in-app notifications as read: ${error}`);
      throw new Error(`Failed to mark all in-app notifications as read: ${error}`);
    }
  }

  /**
   * Delete in-app notification
   */
  async deleteInAppNotification(notificationId: string, recipientId: string): Promise<void> {
    try {
      const deleted = await db('in_app_notifications')
        .where({ notificationId, recipientId })
        .delete();

      if (deleted === 0) {
        throw new Error('In-app notification not found');
      }

      logger.info(`In-app notification deleted: ${notificationId}`);
    } catch (error) {
      logger.error(`Error deleting in-app notification: ${error}`);
      throw new Error(`Failed to delete in-app notification: ${error}`);
    }
  }

  /**
   * Archive in-app notifications (soft delete by expiration)
   */
  async archiveInAppNotifications(recipientId: string, daysOld: number = 30): Promise<number> {
    try {
      // Bind the interval count as a parameter — never interpolate into SQL.
      const days = Math.max(0, Math.trunc(Number(daysOld)) || 0);
      const archived = await db('in_app_notifications')
        .where({ recipientId })
        .where('createdAt', '<', db.raw(`NOW() - (? * INTERVAL '1 day')`, [days]))
        .update({
          expiresAt: db.fn.now(),
        });

      logger.info(`Archived ${archived} old in-app notifications for user: ${recipientId}`);
      return archived;
    } catch (error) {
      logger.error(`Error archiving old in-app notifications: ${error}`);
      throw new Error(`Failed to archive in-app notifications: ${error}`);
    }
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(recipientId: string): Promise<number> {
    try {
      const result = await db('in_app_notifications')
        .where({ recipientId, isRead: false })
        .where((qb: any) => {
          qb.whereNull('expiresAt').orWhere('expiresAt', '>', db.fn.now());
        })
        .count('* as count')
        .first();

      return result?.count || 0;
    } catch (error) {
      logger.error(`Error fetching unread count: ${error}`);
      throw new Error(`Failed to fetch unread count: ${error}`);
    }
  }

  /**
   * Get in-app notification by ID
   */
  async getInAppNotification(notificationId: string): Promise<InAppNotification | null> {
    try {
      const notification = await db('in_app_notifications')
        .where({ notificationId })
        .first();

      if (!notification) {
        return null;
      }

      return this.formatNotification(notification);
    } catch (error) {
      logger.error(`Error fetching in-app notification: ${error}`);
      throw new Error(`Failed to fetch in-app notification: ${error}`);
    }
  }

  /**
   * Get high priority notifications for user
   */
  async getHighPriorityNotifications(recipientId: string, limit: number = 10): Promise<InAppNotification[]> {
    try {
      const notifications = await db('in_app_notifications')
        .where({ recipientId, priority: 'high', isRead: false })
        .where((qb: any) => {
          qb.whereNull('expiresAt').orWhere('expiresAt', '>', db.fn.now());
        })
        .orderBy('createdAt', 'desc')
        .limit(limit);

      return notifications.map((n: any) => this.formatNotification(n));
    } catch (error) {
      logger.error(`Error fetching high priority notifications: ${error}`);
      throw new Error(`Failed to fetch high priority notifications: ${error}`);
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(recipientId: string): Promise<Record<string, any>> {
    try {
      const total = await db('in_app_notifications')
        .where({ recipientId })
        .where((qb: any) => {
          qb.whereNull('expiresAt').orWhere('expiresAt', '>', db.fn.now());
        })
        .count('* as count')
        .first();

      const unread = await db('in_app_notifications')
        .where({ recipientId, isRead: false })
        .where((qb: any) => {
          qb.whereNull('expiresAt').orWhere('expiresAt', '>', db.fn.now());
        })
        .count('* as count')
        .first();

      const byPriority = await db('in_app_notifications')
        .where({ recipientId })
        .where((qb: any) => {
          qb.whereNull('expiresAt').orWhere('expiresAt', '>', db.fn.now());
        })
        .groupBy('priority')
        .select('priority')
        .count('* as count');

      return {
        total: total?.count || 0,
        unread: unread?.count || 0,
        byPriority: byPriority.reduce((acc: any, row: any) => {
          acc[row.priority] = row.count;
          return acc;
        }, {}),
      };
    } catch (error) {
      logger.error(`Error fetching notification stats: ${error}`);
      throw new Error(`Failed to fetch notification stats: ${error}`);
    }
  }

  /**
   * Clean up expired notifications
   */
  async cleanupExpiredNotifications(): Promise<number> {
    try {
      const cleaned = await db('in_app_notifications')
        .where('expiresAt', '<', db.fn.now())
        .delete();

      logger.info(`Cleaned up ${cleaned} expired in-app notifications`);
      return cleaned;
    } catch (error) {
      logger.error(`Error cleaning up expired notifications: ${error}`);
      throw new Error(`Failed to clean up expired notifications: ${error}`);
    }
  }

  /**
   * Bulk create in-app notifications
   */
  async bulkCreateInAppNotifications(notifications: Array<{
    notificationId: string;
    recipientId: string;
    title: string;
    message: string;
    icon?: string;
    actionUrl?: string;
    priority?: string;
  }>): Promise<InAppNotification[]> {
    try {
      const created = await db('in_app_notifications')
        .insert(
          notifications.map(n => ({
            notificationId: n.notificationId,
            recipientId: n.recipientId,
            title: n.title,
            message: n.message,
            icon: n.icon,
            actionUrl: n.actionUrl,
            priority: n.priority || 'medium',
            isRead: false,
          }))
        )
        .returning('*');

      logger.info(`Bulk created ${created.length} in-app notifications`);
      return created.map((n: any) => this.formatNotification(n));
    } catch (error) {
      logger.error(`Error bulk creating in-app notifications: ${error}`);
      throw new Error(`Failed to bulk create in-app notifications: ${error}`);
    }
  }

  /**
   * Helper method to format notification response
   */
  private formatNotification(notification: any): InAppNotification {
    return {
      id: notification.id,
      notificationId: notification.notificationId,
      recipientId: notification.recipientId,
      title: notification.title,
      message: notification.message,
      icon: notification.icon,
      actionUrl: notification.actionUrl,
      priority: notification.priority,
      isRead: notification.isRead,
      readAt: notification.readAt,
      expiresAt: notification.expiresAt,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }
}

export default new InAppNotificationService();
