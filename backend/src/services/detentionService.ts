/**
 * Detention Service
 * Phase 2.3 - Discipline & Conduct Module
 * Detention scheduling and tracking
 */

import { db } from '@utils/database.js';
import { logger } from '@utils/logger.js';
import { AppError } from '@middleware/errorHandler.js';
import notificationService from '@services/notificationService.js';
import emailService from '@services/emailService.js';
import {
  DetentionRecord,
  DetentionCreateInput,
  DisciplineQueryOptions,
} from '@types/discipline.js';

class DetentionService {
  /**
   * Schedule detention for student
   */
  async scheduleDetention(
    tenantId: string,
    detentionData: DetentionCreateInput
  ): Promise<DetentionRecord> {
    try {
      // Verify action exists
      const action = await db('discipline_actions')
        .where({ action_id: detentionData.action_id, tenant_id: tenantId })
        .first();

      if (!action) {
        throw new AppError('Discipline action not found', 404);
      }

      // Verify student exists
      const student = await db('users')
        .where({ id: detentionData.student_id, tenant_id: tenantId })
        .first();

      if (!student) {
        throw new AppError('Student not found', 404);
      }

      // Check detention limit for the day
      const existingDetentions = await db('detention_records')
        .where({ student_id: detentionData.student_id })
        .where('scheduled_date', '=', detentionData.scheduled_date)
        .count('* as count')
        .first();

      // Prevent multiple detentions on same day (school policy)
      if ((existingDetentions?.count || 0) > 0) {
        throw new AppError(
          'Student already has detention scheduled for this date',
          400
        );
      }

      const detention: DetentionRecord = {
        detention_id: '',
        tenant_id: tenantId,
        action_id: detentionData.action_id,
        student_id: detentionData.student_id,
        detention_type: detentionData.detention_type as any,
        scheduled_date: detentionData.scheduled_date,
        start_time: detentionData.start_time,
        end_time: detentionData.end_time,
        location: detentionData.location,
        supervised_by: detentionData.supervised_by,
        status: 'scheduled',
        parent_notified: false,
        created_at: new Date(),
      };

      const [id] = await db('detention_records').insert(detention);
      detention.detention_id = id;

      // Notify parent if enabled
      if (detentionData.parent_notified) {
        await this.notifyParentOfDetention(tenantId, detentionData.student_id, detention);
      }

      // Log audit entry
      await this.logDetentionAudit(tenantId, id, 'created', 'system', detention);

      logger.info(`Detention ${id} scheduled for student ${detentionData.student_id}`);
      return detention;
    } catch (error) {
      logger.error('Error scheduling detention:', error);
      throw error;
    }
  }

  /**
   * Get student detentions
   */
  async getStudentDetentions(
    studentId: string,
    tenantId: string,
    options?: DisciplineQueryOptions
  ) {
    try {
      let query = db('detention_records')
        .where({ student_id: studentId, tenant_id: tenantId })
        .orderBy('scheduled_date', 'desc');

      if (options?.filters?.status) {
        query = query.where({ status: options.filters.status });
      }

      if (options?.filters?.date_from) {
        query = query.where('scheduled_date', '>=', options.filters.date_from);
      }

      if (options?.filters?.date_to) {
        query = query.where('scheduled_date', '<=', options.filters.date_to);
      }

      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const detentions = await query
        .clone()
        .limit(limit)
        .offset(offset);

      const total = await query.clone().count('* as count').first();

      return {
        data: detentions,
        pagination: {
          page,
          limit,
          total: total?.count || 0,
          total_pages: Math.ceil((total?.count || 0) / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting student detentions:', error);
      throw error;
    }
  }

  /**
   * Get single detention record
   */
  async getDetention(detentionId: string, tenantId: string): Promise<DetentionRecord> {
    try {
      const detention = await db('detention_records')
        .where({ detention_id: detentionId, tenant_id: tenantId })
        .first();

      if (!detention) {
        throw new AppError('Detention record not found', 404);
      }

      return detention;
    } catch (error) {
      logger.error('Error getting detention:', error);
      throw error;
    }
  }

  /**
   * Mark detention attended
   */
  async markAttended(
    detentionId: string,
    tenantId: string,
    supervisorNotes?: string
  ): Promise<DetentionRecord> {
    try {
      const detention = await this.getDetention(detentionId, tenantId);

      if (detention.status === 'attended') {
        throw new AppError('Detention already marked as attended', 400);
      }

      if (detention.status === 'absent') {
        throw new AppError('Cannot mark attended after absence recorded', 400);
      }

      await db('detention_records')
        .where({ detention_id: detentionId })
        .update({
          status: 'attended',
          attended_date: new Date(),
          supervisor_notes: supervisorNotes || detention.supervisor_notes,
        });

      await this.logDetentionAudit(tenantId, detentionId, 'updated', 'system', {
        status: 'attended',
      });

      logger.info(`Detention ${detentionId} marked as attended`);
      return this.getDetention(detentionId, tenantId);
    } catch (error) {
      logger.error('Error marking detention attended:', error);
      throw error;
    }
  }

  /**
   * Mark detention absent
   */
  async markAbsent(
    detentionId: string,
    tenantId: string,
    userId: string,
    reason: string
  ): Promise<DetentionRecord> {
    try {
      const detention = await this.getDetention(detentionId, tenantId);

      if (detention.status === 'attended') {
        throw new AppError('Cannot mark absent after attendance recorded', 400);
      }

      await db('detention_records')
        .where({ detention_id: detentionId })
        .update({
          status: 'absent',
          supervisor_notes: `Absent: ${reason}`,
        });

      await this.logDetentionAudit(tenantId, detentionId, 'updated', userId, {
        status: 'absent',
        reason,
      });

      // Notify supervisors and parents
      await this.notifyAbsence(tenantId, detention, reason);

      logger.info(`Detention ${detentionId} marked as absent`);
      return this.getDetention(detentionId, tenantId);
    } catch (error) {
      logger.error('Error marking detention absent:', error);
      throw error;
    }
  }

  /**
   * Reschedule detention
   */
  async rescheduleDetention(
    detentionId: string,
    tenantId: string,
    newDate: Date,
    userId: string,
    reason: string
  ): Promise<DetentionRecord> {
    try {
      const detention = await this.getDetention(detentionId, tenantId);

      if (detention.status === 'attended' || detention.status === 'rescheduled') {
        throw new AppError('Cannot reschedule completed or already rescheduled detention', 400);
      }

      // Check if already scheduled on new date
      const conflicting = await db('detention_records')
        .where({
          student_id: detention.student_id,
          scheduled_date: newDate,
        })
        .count('* as count')
        .first();

      if ((conflicting?.count || 0) > 0) {
        throw new AppError('Detention already scheduled for new date', 400);
      }

      await db('detention_records')
        .where({ detention_id: detentionId })
        .update({
          scheduled_date: newDate,
          status: 'rescheduled',
          supervisor_notes: `${detention.supervisor_notes || ''}\n\nRescheduled: ${reason}`,
        });

      await this.logDetentionAudit(tenantId, detentionId, 'updated', userId, {
        action: 'rescheduled',
        from_date: detention.scheduled_date,
        to_date: newDate,
        reason,
      });

      // Notify parent of new date
      await this.notifyRescheduled(tenantId, detention, newDate);

      logger.info(`Detention ${detentionId} rescheduled to ${newDate}`);
      return this.getDetention(detentionId, tenantId);
    } catch (error) {
      logger.error('Error rescheduling detention:', error);
      throw error;
    }
  }

  /**
   * Get detention calendar for specific date
   */
  async getDetentionCalendar(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    location?: string
  ) {
    try {
      let query = db('detention_records')
        .where({ tenant_id: tenantId })
        .whereBetween('scheduled_date', [startDate, endDate])
        .orderBy('scheduled_date');

      if (location) {
        query = query.where({ location });
      }

      const detentions = await query;

      // Group by date
      const calendar: Record<string, any[]> = {};
      for (const detention of detentions) {
        const dateKey = detention.scheduled_date.toISOString().split('T')[0];
        if (!calendar[dateKey]) {
          calendar[dateKey] = [];
        }
        calendar[dateKey].push(detention);
      }

      return calendar;
    } catch (error) {
      logger.error('Error getting detention calendar:', error);
      throw error;
    }
  }

  /**
   * Get detention statistics
   */
  async getDetentionStats(tenantId: string, classId?: string) {
    try {
      let query = db('detention_records').where({ tenant_id: tenantId });

      if (classId) {
        query = query
          .join('discipline_actions as da', 'detention_records.action_id', '=', 'da.action_id')
          .where('da.student_id', 'in',
            db('class_enrollments')
              .where({ class_id: classId })
              .select('student_id')
          );
      }

      const totalScheduled = await query
        .clone()
        .where({ status: 'scheduled' })
        .count('* as count')
        .first();

      const totalAttended = await query
        .clone()
        .where({ status: 'attended' })
        .count('* as count')
        .first();

      const totalAbsent = await query
        .clone()
        .where({ status: 'absent' })
        .count('* as count')
        .first();

      const byType = await query
        .clone()
        .groupBy('detention_type')
        .select('detention_type')
        .count('* as count');

      return {
        total_scheduled: totalScheduled?.count || 0,
        total_attended: totalAttended?.count || 0,
        total_absent: totalAbsent?.count || 0,
        attendance_rate:
          ((totalAttended?.count || 0) / ((totalAttended?.count || 0) + (totalAbsent?.count || 0))) * 100,
        by_type: byType.reduce((acc, item) => {
          acc[item.detention_type] = item.count;
          return acc;
        }, {} as Record<string, number>),
      };
    } catch (error) {
      logger.error('Error getting detention stats:', error);
      throw error;
    }
  }

  /**
   * Notify parent of detention
   */
  private async notifyParentOfDetention(
    tenantId: string,
    studentId: string,
    detention: DetentionRecord
  ) {
    try {
      const guardians = await db('student_guardians')
        .where({ student_id: studentId, status: 'active' })
        .select('guardian_id');

      for (const guardian of guardians) {
        try {
          const guardianUser = await db('users')
            .where({ id: guardian.guardian_id, tenant_id: tenantId })
            .first();

          if (!guardianUser) continue;

          // Send notification
          await notificationService.createNotification({
            user_id: guardian.guardian_id,
            tenant_id: tenantId,
            type: 'detention_scheduled',
            title: 'Detention Scheduled',
            message: `Detention scheduled for ${detention.scheduled_date} at ${detention.location}`,
            related_entity: 'detention',
            related_id: detention.detention_id,
          });

          if (guardianUser.email_notifications_enabled && guardianUser.email) {
            await emailService.sendDetentionNotification(
              guardianUser.email,
              guardianUser.first_name,
              detention
            );
          }

          await db('detention_records')
            .where({ detention_id: detention.detention_id })
            .update({ parent_notified: true });
        } catch (err) {
          logger.error(`Error notifying guardian:`, err);
        }
      }
    } catch (error) {
      logger.error('Error notifying parent of detention:', error);
    }
  }

  /**
   * Notify absence
   */
  private async notifyAbsence(
    tenantId: string,
    detention: DetentionRecord,
    reason: string
  ) {
    try {
      // Notify supervisor
      if (detention.supervised_by) {
        await notificationService.createNotification({
          user_id: detention.supervised_by,
          tenant_id: tenantId,
          type: 'detention_absence',
          title: 'Detention Absence',
          message: `Student was absent from scheduled detention: ${reason}`,
          related_entity: 'detention',
          related_id: detention.detention_id,
          priority: 'high',
        });
      }

      // Notify guardians
      const guardians = await db('student_guardians')
        .where({ student_id: detention.student_id, status: 'active' })
        .select('guardian_id');

      for (const guardian of guardians) {
        await notificationService.createNotification({
          user_id: guardian.guardian_id,
          tenant_id: tenantId,
          type: 'detention_absence',
          title: 'Detention Absence',
          message: `Your child was absent from scheduled detention: ${reason}`,
          related_entity: 'detention',
          related_id: detention.detention_id,
        });
      }
    } catch (error) {
      logger.error('Error notifying absence:', error);
    }
  }

  /**
   * Notify rescheduled detention
   */
  private async notifyRescheduled(
    tenantId: string,
    detention: DetentionRecord,
    newDate: Date
  ) {
    try {
      const guardians = await db('student_guardians')
        .where({ student_id: detention.student_id, status: 'active' })
        .select('guardian_id');

      for (const guardian of guardians) {
        await notificationService.createNotification({
          user_id: guardian.guardian_id,
          tenant_id: tenantId,
          type: 'detention_rescheduled',
          title: 'Detention Rescheduled',
          message: `Detention has been rescheduled to ${newDate}`,
          related_entity: 'detention',
          related_id: detention.detention_id,
        });
      }
    } catch (error) {
      logger.error('Error notifying rescheduled detention:', error);
    }
  }

  /**
   * Log detention audit entry
   */
  private async logDetentionAudit(
    tenantId: string,
    detentionId: string,
    action: string,
    userId: string,
    changes: any
  ) {
    try {
      await db('discipline_audit_logs').insert({
        tenant_id: tenantId,
        entity_type: 'detention_records',
        entity_id: detentionId,
        user_id: userId,
        action,
        changes: JSON.stringify(changes),
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error logging detention audit:', error);
    }
  }
}

export default new DetentionService();
