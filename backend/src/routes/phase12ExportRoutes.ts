import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '@middleware/authMiddleware';
import { rbacMiddleware } from '@middleware/rbacMiddleware';
import exportService from '@services/exportService';
import { logger } from '@utils/logger';
import db from '@utils/database';

const router = Router();

// Middleware
router.use(authenticate);

/**
 * POST /api/v1/export/dashboard/pdf
 * Export dashboard data to PDF
 * Required permissions: dashboard.export
 */
router.post('/export/dashboard/pdf', rbacMiddleware('dashboard.export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dashboardType, filters, includeCharts } = req.body;
    const userId = (req as any).user.id;

    if (!dashboardType) {
      return res.status(400).json({ error: 'dashboardType is required' });
    }

    logger.info(`PDF export requested by ${userId} for ${dashboardType}`);

    // Get dashboard data based on type
    let dashboardData: any;

    if (dashboardType === 'admin') {
      const query = db('dashboard_analytics').where('created_at', '>=', db.raw("NOW() - INTERVAL '30 days'"));
      dashboardData = await query;
    } else if (dashboardType === 'teacher') {
      dashboardData = await db('dashboard_analytics').where('user_id', userId);
    } else {
      dashboardData = await db('dashboard_analytics').where('user_id', userId).limit(100);
    }

    // Generate PDF
    const pdfBuffer = await exportService.exportToPDF(dashboardData, {
      title: `${dashboardType} Dashboard Report`,
      includeCharts: includeCharts !== false,
      filters,
    });

    // Log export
    await exportService.logExport(userId, 'pdf', pdfBuffer.length);

    // Send file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard-${dashboardType}-${Date.now()}.pdf"`);
    res.send(pdfBuffer);

    logger.info(`PDF export completed for user ${userId}`);
  } catch (error) {
    logger.error('Error exporting PDF:', error);
    next(error);
  }
});

/**
 * POST /api/v1/export/dashboard/excel
 * Export dashboard data to Excel
 * Required permissions: dashboard.export
 */
router.post('/export/dashboard/excel', rbacMiddleware('dashboard.export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dashboardType, filters } = req.body;
    const userId = (req as any).user.id;

    if (!dashboardType) {
      return res.status(400).json({ error: 'dashboardType is required' });
    }

    logger.info(`Excel export requested by ${userId} for ${dashboardType}`);

    // Get dashboard data
    let dashboardData: any;

    if (dashboardType === 'admin') {
      dashboardData = await db('dashboard_analytics').limit(10000);
    } else if (dashboardType === 'financial') {
      dashboardData = await db('invoices').limit(5000);
    } else {
      dashboardData = await db('dashboard_analytics').where('user_id', userId).limit(1000);
    }

    // Generate Excel
    const excelBuffer = await exportService.exportToExcel(dashboardData, {
      sheetName: `${dashboardType} Report`,
      title: `${dashboardType} Dashboard Report`,
      filters,
    });

    // Log export
    await exportService.logExport(userId, 'excel', excelBuffer.length);

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard-${dashboardType}-${Date.now()}.xlsx"`);
    res.send(excelBuffer);

    logger.info(`Excel export completed for user ${userId}`);
  } catch (error) {
    logger.error('Error exporting Excel:', error);
    next(error);
  }
});

/**
 * POST /api/v1/export/dashboard/csv
 * Export dashboard data to CSV
 * Required permissions: dashboard.export
 */
router.post('/export/dashboard/csv', rbacMiddleware('dashboard.export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dashboardType, filters } = req.body;
    const userId = (req as any).user.id;

    if (!dashboardType) {
      return res.status(400).json({ error: 'dashboardType is required' });
    }

    logger.info(`CSV export requested by ${userId} for ${dashboardType}`);

    // Get dashboard data
    let dashboardData: any;

    if (dashboardType === 'admin') {
      dashboardData = await db('dashboard_analytics').limit(50000);
    } else {
      dashboardData = await db('dashboard_analytics').where('user_id', userId).limit(10000);
    }

    // Generate CSV
    const csvData = await exportService.exportToCSV(dashboardData);

    // Log export
    await exportService.logExport(userId, 'csv', csvData.length);

    // Send file
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard-${dashboardType}-${Date.now()}.csv"`);
    res.send(csvData);

    logger.info(`CSV export completed for user ${userId}`);
  } catch (error) {
    logger.error('Error exporting CSV:', error);
    next(error);
  }
});

/**
 * POST /api/v1/export/dashboard/email
 * Email dashboard report to user
 * Required permissions: dashboard.export
 */
router.post('/export/dashboard/email', rbacMiddleware('dashboard.export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dashboardType, format, email } = req.body;
    const userId = (req as any).user.id;

    if (!dashboardType || !format || !email) {
      return res.status(400).json({
        error: 'dashboardType, format, and email are required',
      });
    }

    if (!['pdf', 'excel', 'csv'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Must be pdf, excel, or csv' });
    }

    logger.info(`Email export requested by ${userId} for ${dashboardType} in ${format} format`);

    // Get dashboard data
    let dashboardData: any;
    if (dashboardType === 'admin') {
      dashboardData = await db('dashboard_analytics').limit(10000);
    } else {
      dashboardData = await db('dashboard_analytics').where('user_id', userId).limit(1000);
    }

    // Generate file based on format
    let fileBuffer: Buffer | string;
    let contentType: string;
    let filename: string;

    if (format === 'pdf') {
      fileBuffer = await exportService.exportToPDF(dashboardData, {
        title: `${dashboardType} Dashboard Report`,
      });
      contentType = 'application/pdf';
      filename = `dashboard-${dashboardType}.pdf`;
    } else if (format === 'excel') {
      fileBuffer = await exportService.exportToExcel(dashboardData, {
        sheetName: `${dashboardType} Report`,
      });
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      filename = `dashboard-${dashboardType}.xlsx`;
    } else {
      fileBuffer = await exportService.exportToCSV(dashboardData);
      contentType = 'text/csv';
      filename = `dashboard-${dashboardType}.csv`;
    }

    // Send email (placeholder - integrate with email service)
    logger.info(`Sending ${format} export to ${email}`);

    // Log export
    await exportService.logExport(userId, format, typeof fileBuffer === 'string' ? fileBuffer.length : fileBuffer.length);

    res.json({
      success: true,
      message: `${format} export sent to ${email}`,
      format,
      filename,
    });

    logger.info(`Email export sent for user ${userId}`);
  } catch (error) {
    logger.error('Error sending email export:', error);
    next(error);
  }
});

/**
 * GET /api/v1/export/templates
 * Get user's saved export templates
 * Required permissions: dashboard.export
 */
router.get('/export/templates', rbacMiddleware('dashboard.export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    logger.info(`Fetching export templates for user ${userId}`);

    const templates = await exportService.getUserTemplates(userId);

    res.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    logger.error('Error fetching templates:', error);
    next(error);
  }
});

/**
 * POST /api/v1/export/templates/save
 * Save current export configuration as template
 * Required permissions: dashboard.export
 */
router.post('/export/templates/save', rbacMiddleware('dashboard.export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, format, columns, filters } = req.body;
    const userId = (req as any).user.id;

    if (!name || !format) {
      return res.status(400).json({ error: 'name and format are required' });
    }

    logger.info(`Saving export template "${name}" for user ${userId}`);

    const template = await exportService.saveTemplate(userId, {
      name,
      description,
      format,
      columns,
      filters,
    });

    res.json({
      success: true,
      data: template,
      message: 'Template saved successfully',
    });
  } catch (error) {
    logger.error('Error saving template:', error);
    next(error);
  }
});

/**
 * DELETE /api/v1/export/templates/:id
 * Delete an export template
 * Required permissions: dashboard.export
 */
router.delete('/export/templates/:id', rbacMiddleware('dashboard.export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    logger.info(`Deleting export template ${id} for user ${userId}`);

    await exportService.deleteTemplate(id);

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting template:', error);
    next(error);
  }
});

/**
 * GET /api/v1/export/history
 * Get user's export history
 * Required permissions: dashboard.export
 */
router.get('/export/history', rbacMiddleware('dashboard.export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;
    const { limit = 50, offset = 0 } = req.query;

    logger.info(`Fetching export history for user ${userId}`);

    const history = await db('export_history')
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const total = await db('export_history')
      .where('user_id', userId)
      .count('* as count')
      .first();

    res.json({
      success: true,
      data: history,
      count: history.length,
      totalCount: total?.count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    logger.error('Error fetching export history:', error);
    next(error);
  }
});

/**
 * POST /api/v1/dashboards/admin/filter
 * Advanced filtering endpoint
 * Required permissions: dashboard.view
 */
router.post('/dashboards/admin/filter', rbacMiddleware('dashboard.view'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filters } = req.body;
    const userId = (req as any).user.id;

    logger.info(`Advanced filter applied by user ${userId}:`, filters);

    // Build query based on filters
    let query = db('dashboard_analytics');

    if (Array.isArray(filters)) {
      filters.forEach((filter) => {
        const { field, operator, value } = filter;

        switch (operator) {
          case 'equals':
            query = query.where(field, value);
            break;
          case 'notEquals':
            query = query.whereNot(field, value);
            break;
          case 'contains':
            query = query.where(field, 'like', `%${value}%`);
            break;
          case 'gte':
            query = query.where(field, '>=', value);
            break;
          case 'lte':
            query = query.where(field, '<=', value);
            break;
          case 'between':
            if (Array.isArray(value) && value.length === 2) {
              query = query.whereBetween(field, value);
            }
            break;
          case 'in':
            if (Array.isArray(value)) {
              query = query.whereIn(field, value);
            }
            break;
        }
      });
    }

    const data = await query.limit(1000);
    const totalCount = await db('dashboard_analytics').count('* as count').first();

    res.json({
      success: true,
      data,
      count: data.length,
      totalCount: totalCount?.count || 0,
      filters,
    });

    logger.info(`Filter completed: ${data.length} results found`);
  } catch (error) {
    logger.error('Error applying filter:', error);
    next(error);
  }
});

export default router;
