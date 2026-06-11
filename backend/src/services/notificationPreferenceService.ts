import { logger } from '@utils/logger';
import db from '@utils/database';

export interface NotificationPreferences {
  id: string;
  userId: string;
  // Notification type preferences
  gradeNotifications: boolean;
  attendanceNotifications: boolean;
  paymentNotifications: boolean;
  scheduleNotifications: boolean;
  enrollmentNotifications: boolean;
  // Channel preferences
  emailPreference: boolean;
  smsPreference: boolean;
  inAppPreference: boolean;
  // Frequency preferences
  frequencyPreference: 'real_time' | 'daily' | 'weekly'; // 'real_time' | 'daily' | 'weekly'
  // Unsubscribe tracking
  unsubscribedAt?: string;
  unsubscribeReason?: string;
  updatedAt: string;
}

class NotificationPreferenceService {
  /**
   * Get user notification preferences
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      let preferences = await db('notification_preferences')
        .where({ userId })
        .first();

      // Create default preferences if they don't exist
      if (!preferences) {
        preferences = await this.createDefaultPreferences(userId);
      }

      return this.formatPreferences(preferences);
    } catch (error) {
      logger.error(`Error fetching notification preferences for user ${userId}: ${error}`);
      throw new Error(`Failed to fetch notification preferences: ${error}`);
    }
  }

  /**
   * Update user notification preferences
   */
  async updatePreferences(userId: string, updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    try {
      // Ensure preferences exist
      let preferences = await db('notification_preferences')
        .where({ userId })
        .first();

      if (!preferences) {
        preferences = await this.createDefaultPreferences(userId);
      }

      // Update preferences
      const [updated] = await db('notification_preferences')
        .where({ userId })
        .update({
          ...(updates.gradeNotifications !== undefined && { gradeNotifications: updates.gradeNotifications }),
          ...(updates.attendanceNotifications !== undefined && { attendanceNotifications: updates.attendanceNotifications }),
          ...(updates.paymentNotifications !== undefined && { paymentNotifications: updates.paymentNotifications }),
          ...(updates.scheduleNotifications !== undefined && { scheduleNotifications: updates.scheduleNotifications }),
          ...(updates.enrollmentNotifications !== undefined && { enrollmentNotifications: updates.enrollmentNotifications }),
          ...(updates.emailPreference !== undefined && { emailPreference: updates.emailPreference }),
          ...(updates.smsPreference !== undefined && { smsPreference: updates.smsPreference }),
          ...(updates.inAppPreference !== undefined && { inAppPreference: updates.inAppPreference }),
          ...(updates.frequencyPreference && { frequencyPreference: updates.frequencyPreference }),
          updatedAt: db.fn.now(),
        })
        .returning('*');

      logger.info(`Notification preferences updated for user: ${userId}`);
      return this.formatPreferences(updated);
    } catch (error) {
      logger.error(`Error updating notification preferences: ${error}`);
      throw new Error(`Failed to update notification preferences: ${error}`);
    }
  }

  /**
   * Reset preferences to default
   */
  async resetPreferences(userId: string): Promise<NotificationPreferences> {
    try {
      await db('notification_preferences')
        .where({ userId })
        .delete();

      const preferences = await this.createDefaultPreferences(userId);
      logger.info(`Notification preferences reset for user: ${userId}`);
      return this.formatPreferences(preferences);
    } catch (error) {
      logger.error(`Error resetting notification preferences: ${error}`);
      throw new Error(`Failed to reset notification preferences: ${error}`);
    }
  }

  /**
   * Unsubscribe user from all notifications
   */
  async unsubscribeAll(userId: string, reason?: string): Promise<NotificationPreferences> {
    try {
      const [updated] = await db('notification_preferences')
        .where({ userId })
        .update({
          gradeNotifications: false,
          attendanceNotifications: false,
          paymentNotifications: false,
          scheduleNotifications: false,
          enrollmentNotifications: false,
          emailPreference: false,
          smsPreference: false,
          inAppPreference: false,
          unsubscribedAt: db.fn.now(),
          unsubscribeReason: reason,
          updatedAt: db.fn.now(),
        })
        .returning('*');

      logger.info(`User ${userId} unsubscribed from all notifications`);
      return this.formatPreferences(updated);
    } catch (error) {
      logger.error(`Error unsubscribing user: ${error}`);
      throw new Error(`Failed to unsubscribe user: ${error}`);
    }
  }

  /**
   * Resubscribe user to notifications
   */
  async resubscribe(userId: string): Promise<NotificationPreferences> {
    try {
      const [updated] = await db('notification_preferences')
        .where({ userId })
        .update({
          gradeNotifications: true,
          attendanceNotifications: true,
          paymentNotifications: true,
          scheduleNotifications: true,
          enrollmentNotifications: true,
          emailPreference: true,
          smsPreference: true,
          inAppPreference: true,
          unsubscribedAt: null,
          unsubscribeReason: null,
          updatedAt: db.fn.now(),
        })
        .returning('*');

      logger.info(`User ${userId} resubscribed to notifications`);
      return this.formatPreferences(updated);
    } catch (error) {
      logger.error(`Error resubscribing user: ${error}`);
      throw new Error(`Failed to resubscribe user: ${error}`);
    }
  }

  /**
   * Check if user should receive notification
   */
  async shouldReceiveNotification(
    userId: string,
    notificationType: string,
    channel: string
  ): Promise<boolean> {
    try {
      const preferences = await this.getPreferences(userId);

      // Check if unsubscribed
      if (preferences.unsubscribedAt) {
        return false;
      }

      // Check notification type preference
      let typeEnabled = true;
      switch (notificationType) {
        case 'grade':
          typeEnabled = preferences.gradeNotifications;
          break;
        case 'attendance':
          typeEnabled = preferences.attendanceNotifications;
          break;
        case 'payment':
          typeEnabled = preferences.paymentNotifications;
          break;
        case 'schedule':
          typeEnabled = preferences.scheduleNotifications;
          break;
        case 'enrollment':
          typeEnabled = preferences.enrollmentNotifications;
          break;
      }

      if (!typeEnabled) {
        return false;
      }

      // Check channel preference
      let channelEnabled = true;
      switch (channel) {
        case 'email':
          channelEnabled = preferences.emailPreference;
          break;
        case 'sms':
          channelEnabled = preferences.smsPreference;
          break;
        case 'in_app':
          channelEnabled = preferences.inAppPreference;
          break;
      }

      return channelEnabled;
    } catch (error) {
      logger.error(`Error checking notification permission: ${error}`);
      return false;
    }
  }

  /**
   * Set notification type preference
   */
  async setNotificationTypePreference(
    userId: string,
    notificationType: string,
    enabled: boolean
  ): Promise<NotificationPreferences> {
    try {
      let updateField: string;

      switch (notificationType) {
        case 'grade':
          updateField = 'gradeNotifications';
          break;
        case 'attendance':
          updateField = 'attendanceNotifications';
          break;
        case 'payment':
          updateField = 'paymentNotifications';
          break;
        case 'schedule':
          updateField = 'scheduleNotifications';
          break;
        case 'enrollment':
          updateField = 'enrollmentNotifications';
          break;
        default:
          throw new Error(`Unknown notification type: ${notificationType}`);
      }

      const [updated] = await db('notification_preferences')
        .where({ userId })
        .update({
          [updateField]: enabled,
          updatedAt: db.fn.now(),
        })
        .returning('*');

      logger.info(`${notificationType} notification preference set to ${enabled} for user: ${userId}`);
      return this.formatPreferences(updated);
    } catch (error) {
      logger.error(`Error setting notification type preference: ${error}`);
      throw new Error(`Failed to set notification type preference: ${error}`);
    }
  }

  /**
   * Set channel preference
   */
  async setChannelPreference(
    userId: string,
    channel: string,
    enabled: boolean
  ): Promise<NotificationPreferences> {
    try {
      let updateField: string;

      switch (channel) {
        case 'email':
          updateField = 'emailPreference';
          break;
        case 'sms':
          updateField = 'smsPreference';
          break;
        case 'in_app':
          updateField = 'inAppPreference';
          break;
        default:
          throw new Error(`Unknown channel: ${channel}`);
      }

      const [updated] = await db('notification_preferences')
        .where({ userId })
        .update({
          [updateField]: enabled,
          updatedAt: db.fn.now(),
        })
        .returning('*');

      logger.info(`Channel preference ${channel} set to ${enabled} for user: ${userId}`);
      return this.formatPreferences(updated);
    } catch (error) {
      logger.error(`Error setting channel preference: ${error}`);
      throw new Error(`Failed to set channel preference: ${error}`);
    }
  }

  /**
   * Set frequency preference
   */
  async setFrequencyPreference(
    userId: string,
    frequency: 'real_time' | 'daily' | 'weekly'
  ): Promise<NotificationPreferences> {
    try {
      const [updated] = await db('notification_preferences')
        .where({ userId })
        .update({
          frequencyPreference: frequency,
          updatedAt: db.fn.now(),
        })
        .returning('*');

      logger.info(`Frequency preference set to ${frequency} for user: ${userId}`);
      return this.formatPreferences(updated);
    } catch (error) {
      logger.error(`Error setting frequency preference: ${error}`);
      throw new Error(`Failed to set frequency preference: ${error}`);
    }
  }

  /**
   * Get summary of all user preferences (for dashboard/admin)
   */
  async getPreferencesSummary(): Promise<Record<string, any>> {
    try {
      const totalUsers = await db('notification_preferences')
        .count('* as count')
        .first();

      const unsubscribedUsers = await db('notification_preferences')
        .whereNotNull('unsubscribedAt')
        .count('* as count')
        .first();

      const emailOptIn = await db('notification_preferences')
        .where({ emailPreference: true })
        .count('* as count')
        .first();

      const smsOptIn = await db('notification_preferences')
        .where({ smsPreference: true })
        .count('* as count')
        .first();

      const inAppOptIn = await db('notification_preferences')
        .where({ inAppPreference: true })
        .count('* as count')
        .first();

      const frequencyDistribution = await db('notification_preferences')
        .groupBy('frequencyPreference')
        .select('frequencyPreference')
        .count('* as count');

      return {
        totalUsers: totalUsers?.count || 0,
        unsubscribedUsers: unsubscribedUsers?.count || 0,
        channels: {
          email: emailOptIn?.count || 0,
          sms: smsOptIn?.count || 0,
          inApp: inAppOptIn?.count || 0,
        },
        frequencyPreferences: frequencyDistribution.reduce((acc, row) => {
          acc[row.frequencyPreference] = row.count;
          return acc;
        }, {}),
      };
    } catch (error) {
      logger.error(`Error getting preferences summary: ${error}`);
      throw new Error(`Failed to get preferences summary: ${error}`);
    }
  }

  /**
   * Create default preferences for new user
   */
  private async createDefaultPreferences(userId: string): Promise<any> {
    try {
      const [preferences] = await db('notification_preferences')
        .insert({
          userId,
          gradeNotifications: true,
          attendanceNotifications: true,
          paymentNotifications: true,
          scheduleNotifications: true,
          enrollmentNotifications: true,
          emailPreference: true,
          smsPreference: false, // SMS opt-in by default false
          inAppPreference: true,
          frequencyPreference: 'real_time',
        })
        .returning('*');

      logger.info(`Default notification preferences created for user: ${userId}`);
      return preferences;
    } catch (error) {
      logger.error(`Error creating default preferences: ${error}`);
      throw new Error(`Failed to create default preferences: ${error}`);
    }
  }

  /**
   * Helper method to format preferences response
   */
  private formatPreferences(prefs: any): NotificationPreferences {
    return {
      id: prefs.id,
      userId: prefs.userId,
      gradeNotifications: prefs.gradeNotifications,
      attendanceNotifications: prefs.attendanceNotifications,
      paymentNotifications: prefs.paymentNotifications,
      scheduleNotifications: prefs.scheduleNotifications,
      enrollmentNotifications: prefs.enrollmentNotifications,
      emailPreference: prefs.emailPreference,
      smsPreference: prefs.smsPreference,
      inAppPreference: prefs.inAppPreference,
      frequencyPreference: prefs.frequencyPreference,
      unsubscribedAt: prefs.unsubscribedAt,
      unsubscribeReason: prefs.unsubscribeReason,
      updatedAt: prefs.updatedAt,
    };
  }
}

export default new NotificationPreferenceService();
