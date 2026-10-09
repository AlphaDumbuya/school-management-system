import express, { Router, Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';
import BrevoEmailService, { EmailConfig, EmailTemplateData } from '@services/phase25BrevoEmailService';
import UploadThingService, { FileUploadConfig } from '@services/phase25UploadThingService';
import NeonDatabaseService from '@services/phase25NeonDatabaseService';
import { authenticate, attachUserContext, authorize } from '@middleware/authMiddleware';
import { UserRole } from '../types/auth';

/**
 * Phase 25 External Services Integration Routes
 * 
 * Endpoints for:
 * - Brevo Email Service (transactional and template emails)
 * - UploadThing File Upload Service (file management)
 * - Neon PostgreSQL Database Service (health checks and monitoring)
 */

const router: Router = express.Router();

// SECURITY: these endpoints (email relay, file read/delete, DB maintenance) are
// platform-operator tooling only. The router is mounted at bare /api/v1, so the
// guard MUST stay path-scoped to '/external-services' — an unscoped
// router.use() would 401 every other /api/v1 route that falls through here.
router.use('/external-services', authenticate, attachUserContext, authorize(UserRole.SUPER_ADMIN));

/**
 * ============================================================================
 * BREVO EMAIL SERVICE ENDPOINTS
 * ============================================================================
 */

/**
 * POST /api/v1/external-services/email/send
 * Send a simple transactional email
 */
router.post('/external-services/email/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, subject, htmlContent, textContent, replyTo } = req.body;

    // Validate request body
    if (!to || !subject || !htmlContent) {
      return res.status(400).json({
        error: 'Missing required fields: to, subject, htmlContent',
      });
    }

    const emailConfig: EmailConfig = {
      to,
      subject,
      htmlContent,
      textContent,
      replyTo,
    };

    const result = await BrevoEmailService.sendEmail(emailConfig);

    if (result.status === 'failed') {
      return res.status(500).json({
        error: 'Failed to send email',
        message: result.error,
      });
    }

    res.status(200).json({
      success: true,
      messageId: result.messageId,
      timestamp: result.timestamp,
    });
  } catch (error) {
    logger.error('Email send endpoint error', { error });
    next(error);
  }
});

/**
 * POST /api/v1/external-services/email/template
 * Send email using Brevo template
 */
router.post('/external-services/email/template', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, templateId, params, replyTo } = req.body;

    // Validate request body
    if (!to || !templateId) {
      return res.status(400).json({
        error: 'Missing required fields: to, templateId',
      });
    }

    const templateData: EmailTemplateData = {
      to,
      templateId: parseInt(templateId),
      params: params || {},
      replyTo,
    };

    const result = await BrevoEmailService.sendEmailWithTemplate(templateData);

    if (result.status === 'failed') {
      return res.status(500).json({
        error: 'Failed to send template email',
        message: result.error,
      });
    }

    res.status(200).json({
      success: true,
      messageId: result.messageId,
      timestamp: result.timestamp,
    });
  } catch (error) {
    logger.error('Template email send endpoint error', { error });
    next(error);
  }
});

/**
 * POST /api/v1/external-services/email/bulk
 * Send bulk emails to multiple recipients using template
 */
router.post('/external-services/email/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId, messageVersions, replyTo } = req.body;

    // Validate request body
    if (!templateId || !messageVersions || !Array.isArray(messageVersions)) {
      return res.status(400).json({
        error: 'Missing required fields: templateId, messageVersions (array)',
      });
    }

    const results = await BrevoEmailService.sendBulkEmail({
      templateId: parseInt(templateId),
      messageVersions,
      replyTo,
    });

    const successCount = results.filter(r => r.status === 'sent').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    res.status(200).json({
      success: failureCount === 0,
      totalRecipients: results.length,
      successCount,
      failureCount,
      results,
    });
  } catch (error) {
    logger.error('Bulk email send endpoint error', { error });
    next(error);
  }
});

/**
 * GET /api/v1/external-services/email/statistics
 * Get email sending statistics
 */
router.get('/external-services/email/statistics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await BrevoEmailService.getEmailStatistics();

    res.status(200).json({
      success: true,
      statistics: stats,
    });
  } catch (error) {
    logger.error('Get email statistics endpoint error', { error });
    next(error);
  }
});

/**
 * POST /api/v1/external-services/email/contact
 * Add contact to email list
 */
router.post('/external-services/email/contact', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, listId, attributes } = req.body;

    if (!email || !listId) {
      return res.status(400).json({
        error: 'Missing required fields: email, listId',
      });
    }

    await BrevoEmailService.addContactToList(email, parseInt(listId), attributes);

    res.status(200).json({
      success: true,
      message: 'Contact added to list',
    });
  } catch (error) {
    logger.error('Add contact endpoint error', { error });
    next(error);
  }
});

/**
 * ============================================================================
 * UPLOADTHING FILE UPLOAD SERVICE ENDPOINTS
 * ============================================================================
 */

/**
 * POST /api/v1/external-services/files/upload
 * Upload a file to UploadThing
 */
router.post('/external-services/files/upload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Note: In production, this would use multer middleware to handle file uploads
    // For now, we're showing the structure
    const {
      filename,
      mimeType,
      entityType,
      entityId,
      fileCategory,
      metadata,
      fileBuffer,
    } = req.body;

    if (!filename || !entityType || !entityId || !fileCategory) {
      return res.status(400).json({
        error: 'Missing required fields: filename, entityType, entityId, fileCategory',
      });
    }

    const config: FileUploadConfig = {
      file: Buffer.from(fileBuffer),
      filename,
      mimeType: mimeType || 'application/octet-stream',
      entityType: entityType as any,
      entityId,
      fileCategory: fileCategory as any,
      metadata,
    };

    const result = await UploadThingService.uploadFile(config);

    if (result.status === 'failed') {
      return res.status(500).json({
        error: 'Failed to upload file',
        message: result.error,
      });
    }

    res.status(200).json({
      success: true,
      fileId: result.fileId,
      filename: result.filename,
      url: result.url,
      size: result.size,
      uploadedAt: result.uploadedAt,
    });
  } catch (error) {
    logger.error('File upload endpoint error', { error });
    next(error);
  }
});

/**
 * GET /api/v1/external-services/files/:fileId
 * Download a file
 */
router.get('/external-services/files/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      return res.status(400).json({
        error: 'File ID is required',
      });
    }

    const file = await UploadThingService.downloadFile(fileId);

    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Type', file.mimeType);
    res.send(file.content);
  } catch (error) {
    logger.error('File download endpoint error', { error });
    next(error);
  }
});

/**
 * GET /api/v1/external-services/files/:fileId/metadata
 * Get file metadata
 */
router.get('/external-services/files/:fileId/metadata', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      return res.status(400).json({
        error: 'File ID is required',
      });
    }

    const metadata = await UploadThingService.getFileMetadata(fileId);

    res.status(200).json({
      success: true,
      metadata,
    });
  } catch (error) {
    logger.error('Get file metadata endpoint error', { error });
    next(error);
  }
});

/**
 * GET /api/v1/external-services/files/list/:entityType/:entityId
 * List files for an entity
 */
router.get('/external-services/files/list/:entityType/:entityId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entityType, entityId } = req.params;
    const { fileCategory } = req.query;

    if (!entityType || !entityId) {
      return res.status(400).json({
        error: 'Entity type and ID are required',
      });
    }

    const files = await UploadThingService.listFiles(entityType, entityId, fileCategory as string);

    res.status(200).json({
      success: true,
      files,
      count: files.length,
    });
  } catch (error) {
    logger.error('List files endpoint error', { error });
    next(error);
  }
});

/**
 * DELETE /api/v1/external-services/files/:fileId
 * Delete a file
 */
router.delete('/external-services/files/:fileId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileId } = req.params;

    if (!fileId) {
      return res.status(400).json({
        error: 'File ID is required',
      });
    }

    await UploadThingService.deleteFile(fileId);

    res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    logger.error('File delete endpoint error', { error });
    next(error);
  }
});

/**
 * GET /api/v1/external-services/files/storage/usage
 * Get storage usage statistics
 */
router.get('/external-services/files/storage/usage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const usage = await UploadThingService.getStorageUsage();

    res.status(200).json({
      success: true,
      usage,
    });
  } catch (error) {
    logger.error('Get storage usage endpoint error', { error });
    next(error);
  }
});

/**
 * ============================================================================
 * NEON DATABASE SERVICE ENDPOINTS
 * ============================================================================
 */

/**
 * GET /api/v1/external-services/database/health
 * Get database health status
 */
router.get('/external-services/database/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const health = await NeonDatabaseService.getHealthStatus();

    res.status(200).json({
      success: true,
      health,
    });
  } catch (error) {
    logger.error('Database health check endpoint error', { error });
    next(error);
  }
});

/**
 * GET /api/v1/external-services/database/stats
 * Get connection pool statistics
 */
router.get('/external-services/database/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = NeonDatabaseService.getPoolStatistics();

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Database stats endpoint error', { error });
    next(error);
  }
});

/**
 * GET /api/v1/external-services/database/size
 * Get database size information
 */
router.get('/external-services/database/size', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const size = await NeonDatabaseService.getDatabaseSize();

    res.status(200).json({
      success: true,
      size,
    });
  } catch (error) {
    logger.error('Database size endpoint error', { error });
    next(error);
  }
});

/**
 * GET /api/v1/external-services/database/tables
 * Get table statistics
 */
router.get('/external-services/database/tables', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tableStats = await NeonDatabaseService.getTableStatistics();

    res.status(200).json({
      success: true,
      tables: tableStats,
      count: tableStats.length,
    });
  } catch (error) {
    logger.error('Database tables endpoint error', { error });
    next(error);
  }
});

/**
 * GET /api/v1/external-services/database/slow-queries
 * Get slow queries
 */
router.get('/external-services/database/slow-queries', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { minDuration } = req.query;
    const minDurationMs = minDuration ? parseInt(minDuration as string) : 1000;

    const queries = await NeonDatabaseService.getSlowQueries(minDurationMs);

    res.status(200).json({
      success: true,
      queries,
      count: queries.length,
      minDuration: minDurationMs,
    });
  } catch (error) {
    logger.error('Slow queries endpoint error', { error });
    next(error);
  }
});

/**
 * GET /api/v1/external-services/database/backup
 * Get backup information
 */
router.get('/external-services/database/backup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const backup = await NeonDatabaseService.getBackupInfo();

    res.status(200).json({
      success: true,
      backup,
    });
  } catch (error) {
    logger.error('Backup info endpoint error', { error });
    next(error);
  }
});

/**
 * POST /api/v1/external-services/database/maintenance
 * Run database maintenance tasks
 */
router.post('/external-services/database/maintenance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const results = await NeonDatabaseService.runMaintenance();

    res.status(200).json({
      success: true,
      message: 'Maintenance tasks completed',
      results,
    });
  } catch (error) {
    logger.error('Database maintenance endpoint error', { error });
    next(error);
  }
});

/**
 * POST /api/v1/external-services/database/test
 * Test database connection
 */
router.post('/external-services/database/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isConnected = await NeonDatabaseService.testConnection();

    res.status(200).json({
      success: isConnected,
      message: isConnected ? 'Database connection successful' : 'Database connection failed',
    });
  } catch (error) {
    logger.error('Database connection test endpoint error', { error });
    next(error);
  }
});

/**
 * ============================================================================
 * INTEGRATION STATUS ENDPOINT
 * ============================================================================
 */

/**
 * GET /api/v1/external-services/status
 * Get status of all external service integrations
 */
router.get('/external-services/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbHealth = await NeonDatabaseService.getHealthStatus();

    res.status(200).json({
      success: true,
      services: {
        brevoEmail: {
          status: 'active',
          version: '1.0.0',
          description: 'Transactional and marketing email service',
        },
        uploadthingFiles: {
          status: 'active',
          version: '1.0.0',
          description: 'File upload and storage service',
        },
        neonDatabase: {
          status: dbHealth.status === 'healthy' ? 'active' : 'degraded',
          version: '1.0.0',
          description: 'Serverless PostgreSQL database service',
          health: dbHealth,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('External services status endpoint error', { error });
    next(error);
  }
});

export default router;
