import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, attachUserContext, authorize, requirePermission } from '@middleware/authMiddleware';
import { UserRole } from '../types/auth';
import { db } from '@utils/database';
import { EnrollmentRequestService } from '@services/enrollmentRequestService';
import { BulkImportService } from '@services/bulkImportService';
import exportService from '@services/exportService';
import { AuditService } from '@services/auditService';
import { logger } from '@utils/logger';

const router = Router();
const enrollmentRequestService = new EnrollmentRequestService(db);
const bulkImportService = new BulkImportService(db);
const auditService = new AuditService(db);

// =====================
// Task 4.1: Enrollment Request Workflow
// =====================

/**
 * POST /api/v1/enrollment-requests
 * Submit an enrollment request
 */
router.post(
  '/enrollment-requests',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { student_id, class_id, academic_session_id, reason_for_request } = req.body;
      const userId = (req as any).user.userId;

      const request = await enrollmentRequestService.submitEnrollmentRequest(
        {
          student_id,
          class_id,
          academic_session_id,
          reason_for_request,
        },
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Enrollment request submitted successfully',
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/enrollment-requests
 * Get enrollment requests with filtering
 */
router.get(
  '/enrollment-requests',
  authenticate,
  requirePermission('enrollment:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, student_id, class_id, academic_session_id, page, limit } = req.query;

      const result = await enrollmentRequestService.getEnrollmentRequests({
        status: status as string,
        student_id: student_id as string,
        class_id: class_id as string,
        academic_session_id: academic_session_id as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/enrollment-requests/:requestId
 * Get enrollment request by ID
 */
router.get(
  '/enrollment-requests/:requestId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { requestId } = req.params;

      const request = await enrollmentRequestService.getEnrollmentRequestById(requestId);

      res.json({
        success: true,
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/enrollment-requests/:requestId/approve
 * Approve an enrollment request
 */
router.post(
  '/enrollment-requests/:requestId/approve',
  authenticate,
  requirePermission('enrollment:approve'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { requestId } = req.params;
      const userId = (req as any).user.userId;

      const request = await enrollmentRequestService.approveEnrollmentRequest(requestId, userId);

      res.json({
        success: true,
        message: 'Enrollment request approved and enrollment created',
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/enrollment-requests/:requestId/reject
 * Reject an enrollment request
 */
router.post(
  '/enrollment-requests/:requestId/reject',
  authenticate,
  requirePermission('enrollment:reject'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { requestId } = req.params;
      const { reason } = req.body;
      const userId = (req as any).user.userId;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required',
        });
      }

      const request = await enrollmentRequestService.rejectEnrollmentRequest(
        requestId,
        reason,
        userId
      );

      res.json({
        success: true,
        message: 'Enrollment request rejected',
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/enrollment-requests/:requestId/cancel
 * Cancel an enrollment request
 */
router.post(
  '/enrollment-requests/:requestId/cancel',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { requestId } = req.params;
      const userId = (req as any).user.userId;

      const request = await enrollmentRequestService.cancelEnrollmentRequest(requestId, userId);

      res.json({
        success: true,
        message: 'Enrollment request cancelled',
        data: request,
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Task 4.2: Bulk Student Import
// =====================

/**
 * POST /api/v1/bulk-import/upload
 * Upload and process bulk student import
 */
router.post(
  '/bulk-import/upload',
  authenticate,
  requirePermission('student:import'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { csvData, fieldMapping, skipDuplicates, updateExisting } = req.body;
      const userId = (req as any).user.userId;

      if (!csvData) {
        return res.status(400).json({
          success: false,
          error: 'CSV data is required',
        });
      }

      // Start import job
      const importId = await bulkImportService.startImportJob(
        'bulk_upload.csv',
        'csv',
        csvData.length,
        userId
      );

      // Parse and validate CSV
      const { rows, errors: parseErrors } = bulkImportService.parseAndValidateCSV(csvData, fieldMapping);

      if (parseErrors.length > 0 && parseErrors.length > rows.length / 2) {
        return res.status(400).json({
          success: false,
          message: 'Too many validation errors in CSV',
          import_id: importId,
          errors: parseErrors.slice(0, 20),
        });
      }

      // Process import
      const result = await bulkImportService.processBulkImport(
        importId,
        rows,
        { skipDuplicates, updateExisting },
        userId
      );

      res.status(202).json({
        success: true,
        message: 'Bulk import completed',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/bulk-import/jobs
 * Get bulk import job history
 */
router.get(
  '/bulk-import/jobs',
  authenticate,
  requirePermission('student:import'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, page, limit } = req.query;

      const result = await bulkImportService.getImportJobsHistory({
        status: status as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/bulk-import/jobs/:jobId
 * Get bulk import job details
 */
router.get(
  '/bulk-import/jobs/:jobId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.params;

      const job = await bulkImportService.getImportJobDetails(jobId);

      res.json({
        success: true,
        data: job,
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Task 4.3: Export Data
// =====================

/**
 * POST /api/v1/exports/enrollments
 * Export enrollment data
 */
router.post(
  '/exports/enrollments',
  authenticate,
  requirePermission('enrollment:export'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { format = 'csv', class_id, academic_session_id, status } = req.body;
      const userId = (req as any).user.userId;

      // Create export job
      const jobId = await exportService.createExportJob('enrollments', format, {
        class_id,
        academic_session_id,
        status,
      }, userId);

      // Get data
      const data = await exportService.getEnrollmentDataForExport({
        class_id,
        academic_session_id,
        status,
      });

      let fileContent = '';
      const timestamp = new Date().toISOString().split('T')[0];
      let filename = `enrollments_${timestamp}`;

      if (format === 'csv') {
        fileContent = exportService.exportToCSV(data);
        filename += '.csv';
      } else if (format === 'json') {
        fileContent = exportService.exportToJSON(data);
        filename += '.json';
      } else if (format === 'pdf') {
        fileContent = exportService.exportToPDFHTML(data, 'Enrollment Report');
        filename += '.html';
      }

      // Update export job
      await exportService.updateExportJob(jobId, {
        status: 'completed',
        total_records: data.length,
      });

      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(fileContent);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/exports/students
 * Export student data
 */
router.post(
  '/exports/students',
  authenticate,
  requirePermission('student:export'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { format = 'csv', status, enrollment_date_from, enrollment_date_to } = req.body;
      const userId = (req as any).user.userId;

      const jobId = await exportService.createExportJob('students', format, {
        status,
        enrollment_date_from,
        enrollment_date_to,
      }, userId);

      const data = await exportService.getStudentDataForExport({
        status,
        enrollment_date_from,
        enrollment_date_to,
      });

      let fileContent = '';
      const timestamp = new Date().toISOString().split('T')[0];
      let filename = `students_${timestamp}`;

      if (format === 'csv') {
        fileContent = exportService.exportToCSV(data);
        filename += '.csv';
      } else if (format === 'json') {
        fileContent = exportService.exportToJSON(data);
        filename += '.json';
      } else if (format === 'pdf') {
        fileContent = exportService.exportToPDFHTML(data, 'Student Report');
        filename += '.html';
      }

      await exportService.updateExportJob(jobId, {
        status: 'completed',
        total_records: data.length,
      });

      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(fileContent);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/exports/jobs
 * Get export job history
 */
router.get(
  '/exports/jobs',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status, export_type, page, limit } = req.query;

      const result = await exportService.getExportJobsHistory({
        status: status as string,
        export_type: export_type as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Task 4.4: Audit Trail
// =====================

/**
 * GET /api/v1/audit-logs/:entityType/:entityId
 * Get audit trail for an entity
 */
router.get(
  '/audit-logs/:entityType/:entityId',
  authenticate,
  attachUserContext,
  authorize(UserRole.PRINCIPAL),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entityType, entityId } = req.params;
      const { action, page, limit } = req.query;

      const result = await auditService.getEntityAuditTrail(req.user!.tenant_id, entityType, entityId, {
        action: action as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/audit-logs/type/:entityType
 * Get audit logs by entity type
 */
router.get(
  '/audit-logs/type/:entityType',
  authenticate,
  attachUserContext,
  authorize(UserRole.PRINCIPAL),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entityType } = req.params;
      const { action, page, limit } = req.query;

      const result = await auditService.getAuditLogsByEntityType(req.user!.tenant_id, entityType, {
        action: action as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/audit-logs/user/:userId
 * Get audit logs by user
 */
router.get(
  '/audit-logs/user/:userId',
  authenticate,
  attachUserContext,
  authorize(UserRole.PRINCIPAL),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { entity_type, action, page, limit } = req.query;

      const result = await auditService.getAuditLogsByUser(req.user!.tenant_id, userId, {
        entity_type: entity_type as string,
        action: action as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 50,
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/audit-logs/statistics
 * Get audit statistics
 */
router.get(
  '/audit-logs/statistics',
  authenticate,
  attachUserContext,
  authorize(UserRole.PRINCIPAL),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;

      const stats = await auditService.getAuditStatistics(
        req.user!.tenant_id,
        startDate as string,
        endDate as string
      );

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
