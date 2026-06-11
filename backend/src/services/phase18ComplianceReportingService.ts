import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 18.1 & 18.2: Compliance Reporting and Audit Analytics
 * 
 * Provides comprehensive compliance and audit reporting:
 * - Audit trail generation for regulatory compliance
 * - Compliance metrics and dashboards
 * - Data access pattern analysis
 * - User activity reports
 * - Sensitive action tracking
 * - Audit trail exports in various formats
 */

interface ComplianceReport {
  id: string;
  tenantId: string;
  reportType: string;
  dateRange: {
    startDate: Date;
    endDate: Date;
  };
  metrics: Record<string, any>;
  generatedAt: Date;
  generatedBy: string;
}

interface AuditMetrics {
  totalAuditEvents: number;
  successfulActions: number;
  failedActions: number;
  userCount: number;
  actionTypeBreakdown: Record<string, number>;
  entityTypeBreakdown: Record<string, number>;
  hourlyActivityPattern: Record<number, number>;
  riskScore: number;
}

interface SensitiveActionLog {
  id: string;
  tenantId: string;
  userId: string;
  actionType: string;
  entityType: string;
  entityId: string;
  reason: string;
  approvalRequired: boolean;
  approvedBy?: string;
  approvedAt?: Date;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  createdAt: Date;
}

export class ComplianceReportingService {
  private db: Knex;

  /**
   * Initializes compliance reporting service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('ComplianceReportingService initialized');
  }

  /**
   * Generates compliance report for audit trail
   * @param tenantId - Tenant ID
   * @param reportType - Type of compliance report
   * @param startDate - Report start date
   * @param endDate - Report end date
   * @param userId - User generating report
   * @returns Generated compliance report
   */
  async generateComplianceReport(
    tenantId: string,
    reportType: 'audit_trail' | 'access_summary' | 'incident_report' | 'user_activity',
    startDate: Date,
    endDate: Date,
    userId: string
  ): Promise<ComplianceReport> {
    try {
      if (endDate < startDate) {
        throw new AppError('Invalid date range: endDate must be after startDate', 400);
      }

      const reportId = uuidv4();

      // Fetch metrics based on report type
      let metrics: Record<string, any> = {};

      switch (reportType) {
        case 'audit_trail':
          metrics = await this.generateAuditTrailMetrics(tenantId, startDate, endDate);
          break;
        case 'access_summary':
          metrics = await this.generateAccessSummaryMetrics(tenantId, startDate, endDate);
          break;
        case 'incident_report':
          metrics = await this.generateIncidentMetrics(tenantId, startDate, endDate);
          break;
        case 'user_activity':
          metrics = await this.generateUserActivityMetrics(tenantId, startDate, endDate);
          break;
      }

      // Store report metadata
      const report: ComplianceReport = {
        id: reportId,
        tenantId,
        reportType,
        dateRange: { startDate, endDate },
        metrics,
        generatedAt: new Date(),
        generatedBy: userId,
      };

      // Save to database
      await this.db('compliance_reports').insert({
        id: reportId,
        tenant_id: tenantId,
        report_type: reportType,
        start_date: startDate,
        end_date: endDate,
        metrics: JSON.stringify(metrics),
        generated_by: userId,
        generated_at: new Date(),
      });

      logger.info(`Generated ${reportType} compliance report for tenant ${tenantId}`);
      return report;
    } catch (error) {
      logger.error('Failed to generate compliance report', error);
      throw new AppError('Failed to generate compliance report', 500, (error as Error).message);
    }
  }

  /**
   * Generates audit trail metrics
   * @param tenantId - Tenant ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Audit trail metrics
   */
  private async generateAuditTrailMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<AuditMetrics> {
    try {
      // Get total audit events
      const totalEvents = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .count('* as count')
        .first() as any;

      // Get success/failure breakdown
      const statusBreakdown = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('status')
        .select('status')
        .count('* as count');

      // Get action type breakdown
      const actionBreakdown = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('action')
        .select('action')
        .count('* as count');

      // Get entity type breakdown
      const entityBreakdown = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('entity_type')
        .select('entity_type')
        .count('* as count');

      // Get unique users
      const uniqueUsers = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .distinct('user_id')
        .count('DISTINCT user_id as count')
        .first() as any;

      // Calculate hourly activity pattern
      const hourlyPattern = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .select(this.db.raw('EXTRACT(HOUR FROM created_at) as hour'))
        .count('* as count')
        .groupBy(this.db.raw('EXTRACT(HOUR FROM created_at)'));

      // Calculate risk score (based on failure rate and suspicious patterns)
      const failureCount = statusBreakdown.find((s: any) => s.status === 'failure')?.count || 0;
      const failureRate = totalEvents.count ? (failureCount / totalEvents.count) * 100 : 0;
      const riskScore = Math.round(failureRate * 10);

      return {
        totalAuditEvents: totalEvents.count || 0,
        successfulActions: statusBreakdown.find((s: any) => s.status === 'success')?.count || 0,
        failedActions: failureCount,
        userCount: uniqueUsers.count || 0,
        actionTypeBreakdown: Object.fromEntries(
          actionBreakdown.map((a: any) => [a.action, a.count])
        ),
        entityTypeBreakdown: Object.fromEntries(
          entityBreakdown.map((e: any) => [e.entity_type, e.count])
        ),
        hourlyActivityPattern: Object.fromEntries(
          hourlyPattern.map((h: any) => [h.hour, h.count])
        ),
        riskScore,
      };
    } catch (error) {
      logger.error('Failed to generate audit trail metrics', error);
      throw new AppError('Failed to generate audit trail metrics', 500);
    }
  }

  /**
   * Generates access summary metrics
   * @param tenantId - Tenant ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Access summary metrics
   */
  private async generateAccessSummaryMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, any>> {
    try {
      // Get failed access attempts
      const failedAttempts = await this.db('access_logs')
        .where('tenant_id', tenantId)
        .where('status', 'failure')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .count('* as count')
        .first() as any;

      // Get successful logins
      const successfulLogins = await this.db('access_logs')
        .where('tenant_id', tenantId)
        .where('action', 'login')
        .where('status', 'success')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .count('* as count')
        .first() as any;

      // Get unique IPs accessing the system
      const uniqueIPs = await this.db('access_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .distinct('ip_address')
        .count('DISTINCT ip_address as count')
        .first() as any;

      // Get blocked IPs
      const blockedIPs = await this.db('ip_blocklist')
        .where('active', true)
        .count('* as count')
        .first() as any;

      // Get top accessing IPs
      const topIPs = await this.db('access_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('ip_address')
        .select('ip_address')
        .count('* as count')
        .orderBy('count', 'desc')
        .limit(10);

      return {
        failedAccessAttempts: failedAttempts.count || 0,
        successfulLogins: successfulLogins.count || 0,
        uniqueIPAddresses: uniqueIPs.count || 0,
        blockedIPCount: blockedIPs.count || 0,
        topAccessingIPs: topIPs.map((ip: any) => ({
          ipAddress: ip.ip_address,
          accessCount: ip.count,
        })),
      };
    } catch (error) {
      logger.error('Failed to generate access summary metrics', error);
      throw new AppError('Failed to generate access summary metrics', 500);
    }
  }

  /**
   * Generates incident metrics
   * @param tenantId - Tenant ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns Incident metrics
   */
  private async generateIncidentMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, any>> {
    try {
      // Get security alerts
      const alerts = await this.db('security_alerts')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .select('severity')
        .count('* as count')
        .groupBy('severity');

      // Get unacknowledged alerts
      const unacknowledged = await this.db('security_alerts')
        .where('tenant_id', tenantId)
        .where('acknowledged', false)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .count('* as count')
        .first() as any;

      // Get failed operations
      const failedOps = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('status', 'failure')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .count('* as count')
        .first() as any;

      return {
        totalAlerts: alerts.reduce((sum: number, a: any) => sum + a.count, 0),
        alertsBySeverity: Object.fromEntries(
          alerts.map((a: any) => [a.severity, a.count])
        ),
        unacknowledgedAlerts: unacknowledged.count || 0,
        failedOperations: failedOps.count || 0,
      };
    } catch (error) {
      logger.error('Failed to generate incident metrics', error);
      throw new AppError('Failed to generate incident metrics', 500);
    }
  }

  /**
   * Generates user activity metrics
   * @param tenantId - Tenant ID
   * @param startDate - Start date
   * @param endDate - End date
   * @returns User activity metrics
   */
  private async generateUserActivityMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, any>> {
    try {
      // Get most active users
      const topUsers = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('user_id')
        .select('user_id')
        .count('* as count')
        .orderBy('count', 'desc')
        .limit(20);

      // Get user failure patterns
      const userFailures = await this.db('access_logs')
        .where('tenant_id', tenantId)
        .where('status', 'failure')
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('user_id')
        .select('user_id')
        .count('* as count')
        .orderBy('count', 'desc')
        .limit(10);

      // Get user action breakdown
      const userActions = await this.db('audit_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .where('created_at', '<=', endDate)
        .groupBy('action')
        .select('action')
        .count('DISTINCT user_id as user_count');

      return {
        topActiveUsers: topUsers.map((u: any) => ({
          userId: u.user_id,
          actionCount: u.count,
        })),
        usersWithFailures: userFailures.map((u: any) => ({
          userId: u.user_id,
          failureCount: u.count,
        })),
        userActionDistribution: Object.fromEntries(
          userActions.map((a: any) => [a.action, a.user_count])
        ),
      };
    } catch (error) {
      logger.error('Failed to generate user activity metrics', error);
      throw new AppError('Failed to generate user activity metrics', 500);
    }
  }

  /**
   * Exports compliance report in specified format
   * @param reportId - Report ID
   * @param format - Export format (csv, json, pdf)
   * @returns Exported report content
   */
  async exportComplianceReport(
    reportId: string,
    format: 'csv' | 'json' | 'pdf' = 'json'
  ): Promise<string> {
    try {
      const report = await this.db('compliance_reports')
        .where('id', reportId)
        .first();

      if (!report) {
        throw new AppError('Compliance report not found', 404);
      }

      const metrics = JSON.parse(report.metrics);

      if (format === 'json') {
        return JSON.stringify(
          {
            id: report.id,
            type: report.report_type,
            dateRange: {
              startDate: report.start_date,
              endDate: report.end_date,
            },
            metrics,
            generatedAt: report.generated_at,
          },
          null,
          2
        );
      }

      if (format === 'csv') {
        return this.metricsToCSV(metrics, report.report_type);
      }

      if (format === 'pdf') {
        // PDF generation would require additional library
        throw new AppError('PDF export requires additional configuration', 501);
      }

      throw new AppError('Unsupported export format', 400);
    } catch (error) {
      logger.error('Failed to export compliance report', error);
      throw new AppError('Failed to export compliance report', 500, (error as Error).message);
    }
  }

  /**
   * Converts metrics to CSV format
   * @param metrics - Metrics object
   * @param reportType - Type of report
   * @returns CSV content
   */
  private metricsToCSV(metrics: Record<string, any>, reportType: string): string {
    const rows: string[] = [`Compliance Report - ${reportType}`];
    rows.push('');
    rows.push('Metric,Value');

    const flattenMetrics = (obj: any, prefix = ''): [string, any][] => {
      const result: [string, any][] = [];
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          result.push(...flattenMetrics(value, `${prefix}${key}.`));
        } else if (Array.isArray(value)) {
          result.push([`${prefix}${key}`, JSON.stringify(value)]);
        } else {
          result.push([`${prefix}${key}`, value]);
        }
      }
      return result;
    };

    const flattened = flattenMetrics(metrics);
    rows.push(
      ...flattened.map(([key, value]) => `"${key}","${String(value).replace(/"/g, '""')}"`)
    );

    return rows.join('\n');
  }

  /**
   * Lists compliance reports with filtering
   * @param tenantId - Tenant ID
   * @param reportType - Filter by report type
   * @param limit - Result limit
   * @param offset - Result offset
   * @returns Array of compliance reports
   */
  async listComplianceReports(
    tenantId: string,
    reportType?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<ComplianceReport[]> {
    try {
      let query = this.db('compliance_reports')
        .where('tenant_id', tenantId);

      if (reportType) {
        query = query.where('report_type', reportType);
      }

      const reports = await query
        .orderBy('generated_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      return reports.map((r: any) => ({
        id: r.id,
        tenantId: r.tenant_id,
        reportType: r.report_type,
        dateRange: {
          startDate: r.start_date,
          endDate: r.end_date,
        },
        metrics: JSON.parse(r.metrics),
        generatedAt: r.generated_at,
        generatedBy: r.generated_by,
      }));
    } catch (error) {
      logger.error('Failed to list compliance reports', error);
      throw new AppError('Failed to list compliance reports', 500);
    }
  }
}

export default ComplianceReportingService;
