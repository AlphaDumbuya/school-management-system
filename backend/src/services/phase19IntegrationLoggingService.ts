import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 19.5: Integration Logging and Monitoring
 * 
 * Provides comprehensive logging and monitoring for external integrations:
 * - Integration activity logging
 * - Integration error tracking
 * - Integration status monitoring
 * - Performance metrics collection
 * - Alert generation for integration issues
 * - Integration health dashboard data
 */

interface IntegrationLog {
  id: string;
  tenantId: string;
  integrationName: string;
  eventType: string;
  status: 'success' | 'failure' | 'warning';
  endpoint?: string;
  requestData?: Record<string, any>;
  responseData?: Record<string, any>;
  errorMessage?: string;
  responseTime: number; // milliseconds
  statusCode?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

interface IntegrationMetrics {
  tenantId: string;
  integrationName: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  warningRequests: number;
  averageResponseTime: number;
  lastActivityAt?: Date;
  successRate: number;
  uptime: number;
}

interface IntegrationAlert {
  id: string;
  tenantId: string;
  integrationName: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

export class IntegrationLoggingService {
  private db: Knex;

  /**
   * Initializes integration logging service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('IntegrationLoggingService initialized');
  }

  /**
   * Logs an integration activity
   * @param log - Integration log details
   */
  async logIntegrationActivity(
    tenantId: string,
    integrationName: string,
    eventType: string,
    status: 'success' | 'failure' | 'warning',
    responseTime: number,
    details: {
      endpoint?: string;
      requestData?: Record<string, any>;
      responseData?: Record<string, any>;
      errorMessage?: string;
      statusCode?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<IntegrationLog> {
    try {
      const logId = uuidv4();

      await this.db('integration_logs').insert({
        id: logId,
        tenant_id: tenantId,
        integration_name: integrationName,
        event_type: eventType,
        status,
        endpoint: details.endpoint || null,
        request_data: details.requestData ? JSON.stringify(details.requestData) : null,
        response_data: details.responseData ? JSON.stringify(details.responseData) : null,
        error_message: details.errorMessage || null,
        response_time: responseTime,
        status_code: details.statusCode || null,
        metadata: details.metadata ? JSON.stringify(details.metadata) : null,
        created_at: new Date(),
      });

      // Check for errors and generate alerts if needed
      if (status === 'failure') {
        await this.generateIntegrationAlert(
          tenantId,
          integrationName,
          'integration_failure',
          'high',
          `${integrationName} integration failed`,
          details.errorMessage || 'Unknown error'
        );
      }

      logger.info(
        `Integration activity logged: ${integrationName} - ${eventType} (${status}) in ${responseTime}ms`
      );

      return {
        id: logId,
        tenantId,
        integrationName,
        eventType,
        status,
        endpoint: details.endpoint,
        requestData: details.requestData,
        responseData: details.responseData,
        errorMessage: details.errorMessage,
        responseTime,
        statusCode: details.statusCode,
        metadata: details.metadata,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to log integration activity', error);
      // Don't throw - logging should not break the main operation
    }
  }

  /**
   * Generates integration alert
   * @param tenantId - Tenant ID
   * @param integrationName - Integration name
   * @param alertType - Type of alert
   * @param severity - Alert severity
   * @param title - Alert title
   * @param description - Alert description
   */
  async generateIntegrationAlert(
    tenantId: string,
    integrationName: string,
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    title: string,
    description: string
  ): Promise<IntegrationAlert> {
    try {
      const alertId = uuidv4();

      await this.db('integration_alerts').insert({
        id: alertId,
        tenant_id: tenantId,
        integration_name: integrationName,
        alert_type: alertType,
        severity,
        title,
        description,
        resolved: false,
        created_at: new Date(),
      });

      logger.warn(`Integration alert generated: ${title} (${severity})`);

      return {
        id: alertId,
        tenantId,
        integrationName,
        alertType,
        severity,
        title,
        description,
        resolved: false,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to generate integration alert', error);
      throw new AppError('Failed to generate integration alert', 500);
    }
  }

  /**
   * Resolves an integration alert
   * @param alertId - Alert ID
   * @returns Updated alert
   */
  async resolveIntegrationAlert(alertId: string): Promise<IntegrationAlert> {
    try {
      const alert = await this.db('integration_alerts')
        .where('id', alertId)
        .first();

      if (!alert) {
        throw new AppError('Integration alert not found', 404);
      }

      const now = new Date();
      await this.db('integration_alerts')
        .where('id', alertId)
        .update({
          resolved: true,
          resolved_at: now,
        });

      logger.info(`Integration alert resolved: ${alertId}`);

      return {
        id: alert.id,
        tenantId: alert.tenant_id,
        integrationName: alert.integration_name,
        alertType: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        resolved: true,
        resolvedAt: now,
        createdAt: alert.created_at,
      };
    } catch (error) {
      logger.error('Failed to resolve integration alert', error);
      throw error;
    }
  }

  /**
   * Gets integration logs with filtering
   * @param tenantId - Tenant ID
   * @param filters - Filter criteria
   * @returns Array of integration logs
   */
  async getIntegrationLogs(
    tenantId: string,
    filters?: {
      integrationName?: string;
      eventType?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<IntegrationLog[]> {
    try {
      let query = this.db('integration_logs')
        .where('tenant_id', tenantId);

      if (filters?.integrationName) {
        query = query.where('integration_name', filters.integrationName);
      }

      if (filters?.eventType) {
        query = query.where('event_type', filters.eventType);
      }

      if (filters?.status) {
        query = query.where('status', filters.status);
      }

      if (filters?.startDate) {
        query = query.where('created_at', '>=', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.where('created_at', '<=', filters.endDate);
      }

      const limit = filters?.limit || 100;
      const offset = filters?.offset || 0;

      const logs = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      return logs.map((l: any) => ({
        id: l.id,
        tenantId: l.tenant_id,
        integrationName: l.integration_name,
        eventType: l.event_type,
        status: l.status,
        endpoint: l.endpoint,
        requestData: l.request_data ? JSON.parse(l.request_data) : undefined,
        responseData: l.response_data ? JSON.parse(l.response_data) : undefined,
        errorMessage: l.error_message,
        responseTime: l.response_time,
        statusCode: l.status_code,
        metadata: l.metadata ? JSON.parse(l.metadata) : undefined,
        createdAt: l.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get integration logs', error);
      throw new AppError('Failed to get integration logs', 500);
    }
  }

  /**
   * Gets integration metrics
   * @param tenantId - Tenant ID
   * @param integrationName - Integration name
   * @param periodDays - Metrics period in days
   * @returns Integration metrics
   */
  async getIntegrationMetrics(
    tenantId: string,
    integrationName: string,
    periodDays: number = 30
  ): Promise<IntegrationMetrics> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // Get total requests
      const totalRequests = await this.db('integration_logs')
        .where('tenant_id', tenantId)
        .where('integration_name', integrationName)
        .where('created_at', '>=', startDate)
        .count('* as count')
        .first() as any;

      // Get requests by status
      const statusBreakdown = await this.db('integration_logs')
        .where('tenant_id', tenantId)
        .where('integration_name', integrationName)
        .where('created_at', '>=', startDate)
        .groupBy('status')
        .select('status')
        .count('* as count');

      // Get average response time
      const avgResponseTime = await this.db('integration_logs')
        .where('tenant_id', tenantId)
        .where('integration_name', integrationName)
        .where('created_at', '>=', startDate)
        .avg('response_time as avg')
        .first() as any;

      // Get last activity
      const lastActivity = await this.db('integration_logs')
        .where('tenant_id', tenantId)
        .where('integration_name', integrationName)
        .orderBy('created_at', 'desc')
        .first() as any;

      // Get unresolved alerts count
      const unresolved = await this.db('integration_alerts')
        .where('tenant_id', tenantId)
        .where('integration_name', integrationName)
        .where('resolved', false)
        .count('* as count')
        .first() as any;

      const successful = statusBreakdown.find((s: any) => s.status === 'success')?.count || 0;
      const failed = statusBreakdown.find((s: any) => s.status === 'failure')?.count || 0;
      const warning = statusBreakdown.find((s: any) => s.status === 'warning')?.count || 0;

      const successRate =
        totalRequests.count > 0 ? (successful / totalRequests.count) * 100 : 0;
      const uptime = Math.max(0, 100 - (unresolved.count > 0 ? 20 : 0));

      return {
        tenantId,
        integrationName,
        totalRequests: totalRequests.count || 0,
        successfulRequests: successful,
        failedRequests: failed,
        warningRequests: warning,
        averageResponseTime: Math.round(avgResponseTime.avg || 0),
        lastActivityAt: lastActivity?.created_at,
        successRate: Math.round(successRate * 100) / 100,
        uptime: Math.round(uptime * 100) / 100,
      };
    } catch (error) {
      logger.error('Failed to get integration metrics', error);
      throw new AppError('Failed to get integration metrics', 500);
    }
  }

  /**
   * Gets integration alerts
   * @param tenantId - Tenant ID
   * @param integrationName - Filter by integration name
   * @param resolved - Filter by resolved status
   * @returns Array of integration alerts
   */
  async getIntegrationAlerts(
    tenantId: string,
    integrationName?: string,
    resolved?: boolean
  ): Promise<IntegrationAlert[]> {
    try {
      let query = this.db('integration_alerts')
        .where('tenant_id', tenantId);

      if (integrationName) {
        query = query.where('integration_name', integrationName);
      }

      if (resolved !== undefined) {
        query = query.where('resolved', resolved);
      }

      const alerts = await query
        .orderBy('created_at', 'desc')
        .select();

      return alerts.map((a: any) => ({
        id: a.id,
        tenantId: a.tenant_id,
        integrationName: a.integration_name,
        alertType: a.alert_type,
        severity: a.severity,
        title: a.title,
        description: a.description,
        resolved: a.resolved,
        resolvedAt: a.resolved_at,
        createdAt: a.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get integration alerts', error);
      throw new AppError('Failed to get integration alerts', 500);
    }
  }

  /**
   * Gets integration health status for all integrations
   * @param tenantId - Tenant ID
   * @returns Health status for all integrations
   */
  async getIntegrationHealthDashboard(tenantId: string): Promise<{
    email: IntegrationMetrics;
    sms: IntegrationMetrics;
    payment: IntegrationMetrics;
    overallHealth: string;
    criticalAlerts: number;
  }> {
    try {
      const emailMetrics = await this.getIntegrationMetrics(tenantId, 'email');
      const smsMetrics = await this.getIntegrationMetrics(tenantId, 'sms');
      const paymentMetrics = await this.getIntegrationMetrics(tenantId, 'payment_gateway');

      // Get critical alerts
      const criticalAlerts = await this.db('integration_alerts')
        .where('tenant_id', tenantId)
        .where('resolved', false)
        .where('severity', 'critical')
        .count('* as count')
        .first() as any;

      // Calculate overall health
      const avgUptime =
        (emailMetrics.uptime + smsMetrics.uptime + paymentMetrics.uptime) / 3;
      const overallHealth =
        avgUptime >= 95
          ? 'healthy'
          : avgUptime >= 80
            ? 'degraded'
            : 'critical';

      return {
        email: emailMetrics,
        sms: smsMetrics,
        payment: paymentMetrics,
        overallHealth,
        criticalAlerts: criticalAlerts.count || 0,
      };
    } catch (error) {
      logger.error('Failed to get integration health dashboard', error);
      throw new AppError('Failed to get integration health dashboard', 500);
    }
  }
}

export default IntegrationLoggingService;
