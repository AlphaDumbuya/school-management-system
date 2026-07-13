import db from '@utils/database';
import { logger } from '@utils/logger';
import type {
  MessageSchedule,
  CreateScheduleRequest,
  ScheduleType,
  MessagingAnalytics,
  UserMessagingStats,
  AnalyticsFilterRequest,
} from '../types/sms-whatsapp';
import smsWhatsAppService from './smsWhatsAppService';

/**
 * SMS & WhatsApp Scheduling Service
 * Manages scheduled messages and message delivery scheduling
 */
class SMSWhatsAppSchedulingService {
  /**
   * Create a scheduled message
   */
  async createSchedule(
    tenantId: string,
    request: CreateScheduleRequest,
    userId: string
  ): Promise<MessageSchedule> {
    try {
      const [schedule] = await db('message_schedules')
        .insert({
          tenant_id: tenantId,
          template_id: request.template_id,
          recipient_id: request.recipient_id,
          channel: request.channel,
          message_content: request.message_content,
          recipient_variables: request.template_variables ? JSON.stringify(request.template_variables) : null,
          schedule_type: request.schedule_type,
          first_send_time: request.first_send_time,
          next_send_time: request.first_send_time,
          recurrence_pattern: request.recurrence_pattern,
          max_occurrences: request.max_occurrences,
          end_date: request.end_date,
          metadata: request.metadata ? JSON.stringify(request.metadata) : null,
          created_by: userId,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      logger.info(`Schedule created: ${schedule.schedule_id}`);
      return this.formatSchedule(schedule);
    } catch (error) {
      logger.error(`Error creating schedule: ${error}`);
      throw new Error(`Failed to create schedule: ${error}`);
    }
  }

  /**
   * Get schedule by ID
   */
  async getScheduleById(scheduleId: string): Promise<MessageSchedule | null> {
    try {
      const schedule = await db('message_schedules')
        .where({ schedule_id: scheduleId })
        .first();

      return schedule ? this.formatSchedule(schedule) : null;
    } catch (error) {
      logger.error(`Error fetching schedule: ${error}`);
      throw new Error(`Failed to fetch schedule: ${error}`);
    }
  }

  /**
   * Get user schedules
   */
  async getUserSchedules(tenantId: string, userId: string): Promise<MessageSchedule[]> {
    try {
      const schedules = await db('message_schedules')
        .where({
          tenant_id: tenantId,
          recipient_id: userId,
          status: ['active', 'paused'],
        })
        .orderBy('next_send_time', 'asc');

      return schedules.map(s => this.formatSchedule(s));
    } catch (error) {
      logger.error(`Error fetching user schedules: ${error}`);
      throw new Error(`Failed to fetch schedules: ${error}`);
    }
  }

  /**
   * Get pending schedules for delivery
   */
  async getPendingSchedules(limit: number = 100): Promise<MessageSchedule[]> {
    try {
      const schedules = await db('message_schedules')
        .where({
          status: ['active', 'paused'],
        })
        .where('next_send_time', '<=', db.fn.now())
        .where((query) => {
          query.whereNull('end_date').orWhere('end_date', '>=', db.fn.now());
        })
        .limit(limit)
        .orderBy('next_send_time', 'asc');

      return schedules.map(s => this.formatSchedule(s));
    } catch (error) {
      logger.error(`Error fetching pending schedules: ${error}`);
      throw new Error(`Failed to fetch pending schedules: ${error}`);
    }
  }

  /**
   * Send scheduled message
   */
  async sendScheduledMessage(scheduleId: string): Promise<void> {
    try {
      const schedule = await this.getScheduleById(scheduleId);
      if (!schedule) {
        throw new Error('Schedule not found');
      }

      // Send message
      await smsWhatsAppService.sendMessage(
        schedule.tenant_id,
        {
          recipient_id: schedule.recipient_id,
          template_id: schedule.template_id || undefined,
          channel: schedule.channel,
          message_content: schedule.message_content || undefined,
          template_variables: schedule.recipient_variables || undefined,
          source_id: schedule.metadata?.source_id,
          source_type: schedule.metadata?.source_type,
        },
        schedule.created_by
      );

      // Update schedule
      const nextSendTime = this.calculateNextSendTime(schedule);
      const isCompleted = !nextSendTime || (schedule.max_occurrences && schedule.occurrences_sent + 1 >= schedule.max_occurrences);

      const updateData: Record<string, any> = {
        occurrences_sent: schedule.occurrences_sent + 1,
        updated_at: db.fn.now(),
      };

      if (isCompleted) {
        updateData.status = 'completed';
      } else {
        updateData.next_send_time = nextSendTime;
      }

      await db('message_schedules')
        .where({ schedule_id: scheduleId })
        .update(updateData);

      logger.info(`Scheduled message sent: ${scheduleId}`);
    } catch (error) {
      logger.error(`Error sending scheduled message: ${error}`);
      throw new Error(`Failed to send scheduled message: ${error}`);
    }
  }

  /**
   * Update schedule
   */
  async updateSchedule(
    scheduleId: string,
    updates: Partial<CreateScheduleRequest>
  ): Promise<MessageSchedule> {
    try {
      const updateData: Record<string, any> = {
        updated_at: db.fn.now(),
      };

      if (updates.first_send_time) updateData.first_send_time = updates.first_send_time;
      if (updates.recurrence_pattern) updateData.recurrence_pattern = updates.recurrence_pattern;
      if (updates.max_occurrences !== undefined) updateData.max_occurrences = updates.max_occurrences;
      if (updates.end_date) updateData.end_date = updates.end_date;
      if (updates.message_content) updateData.message_content = updates.message_content;
      if (updates.template_variables) updateData.recipient_variables = JSON.stringify(updates.template_variables);

      const [schedule] = await db('message_schedules')
        .where({ schedule_id: scheduleId })
        .update(updateData)
        .returning('*');

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      logger.info(`Schedule updated: ${scheduleId}`);
      return this.formatSchedule(schedule);
    } catch (error) {
      logger.error(`Error updating schedule: ${error}`);
      throw new Error(`Failed to update schedule: ${error}`);
    }
  }

  /**
   * Pause schedule
   */
  async pauseSchedule(scheduleId: string): Promise<MessageSchedule> {
    try {
      const [schedule] = await db('message_schedules')
        .where({ schedule_id: scheduleId })
        .update({
          status: 'paused',
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      logger.info(`Schedule paused: ${scheduleId}`);
      return this.formatSchedule(schedule);
    } catch (error) {
      logger.error(`Error pausing schedule: ${error}`);
      throw new Error(`Failed to pause schedule: ${error}`);
    }
  }

  /**
   * Resume schedule
   */
  async resumeSchedule(scheduleId: string): Promise<MessageSchedule> {
    try {
      const [schedule] = await db('message_schedules')
        .where({ schedule_id: scheduleId })
        .update({
          status: 'active',
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!schedule) {
        throw new Error('Schedule not found');
      }

      logger.info(`Schedule resumed: ${scheduleId}`);
      return this.formatSchedule(schedule);
    } catch (error) {
      logger.error(`Error resuming schedule: ${error}`);
      throw new Error(`Failed to resume schedule: ${error}`);
    }
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    try {
      const deleted = await db('message_schedules')
        .where({ schedule_id: scheduleId })
        .delete();

      if (deleted === 0) {
        throw new Error('Schedule not found');
      }

      logger.info(`Schedule deleted: ${scheduleId}`);
    } catch (error) {
      logger.error(`Error deleting schedule: ${error}`);
      throw new Error(`Failed to delete schedule: ${error}`);
    }
  }

  /**
   * Get messaging analytics
   */
  async getAnalytics(
    tenantId: string,
    filter: AnalyticsFilterRequest
  ): Promise<MessagingAnalytics[]> {
    try {
      let query = db('messaging_analytics').where({ tenant_id: tenantId });

      if (filter.channel) query = query.where({ channel: filter.channel });
      if (filter.provider_name) query = query.where({ provider_name: filter.provider_name });
      if (filter.date_from) query = query.where('analytics_date', '>=', filter.date_from);
      if (filter.date_to) query = query.where('analytics_date', '<=', filter.date_to);

      const analytics = await query.orderBy('analytics_date', 'desc');

      return analytics.map(a => this.formatAnalytics(a));
    } catch (error) {
      logger.error(`Error fetching analytics: ${error}`);
      throw new Error(`Failed to fetch analytics: ${error}`);
    }
  }

  /**
   * Get user messaging stats
   */
  async getUserStats(tenantId: string, userId: string): Promise<UserMessagingStats | null> {
    try {
      const stats = await db('messaging_user_stats')
        .where({ tenant_id: tenantId, user_id: userId })
        .first();

      return stats ? this.formatUserStats(stats) : null;
    } catch (error) {
      logger.error(`Error fetching user stats: ${error}`);
      throw new Error(`Failed to fetch user stats: ${error}`);
    }
  }

  /**
   * Aggregate daily analytics
   */
  async aggregateDailyAnalytics(tenantId: string, date: Date): Promise<void> {
    try {
      const dateStr = date.toISOString().split('T')[0];

      // Get SMS analytics
      const smsStats = await db('sms_whatsapp_messages')
        .where({ tenant_id: tenantId, channel: 'sms' })
        .whereRaw(`DATE(created_at) = ?`, [dateStr])
        .groupBy('provider_id')
        .select(
          'provider_id',
          db.raw('COUNT(*) as messages_sent'),
          db.raw(`SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as messages_delivered`),
          db.raw(`SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as messages_failed`),
          db.raw(`SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as messages_bounced`),
          db.raw('SUM(cost) as total_cost'),
          db.raw('COUNT(DISTINCT recipient_id) as distinct_recipients')
        );

      for (const stat of smsStats) {
        const provider = await db('sms_whatsapp_providers').where({ provider_id: stat.provider_id }).first();
        await db('messaging_analytics').insert({
          tenant_id: tenantId,
          analytics_date: date,
          channel: 'sms',
          provider_name: provider?.provider_name,
          messages_sent: stat.messages_sent,
          messages_delivered: stat.messages_delivered,
          messages_failed: stat.messages_failed,
          messages_bounced: stat.messages_bounced,
          total_cost: stat.total_cost || 0,
          distinct_recipients: stat.distinct_recipients,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        });
      }

      logger.info(`Analytics aggregated for ${dateStr}`);
    } catch (error) {
      logger.error(`Error aggregating analytics: ${error}`);
      throw new Error(`Failed to aggregate analytics: ${error}`);
    }
  }

  /**
   * Private helper methods
   */

  private calculateNextSendTime(schedule: MessageSchedule): Date | null {
    const current = new Date(schedule.next_send_time || schedule.first_send_time);

    switch (schedule.schedule_type) {
      case 'daily':
        current.setDate(current.getDate() + 1);
        break;
      case 'weekly':
        current.setDate(current.getDate() + 7);
        break;
      case 'monthly':
        current.setMonth(current.getMonth() + 1);
        break;
      case 'once':
        return null;
    }

    // Check if within end date
    if (schedule.end_date && current > new Date(schedule.end_date)) {
      return null;
    }

    return current;
  }

  private formatSchedule(schedule: any): MessageSchedule {
    return {
      ...schedule,
      recipient_variables: schedule.recipient_variables ? JSON.parse(schedule.recipient_variables) : undefined,
      metadata: schedule.metadata ? JSON.parse(schedule.metadata) : undefined,
    };
  }

  private formatAnalytics(analytics: any): MessagingAnalytics {
    return {
      ...analytics,
      message_types_breakdown: analytics.message_types_breakdown
        ? JSON.parse(analytics.message_types_breakdown)
        : undefined,
      error_summary: analytics.error_summary ? JSON.parse(analytics.error_summary) : undefined,
    };
  }

  private formatUserStats(stats: any): UserMessagingStats {
    return stats;
  }
}

export default new SMSWhatsAppSchedulingService();
