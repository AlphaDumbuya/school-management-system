import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 20.6: Performance Monitoring
 * 
 * Provides performance monitoring and optimization:
 * - Page load time monitoring
 * - Performance metrics collection
 * - Performance alerts
 * - Resource usage tracking
 * - Slow operation detection
 */

interface PerformanceMetric {
  id: string;
  tenantId: string;
  pageUrl: string;
  metricType: string;
  value: number;
  unit: string;
  userAgent?: string;
  deviceType?: string;
  timestamp: Date;
}

interface PerformanceAlert {
  id: string;
  tenantId: string;
  pageUrl: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threshold: number;
  actualValue: number;
  title: string;
  description: string;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

export class PerformanceMonitoringService {
  private db: Knex;

  /**
   * Initializes performance monitoring service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('PerformanceMonitoringService initialized');
  }

  /**
   * Records a performance metric
   * @param tenantId - Tenant ID
   * @param pageUrl - Page URL
   * @param metricType - Type of metric (FCP, LCP, CLS, FID, TTFB, etc.)
   * @param value - Metric value
   * @param unit - Unit of measurement
   * @param deviceInfo - Device information
   */
  async recordPerformanceMetric(
    tenantId: string,
    pageUrl: string,
    metricType: string,
    value: number,
    unit: string,
    deviceInfo?: { userAgent?: string; deviceType?: string }
  ): Promise<PerformanceMetric> {
    try {
      const metricId = uuidv4();

      await this.db('performance_metrics').insert({
        id: metricId,
        tenant_id: tenantId,
        page_url: pageUrl,
        metric_type: metricType,
        value,
        unit,
        user_agent: deviceInfo?.userAgent || null,
        device_type: deviceInfo?.deviceType || null,
        timestamp: new Date(),
      });

      // Check if metric violates thresholds
      await this.checkPerformanceThresholds(tenantId, pageUrl, metricType, value);

      logger.debug(`Performance metric recorded: ${metricType}=${value}${unit} for ${pageUrl}`);

      return {
        id: metricId,
        tenantId,
        pageUrl,
        metricType,
        value,
        unit,
        userAgent: deviceInfo?.userAgent,
        deviceType: deviceInfo?.deviceType,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Failed to record performance metric', error);
      throw new AppError('Failed to record performance metric', 500);
    }
  }

  /**
   * Checks if metric violates performance thresholds
   * @param tenantId - Tenant ID
   * @param pageUrl - Page URL
   * @param metricType - Metric type
   * @param value - Metric value
   */
  private async checkPerformanceThresholds(
    tenantId: string,
    pageUrl: string,
    metricType: string,
    value: number
  ): Promise<void> {
    try {
      // Define performance thresholds
      const thresholds: Record<string, number> = {
        FCP: 1800, // First Contentful Paint: 1.8s
        LCP: 2500, // Largest Contentful Paint: 2.5s
        FID: 100, // First Input Delay: 100ms
        CLS: 0.1, // Cumulative Layout Shift: 0.1
        TTFB: 600, // Time to First Byte: 600ms
        page_load_time: 3000, // 3s
      };

      const threshold = thresholds[metricType];
      if (!threshold) return;

      if (value > threshold) {
        await this.generatePerformanceAlert(
          tenantId,
          pageUrl,
          'slow_metric',
          'high',
          threshold,
          value,
          `${metricType} exceeded threshold`,
          `${metricType} is ${value}ms, exceeding threshold of ${threshold}ms`
        );
      }
    } catch (error) {
      logger.error('Failed to check performance thresholds', error);
    }
  }

  /**
   * Generates performance alert
   * @param tenantId - Tenant ID
   * @param pageUrl - Page URL
   * @param alertType - Type of alert
   * @param severity - Alert severity
   * @param threshold - Performance threshold
   * @param actualValue - Actual metric value
   * @param title - Alert title
   * @param description - Alert description
   */
  async generatePerformanceAlert(
    tenantId: string,
    pageUrl: string,
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    threshold: number,
    actualValue: number,
    title: string,
    description: string
  ): Promise<PerformanceAlert> {
    try {
      const alertId = uuidv4();

      await this.db('performance_alerts').insert({
        id: alertId,
        tenant_id: tenantId,
        page_url: pageUrl,
        alert_type: alertType,
        severity,
        threshold,
        actual_value: actualValue,
        title,
        description,
        resolved: false,
        created_at: new Date(),
      });

      logger.warn(`Performance alert: ${title} (${severity})`);

      return {
        id: alertId,
        tenantId,
        pageUrl,
        alertType,
        severity,
        threshold,
        actualValue,
        title,
        description,
        resolved: false,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to generate performance alert', error);
      throw new AppError('Failed to generate performance alert', 500);
    }
  }

  /**
   * Gets performance metrics with filtering
   * @param tenantId - Tenant ID
   * @param filters - Filter criteria
   * @returns Array of performance metrics
   */
  async getPerformanceMetrics(
    tenantId: string,
    filters?: {
      pageUrl?: string;
      metricType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<PerformanceMetric[]> {
    try {
      let query = this.db('performance_metrics')
        .where('tenant_id', tenantId);

      if (filters?.pageUrl) {
        query = query.where('page_url', 'like', `%${filters.pageUrl}%`);
      }

      if (filters?.metricType) {
        query = query.where('metric_type', filters.metricType);
      }

      if (filters?.startDate) {
        query = query.where('timestamp', '>=', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.where('timestamp', '<=', filters.endDate);
      }

      const limit = filters?.limit || 500;
      const offset = filters?.offset || 0;

      const metrics = await query
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      return metrics.map((m: any) => ({
        id: m.id,
        tenantId: m.tenant_id,
        pageUrl: m.page_url,
        metricType: m.metric_type,
        value: m.value,
        unit: m.unit,
        userAgent: m.user_agent,
        deviceType: m.device_type,
        timestamp: m.timestamp,
      }));
    } catch (error) {
      logger.error('Failed to get performance metrics', error);
      throw new AppError('Failed to get performance metrics', 500);
    }
  }

  /**
   * Calculates average performance metrics
   * @param tenantId - Tenant ID
   * @param metricType - Metric type
   * @param periodDays - Time period in days
   * @returns Average and percentile metrics
   */
  async getPerformanceStats(
    tenantId: string,
    metricType: string,
    periodDays: number = 7
  ): Promise<{
    metricType: string;
    average: number;
    min: number;
    max: number;
    p50: number;
    p75: number;
    p95: number;
    p99: number;
    sampleCount: number;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const metrics = await this.db('performance_metrics')
        .where('tenant_id', tenantId)
        .where('metric_type', metricType)
        .where('timestamp', '>=', startDate)
        .select('value')
        .orderBy('value', 'asc');

      if (metrics.length === 0) {
        throw new AppError('No metrics found for period', 404);
      }

      const values = metrics.map((m: any) => m.value).sort((a: number, b: number) => a - b);

      const average = values.reduce((a: number, b: number) => a + b, 0) / values.length;
      const min = values[0];
      const max = values[values.length - 1];
      const p50 = values[Math.floor(values.length * 0.5)];
      const p75 = values[Math.floor(values.length * 0.75)];
      const p95 = values[Math.floor(values.length * 0.95)];
      const p99 = values[Math.floor(values.length * 0.99)];

      return {
        metricType,
        average: Math.round(average),
        min,
        max,
        p50,
        p75,
        p95,
        p99,
        sampleCount: values.length,
      };
    } catch (error) {
      logger.error('Failed to calculate performance stats', error);
      throw error;
    }
  }

  /**
   * Gets performance alerts
   * @param tenantId - Tenant ID
   * @param resolved - Filter by resolved status
   * @returns Array of alerts
   */
  async getPerformanceAlerts(
    tenantId: string,
    resolved?: boolean
  ): Promise<PerformanceAlert[]> {
    try {
      let query = this.db('performance_alerts')
        .where('tenant_id', tenantId);

      if (resolved !== undefined) {
        query = query.where('resolved', resolved);
      }

      const alerts = await query
        .orderBy('created_at', 'desc')
        .select();

      return alerts.map((a: any) => ({
        id: a.id,
        tenantId: a.tenant_id,
        pageUrl: a.page_url,
        alertType: a.alert_type,
        severity: a.severity,
        threshold: a.threshold,
        actualValue: a.actual_value,
        title: a.title,
        description: a.description,
        resolved: a.resolved,
        resolvedAt: a.resolved_at,
        createdAt: a.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get performance alerts', error);
      throw new AppError('Failed to get performance alerts', 500);
    }
  }

  /**
   * Resolves performance alert
   * @param alertId - Alert ID
   * @returns Updated alert
   */
  async resolvePerformanceAlert(alertId: string): Promise<PerformanceAlert> {
    try {
      const alert = await this.db('performance_alerts')
        .where('id', alertId)
        .first();

      if (!alert) {
        throw new AppError('Performance alert not found', 404);
      }

      const now = new Date();
      await this.db('performance_alerts')
        .where('id', alertId)
        .update({
          resolved: true,
          resolved_at: now,
        });

      return {
        id: alert.id,
        tenantId: alert.tenant_id,
        pageUrl: alert.page_url,
        alertType: alert.alert_type,
        severity: alert.severity,
        threshold: alert.threshold,
        actualValue: alert.actual_value,
        title: alert.title,
        description: alert.description,
        resolved: true,
        resolvedAt: now,
        createdAt: alert.created_at,
      };
    } catch (error) {
      logger.error('Failed to resolve performance alert', error);
      throw error;
    }
  }

  /**
   * Gets performance summary for dashboard
   * @param tenantId - Tenant ID
   * @returns Performance summary
   */
  async getPerformanceSummary(tenantId: string): Promise<{
    averagePageLoadTime: number;
    averageFCP: number;
    averageLCP: number;
    averageFID: number;
    averageCLS: number;
    totalMetricsCollected: number;
    criticalAlerts: number;
    performanceScore: number;
  }> {
    try {
      // Get average metrics for different types
      const fcpStats = await this.getPerformanceStats(tenantId, 'FCP', 7).catch(() => null);
      const lcpStats = await this.getPerformanceStats(tenantId, 'LCP', 7).catch(() => null);
      const fidStats = await this.getPerformanceStats(tenantId, 'FID', 7).catch(() => null);
      const clsStats = await this.getPerformanceStats(tenantId, 'CLS', 7).catch(() => null);
      const pageLoadStats = await this.getPerformanceStats(tenantId, 'page_load_time', 7).catch(() => null);

      // Count total metrics
      const totalMetrics = await this.db('performance_metrics')
        .where('tenant_id', tenantId)
        .count('* as count')
        .first() as any;

      // Count critical alerts
      const criticalAlerts = await this.db('performance_alerts')
        .where('tenant_id', tenantId)
        .where('severity', 'critical')
        .where('resolved', false)
        .count('* as count')
        .first() as any;

      // Calculate performance score (0-100)
      let score = 100;
      if (fcpStats && fcpStats.average > 1800) score -= 10;
      if (lcpStats && lcpStats.average > 2500) score -= 20;
      if (fidStats && fidStats.average > 100) score -= 15;
      if (clsStats && clsStats.average > 0.1) score -= 15;
      if (pageLoadStats && pageLoadStats.average > 3000) score -= 25;

      return {
        averagePageLoadTime: pageLoadStats?.average || 0,
        averageFCP: fcpStats?.average || 0,
        averageLCP: lcpStats?.average || 0,
        averageFID: fidStats?.average || 0,
        averageCLS: clsStats?.average || 0,
        totalMetricsCollected: totalMetrics.count || 0,
        criticalAlerts: criticalAlerts.count || 0,
        performanceScore: Math.max(0, score),
      };
    } catch (error) {
      logger.error('Failed to get performance summary', error);
      return {
        averagePageLoadTime: 0,
        averageFCP: 0,
        averageLCP: 0,
        averageFID: 0,
        averageCLS: 0,
        totalMetricsCollected: 0,
        criticalAlerts: 0,
        performanceScore: 0,
      };
    }
  }
}

export default PerformanceMonitoringService;
