import type { Express, Response } from 'express';
import type { Request } from 'express';
import type { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { authenticate } from '@middleware/authMiddleware';
import AcademicRecordParser from '@services/phase22AcademicRecordParser';
import AcademicRecordSerializer from '@services/phase22AcademicRecordSerializer';

// Extend Express Request
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
 * Phase 22: Data Serialization & Parsing Routes
 * 
 * API endpoints for:
 * - Academic record parsing
 * - Academic record serialization
 * - Bulk import/export
 * - Format conversion
 */

export default function registerPhase22Routes(
  app: Express,
  db: Knex
): void {
  // ==================== PARSING ENDPOINTS ====================

  /**
   * POST /api/v1/data/parse/record
   * Parses single academic record from JSON
   */
  app.post('/api/v1/data/parse/record', authenticate, async (req: Request, res: Response) => {
    try {
      const { jsonString } = req.body;

      if (!jsonString || typeof jsonString !== 'string') {
        throw new AppError('jsonString (string) required', 400);
      }

      const result = AcademicRecordParser.parseRecord(jsonString);

      res.status(200).json({
        success: result.success,
        data: result.data,
        errors: result.errors,
        warnings: result.warnings,
        lineCount: result.lineCount,
      });
    } catch (error) {
      logger.error('Failed to parse academic record', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/data/parse/records
   * Parses array of academic records from JSON
   */
  app.post('/api/v1/data/parse/records', authenticate, async (req: Request, res: Response) => {
    try {
      const { jsonString } = req.body;

      if (!jsonString || typeof jsonString !== 'string') {
        throw new AppError('jsonString (string) required', 400);
      }

      const result = AcademicRecordParser.parseRecords(jsonString);

      res.status(200).json({
        success: result.success,
        data: result.data,
        errors: result.errors,
        warnings: result.warnings,
        lineCount: result.lineCount,
        recordCount: result.data?.length || 0,
      });
    } catch (error) {
      logger.error('Failed to parse academic records', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/data/validate
   * Validates academic record JSON
   */
  app.post('/api/v1/data/validate', authenticate, async (req: Request, res: Response) => {
    try {
      const { jsonString } = req.body;

      if (!jsonString) throw new AppError('jsonString required', 400);

      const result = AcademicRecordParser.parseRecords(jsonString);
      const errorMessages = result.errors.map((e) => AcademicRecordParser.formatError(e));

      res.status(200).json({
        success: result.success,
        recordCount: result.data?.length || 0,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        errors: errorMessages,
        summary: result.success ? 'Validation passed' : 'Validation failed',
      });
    } catch (error) {
      logger.error('Failed to validate records', error);
      throw error;
    }
  });

  // ==================== SERIALIZATION ENDPOINTS ====================

  /**
   * POST /api/v1/data/serialize/record
   * Serializes single academic record to JSON
   */
  app.post('/api/v1/data/serialize/record', authenticate, async (req: Request, res: Response) => {
    try {
      const { record, options = {} } = req.body;

      if (!record) throw new AppError('record required', 400);

      const json = AcademicRecordSerializer.serializeRecord(record, {
        prettyPrint: options.prettyPrint ?? true,
        indent: options.indent ?? 2,
        excludeFields: options.excludeFields,
        dateFormat: options.dateFormat || 'iso',
      });

      res.status(200).json({
        success: true,
        data: json,
        format: 'json',
      });
    } catch (error) {
      logger.error('Failed to serialize record', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/data/serialize/records
   * Serializes array of academic records to JSON
   */
  app.post('/api/v1/data/serialize/records', authenticate, async (req: Request, res: Response) => {
    try {
      const { records, options = {} } = req.body;
      const tenantId = req.user?.tenantId;

      if (!Array.isArray(records)) throw new AppError('records (array) required', 400);
      if (!tenantId) throw new AppError('User context required', 401);

      const json = AcademicRecordSerializer.serializeRecords(records, {
        prettyPrint: options.prettyPrint ?? true,
        indent: options.indent ?? 2,
        excludeFields: options.excludeFields,
        dateFormat: options.dateFormat || 'iso',
        filterByDateRange: options.dateRange ? {
          start: new Date(options.dateRange.start),
          end: new Date(options.dateRange.end),
        } : undefined,
        filterByClass: options.classId,
        filterByStudent: options.studentId,
      });

      const stats = AcademicRecordSerializer.getStatistics(records);

      res.status(200).json({
        success: true,
        data: json,
        format: 'json',
        statistics: stats,
      });
    } catch (error) {
      logger.error('Failed to serialize records', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/data/serialize/csv
   * Serializes academic records to CSV
   */
  app.post('/api/v1/data/serialize/csv', authenticate, async (req: Request, res: Response) => {
    try {
      const { records, options = {} } = req.body;
      const tenantId = req.user?.tenantId;

      if (!Array.isArray(records)) throw new AppError('records (array) required', 400);
      if (!tenantId) throw new AppError('User context required', 401);

      const csv = AcademicRecordSerializer.serializeToCSV(records, {
        dateFormat: options.dateFormat || 'iso',
        filterByDateRange: options.dateRange ? {
          start: new Date(options.dateRange.start),
          end: new Date(options.dateRange.end),
        } : undefined,
        filterByClass: options.classId,
        filterByStudent: options.studentId,
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="academic-records.csv"');
      res.status(200).send(csv);
    } catch (error) {
      logger.error('Failed to serialize to CSV', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/data/serialize/compact
   * Serializes records to compact format
   */
  app.post('/api/v1/data/serialize/compact', authenticate, async (req: Request, res: Response) => {
    try {
      const { records } = req.body;

      if (!Array.isArray(records)) throw new AppError('records (array) required', 400);

      const compact = AcademicRecordSerializer.serializeCompact(records);

      res.status(200).json({
        success: true,
        data: compact,
        format: 'compact',
        compressionRatio: `${Math.round((compact.length / JSON.stringify(records).length) * 100)}%`,
      });
    } catch (error) {
      logger.error('Failed to serialize to compact', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/data/deserialize/compact
   * Deserializes compact format to records
   */
  app.post('/api/v1/data/deserialize/compact', authenticate, async (req: Request, res: Response) => {
    try {
      const { compactJson } = req.body;

      if (!compactJson) throw new AppError('compactJson required', 400);

      const records = AcademicRecordSerializer.deserializeCompact(compactJson);

      res.status(200).json({
        success: true,
        data: records,
        recordCount: records.length,
      });
    } catch (error) {
      logger.error('Failed to deserialize compact', error);
      throw error;
    }
  });

  // ==================== STATISTICS ENDPOINTS ====================

  /**
   * POST /api/v1/data/statistics
   * Gets serialization statistics
   */
  app.post('/api/v1/data/statistics', authenticate, async (req: Request, res: Response) => {
    try {
      const { records } = req.body;

      if (!Array.isArray(records)) throw new AppError('records (array) required', 400);

      const stats = AcademicRecordSerializer.getStatistics(records);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get statistics', error);
      throw error;
    }
  });

  logger.info('Phase 22 Data Serialization routes registered (9 endpoints)');
}
