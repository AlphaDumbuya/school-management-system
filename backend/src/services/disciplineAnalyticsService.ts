/**
 * Discipline Analytics Service
 * Phase 2.3 - Discipline & Conduct Module
 * Analytics and insights for discipline system
 */

import { db } from '@utils/database.js';
import logger from '@utils/logger.js';
import { ConductAnalytics } from '@types/discipline.js';

class DisciplineAnalyticsService {
  /**
   * Get dashboard summary
   */
  async getDashboardSummary(tenantId: string) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayInfractions = await db('student_infractions')
        .where({ tenant_id: tenantId })
        .where('incident_date', '>=', today)
        .count('* as count')
        .first();

      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);

      const weekInfractions = await db('student_infractions')
        .where({ tenant_id: tenantId })
        .whereBetween('incident_date', [weekStart, today])
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

      const highRiskStudents = await this.getHighRiskStudents(tenantId);

      return {
        today_infractions: todayInfractions?.count || 0,
        week_infractions: weekInfractions?.count || 0,
        active_discipline_actions: activeActions?.count || 0,
        pending_appeals: pendingAppeals?.count || 0,
        high_risk_students: highRiskStudents.length,
      };
    } catch (error) {
      logger.error('Error getting dashboard summary:', error);
      throw error;
    }
  }

  /**
   * Get infraction trends over time
   */
  async getInfractionTrends(tenantId: string, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const infractions = await db('student_infractions')
        .where({ tenant_id: tenantId })
        .where('incident_date', '>=', startDate)
        .select('incident_date', 'infraction_type_id', 'student_id');

      // Group by date
      const byDate: Record<string, number> = {};
      for (const infraction of infractions) {
        const dateKey = infraction.incident_date.toISOString().split('T')[0];
        byDate[dateKey] = (byDate[dateKey] || 0) + 1;
      }

      // Sort by date
      const sorted = Object.entries(byDate)
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB));

      // Calculate trend
      const midpoint = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, midpoint).reduce((sum, [_, count]) => sum + count, 0);
      const secondHalf = sorted.slice(midpoint).reduce((sum, [_, count]) => sum + count, 0);

      const trend = firstHalf > secondHalf ? 'improving' : firstHalf < secondHalf ? 'worsening' : 'stable';

      return {
        trend,
        data: Object.fromEntries(sorted),
        total: infractions.length,
      };
    } catch (error) {
      logger.error('Error getting infraction trends:', error);
      throw error;
    }
  }

  /**
   * Get infractions by type
   */
  async getInfractionsByType(tenantId: string) {
    try {
      const infractions = await db('student_infractions as si')
        .leftJoin('infraction_types as it', 'si.infraction_type_id', '=', 'it.infraction_type_id')
        .where('si.tenant_id', tenantId)
        .groupBy('si.infraction_type_id', 'it.name')
        .select('it.name', 'it.infraction_type_id')
        .count('* as count')
        .orderBy('count', 'desc');

      return infractions.reduce((acc, item) => {
        acc[item.name] = item.count;
        return acc;
      }, {} as Record<string, number>);
    } catch (error) {
      logger.error('Error getting infractions by type:', error);
      throw error;
    }
  }

  /**
   * Get discipline actions distribution
   */
  async getActionsDistribution(tenantId: string) {
    try {
      const actions = await db('discipline_actions')
        .where({ tenant_id: tenantId })
        .groupBy('action_type')
        .select('action_type')
        .count('* as count')
        .orderBy('count', 'desc');

      return actions.reduce((acc, item) => {
        acc[item.action_type] = item.count;
        return acc;
      }, {} as Record<string, number>);
    } catch (error) {
      logger.error('Error getting actions distribution:', error);
      throw error;
    }
  }

  /**
   * Get high-risk students
   */
  async getHighRiskStudents(tenantId: string, limit: number = 10) {
    try {
      // Students with multiple infractions
      const students = await db('student_infractions as si')
        .leftJoin('infraction_types as it', 'si.infraction_type_id', '=', 'it.infraction_type_id')
        .where('si.tenant_id', tenantId)
        .groupBy('si.student_id')
        .select('si.student_id')
        .sum('it.default_points as total_points')
        .count('* as infraction_count')
        .havingRaw('SUM(it.default_points) >= 50')
        .orderBy('total_points', 'desc')
        .limit(limit);

      // Enrich with student details
      const result = await Promise.all(
        students.map(async student => {
          const user = await db('users')
            .where({ id: student.student_id })
            .first();

          return {
            student_id: student.student_id,
            student_name: `${user?.first_name || ''} ${user?.last_name || ''}`,
            infraction_count: student.infraction_count,
            total_points: student.total_points,
            risk_level: student.total_points >= 100 ? 'critical' : student.total_points >= 75 ? 'high' : 'medium',
          };
        })
      );

      return result;
    } catch (error) {
      logger.error('Error getting high-risk students:', error);
      throw error;
    }
  }

  /**
   * Get class analytics
   */
  async getClassAnalytics(classId: string, tenantId: string) {
    try {
      // Get students in class
      const students = await db('class_enrollments')
        .where({ class_id: classId, status: 'active' })
        .select('student_id');

      const studentIds = students.map(s => s.student_id);

      if (studentIds.length === 0) {
        return {
          class_id: classId,
          total_students: 0,
          affected_students: 0,
          total_infractions: 0,
          average_points: 0,
          behavior_rating: 0,
        };
      }

      // Get infractions
      const infractions = await db('student_infractions')
        .whereIn('student_id', studentIds)
        .where({ tenant_id: tenantId });

      // Get points
      const pointsResult = await db('student_infractions as si')
        .leftJoin('infraction_types as it', 'si.infraction_type_id', '=', 'it.infraction_type_id')
        .whereIn('si.student_id', studentIds)
        .where('si.tenant_id', tenantId)
        .avg('it.default_points as avg_points')
        .first();

      // Get behavior ratings
      const notes = await db('behavioral_notes')
        .whereIn('student_id', studentIds)
        .where({ tenant_id: tenantId, class_id: classId });

      const ratingSum = notes.reduce((sum, note) => sum + (note.rating || 0), 0);
      const avgRating = notes.length > 0 ? ratingSum / notes.length : 0;

      return {
        class_id: classId,
        total_students: studentIds.length,
        affected_students: new Set(infractions.map(i => i.student_id)).size,
        total_infractions: infractions.length,
        average_points: parseFloat((pointsResult?.avg_points || 0).toFixed(2)),
        behavior_rating: parseFloat(avgRating.toFixed(2)),
      };
    } catch (error) {
      logger.error('Error getting class analytics:', error);
      throw error;
    }
  }

  /**
   * Get appeal statistics
   */
  async getAppealStatistics(tenantId: string) {
    try {
      const total = await db('discipline_appeals')
        .where({ tenant_id: tenantId })
        .count('* as count')
        .first();

      const byStatus = await db('discipline_appeals')
        .where({ tenant_id: tenantId })
        .groupBy('status')
        .select('status')
        .count('* as count');

      const statusMap = byStatus.reduce((acc, item) => {
        acc[item.status] = item.count;
        return acc;
      }, {} as Record<string, number>);

      const approved = statusMap['approved'] || 0;
      const rejected = statusMap['rejected'] || 0;
      const approvalRate = (approved / (approved + rejected)) * 100 || 0;

      return {
        total: total?.count || 0,
        by_status: statusMap,
        approval_rate: parseFloat(approvalRate.toFixed(2)),
      };
    } catch (error) {
      logger.error('Error getting appeal statistics:', error);
      throw error;
    }
  }

  /**
   * Get detention statistics
   */
  async getDetentionStatistics(tenantId: string) {
    try {
      const total = await db('detention_records')
        .where({ tenant_id: tenantId })
        .count('* as count')
        .first();

      const attended = await db('detention_records')
        .where({ tenant_id: tenantId, status: 'attended' })
        .count('* as count')
        .first();

      const absent = await db('detention_records')
        .where({ tenant_id: tenantId, status: 'absent' })
        .count('* as count')
        .first();

      const byType = await db('detention_records')
        .where({ tenant_id: tenantId })
        .groupBy('detention_type')
        .select('detention_type')
        .count('* as count');

      const typeMap = byType.reduce((acc, item) => {
        acc[item.detention_type] = item.count;
        return acc;
      }, {} as Record<string, number>);

      const attendanceRate =
        ((attended?.count || 0) / ((attended?.count || 0) + (absent?.count || 0))) * 100 || 0;

      return {
        total: total?.count || 0,
        attended: attended?.count || 0,
        absent: absent?.count || 0,
        attendance_rate: parseFloat(attendanceRate.toFixed(2)),
        by_type: typeMap,
      };
    } catch (error) {
      logger.error('Error getting detention statistics:', error);
      throw error;
    }
  }

  /**
   * Generate comprehensive discipline report
   */
  async generateComprehensiveReport(tenantId: string) {
    try {
      const summary = await this.getDashboardSummary(tenantId);
      const trends = await this.getInfractionTrends(tenantId);
      const byType = await this.getInfractionsByType(tenantId);
      const actions = await this.getActionsDistribution(tenantId);
      const highRisk = await this.getHighRiskStudents(tenantId, 5);
      const appeals = await this.getAppealStatistics(tenantId);
      const detentions = await this.getDetentionStatistics(tenantId);

      return {
        summary,
        trends,
        infractions_by_type: byType,
        actions_distribution: actions,
        high_risk_students: highRisk,
        appeal_statistics: appeals,
        detention_statistics: detentions,
        generated_at: new Date(),
      };
    } catch (error) {
      logger.error('Error generating comprehensive report:', error);
      throw error;
    }
  }

  /**
   * Store analytics snapshot
   */
  async storeAnalyticsSnapshot(tenantId: string, classId?: string) {
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      let query = db('student_infractions')
        .where({ tenant_id: tenantId })
        .where('incident_date', '>=', now);

      const infractions = await query;
      const actions = await db('discipline_actions')
        .where({ tenant_id: tenantId })
        .where('action_date', '>=', now);

      const analytics: Partial<ConductAnalytics> = {
        tenant_id: tenantId,
        class_id: classId,
        analytics_date: now,
        total_infractions: infractions.length,
        total_detentions: (await db('detention_records')
          .where({ tenant_id: tenantId })
          .where('scheduled_date', '>=', now)).length,
        total_suspensions: actions.filter(a => a.action_type === 'suspension').length,
      };

      await db('conduct_analytics').insert(analytics);

      logger.info(`Analytics snapshot stored for ${classId ? `class ${classId}` : 'tenant'}`);
    } catch (error) {
      logger.error('Error storing analytics snapshot:', error);
    }
  }
}

export default new DisciplineAnalyticsService();
