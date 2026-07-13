/**
 * Conduct Report Service
 * Phase 2.3 - Discipline & Conduct Module
 * Conduct report generation and management
 */

import { db } from '@utils/database.js';
import { logger } from '@utils/logger.js';
import { AppError } from '@middleware/errorHandler.js';
import notificationService from '@services/notificationService.js';
import emailService from '@services/emailService.js';
import { ConductReport } from '@types/discipline.js';

class ConductReportService {
  /**
   * Generate conduct report for student
   */
  async generateReport(
    tenantId: string,
    studentId: string,
    reportPeriod: 'term' | 'semester' | 'year' | 'custom',
    startDate?: Date,
    endDate?: Date,
    generatedBy?: string
  ): Promise<ConductReport> {
    try {
      // Verify student exists
      const student = await db('users')
        .where({ id: studentId, tenant_id: tenantId })
        .first();

      if (!student) {
        throw new AppError('Student not found', 404);
      }

      // Determine report period dates
      let periodStart = startDate;
      let periodEnd = endDate || new Date();

      if (!periodStart) {
        if (reportPeriod === 'year') {
          periodStart = new Date(periodEnd.getFullYear(), 0, 1);
        } else if (reportPeriod === 'semester') {
          const month = periodEnd.getMonth();
          periodStart = new Date(periodEnd.getFullYear(), month < 6 ? 0 : 6, 1);
        } else if (reportPeriod === 'term') {
          // Assuming 3 terms per year
          const month = periodEnd.getMonth();
          let termStart = 0;
          if (month >= 0 && month < 4) {
            termStart = 0;
          } else if (month >= 4 && month < 8) {
            termStart = 4;
          } else {
            termStart = 8;
          }
          periodStart = new Date(periodEnd.getFullYear(), termStart, 1);
        }
      }

      // Get infractions for period
      const infractions = await db('student_infractions')
        .where({ student_id: studentId, tenant_id: tenantId })
        .whereBetween('incident_date', [periodStart, periodEnd]);

      // Calculate total points
      const pointsResult = await db('student_infractions as si')
        .leftJoin('infraction_types as it', 'si.infraction_type_id', '=', 'it.infraction_type_id')
        .where('si.student_id', studentId)
        .where('si.tenant_id', tenantId)
        .whereBetween('si.incident_date', [periodStart, periodEnd])
        .sum('it.default_points as total')
        .first();

      const totalPoints = (pointsResult?.total || 0) as number;

      // Get behavioral notes
      const positiveNotes = await db('behavioral_notes')
        .where({
          student_id: studentId,
          tenant_id: tenantId,
          note_type: 'positive',
        })
        .whereBetween('note_date', [periodStart, periodEnd]);

      const concernNotes = await db('behavioral_notes')
        .where({
          student_id: studentId,
          tenant_id: tenantId,
          note_type: 'concern',
        })
        .whereBetween('note_date', [periodStart, periodEnd]);

      // Calculate average behavior rating
      const allNotes = await db('behavioral_notes')
        .where({ student_id: studentId, tenant_id: tenantId })
        .whereBetween('note_date', [periodStart, periodEnd]);

      const ratingSum = allNotes.reduce((sum, note) => sum + (note.rating || 0), 0);
      const behavioralRating = allNotes.length > 0 ? Math.round(ratingSum / allNotes.length) : 0;

      // Generate report
      const report: ConductReport = {
        report_id: '',
        tenant_id: tenantId,
        student_id: studentId,
        generated_by: generatedBy,
        report_period: reportPeriod,
        period_start_date: periodStart,
        period_end_date: periodEnd,
        total_infractions: infractions.length,
        total_points: totalPoints,
        behavioral_rating: behavioralRating,
        strengths: this.generateStrengths(positiveNotes, behavioralRating),
        areas_for_improvement: this.generateImprovementAreas(concernNotes, infractions, totalPoints),
        teacher_comments: this.generateTeacherComments(infractions, behavioralRating),
        overall_assessment: this.generateOverallAssessment(
          infractions.length,
          behavioralRating,
          totalPoints
        ),
        parent_shared: false,
        parent_acknowledged: false,
        created_at: new Date(),
      };

      const [id] = await db('conduct_reports').insert(report);
      report.report_id = id;

      logger.info(`Conduct report ${id} generated for student ${studentId}`);
      return report;
    } catch (error) {
      logger.error('Error generating conduct report:', error);
      throw error;
    }
  }

  /**
   * Get student conduct reports
   */
  async getStudentReports(studentId: string, tenantId: string) {
    try {
      const reports = await db('conduct_reports')
        .where({ student_id: studentId, tenant_id: tenantId })
        .orderBy('created_at', 'desc');

      return reports;
    } catch (error) {
      logger.error('Error getting student reports:', error);
      throw error;
    }
  }

  /**
   * Get single report
   */
  async getReport(reportId: string, tenantId: string): Promise<ConductReport> {
    try {
      const report = await db('conduct_reports')
        .where({ report_id: reportId, tenant_id: tenantId })
        .first();

      if (!report) {
        throw new AppError('Report not found', 404);
      }

      return report;
    } catch (error) {
      logger.error('Error getting report:', error);
      throw error;
    }
  }

  /**
   * Share report with parents
   */
  async shareWithParents(
    reportId: string,
    tenantId: string,
    userId: string
  ): Promise<ConductReport> {
    try {
      const report = await this.getReport(reportId, tenantId);

      const student = await db('users')
        .where({ id: report.student_id, tenant_id: tenantId })
        .first();

      if (!student) {
        throw new AppError('Student not found', 404);
      }

      // Get guardians
      const guardians = await db('student_guardians')
        .where({ student_id: report.student_id, status: 'active' })
        .select('guardian_id');

      // Send to each guardian
      for (const guardian of guardians) {
        try {
          const guardianUser = await db('users')
            .where({ id: guardian.guardian_id, tenant_id: tenantId })
            .first();

          if (!guardianUser) continue;

          // In-app notification
          await notificationService.createNotification({
            user_id: guardian.guardian_id,
            tenant_id: tenantId,
            type: 'conduct_report_shared',
            title: 'Conduct Report Available',
            message: `A conduct report for your child has been shared`,
            related_entity: 'conduct_report',
            related_id: reportId,
          });

          // Email
          if (guardianUser.email_notifications_enabled && guardianUser.email) {
            await emailService.sendConductReport(
              guardianUser.email,
              guardianUser.first_name,
              student.first_name,
              report
            );
          }
        } catch (err) {
          logger.error(`Error sharing report with guardian:`, err);
        }
      }

      // Update report
      await db('conduct_reports')
        .where({ report_id: reportId })
        .update({
          parent_shared: true,
          parent_share_date: new Date(),
        });

      logger.info(`Report ${reportId} shared with parents`);
      return this.getReport(reportId, tenantId);
    } catch (error) {
      logger.error('Error sharing report with parents:', error);
      throw error;
    }
  }

  /**
   * Acknowledge report receipt
   */
  async acknowledgeReceipt(reportId: string, tenantId: string, userId: string): Promise<ConductReport> {
    try {
      const report = await this.getReport(reportId, tenantId);

      if (!report.parent_shared) {
        throw new AppError('Report has not been shared yet', 400);
      }

      await db('conduct_reports')
        .where({ report_id: reportId })
        .update({ parent_acknowledged: true });

      logger.info(`Report ${reportId} acknowledged by parent`);
      return this.getReport(reportId, tenantId);
    } catch (error) {
      logger.error('Error acknowledging receipt:', error);
      throw error;
    }
  }

  /**
   * Get class conduct report summary
   */
  async getClassSummary(classId: string, tenantId: string) {
    try {
      // Get all students in class
      const students = await db('class_enrollments')
        .where({ class_id: classId, status: 'active' })
        .select('student_id');

      const studentIds = students.map(s => s.student_id);

      if (studentIds.length === 0) {
        return {
          class_id: classId,
          total_students: 0,
          average_behavior_rating: 0,
          students_with_infractions: 0,
          total_infractions: 0,
          high_risk_count: 0,
        };
      }

      // Get infractions for class
      const infractions = await db('student_infractions')
        .whereIn('student_id', studentIds)
        .where({ tenant_id: tenantId });

      // Get average behavior rating
      const notes = await db('behavioral_notes')
        .whereIn('student_id', studentIds)
        .where({ tenant_id: tenantId });

      const ratingSum = notes.reduce((sum, note) => sum + (note.rating || 0), 0);
      const avgRating = notes.length > 0 ? ratingSum / notes.length : 0;

      // Count high-risk students (those with many infractions)
      const highRiskCount = new Set(
        infractions.filter(i => {
          const studentInfractions = infractions.filter(inf => inf.student_id === i.student_id);
          return studentInfractions.length >= 3;
        }).map(i => i.student_id)
      ).size;

      return {
        class_id: classId,
        total_students: studentIds.length,
        average_behavior_rating: parseFloat(avgRating.toFixed(2)),
        students_with_infractions: new Set(infractions.map(i => i.student_id)).size,
        total_infractions: infractions.length,
        high_risk_count: highRiskCount,
      };
    } catch (error) {
      logger.error('Error getting class summary:', error);
      throw error;
    }
  }

  /**
   * Generate strengths section
   */
  private generateStrengths(positiveNotes: any[], behavioralRating: number): string {
    const strengths = [];

    if (behavioralRating >= 8) {
      strengths.push('Demonstrates consistently positive behavior');
    }

    if (positiveNotes.length >= 5) {
      strengths.push('Receives frequent positive feedback from teachers');
    }

    if (positiveNotes.length > 0) {
      const uniqueStrengths = new Set(positiveNotes.map(n => n.category));
      uniqueStrengths.forEach(strength => {
        strengths.push(`Strong performance in ${strength}`);
      });
    }

    return strengths.length > 0 ? strengths.join('; ') : 'Student shows potential for improvement';
  }

  /**
   * Generate areas for improvement
   */
  private generateImprovementAreas(
    concernNotes: any[],
    infractions: any[],
    totalPoints: number
  ): string {
    const areas = [];

    if (totalPoints > 50) {
      areas.push('Needs significant improvement in following school conduct policies');
    }

    if (infractions.length >= 3) {
      areas.push('Multiple infractions recorded; consistency in behavior needed');
    }

    if (concernNotes.length > 0) {
      const categories = new Set(concernNotes.map(n => n.category));
      categories.forEach(cat => {
        areas.push(`Needs attention in ${cat} behavior`);
      });
    }

    return areas.length > 0 ? areas.join('; ') : 'Continue current positive behavior';
  }

  /**
   * Generate teacher comments
   */
  private generateTeacherComments(infractions: any[], behavioralRating: number): string {
    if (behavioralRating >= 9) {
      return 'Excellent conduct. Model student behavior.';
    } else if (behavioralRating >= 7) {
      return 'Good behavior with minor areas to improve.';
    } else if (behavioralRating >= 5) {
      return 'Average behavior with room for improvement in specific areas.';
    } else if (infractions.length === 0) {
      return 'No infractions recorded, but attention to attitude recommended.';
    } else {
      return 'Multiple behavioral concerns require parental involvement and intervention.';
    }
  }

  /**
   * Generate overall assessment
   */
  private generateOverallAssessment(
    infractionCount: number,
    behavioralRating: number,
    totalPoints: number
  ): string {
    if (infractionCount === 0 && behavioralRating >= 8) {
      return 'Outstanding conduct and behavior. Student is a positive role model.';
    } else if (infractionCount <= 2 && behavioralRating >= 7) {
      return 'Good conduct with occasional minor infractions. Overall positive trajectory.';
    } else if (infractionCount <= 4 && totalPoints <= 50) {
      return 'Fair conduct. Student needs to focus on improving compliance with school policies.';
    } else {
      return 'Concerning conduct patterns. Intensive intervention and support needed.';
    }
  }
}

export default new ConductReportService();
