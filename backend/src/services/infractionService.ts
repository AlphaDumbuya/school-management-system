/**
 * Infraction Service
 * Phase 2.3 - Discipline & Conduct Module
 * Infraction recording and management
 */

import { db } from '@utils/database.js';
import { logger } from '@utils/logger.js';
import { AppError } from '@middleware/errorHandler.js';
import notificationService from '@services/notificationService.js';
import emailService from '@services/emailService.js';
import { applyYearScope, type YearScope } from '@utils/academicYear.js';

// infraction_types has no severity column — derive the level the UI shows
// (minor/moderate/serious/critical) from the points (per-incident override
// first, else the type's default points).
const SEVERITY_SQL = `(CASE
  WHEN COALESCE(si.severity_override, it.default_points, 0) >= 50 THEN 'critical'
  WHEN COALESCE(si.severity_override, it.default_points, 0) >= 25 THEN 'serious'
  WHEN COALESCE(si.severity_override, it.default_points, 0) >= 10 THEN 'moderate'
  ELSE 'minor' END)`;
import {
  StudentInfraction,
  InfractionCreateInput,
  InfractionQueryOptions,
  StudentDisciplineStats,
} from '@types/discipline.js';

class InfractionService {
  /**
   * Record new infraction for student
   */
  async recordInfraction(
    tenantId: string,
    infractionData: InfractionCreateInput
  ): Promise<StudentInfraction> {
    try {
      // The route resolves the student to their login account (users.id —
      // the column's FK) and the type to a tenant infraction_type_id.
      const student = await db('users')
        .where({ tenant_id: tenantId, id: infractionData.student_id })
        .first('id');

      if (!student) {
        throw new AppError('Student not found', 404);
      }

      // Verify infraction type exists
      const infractionType = await db('infraction_types')
        .where({ infraction_type_id: infractionData.infraction_type_id, tenant_id: tenantId })
        .first();

      if (!infractionType) {
        throw new AppError('Infraction type not found', 404);
      }

      // Create infraction record (the DB generates infraction_id).
      const infraction: Omit<StudentInfraction, 'infraction_id'> & { infraction_id?: string } = {
        tenant_id: tenantId,
        student_id: infractionData.student_id,
        infraction_type_id: infractionData.infraction_type_id,
        recorded_by: infractionData.recorded_by,
        incident_date: infractionData.incident_date,
        incident_description: infractionData.incident_description,
        incident_location: infractionData.incident_location,
        status: 'recorded',
        severity_override: infractionData.severity_override,
        notes: infractionData.notes,
        parent_notified: false,
        evidence_type: infractionData.evidence_type,
        evidence_urls: infractionData.evidence_urls,
        is_confidential: infractionData.is_confidential || false,
        class_id: infractionData.class_id,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const [inserted] = await db('student_infractions').insert(infraction).returning('*');
      const id: string = inserted.infraction_id;

      // Log audit entry
      await this.logInfractionAudit(tenantId, id, 'created', infractionData.recorded_by, inserted);

      // Parent notification is best-effort: it must never fail the record.
      const rule = await db('conduct_rules')
        .where({ rule_id: infractionType.rule_id, tenant_id: tenantId })
        .first();
      if (rule?.requires_parent_notification && !inserted.is_confidential) {
        void this.notifyParents(tenantId, infractionData.student_id, inserted);
      }

      logger.info(
        `Infraction ${id} recorded for student ${infractionData.student_id} by ${infractionData.recorded_by}`
      );

      return inserted as StudentInfraction;
    } catch (error) {
      logger.error('Error recording infraction:', error);
      throw error;
    }
  }

  /**
   * Get infractions for student
   */
  async getStudentInfractions(
    studentId: string,
    tenantId: string,
    options?: InfractionQueryOptions
  ) {
    try {
      let query = db('student_infractions as si')
        .leftJoin('infraction_types as it', function () {
          this.on('si.infraction_type_id', '=', 'it.infraction_type_id').andOn('it.tenant_id', '=', db.raw('?', [tenantId]));
        })
        .where('si.student_id', studentId)
        .where('si.tenant_id', tenantId)
        .select('si.*', db.raw("COALESCE(it.name, si.infraction_type_id::text) as infraction_type_name"), db.raw(`${SEVERITY_SQL} as severity_level`))
        .orderBy('si.incident_date', 'desc');

      // Apply filters
      if (options?.status) {
        query = query.where('si.status', options.status);
      }

      if (options?.severity) {
        query = query.where({ severity_override: options.severity });
      }

      if (options?.date_from) {
        query = query.where('incident_date', '>=', options.date_from);
      }

      if (options?.date_to) {
        query = query.where('incident_date', '<=', options.date_to);
      }

      // Academic-year scope: the year's classes, else the year's date window.
      query = applyYearScope(query, (options as any)?.yearScope ?? null, 'si.class_id', 'si.incident_date');

      // Pagination
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const infractions = await query
        .clone()
        .limit(limit)
        .offset(offset);

      // Count without the select list / ORDER BY (Postgres rejects mixing them).
      const total = await query.clone().clearSelect().clearOrder().count('* as count').first();
      const totalCount = Number(total?.count || 0);

      return {
        data: infractions,
        pagination: {
          page,
          limit,
          total: totalCount,
          total_pages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting student infractions:', error);
      throw error;
    }
  }

  /**
   * Get single infraction
   */
  async getInfraction(infractionId: string, tenantId: string): Promise<StudentInfraction> {
    try {
      const infraction = await db('student_infractions')
        .where({ infraction_id: infractionId, tenant_id: tenantId })
        .first();

      if (!infraction) {
        throw new AppError('Infraction not found', 404);
      }

      return infraction;
    } catch (error) {
      logger.error('Error getting infraction:', error);
      throw error;
    }
  }

  /**
   * Update infraction
   */
  async updateInfraction(
    infractionId: string,
    tenantId: string,
    updateData: Partial<StudentInfraction>,
    userId: string
  ): Promise<StudentInfraction> {
    try {
      const infraction = await this.getInfraction(infractionId, tenantId);

      const updates = {
        ...updateData,
        updated_at: new Date(),
      };

      await db('student_infractions')
        .where({ infraction_id: infractionId })
        .update(updates);

      await this.logInfractionAudit(tenantId, infractionId, 'updated', userId, updates);

      logger.info(`Infraction ${infractionId} updated`);
      return this.getInfraction(infractionId, tenantId);
    } catch (error) {
      logger.error('Error updating infraction:', error);
      throw error;
    }
  }

  /**
   * Acknowledge infraction (student/parent acknowledges)
   */
  async acknowledgeInfraction(
    infractionId: string,
    tenantId: string,
    userId: string
  ): Promise<StudentInfraction> {
    try {
      const infraction = await this.getInfraction(infractionId, tenantId);

      await db('student_infractions')
        .where({ infraction_id: infractionId })
        .update({
          status: 'acknowledged',
          updated_at: new Date(),
        });

      await this.logInfractionAudit(tenantId, infractionId, 'updated', userId, {
        status: 'acknowledged',
      });

      logger.info(`Infraction ${infractionId} acknowledged by ${userId}`);
      return this.getInfraction(infractionId, tenantId);
    } catch (error) {
      logger.error('Error acknowledging infraction:', error);
      throw error;
    }
  }

  /**
   * Resolve infraction (mark as resolved)
   */
  async resolveInfraction(
    infractionId: string,
    tenantId: string,
    userId: string,
    resolutionNotes: string
  ): Promise<StudentInfraction> {
    try {
      const infraction = await this.getInfraction(infractionId, tenantId);

      await db('student_infractions')
        .where({ infraction_id: infractionId })
        .update({
          status: 'resolved',
          notes: `${infraction.notes || ''}\n\nResolution: ${resolutionNotes}`,
          updated_at: new Date(),
        });

      await this.logInfractionAudit(tenantId, infractionId, 'updated', userId, {
        status: 'resolved',
        resolution_notes: resolutionNotes,
      });

      logger.info(`Infraction ${infractionId} resolved`);
      return this.getInfraction(infractionId, tenantId);
    } catch (error) {
      logger.error('Error resolving infraction:', error);
      throw error;
    }
  }

  /**
   * Get infractions by class
   */
  async getClassInfractions(classId: string, tenantId: string, options?: InfractionQueryOptions) {
    try {
      let query = db('student_infractions')
        .where({ class_id: classId, tenant_id: tenantId })
        .orderBy('incident_date', 'desc');

      if (options?.status) {
        query = query.where({ status: options.status });
      }

      if (options?.date_from) {
        query = query.where('incident_date', '>=', options.date_from);
      }

      if (options?.date_to) {
        query = query.where('incident_date', '<=', options.date_to);
      }

      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      const infractions = await query
        .clone()
        .limit(limit)
        .offset(offset);

      // Count without the select list / ORDER BY (Postgres rejects mixing them).
      const total = await query.clone().clearSelect().clearOrder().count('* as count').first();
      const totalCount = Number(total?.count || 0);

      return {
        data: infractions,
        pagination: {
          page,
          limit,
          total: totalCount,
          total_pages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      logger.error('Error getting class infractions:', error);
      throw error;
    }
  }

  /**
   * Get infractions by date range for analytics
   */
  async getInfractionsByDateRange(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    classId?: string
  ) {
    try {
      let query = db('student_infractions')
        .where({ tenant_id: tenantId })
        .whereBetween('incident_date', [startDate, endDate]);

      if (classId) {
        query = query.where({ class_id: classId });
      }

      const infractions = await query.orderBy('incident_date', 'desc');

      // Group by infraction type
      const byType: Record<string, number> = {};
      for (const infraction of infractions) {
        const type = infraction.infraction_type_id;
        byType[type] = (byType[type] || 0) + 1;
      }

      return {
        total: infractions.length,
        by_type: byType,
        infractions,
      };
    } catch (error) {
      logger.error('Error getting infractions by date range:', error);
      throw error;
    }
  }

  /**
   * Check for repeat offenders
   */
  async getRepeatOffenders(tenantId: string, classId?: string, limit: number = 10) {
    try {
      let query = db('student_infractions')
        .where({ tenant_id: tenantId })
        .groupBy('student_id')
        .select('student_id')
        .count('* as infraction_count')
        .orderBy('infraction_count', 'desc')
        .limit(limit);

      if (classId) {
        query = query.where({ class_id: classId });
      }

      const offenders = await query;

      // Get student details for each
      const offenderDetails = await Promise.all(
        offenders.map(async offender => {
          const student = await db('users')
            .where({ id: offender.student_id })
            .first();

          return {
            student_id: offender.student_id,
            student_name: `${student?.first_name || ''} ${student?.last_name || ''}`,
            infraction_count: offender.infraction_count,
          };
        })
      );

      return offenderDetails;
    } catch (error) {
      logger.error('Error getting repeat offenders:', error);
      throw error;
    }
  }

  /**
   * Notify parents of infraction
   */
  private async notifyParents(tenantId: string, studentId: string, infraction: StudentInfraction) {
    try {
      // Guardian login accounts (guardians → students.user_id = this student).
      const { guardianUserIds } = await import('../utils/disciplineScope.js');
      const guardians = (await guardianUserIds(tenantId, studentId)).map((id) => ({ guardian_id: id }));

      for (const guardian of guardians) {
        try {
          const guardianUser = await db('users')
            .where({ id: guardian.guardian_id, tenant_id: tenantId })
            .first();

          if (!guardianUser) continue;

          // Send in-app notification
          await notificationService.createNotification({
            user_id: guardian.guardian_id,
            tenant_id: tenantId,
            type: 'infraction_recorded',
            title: 'Infraction Recorded',
            message: `An infraction has been recorded for your child: ${infraction.incident_description}`,
            related_entity: 'infraction',
            related_id: infraction.infraction_id,
          });

          // Send email if enabled
          if (guardianUser.email_notifications_enabled && guardianUser.email) {
            await emailService.sendInfractionNotification(
              tenantId,
              guardianUser.email,
              guardianUser.first_name,
              infraction
            );
          }

          await this.updateInfractionNotificationStatus(infraction.infraction_id, true);

          logger.info(`Parent ${guardian.guardian_id} notified of infraction ${infraction.infraction_id}`);
        } catch (err) {
          logger.error(`Error notifying guardian ${guardian.guardian_id}:`, err);
        }
      }
    } catch (error) {
      logger.error('Error notifying parents:', error);
    }
  }

  /**
   * Update infraction parent notification status
   */
  private async updateInfractionNotificationStatus(infractionId: string, notified: boolean) {
    try {
      await db('student_infractions')
        .where({ infraction_id: infractionId })
        .update({
          parent_notified: notified,
          parent_notification_date: notified ? new Date() : null,
        });
    } catch (error) {
      logger.error('Error updating notification status:', error);
    }
  }

  /**
   * Log infraction audit entry
   */
  private async logInfractionAudit(
    tenantId: string,
    infractionId: string,
    action: string,
    userId: string,
    changes: any
  ) {
    try {
      await db('discipline_audit_logs').insert({
        tenant_id: tenantId,
        entity_type: 'student_infractions',
        entity_id: infractionId,
        user_id: userId,
        action,
        changes: JSON.stringify(changes),
        timestamp: new Date(),
      });
    } catch (error) {
      logger.error('Error logging infraction audit:', error);
    }
  }

  /**
   * List all infractions school-wide (tenant-isolated)
   */
  async listAllInfractions(
    tenantId: string,
    options?: {
      search?: string;
      status?: string;
      severity?: string;
      recordedBy?: string;
      yearScope?: YearScope | null;
      page?: number;
      limit?: number;
    }
  ) {
    try {
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const offset = (page - 1) * limit;

      let query = db('student_infractions as si')
        .leftJoin('users as u', function() {
          this.on('si.student_id', '=', 'u.id').andOn('u.tenant_id', '=', db.raw('?', [tenantId]));
        })
        .leftJoin('infraction_types as it', function() {
          this.on('si.infraction_type_id', '=', 'it.infraction_type_id').andOn('it.tenant_id', '=', db.raw('?', [tenantId]));
        })
        .where('si.tenant_id', tenantId);

      // Teacher scope: only infractions they recorded.
      if (options?.recordedBy) {
        query = query.where('si.recorded_by', options.recordedBy);
      }
      // Academic-year scope: the year's classes, else the year's date window.
      query = applyYearScope(query, options?.yearScope ?? null, 'si.class_id', 'si.incident_date');

      query = query
        .select(
          'si.*',
          db.raw("CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) as student_name"),
          db.raw("COALESCE(it.name, si.infraction_type_id::text) as infraction_type_name"),
          db.raw(`${SEVERITY_SQL} as severity_level`)
        )
        .orderBy('si.incident_date', 'desc');

      if (options?.status) {
        query = query.where('si.status', options.status);
      }

      if (options?.severity) {
        query = query.whereRaw(`${SEVERITY_SQL} = ?`, [options.severity]);
      }

      if (options?.search) {
        const term = `%${options.search.toLowerCase()}%`;
        query = query.where(builder => {
          builder.whereRaw("LOWER(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))) LIKE ?", [term])
            .orWhereRaw("LOWER(COALESCE(it.name, si.infraction_type_id::text)) LIKE ?", [term]);
        });
      }

      const items = await query.clone().limit(limit).offset(offset);
      // Count without the select list / ORDER BY (Postgres rejects mixing them).
      const countRes = await query.clone().clearSelect().clearOrder().count('* as count').first();
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
      logger.error('Error listing all infractions:', error);
      throw error;
    }
  }
}

export default new InfractionService();
