/**
 * Discipline Service
 * Phase 2.3 - Discipline & Conduct Module
 * Core discipline management functionality
 */

import { db } from '@utils/database.js';
import { logger } from '@utils/logger.js';
import { AppError } from '@middleware/errorHandler.js';
import { applyYearScope, type YearScope } from '@utils/academicYear.js';
import {
  DisciplineAction,
  DisciplineActionCreateInput,
  StudentDisciplineStats,
  ClassDisciplineStats,
  DisciplineQueryOptions,
} from '@types/discipline.js';

class DisciplineService {
  /**
   * Assign discipline action to student
   */
  async assignDisciplineAction(
    tenantId: string,
    actionData: DisciplineActionCreateInput
  ): Promise<DisciplineAction> {
    try {
      // Verify infraction exists in this tenant.
      const infraction = await db('student_infractions')
        .where({ infraction_id: actionData.infraction_id, tenant_id: tenantId })
        .first();

      if (!infraction) {
        throw new AppError('Infraction not found', 404);
      }

      // The action MUST target the same student the infraction belongs to.
      // Trust the infraction's student_id (tenant-verified) rather than the
      // client-supplied one, so an action can't be mis-attributed to another
      // (possibly foreign) student.
      const studentId = infraction.student_id;
      if (actionData.student_id && actionData.student_id !== studentId) {
        throw new AppError('Student does not match the infraction', 400, 'VALIDATION_ERROR');
      }

      // Create discipline action
      const action: DisciplineAction = {
        action_id: '',
        tenant_id: tenantId,
        student_id: studentId,
        infraction_id: actionData.infraction_id,
        action_type: actionData.action_type as any,
        action_subtype: actionData.action_subtype,
        assigned_by: actionData.assigned_by,
        action_description: actionData.action_description,
        action_date: actionData.action_date,
        start_date: actionData.start_date,
        end_date: actionData.end_date,
        duration_days: actionData.duration_days,
        status: 'active',
        parent_notified: false,
        conditions: actionData.conditions,
        requires_follow_up: actionData.requires_follow_up || false,
        follow_up_date: actionData.follow_up_date,
        follow_up_assigned_to: actionData.follow_up_assigned_to,
        notes: actionData.notes,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const [id] = await db('discipline_actions').insert(action);
      action.action_id = id;

      // Update infraction status
      await db('student_infractions')
        .where({ infraction_id: actionData.infraction_id })
        .update({ status: 'acknowledged' });

      // Log audit entry
      await this.logDisciplineAudit(
        tenantId,
        'discipline_actions',
        id,
        'created',
        actionData.assigned_by,
        action
      );

      logger.info(`Discipline action ${id} assigned to student ${actionData.student_id}`);
      return action;
    } catch (error) {
      logger.error('Error assigning discipline action:', error);
      throw error;
    }
  }

  /**
   * Get discipline actions for student
   */
  async getStudentActions(
    studentId: string,
    tenantId: string,
    options?: DisciplineQueryOptions
  ) {
    try {
      let query = db('discipline_actions')
        .where({ student_id: studentId, tenant_id: tenantId })
        .orderBy('action_date', 'desc');

      // Apply filters
      if (options?.filters?.status) {
        query = query.where({ status: options.filters.status });
      }

      if (options?.filters?.action_type) {
        query = query.where({ action_type: options.filters.action_type });
      }

      if (options?.filters?.date_from) {
        query = query.where('action_date', '>=', options.filters.date_from);
      }

      if (options?.filters?.date_to) {
        query = query.where('action_date', '<=', options.filters.date_to);
      }

      // Pagination
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const actions = await query.clone().limit(limit).offset(offset);
      const total = await query.clone().count('* as count').first();

      return {
        data: actions,
        pagination: {
          page,
          limit,
          total: total?.count || 0,
          total_pages: Math.ceil((total?.count || 0) / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting student actions:', error);
      throw error;
    }
  }

  /**
   * Update discipline action status
   */
  async updateActionStatus(
    actionId: string,
    tenantId: string,
    newStatus: string,
    userId: string,
    notes?: string
  ): Promise<DisciplineAction> {
    try {
      const action = await db('discipline_actions')
        .where({ action_id: actionId, tenant_id: tenantId })
        .first();

      if (!action) {
        throw new AppError('Discipline action not found', 404);
      }

      // Update status
      await db('discipline_actions')
        .where({ action_id: actionId })
        .update({
          status: newStatus,
          updated_at: new Date(),
          notes: notes || action.notes,
        });

      // Log audit entry
      await this.logDisciplineAudit(
        tenantId,
        'discipline_actions',
        actionId,
        'updated',
        userId,
        { status: newStatus, previous_status: action.status }
      );

      logger.info(`Action ${actionId} status updated to ${newStatus}`);
      return this.getDisciplineAction(actionId, tenantId);
    } catch (error) {
      logger.error('Error updating action status:', error);
      throw error;
    }
  }

  /**
   * Get single discipline action
   */
  async getDisciplineAction(actionId: string, tenantId: string): Promise<DisciplineAction> {
    try {
      const action = await db('discipline_actions')
        .where({ action_id: actionId, tenant_id: tenantId })
        .first();

      if (!action) {
        throw new AppError('Discipline action not found', 404);
      }

      return action;
    } catch (error) {
      logger.error('Error getting discipline action:', error);
      throw error;
    }
  }

  /**
   * Cancel discipline action
   */
  async cancelAction(
    actionId: string,
    tenantId: string,
    userId: string,
    reason: string
  ): Promise<DisciplineAction> {
    try {
      const action = await this.getDisciplineAction(actionId, tenantId);

      if (action.status === 'cancelled') {
        throw new AppError('Action is already cancelled', 400);
      }

      if (action.status === 'completed') {
        throw new AppError('Cannot cancel completed action', 400);
      }

      await db('discipline_actions')
        .where({ action_id: actionId })
        .update({
          status: 'cancelled',
          notes: `${action.notes || ''}\n\nCancelled: ${reason}`,
          updated_at: new Date(),
        });

      await this.logDisciplineAudit(
        tenantId,
        'discipline_actions',
        actionId,
        'updated',
        userId,
        { action: 'cancelled', reason }
      );

      logger.info(`Action ${actionId} cancelled: ${reason}`);
      return this.getDisciplineAction(actionId, tenantId);
    } catch (error) {
      logger.error('Error cancelling action:', error);
      throw error;
    }
  }

  /**
   * Get student discipline statistics
   */
  async getStudentStats(studentId: string, tenantId: string): Promise<StudentDisciplineStats> {
    try {
      // Get total infractions
      const infractions = await db('student_infractions')
        .where({ student_id: studentId, tenant_id: tenantId })
        .count('* as count')
        .first();

      // Get total points
      const pointsResult = await db('student_infractions as si')
        .leftJoin('infraction_types as it', 'si.infraction_type_id', '=', 'it.infraction_type_id')
        .where('si.student_id', studentId)
        .where('si.tenant_id', tenantId)
        .sum('it.default_points as total')
        .first();

      // Get active actions
      const activeActions = await db('discipline_actions')
        .where({
          student_id: studentId,
          tenant_id: tenantId,
          status: 'active',
        })
        .count('* as count')
        .first();

      // Get pending appeals
      const pendingAppeals = await db('discipline_appeals')
        .where({
          student_id: studentId,
          tenant_id: tenantId,
          status: 'pending',
        })
        .count('* as count')
        .first();

      // Get positive notes
      const positiveNotes = await db('behavioral_notes')
        .where({
          student_id: studentId,
          tenant_id: tenantId,
          note_type: 'positive',
        })
        .count('* as count')
        .first();

      // Get last infraction date
      const lastInfraction = await db('student_infractions')
        .where({ student_id: studentId, tenant_id: tenantId })
        .orderBy('incident_date', 'desc')
        .first();

      // Calculate behavior trend
      const recentInfractions = await db('student_infractions')
        .where({ student_id: studentId, tenant_id: tenantId })
        .where('incident_date', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .count('* as count')
        .first();

      const olderInfractions = await db('student_infractions')
        .where({ student_id: studentId, tenant_id: tenantId })
        .whereBetween('incident_date', [
          new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        ])
        .count('* as count')
        .first();

      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if ((recentInfractions?.count || 0) < (olderInfractions?.count || 0)) {
        trend = 'improving';
      } else if ((recentInfractions?.count || 0) > (olderInfractions?.count || 0)) {
        trend = 'declining';
      }

      // Calculate risk level
      const totalPoints = (pointsResult?.total || 0) as number;
      let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (totalPoints >= 100) {
        risk = 'critical';
      } else if (totalPoints >= 75) {
        risk = 'high';
      } else if (totalPoints >= 50) {
        risk = 'medium';
      }

      return {
        student_id: studentId,
        total_infractions: infractions?.count || 0,
        total_points: totalPoints,
        active_actions: activeActions?.count || 0,
        pending_appeals: pendingAppeals?.count || 0,
        positive_notes: positiveNotes?.count || 0,
        last_infraction_date: lastInfraction?.incident_date,
        behavior_trend: trend,
        risk_level: risk,
      };
    } catch (error) {
      logger.error('Error getting student discipline stats:', error);
      throw error;
    }
  }

  /**
   * Get class discipline statistics
   */
  async getClassStats(classId: string, tenantId: string): Promise<ClassDisciplineStats> {
    try {
      // Get students in class
      const students = await db('class_enrollments')
        .where({ class_id: classId, status: 'active' })
        .select('student_id');

      const studentIds = students.map(s => s.student_id);

      if (studentIds.length === 0) {
        return {
          class_id: classId,
          students_count: 0,
          students_with_infractions: 0,
          total_infractions: 0,
          common_infractions: [],
          average_behavior_rating: 0,
          most_common_action: '',
        };
      }

      // Get infractions for class students
      const infractions = await db('student_infractions')
        .whereIn('student_id', studentIds)
        .where({ tenant_id: tenantId });

      const infractionCount = infractions.length;

      // Get students with infractions
      const uniqueStudentsWithInfractions = new Set(infractions.map(i => i.student_id)).size;

      // Get common infraction types
      const commonInfractions: Record<string, number> = {};
      for (const infraction of infractions) {
        const type = infraction.infraction_type_id;
        commonInfractions[type] = (commonInfractions[type] || 0) + 1;
      }

      const sortedInfractions = Object.entries(commonInfractions)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type]) => type);

      // Get discipline actions
      const actions = await db('discipline_actions')
        .whereIn('student_id', studentIds)
        .where({ tenant_id: tenantId });

      const actionCounts: Record<string, number> = {};
      for (const action of actions) {
        const type = action.action_type;
        actionCounts[type] = (actionCounts[type] || 0) + 1;
      }

      const mostCommonAction = Object.entries(actionCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '';

      // Get average behavior rating
      const notes = await db('behavioral_notes')
        .whereIn('student_id', studentIds)
        .where({ tenant_id: tenantId, class_id: classId });

      const ratingSum = notes.reduce((sum, note) => sum + (note.rating || 0), 0);
      const averageRating = notes.length > 0 ? ratingSum / notes.length : 0;

      return {
        class_id: classId,
        students_count: studentIds.length,
        students_with_infractions: uniqueStudentsWithInfractions,
        total_infractions: infractionCount,
        common_infractions: sortedInfractions,
        average_behavior_rating: parseFloat(averageRating.toFixed(2)),
        most_common_action: mostCommonAction,
      };
    } catch (error) {
      logger.error('Error getting class discipline stats:', error);
      throw error;
    }
  }

  /**
   * Get discipline summary for tenant
   */
  async getTenantSummary(tenantId: string) {
    try {
      const totalInfractions = await db('student_infractions')
        .where({ tenant_id: tenantId })
        .count('* as count')
        .first();

      const activeActions = await db('discipline_actions')
        .where({ tenant_id: tenantId, status: 'active' })
        .count('* as count')
        .first();

      const pendingAppeals = await db('discipline_appeals')
        .where({ tenant_id: tenantId, status: 'pending' })
        .count('* as count')
        .first();

      const totalSuspensions = await db('discipline_actions')
        .where({ tenant_id: tenantId })
        .whereIn('action_type', ['suspension', 'expulsion'])
        .count('* as count')
        .first();

      const highRiskStudents = await db('student_infractions as si')
        .leftJoin('infraction_types as it', 'si.infraction_type_id', '=', 'it.infraction_type_id')
        .where('si.tenant_id', tenantId)
        .groupBy('si.student_id')
        .havingRaw('SUM(it.default_points) >= 50')
        .select('si.student_id')
        .count('* as count')
        .first();

      return {
        total_infractions: totalInfractions?.count || 0,
        active_discipline_actions: activeActions?.count || 0,
        pending_appeals: pendingAppeals?.count || 0,
        total_suspensions: totalSuspensions?.count || 0,
        high_risk_students: highRiskStudents?.count || 0,
      };
    } catch (error) {
      logger.error('Error getting tenant discipline summary:', error);
      throw error;
    }
  }

  /**
   * Log discipline audit entry
   */
  private async logDisciplineAudit(
    tenantId: string,
    entityType: string,
    entityId: string,
    action: string,
    userId: string,
    changes: any
  ) {
    try {
      await db('discipline_audit_logs').insert({
        tenant_id: tenantId,
        entity_type: entityType,
        entity_id: entityId,
        user_id: userId,
        action,
        changes: JSON.stringify(changes),
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error logging discipline audit:', error);
    }
  }

  /**
   * List all discipline actions school-wide (tenant-isolated)
   */
  async listAllActions(
    tenantId: string,
    options?: {
      search?: string;
      status?: string;
      action_type?: string;
      yearScope?: YearScope | null;
      page?: number;
      limit?: number;
    }
  ) {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      let query = db('discipline_actions as da')
        .leftJoin('users as u', function() {
          this.on('da.student_id', '=', 'u.id').andOn('u.tenant_id', '=', db.raw('?', [tenantId]));
        })
        .where('da.tenant_id', tenantId)
        .select(
          'da.*',
          db.raw("CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as student_name")
        )
        .orderBy('da.action_date', 'desc');
      // Academic-year scope (actions have no class → the year's date window).
      query = applyYearScope(query, options?.yearScope ?? null, null, 'da.action_date');

      if (options?.status) {
        query = query.where('da.status', options.status);
      }

      if (options?.action_type) {
        query = query.where('da.action_type', options.action_type);
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
      logger.error('Error listing all discipline actions:', error);
      throw error;
    }
  }
}

export default new DisciplineService();
