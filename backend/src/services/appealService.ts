/**
 * Appeal Service
 * Phase 2.3 - Discipline & Conduct Module
 * Discipline action appeal management
 */

import { db } from '@utils/database.js';
import { logger } from '@utils/logger.js';
import { AppError } from '@middleware/errorHandler.js';
import notificationService from '@services/notificationService.js';
import emailService from '@services/emailService.js';
import { applyYearScope, type YearScope } from '@utils/academicYear.js';
import {
  DisciplineAppeal,
  AppealCreateInput,
  DisciplineQueryOptions,
} from '@types/discipline.js';

class AppealService {
  /**
   * Submit appeal for discipline action
   */
  async submitAppeal(
    tenantId: string,
    appealData: AppealCreateInput
  ): Promise<DisciplineAppeal> {
    try {
      // Verify action exists in this tenant.
      const action = await db('discipline_actions')
        .where({ action_id: appealData.action_id, tenant_id: tenantId })
        .first();

      if (!action) {
        throw new AppError('Discipline action not found', 404);
      }

      // The appeal MUST be about the action's own student. Trust the action's
      // (tenant-verified) student_id rather than the client-supplied one.
      const studentId = action.student_id;
      if (appealData.student_id && appealData.student_id !== studentId) {
        throw new AppError('Student does not match the discipline action', 400, 'VALIDATION_ERROR');
      }

      // Check if already appealed
      const existingAppeal = await db('discipline_appeals')
        .where({
          action_id: appealData.action_id,
          status: ['pending', 'under_review'],
        })
        .first();

      if (existingAppeal) {
        throw new AppError('Appeal already submitted for this action', 400);
      }

      const appeal: DisciplineAppeal = {
        appeal_id: '',
        tenant_id: tenantId,
        action_id: appealData.action_id,
        student_id: studentId,
        submitted_by: appealData.submitted_by,
        submitted_by_type: appealData.submitted_by_type as any,
        appeal_reason: appealData.appeal_reason,
        status: 'pending',
        evidence: appealData.evidence,
        submitted_date: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      };

      const [id] = await db('discipline_appeals').insert(appeal);
      appeal.appeal_id = id;

      // Update action status
      await db('discipline_actions')
        .where({ action_id: appealData.action_id })
        .update({ status: 'appealed' });

      // Log audit entry
      await this.logAppealAudit(tenantId, id, 'created', appealData.submitted_by, appeal);

      // Notify principal/admin
      await this.notifyAdministration(tenantId, appeal);

      logger.info(`Appeal ${id} submitted for action ${appealData.action_id}`);
      return appeal;
    } catch (error) {
      logger.error('Error submitting appeal:', error);
      throw error;
    }
  }

  /**
   * Get appeals for student
   */
  async getStudentAppeals(
    studentId: string,
    tenantId: string,
    options?: DisciplineQueryOptions
  ) {
    try {
      let query = db('discipline_appeals')
        .where({ student_id: studentId, tenant_id: tenantId })
        .orderBy('submitted_date', 'desc');

      if (options?.filters?.status) {
        query = query.where({ status: options.filters.status });
      }

      if (options?.filters?.date_from) {
        query = query.where('submitted_date', '>=', options.filters.date_from);
      }

      if (options?.filters?.date_to) {
        query = query.where('submitted_date', '<=', options.filters.date_to);
      }

      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const appeals = await query
        .clone()
        .limit(limit)
        .offset(offset);

      const total = await query.clone().count('* as count').first();

      return {
        data: appeals,
        pagination: {
          page,
          limit,
          total: total?.count || 0,
          total_pages: Math.ceil((total?.count || 0) / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting student appeals:', error);
      throw error;
    }
  }

  /**
   * Get single appeal
   */
  async getAppeal(appealId: string, tenantId: string): Promise<DisciplineAppeal> {
    try {
      const appeal = await db('discipline_appeals')
        .where({ appeal_id: appealId, tenant_id: tenantId })
        .first();

      if (!appeal) {
        throw new AppError('Appeal not found', 404);
      }

      return appeal;
    } catch (error) {
      logger.error('Error getting appeal:', error);
      throw error;
    }
  }

  /**
   * Review appeal (move to under_review)
   */
  async reviewAppeal(
    appealId: string,
    tenantId: string,
    reviewerId: string
  ): Promise<DisciplineAppeal> {
    try {
      const appeal = await this.getAppeal(appealId, tenantId);

      if (appeal.status !== 'pending') {
        throw new AppError('Only pending appeals can be reviewed', 400);
      }

      await db('discipline_appeals')
        .where({ appeal_id: appealId })
        .update({
          status: 'under_review',
          reviewed_by: reviewerId,
          review_date: new Date(),
        });

      await this.logAppealAudit(tenantId, appealId, 'updated', reviewerId, {
        status: 'under_review',
      });

      logger.info(`Appeal ${appealId} moved to under_review`);
      return this.getAppeal(appealId, tenantId);
    } catch (error) {
      logger.error('Error reviewing appeal:', error);
      throw error;
    }
  }

  /**
   * Approve appeal
   */
  async approveAppeal(
    appealId: string,
    tenantId: string,
    reviewerId: string,
    decisionNotes: string,
    modifiedAction?: string
  ): Promise<DisciplineAppeal> {
    try {
      const appeal = await this.getAppeal(appealId, tenantId);

      if (appeal.status !== 'under_review') {
        throw new AppError('Only appeals under review can be approved', 400);
      }

      await db('discipline_appeals')
        .where({ appeal_id: appealId })
        .update({
          status: 'approved',
          decision_type: 'upheld',
          appeal_decision: decisionNotes,
          modified_action: modifiedAction,
          review_date: new Date(),
          reviewed_by: reviewerId,
        });

      // Update action status if modified
      if (modifiedAction === 'overturned') {
        await db('discipline_actions')
          .where({ action_id: appeal.action_id })
          .update({ status: 'cancelled' });
      } else if (modifiedAction === 'reduced') {
        // Modify action details as specified
        // This would be handled by additional parameters in production
      }

      await this.logAppealAudit(tenantId, appealId, 'updated', reviewerId, {
        status: 'approved',
        decision_type: 'upheld',
      });

      // Notify student/parent
      await this.notifyAppealDecision(tenantId, appeal, 'approved', decisionNotes);

      logger.info(`Appeal ${appealId} approved`);
      return this.getAppeal(appealId, tenantId);
    } catch (error) {
      logger.error('Error approving appeal:', error);
      throw error;
    }
  }

  /**
   * Reject appeal
   */
  async rejectAppeal(
    appealId: string,
    tenantId: string,
    reviewerId: string,
    decisionNotes: string
  ): Promise<DisciplineAppeal> {
    try {
      const appeal = await this.getAppeal(appealId, tenantId);

      if (appeal.status !== 'under_review') {
        throw new AppError('Only appeals under review can be rejected', 400);
      }

      await db('discipline_appeals')
        .where({ appeal_id: appealId })
        .update({
          status: 'rejected',
          decision_type: 'upheld',
          appeal_decision: decisionNotes,
          review_date: new Date(),
          reviewed_by: reviewerId,
        });

      // Action remains active
      await db('discipline_actions')
        .where({ action_id: appeal.action_id })
        .update({ status: 'active' });

      await this.logAppealAudit(tenantId, appealId, 'updated', reviewerId, {
        status: 'rejected',
        decision_type: 'upheld',
      });

      // Notify student/parent
      await this.notifyAppealDecision(tenantId, appeal, 'rejected', decisionNotes);

      logger.info(`Appeal ${appealId} rejected`);
      return this.getAppeal(appealId, tenantId);
    } catch (error) {
      logger.error('Error rejecting appeal:', error);
      throw error;
    }
  }

  /**
   * Escalate appeal to higher authority
   */
  async escalateAppeal(
    appealId: string,
    tenantId: string,
    escalatedBy: string,
    reason: string
  ): Promise<DisciplineAppeal> {
    try {
      const appeal = await this.getAppeal(appealId, tenantId);

      if (appeal.status === 'escalated' || appeal.status === 'approved' || appeal.status === 'rejected') {
        throw new AppError('Cannot escalate this appeal', 400);
      }

      await db('discipline_appeals')
        .where({ appeal_id: appealId })
        .update({
          status: 'escalated',
          review_notes: `${appeal.review_notes || ''}\n\nEscalated: ${reason}`,
        });

      await this.logAppealAudit(tenantId, appealId, 'updated', escalatedBy, {
        status: 'escalated',
        reason,
      });

      // Notify super admin
      await this.notifySuperAdminEscalation(tenantId, appeal, reason);

      logger.info(`Appeal ${appealId} escalated: ${reason}`);
      return this.getAppeal(appealId, tenantId);
    } catch (error) {
      logger.error('Error escalating appeal:', error);
      throw error;
    }
  }

  /**
   * Get pending appeals
   */
  async getPendingAppeals(tenantId: string, limit: number = 10) {
    try {
      const appeals = await db('discipline_appeals')
        .where({ tenant_id: tenantId, status: 'pending' })
        .orderBy('submitted_date')
        .limit(limit);

      return appeals;
    } catch (error) {
      logger.error('Error getting pending appeals:', error);
      throw error;
    }
  }

  /**
   * Get appeal statistics
   */
  async getAppealStats(tenantId: string) {
    try {
      const totalAppeals = await db('discipline_appeals')
        .where({ tenant_id: tenantId })
        .count('* as count')
        .first();

      const pendingAppeals = await db('discipline_appeals')
        .where({ tenant_id: tenantId, status: 'pending' })
        .count('* as count')
        .first();

      const underReview = await db('discipline_appeals')
        .where({ tenant_id: tenantId, status: 'under_review' })
        .count('* as count')
        .first();

      const approved = await db('discipline_appeals')
        .where({ tenant_id: tenantId, status: 'approved' })
        .count('* as count')
        .first();

      const rejected = await db('discipline_appeals')
        .where({ tenant_id: tenantId, status: 'rejected' })
        .count('* as count')
        .first();

      const approvalRate =
        (approved?.count || 0) / ((approved?.count || 0) + (rejected?.count || 0)) * 100;

      return {
        total: totalAppeals?.count || 0,
        pending: pendingAppeals?.count || 0,
        under_review: underReview?.count || 0,
        approved: approved?.count || 0,
        rejected: rejected?.count || 0,
        approval_rate: parseFloat(approvalRate.toFixed(2)),
      };
    } catch (error) {
      logger.error('Error getting appeal stats:', error);
      throw error;
    }
  }

  /**
   * Check appeal window (if appeal can still be submitted)
   */
  async canAppeal(actionId: string, tenantId: string): Promise<boolean> {
    try {
      const action = await db('discipline_actions')
        .where({ action_id: actionId, tenant_id: tenantId })
        .first();

      if (!action) {
        return false;
      }

      // Check if already completed
      if (action.status === 'completed' || action.status === 'cancelled') {
        return false;
      }

      // Check if appeal window is still open (default: 30 days from action date)
      const daysSinceAction = Math.floor(
        (Date.now() - new Date(action.action_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      return daysSinceAction <= 30;
    } catch (error) {
      logger.error('Error checking appeal window:', error);
      return false;
    }
  }

  /**
   * Notify administration of new appeal
   */
  private async notifyAdministration(tenantId: string, appeal: DisciplineAppeal) {
    try {
      // Get all principals/admins
      const admins = await db('users')
        .where({ tenant_id: tenantId })
        .whereIn('role', ['principal', 'super_admin']);

      for (const admin of admins) {
        await notificationService.createNotification({
          user_id: admin.id,
          tenant_id: tenantId,
          type: 'appeal_submitted',
          title: 'New Discipline Appeal',
          message: `A new discipline appeal has been submitted for review`,
          related_entity: 'appeal',
          related_id: appeal.appeal_id,
          priority: 'high',
        });
      }
    } catch (error) {
      logger.error('Error notifying administration:', error);
    }
  }

  /**
   * Notify appeal decision
   */
  private async notifyAppealDecision(
    tenantId: string,
    appeal: DisciplineAppeal,
    decision: string,
    notes: string
  ) {
    try {
      const user = await db('users')
        .where({ id: appeal.submitted_by, tenant_id: tenantId })
        .first();

      if (!user) return;

      const title = `Appeal ${decision === 'approved' ? 'Approved' : 'Rejected'}`;
      const message = `Your appeal has been ${decision}. ${notes}`;

      await notificationService.createNotification({
        user_id: appeal.submitted_by,
        tenant_id: tenantId,
        type: 'appeal_decision',
        title,
        message,
        related_entity: 'appeal',
        related_id: appeal.appeal_id,
      });

      if (user.email_notifications_enabled && user.email) {
        await emailService.sendAppealDecision(tenantId, user.email, user.first_name, appeal, decision, notes);
      }
    } catch (error) {
      logger.error('Error notifying appeal decision:', error);
    }
  }

  /**
   * Notify super admin of escalation
   */
  private async notifySuperAdminEscalation(tenantId: string, appeal: DisciplineAppeal, reason: string) {
    try {
      const superAdmins = await db('users')
        .where({ tenant_id: tenantId, role: 'super_admin' });

      for (const admin of superAdmins) {
        await notificationService.createNotification({
          user_id: admin.id,
          tenant_id: tenantId,
          type: 'appeal_escalated',
          title: 'Appeal Escalated',
          message: `A discipline appeal has been escalated: ${reason}`,
          related_entity: 'appeal',
          related_id: appeal.appeal_id,
          priority: 'high',
        });
      }
    } catch (error) {
      logger.error('Error notifying super admin escalation:', error);
    }
  }

  /**
   * Log appeal audit entry
   */
  private async logAppealAudit(
    tenantId: string,
    appealId: string,
    action: string,
    userId: string,
    changes: any
  ) {
    try {
      await db('discipline_audit_logs').insert({
        tenant_id: tenantId,
        entity_type: 'discipline_appeals',
        entity_id: appealId,
        user_id: userId,
        action,
        changes: JSON.stringify(changes),
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error logging appeal audit:', error);
    }
  }

  /**
   * List all discipline appeals school-wide (tenant-isolated)
   */
  async listAllAppeals(
    tenantId: string,
    options?: {
      search?: string;
      status?: string;
      yearScope?: YearScope | null;
      page?: number;
      limit?: number;
    }
  ) {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      let query = db('discipline_appeals as ap')
        .leftJoin('users as u', function() {
          this.on('ap.student_id', '=', 'u.id').andOn('u.tenant_id', '=', db.raw('?', [tenantId]));
        })
        .leftJoin('discipline_actions as da', function() {
          this.on('ap.action_id', '=', 'da.action_id').andOn('da.tenant_id', '=', db.raw('?', [tenantId]));
        })
        .where('ap.tenant_id', tenantId)
        .select(
          'ap.*',
          db.raw("CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as student_name"),
          'da.action_type'
        )
        .orderBy('ap.submitted_date', 'desc');
      // Academic-year scope (appeals have no class → the year's date window).
      query = applyYearScope(query, options?.yearScope ?? null, null, 'ap.submitted_date');

      if (options?.status) {
        query = query.where('ap.status', options.status);
      }

      if (options?.search) {
        const term = `%${options.search.toLowerCase()}%`;
        query = query.where(builder => {
          builder.whereRaw("LOWER(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) LIKE ?", [term])
            .orWhereRaw("LOWER(u.student_id) LIKE ?", [term]);
        });
      }

      const items = await query.clone().limit(limit).offset(offset);
      const countRes = await query.clone().count('* as count').first();
      const total = Number(countRes?.count || 0);

      return {
        data: items,
        pagination: {
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit) || 1,
        },
      };
    } catch (error) {
      logger.error('Error listing all discipline appeals:', error);
      throw error;
    }
  }
}

export default new AppealService();
