import type { Express, Response } from 'express';
import type { Knex } from 'knex';
import type { Request } from 'express';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import PerformanceMonitoringService from '@services/phase20PerformanceMonitoringService';
import CachingService from '@services/phase20CachingService';

// Import auth middleware - use the authenticate export
import { authenticate } from '@middleware/authMiddleware';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        tenantId: string;
        userId: string;
        email: string;
      };
    }
  }
}

/**
 * Phase 20: Mobile Responsiveness and Performance Routes
 * 
 * API endpoints for:
 * - Performance metrics recording and retrieval
 * - Performance alerts management
 * - Cache operations and statistics
 * - Offline data synchronization
 */

export default function registerPhase20Routes(
  app: Express,
  db: Knex
): void {
  const performanceService = new PerformanceMonitoringService(db);
  const cachingService = new CachingService(db);

  // ==================== PERFORMANCE MONITORING ENDPOINTS ====================

  /**
   * POST /api/v1/performance/metrics
   * Records performance metrics from client
   */
  app.post('/api/v1/performance/metrics', authenticate, async (req: Request, res: Response) => {
    try {
      const { pageUrl, metricType, value, unit, deviceType, userAgent } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!pageUrl || !metricType || typeof value !== 'number' || !unit) {
        throw new AppError('pageUrl, metricType, value, and unit required', 400);
      }

      const metric = await performanceService.recordPerformanceMetric(
        tenantId,
        pageUrl,
        metricType,
        value,
        unit,
        { deviceType, userAgent }
      );

      res.status(201).json({ success: true, data: metric });
    } catch (error) {
      logger.error('Failed to record performance metric', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/performance/metrics
   * Retrieves performance metrics with filtering
   */
  app.get('/api/v1/performance/metrics', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { pageUrl, metricType, startDate, endDate, limit = 500, offset = 0 } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);

      const metrics = await performanceService.getPerformanceMetrics(tenantId, {
        pageUrl: pageUrl as string | undefined,
        metricType: metricType as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      res.status(200).json({
        success: true,
        data: metrics,
        pagination: { limit, offset },
      });
    } catch (error) {
      logger.error('Failed to get performance metrics', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/performance/stats/:metricType
   * Retrieves performance statistics for a metric type
   */
  app.get('/api/v1/performance/stats/:metricType', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { metricType } = req.params;
      const { periodDays = 7 } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!metricType) throw new AppError('metricType required', 400);

      const stats = await performanceService.getPerformanceStats(
        tenantId,
        metricType,
        parseInt(periodDays as string)
      );

      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      logger.error('Failed to get performance stats', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/performance/summary
   * Retrieves performance summary for dashboard
   */
  app.get('/api/v1/performance/summary', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const summary = await performanceService.getPerformanceSummary(tenantId);
      res.status(200).json({ success: true, data: summary });
    } catch (error) {
      logger.error('Failed to get performance summary', error);
      throw error;
    }
  });

  // ==================== PERFORMANCE ALERTS ENDPOINTS ====================

  /**
   * GET /api/v1/performance/alerts
   * Retrieves performance alerts
   */
  app.get('/api/v1/performance/alerts', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { resolved } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);

      const resolvedFilter = resolved === 'true' ? true : resolved === 'false' ? false : undefined;
      const alerts = await performanceService.getPerformanceAlerts(tenantId, resolvedFilter);

      res.status(200).json({ success: true, data: alerts });
    } catch (error) {
      logger.error('Failed to get performance alerts', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/performance/alerts/:alertId/resolve
   * Resolves performance alert
   */
  app.post('/api/v1/performance/alerts/:alertId/resolve', authenticate, async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const tenantId = req.user?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!alertId) throw new AppError('alertId required', 400);

      const alert = await performanceService.resolvePerformanceAlert(alertId);
      res.status(200).json({ success: true, data: alert });
    } catch (error) {
      logger.error('Failed to resolve performance alert', error);
      throw error;
    }
  });

  // ==================== CACHING ENDPOINTS ====================

  /**
   * POST /api/v1/cache/set
   * Sets cache entry
   */
  app.post('/api/v1/cache/set', authenticate, async (req: Request, res: Response) => {
    try {
      const { key, value, ttlSeconds = 3600, useMemory = true } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!key || value === undefined) throw new AppError('key and value required', 400);

      await cachingService.set(tenantId, key, value, ttlSeconds, useMemory);

      res.status(201).json({
        success: true,
        data: { key, ttlSeconds, message: 'Cache entry set successfully' },
      });
    } catch (error) {
      logger.error('Failed to set cache', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/cache/get/:key
   * Retrieves cache entry
   */
  app.get('/api/v1/cache/get/:key', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { key } = req.params;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!key) throw new AppError('key required', 400);

      const value = await cachingService.get(tenantId, key);

      if (value === null) {
        return res.status(404).json({
          success: false,
          error: 'Cache entry not found or expired',
        });
      }

      res.status(200).json({ success: true, data: { key, value } });
    } catch (error) {
      logger.error('Failed to get cache', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/cache/invalidate/:key
   * Invalidates single cache entry
   */
  app.post('/api/v1/cache/invalidate/:key', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { key } = req.params;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!key) throw new AppError('key required', 400);

      await cachingService.invalidate(tenantId, key);

      res.status(200).json({
        success: true,
        data: { key, message: 'Cache entry invalidated successfully' },
      });
    } catch (error) {
      logger.error('Failed to invalidate cache', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/cache/invalidate-pattern
   * Invalidates cache by pattern
   */
  app.post('/api/v1/cache/invalidate-pattern', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { pattern } = req.body;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!pattern) throw new AppError('pattern required', 400);

      const count = await cachingService.invalidateByPattern(tenantId, pattern);

      res.status(200).json({
        success: true,
        data: { pattern, invalidatedCount: count },
      });
    } catch (error) {
      logger.error('Failed to invalidate cache by pattern', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/cache/clear
   * Clears all cache for tenant
   */
  app.post('/api/v1/cache/clear', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      await cachingService.clear(tenantId);

      res.status(200).json({
        success: true,
        data: { message: 'All cache cleared successfully' },
      });
    } catch (error) {
      logger.error('Failed to clear cache', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/cache/stats
   * Retrieves cache statistics
   */
  app.get('/api/v1/cache/stats', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const stats = await cachingService.getStatistics(tenantId);

      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      logger.error('Failed to get cache stats', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/cache/top-keys
   * Retrieves most frequently accessed cache keys
   */
  app.get('/api/v1/cache/top-keys', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { limit = 10 } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);

      const keys = await cachingService.getTopCacheKeys(tenantId, parseInt(limit as string));

      res.status(200).json({ success: true, data: keys });
    } catch (error) {
      logger.error('Failed to get top cache keys', error);
      throw error;
    }
  });

  logger.info('Phase 20 Performance routes registered (12 endpoints)');
}

