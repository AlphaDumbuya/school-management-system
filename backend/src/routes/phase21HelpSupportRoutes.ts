import type { Express, Response } from 'express';
import type { Request } from 'express';
import type { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { authenticate } from '@middleware/authMiddleware';
import HelpDocumentationService from '@services/phase21HelpDocumentationService';
import ErrorHandlingService from '@services/phase21ErrorHandlingService';
import SupportTicketService from '@services/phase21SupportTicketService';
import emailService from '@services/emailService';

/** Fire-and-forget support notification — never blocks or fails the request. */
async function notifyRequester(
  ticketService: SupportTicketService,
  ticketId: string,
  event: 'created' | 'replied' | 'status',
  extra?: { status?: string; message?: string }
): Promise<void> {
  try {
    const contact = await ticketService.getRequesterContact(ticketId);
    if (!contact?.email) return;
    await emailService.sendSupportTicketEmail(contact.email, {
      userName: contact.name || undefined,
      reference: SupportTicketService.reference(ticketId),
      subject: contact.subject,
      event,
      status: extra?.status,
      message: extra?.message,
    });
  } catch (err) {
    logger.warn(`Support ticket notification (${event}) failed for ${ticketId}: ${String((err as any)?.message || err)}`);
  }
}

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
 * Phase 21: Help & Support Routes
 * 
 * API endpoints for:
 * - Help documentation
 * - Error handling and messaging
 * - Support tickets
 * - FAQs and tooltips
 */

export default function registerPhase21Routes(
  app: Express,
  db: Knex
): void {
  const helpService = new HelpDocumentationService(db);
  const errorService = new ErrorHandlingService(db);
  const ticketService = new SupportTicketService(db);

  // ==================== HELP DOCUMENTATION ENDPOINTS ====================

  /**
   * GET /api/v1/help/articles/search
   * Searches help articles
   */
  app.get('/api/v1/help/articles/search', authenticate, async (req: Request, res: Response) => {
    try {
      const { query, category, limit = 20 } = req.query;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const articles = await helpService.searchArticles(
        tenantId,
        query as string,
        category as string | undefined,
        parseInt(limit as string)
      );

      res.status(200).json({ success: true, data: articles });
    } catch (error) {
      logger.error('Failed to search help articles', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/help/articles/:articleId
   * Gets help article by ID
   */
  app.get('/api/v1/help/articles/:articleId', authenticate, async (req: Request, res: Response) => {
    try {
      const { articleId } = req.params;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const article = await helpService.getArticle(articleId, tenantId);
      res.status(200).json({ success: true, data: article });
    } catch (error) {
      logger.error('Failed to get help article', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/help/context/:contextPath
   * Gets context-sensitive help
   */
  app.get('/api/v1/help/context/:contextPath', authenticate, async (req: Request, res: Response) => {
    try {
      const { contextPath } = req.params;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const help = await helpService.getContextHelp(tenantId, contextPath);

      if (!help) {
        return res.status(404).json({ success: false, error: 'Help not found for this context' });
      }

      res.status(200).json({ success: true, data: help });
    } catch (error) {
      logger.error('Failed to get context help', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/help/articles/:articleId/helpful
   * Marks article as helpful
   */
  app.post('/api/v1/help/articles/:articleId/helpful', authenticate, async (req: Request, res: Response) => {
    try {
      const { articleId } = req.params;
      await helpService.markHelpful(articleId);
      res.status(200).json({ success: true, data: { message: 'Thank you for your feedback' } });
    } catch (error) {
      logger.error('Failed to mark article helpful', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/help/articles/:articleId/unhelpful
   * Marks article as unhelpful
   */
  app.post('/api/v1/help/articles/:articleId/unhelpful', authenticate, async (req: Request, res: Response) => {
    try {
      const { articleId } = req.params;
      await helpService.markUnhelpful(articleId);
      res.status(200).json({ success: true, data: { message: 'Thank you for your feedback' } });
    } catch (error) {
      logger.error('Failed to mark article unhelpful', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/help/categories
   * Gets help categories
   */
  app.get('/api/v1/help/categories', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const categories = await helpService.getCategories(tenantId);
      res.status(200).json({ success: true, data: categories });
    } catch (error) {
      logger.error('Failed to get categories', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/help/categories/:category
   * Gets articles by category
   */
  app.get('/api/v1/help/categories/:category', authenticate, async (req: Request, res: Response) => {
    try {
      const { category } = req.params;
      const { limit = 50 } = req.query;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const articles = await helpService.getByCategory(tenantId, category, parseInt(limit as string));
      res.status(200).json({ success: true, data: articles });
    } catch (error) {
      logger.error('Failed to get articles by category', error);
      throw error;
    }
  });

  // ==================== FAQ ENDPOINTS ====================

  /**
   * GET /api/v1/help/faqs
   * Gets FAQs
   */
  app.get('/api/v1/help/faqs', authenticate, async (req: Request, res: Response) => {
    try {
      const { category } = req.query;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const faqs = await helpService.getFAQs(tenantId, category as string | undefined);
      res.status(200).json({ success: true, data: faqs });
    } catch (error) {
      logger.error('Failed to get FAQs', error);
      throw error;
    }
  });

  // ==================== ERROR HANDLING ENDPOINTS ====================

  /**
   * GET /api/v1/help/errors/:errorCode
   * Gets user-friendly error message
   */
  app.get('/api/v1/help/errors/:errorCode', authenticate, async (req: Request, res: Response) => {
    try {
      const { errorCode } = req.params;
      const { customMessage } = req.query;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const errorMsg = await errorService.getErrorMessage(
        errorCode,
        tenantId,
        customMessage as string | undefined
      );

      res.status(200).json({ success: true, data: errorMsg });
    } catch (error) {
      logger.error('Failed to get error message', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/help/errors/log
   * Logs error for support
   */
  app.post('/api/v1/help/errors/log', authenticate, async (req: Request, res: Response) => {
    try {
      const { errorCode, message, stackTrace, context } = req.body;
      const tenantId = req.auth?.tenantId;
      const userId = req.auth?.userId;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!errorCode || !message) {
        throw new AppError('errorCode and message required', 400);
      }

      const errorLog = await errorService.logError(
        tenantId,
        errorCode,
        message,
        stackTrace || '',
        context || {},
        userId
      );

      res.status(201).json({ success: true, data: errorLog });
    } catch (error) {
      logger.error('Failed to log error', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/help/errors/logs
   * Gets error logs
   */
  app.get('/api/v1/help/errors/logs', authenticate, async (req: Request, res: Response) => {
    try {
      const { errorCode, resolved, limit = 100, offset = 0 } = req.query;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const logs = await errorService.getErrorLogs(tenantId, {
        errorCode: errorCode as string | undefined,
        resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      res.status(200).json({
        success: true,
        data: logs,
        pagination: { limit, offset },
      });
    } catch (error) {
      logger.error('Failed to get error logs', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/help/errors/stats
   * Gets error statistics
   */
  app.get('/api/v1/help/errors/stats', authenticate, async (req: Request, res: Response) => {
    try {
      const { periodDays = 30 } = req.query;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const stats = await errorService.getErrorStats(tenantId, parseInt(periodDays as string));
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      logger.error('Failed to get error statistics', error);
      throw error;
    }
  });

  // ==================== SUPPORT TICKET ENDPOINTS ====================

  /**
   * POST /api/v1/support/tickets
   * Creates support ticket
   */
  app.post('/api/v1/support/tickets', authenticate, async (req: Request, res: Response) => {
    try {
      const { subject, description, priority, category, attachments } = req.body;
      const tenantId = req.auth?.tenantId;
      const userId = req.auth?.userId;

      if (!tenantId || !userId) throw new AppError('User context required', 401);
      if (!subject || !description || !category) {
        throw new AppError('subject, description, and category required', 400);
      }

      const ticket = await ticketService.createTicket(tenantId, userId, {
        subject,
        description,
        priority: priority || 'medium',
        category,
        attachments: attachments || [],
      });

      void notifyRequester(ticketService, ticket.id, 'created');
      res.status(201).json({ success: true, data: { ...ticket, reference: SupportTicketService.reference(ticket.id) } });
    } catch (error) {
      logger.error('Failed to create support ticket', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/support/tickets/:ticketId
   * Gets support ticket
   */
  app.get('/api/v1/support/tickets/:ticketId', authenticate, async (req: Request, res: Response) => {
    try {
      const { ticketId } = req.params;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const ticket = await ticketService.getTicket(ticketId, tenantId);
      res.status(200).json({ success: true, data: ticket });
    } catch (error) {
      logger.error('Failed to get support ticket', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/support/tickets
   * Gets support tickets with filtering
   */
  app.get('/api/v1/support/tickets', authenticate, async (req: Request, res: Response) => {
    try {
      const { status, priority, category, limit = 50, offset = 0 } = req.query;
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const tickets = await ticketService.getTickets(tenantId, {
        status: status as string | undefined,
        priority: priority as string | undefined,
        category: category as string | undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      res.status(200).json({
        success: true,
        data: tickets,
        pagination: { limit, offset },
      });
    } catch (error) {
      logger.error('Failed to get support tickets', error);
      throw error;
    }
  });

  /**
   * PATCH /api/v1/support/tickets/:ticketId/status
   * Updates ticket status
   */
  app.patch('/api/v1/support/tickets/:ticketId/status', authenticate, async (req: Request, res: Response) => {
    try {
      const { ticketId } = req.params;
      const { status, resolution } = req.body;

      if (!status) throw new AppError('status required', 400);

      const updated = await ticketService.updateTicketStatus(ticketId, status, resolution);
      void notifyRequester(ticketService, ticketId, 'status', { status });
      res.status(200).json({ success: true, data: updated });
    } catch (error) {
      logger.error('Failed to update ticket status', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/support/tickets/:ticketId/responses
   * Adds response to ticket
   */
  app.post('/api/v1/support/tickets/:ticketId/responses', authenticate, async (req: Request, res: Response) => {
    try {
      const { ticketId } = req.params;
      const { message, attachments, isPublic = true } = req.body;
      const responderId = req.auth?.userId;

      if (!responderId) throw new AppError('User context required', 401);
      if (!message) throw new AppError('message required', 400);

      const response = await ticketService.addResponse(
        ticketId,
        responderId,
        message,
        attachments || [],
        isPublic
      );

      // Notify the requester of a public reply (not internal notes).
      if (isPublic) void notifyRequester(ticketService, ticketId, 'replied', { message });
      res.status(201).json({ success: true, data: response });
    } catch (error) {
      logger.error('Failed to add response', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/support/tickets/:ticketId/responses
   * Gets ticket responses
   */
  app.get('/api/v1/support/tickets/:ticketId/responses', authenticate, async (req: Request, res: Response) => {
    try {
      const { ticketId } = req.params;
      const responses = await ticketService.getResponses(ticketId);
      res.status(200).json({ success: true, data: responses });
    } catch (error) {
      logger.error('Failed to get responses', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/support/stats
   * Gets support statistics
   */
  app.get('/api/v1/support/stats', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.auth?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);

      const stats = await ticketService.getStatistics(tenantId);
      res.status(200).json({ success: true, data: stats });
    } catch (error) {
      logger.error('Failed to get support statistics', error);
      throw error;
    }
  });

  logger.info('Phase 21 Help & Support routes registered (18 endpoints)');
}
