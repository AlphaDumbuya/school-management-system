/**
 * Phase 14: Data Import/Export Routes
 * 
 * RESTful endpoints for CSV/Excel import, data validation, and bulk export operations
 * with comprehensive error reporting and field mapping capabilities.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, requirePermission } from '@middleware/authMiddleware';
import { Phase14ImportExportService, ImportOptions, ExportOptions } from '@services/phase14ImportExportService';
import { StudentService } from '@services/studentService';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import knex from 'knex';
import knexConfig from '../../knexfile';
import * as multer from 'multer';
import * as path from 'path';

const router = Router();
const db = knex(knexConfig.development);
const importExportService = new Phase14ImportExportService(db);
const studentService = new StudentService(db);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only CSV and Excel files are allowed', 400, 'INVALID_FILE_TYPE'));
    }
  },
});

/**
 * POST /api/v1/import/validate-file
 * Validate and preview file content without importing
 * 
 * Request body:
 * - fileType: 'csv' | 'excel'
 * - importType: 'student' | 'grade' | 'attendance'
 * - fieldMapping: { csvColumn: dbField }
 * 
 * Response:
 * - preview: First 5 rows
 * - headers: Detected headers
 * - totalRows: Total rows in file
 * - mappedHeaders: Headers after field mapping
 * - validationPreview: Sample validation results
 */
router.post(
  '/validate-file',
  authenticate,
  authorize('admin', 'school_manager'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400, 'MISSING_FILE');
      }

      const { fileType, importType, fieldMapping } = req.body;
      const tenantId = (req as any).user.tenant_id;
      const userId = (req as any).user.id;

      if (!fileType || !importType || !fieldMapping) {
        throw new AppError('Missing required fields: fileType, importType, fieldMapping', 400, 'VALIDATION_ERROR');
      }

      // Parse file
      let parsedData;
      if (fileType === 'csv') {
        parsedData = await importExportService.parseCSV(req.file.buffer.toString('utf-8'));
      } else if (fileType === 'excel') {
        parsedData = await importExportService.parseExcel(req.file.buffer);
      } else {
        throw new AppError('Unsupported file type', 400, 'VALIDATION_ERROR');
      }

      // Validate data
      const { valid, errors } = await importExportService.validateImportData(
        parsedData.rows,
        importType,
        tenantId,
        JSON.parse(fieldMapping)
      );

      // Generate preview (first 5 valid rows)
      const preview = valid.slice(0, 5);
      const mappedFieldMapping = JSON.parse(fieldMapping);

      res.json({
        success: true,
        data: {
          totalRows: parsedData.rows.length,
          validRows: valid.length,
          invalidRows: errors.length,
          headers: parsedData.headers,
          mappedHeaders: Object.values(mappedFieldMapping),
          preview,
          errorSummary: {
            total: errors.length,
            byField: Object.entries(
              errors.reduce((acc: Record<string, number>, err) => {
                acc[err.field] = (acc[err.field] || 0) + 1;
                return acc;
              }, {})
            ),
            samples: errors.slice(0, 10),
          },
          canProceed: errors.length === 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/import/start
 * Start a bulk import job
 * 
 * Request body:
 * - fileType: 'csv' | 'excel'
 * - importType: 'student' | 'grade' | 'attendance'
 * - fieldMapping: { csvColumn: dbField }
 * - duplicateHandling: 'skip' | 'merge' | 'error'
 * - validateOnly?: boolean (default: false)
 * 
 * Response:
 * - importId: Job ID for tracking
 * - status: 'pending' | 'processing'
 * - estimatedDuration: Estimated processing time
 */
router.post(
  '/start',
  authenticate,
  authorize('admin', 'school_manager'),
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('No file uploaded', 400, 'MISSING_FILE');
      }

      const { fileType, importType, fieldMapping, duplicateHandling = 'skip', validateOnly = false } = req.body;
      const tenantId = (req as any).user.tenant_id;
      const userId = (req as any).user.id;

      if (!fileType || !importType || !fieldMapping) {
        throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
      }

      // Parse file
      let parsedData;
      if (fileType === 'csv') {
        parsedData = await importExportService.parseCSV(req.file.buffer.toString('utf-8'));
      } else if (fileType === 'excel') {
        parsedData = await importExportService.parseExcel(req.file.buffer);
      } else {
        throw new AppError('Unsupported file type', 400, 'VALIDATION_ERROR');
      }

      // Create import job record
      const [importId] = await db('import_jobs').insert({
        tenant_id: tenantId,
        import_type: importType,
        file_name: req.file.originalname,
        file_type: fileType,
        status: 'pending',
        total_rows: parsedData.rows.length,
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Start async processing (non-blocking)
      setImmediate(async () => {
        try {
          const options: ImportOptions = {
            fileType: fileType as 'csv' | 'excel',
            fieldMapping: JSON.parse(fieldMapping),
            tenantId,
            userId,
            importType: importType as 'student' | 'grade' | 'attendance',
            duplicateHandling: duplicateHandling as 'skip' | 'merge' | 'error',
            validateOnly,
          };

          await importExportService.processImport(importId, parsedData.rows, options);
        } catch (error) {
          logger.error(`Import job ${importId} failed:`, error);
          await db('import_jobs').where('id', importId).update({
            status: 'failed',
            error_message: (error as Error).message,
          });
        }
      });

      res.json({
        success: true,
        data: {
          importId,
          status: 'pending',
          totalRows: parsedData.rows.length,
          estimatedDuration: Math.ceil(parsedData.rows.length / 100) + ' seconds',
          message: 'Import job started. Check status using importId',
        },
      });

      logger.info(`Import job ${importId} started: ${parsedData.rows.length} rows, type: ${importType}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/import/:importId/status
 * Get import job status and progress
 * 
 * Response:
 * - importId: Job ID
 * - status: 'pending' | 'processing' | 'completed' | 'failed'
 * - progress: Percentage complete
 * - result: If completed, includes summary and error details
 */
router.get(
  '/:importId/status',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { importId } = req.params;
      const tenantId = (req as any).user.tenant_id;

      const job = await db('import_jobs').where('id', importId).where('tenant_id', tenantId).first();

      if (!job) {
        throw new AppError('Import job not found', 404, 'NOT_FOUND');
      }

      const result = job.result ? JSON.parse(job.result) : null;

      res.json({
        success: true,
        data: {
          importId,
          status: job.status,
          progress: job.status === 'completed' ? 100 : 50,
          totalRows: job.total_rows,
          successfulRows: result?.successfulRows || 0,
          failedRows: result?.failedRows || 0,
          result,
          createdAt: job.created_at,
          completedAt: job.completed_at,
          errorMessage: job.error_message,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/import/:importId/errors
 * Get detailed error report for failed import
 * 
 * Response:
 * - totalErrors: Total error count
 * - errorsByField: Grouped by field
 * - errorsByRow: Grouped by row number
 * - sampleErrors: First 10 errors with suggestions
 */
router.get(
  '/:importId/errors',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { importId } = req.params;
      const tenantId = (req as any).user.tenant_id;

      // Verify ownership
      const job = await db('import_jobs').where('id', importId).where('tenant_id', tenantId).first();
      if (!job) {
        throw new AppError('Import job not found', 404, 'NOT_FOUND');
      }

      const errorReport = await importExportService.getImportErrorReport(importId);

      res.json({
        success: true,
        data: errorReport,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/import/:importId/download-errors
 * Download error report as CSV
 */
router.get(
  '/:importId/download-errors',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { importId } = req.params;
      const tenantId = (req as any).user.tenant_id;

      // Verify ownership
      const job = await db('import_jobs').where('id', importId).where('tenant_id', tenantId).first();
      if (!job) {
        throw new AppError('Import job not found', 404, 'NOT_FOUND');
      }

      const errorReport = await importExportService.getImportErrorReport(importId);
      const result = job.result ? JSON.parse(job.result) : null;

      // Build CSV
      let csv = 'Row Number,Field,Value,Error Message,Suggestion\n';
      if (result && result.errors) {
        result.errors.forEach((error: any) => {
          csv += `${error.rowNumber},"${error.field}","${String(error.value).replace(/"/g, '""')}","${error.errorMessage}","${error.suggestion || ''}"\n`;
        });
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="import-errors-${importId}.csv"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/import/history
 * Get import job history
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Records per page (default: 20)
 * - status: Filter by status
 * - importType: Filter by import type
 */
router.get(
  '',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenant_id;
      const { page = 1, limit = 20, status, importType } = req.query;

      let query = db('import_jobs').where('tenant_id', tenantId);

      if (status) {
        query = query.where('status', status);
      }

      if (importType) {
        query = query.where('import_type', importType);
      }

      const total = await query.clone().count('* as count').first();
      const jobs = await query
        .select('id', 'import_type', 'file_name', 'status', 'total_rows', 'created_by', 'created_at', 'completed_at')
        .limit(Number(limit))
        .offset((Number(page) - 1) * Number(limit))
        .orderBy('created_at', 'desc');

      res.json({
        success: true,
        data: {
          jobs,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: total.count,
            total_pages: Math.ceil(total.count / Number(limit)),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/export/students
 * Export students data
 * 
 * Request body:
 * - format: 'csv' | 'excel' | 'pdf'
 * - fields: Array of field names to export
 * - filters?: { classId, startDate, endDate, status }
 * - maskSensitive?: boolean
 * 
 * Response: File download
 */
router.post(
  '/export/students',
  authenticate,
  authorize('admin', 'school_manager', 'teacher'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { format, fields, filters = {}, maskSensitive = true } = req.body;
      const tenantId = (req as any).user.tenant_id;

      if (!format || !fields || fields.length === 0) {
        throw new AppError('Missing required fields: format, fields', 400, 'VALIDATION_ERROR');
      }

      const exportOptions: ExportOptions = {
        format: format as 'csv' | 'excel' | 'pdf',
        fields,
        filters: {
          ...filters,
          tenantId,
        },
        maskSensitive,
      };

      let fileContent: string | Buffer;
      let contentType: string;
      let filename: string;

      if (format === 'csv') {
        fileContent = await importExportService.exportToCSV(exportOptions);
        contentType = 'text/csv';
        filename = `students-export-${Date.now()}.csv`;
      } else if (format === 'excel') {
        fileContent = await importExportService.exportToExcel(exportOptions);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `students-export-${Date.now()}.xlsx`;
      } else {
        throw new AppError('PDF export not yet implemented', 501, 'NOT_IMPLEMENTED');
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(fileContent);

      logger.info(`Student data exported: format=${format}, fields=${fields.length}, user=${(req as any).user.id}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/export/grades
 * Export grades data
 */
router.post(
  '/export/grades',
  authenticate,
  authorize('admin', 'school_manager', 'teacher'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { format, fields, filters = {}, maskSensitive = true } = req.body;
      const tenantId = (req as any).user.tenant_id;

      if (!format || !fields || fields.length === 0) {
        throw new AppError('Missing required fields: format, fields', 400, 'VALIDATION_ERROR');
      }

      const exportOptions: ExportOptions = {
        format: format as 'csv' | 'excel' | 'pdf',
        fields,
        filters: {
          ...filters,
          tenantId,
        },
        maskSensitive,
      };

      let fileContent: string | Buffer;
      let contentType: string;
      let filename: string;

      if (format === 'csv') {
        fileContent = await importExportService.exportToCSV(exportOptions);
        contentType = 'text/csv';
        filename = `grades-export-${Date.now()}.csv`;
      } else if (format === 'excel') {
        fileContent = await importExportService.exportToExcel(exportOptions);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `grades-export-${Date.now()}.xlsx`;
      } else {
        throw new AppError('PDF export not yet implemented', 501, 'NOT_IMPLEMENTED');
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(fileContent);

      logger.info(`Grades data exported: format=${format}, fields=${fields.length}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/export/attendance
 * Export attendance data
 */
router.post(
  '/export/attendance',
  authenticate,
  authorize('admin', 'school_manager', 'teacher'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { format, fields, filters = {}, maskSensitive = true } = req.body;
      const tenantId = (req as any).user.tenant_id;

      if (!format || !fields || fields.length === 0) {
        throw new AppError('Missing required fields: format, fields', 400, 'VALIDATION_ERROR');
      }

      const exportOptions: ExportOptions = {
        format: format as 'csv' | 'excel' | 'pdf',
        fields,
        filters: {
          ...filters,
          tenantId,
        },
        maskSensitive,
      };

      let fileContent: string | Buffer;
      let contentType: string;
      let filename: string;

      if (format === 'csv') {
        fileContent = await importExportService.exportToCSV(exportOptions);
        contentType = 'text/csv';
        filename = `attendance-export-${Date.now()}.csv`;
      } else if (format === 'excel') {
        fileContent = await importExportService.exportToExcel(exportOptions);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `attendance-export-${Date.now()}.xlsx`;
      } else {
        throw new AppError('PDF export not yet implemented', 501, 'NOT_IMPLEMENTED');
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(fileContent);

      logger.info(`Attendance data exported: format=${format}, fields=${fields.length}`);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
