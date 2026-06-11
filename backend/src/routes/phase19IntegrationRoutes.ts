import type { Express, Request, Response } from 'express';
import type { Knex } from 'knex';
import { authenticate } from '@middleware/authMiddleware';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import EmailService from '@services/phase19EmailService';
import SMSService from '@services/phase19SMSService';
import PaymentGatewayService from '@services/phase19PaymentGatewayService';
import IntegrationLoggingService from '@services/phase19IntegrationLoggingService';

/**
 * Phase 19: Integration with External Systems Routes
 * 
 * API endpoints for:
 * - Email service integration
 * - SMS service integration
 * - Payment gateway integration
 * - Integration logging and monitoring
 */

export default function registerPhase19Routes(
  app: Express,
  db: Knex
): void {
  const emailService = new EmailService(db);
  const smsService = new SMSService(db);
  const paymentService = new PaymentGatewayService(db);
  const loggingService = new IntegrationLoggingService(db);

  // ==================== EMAIL ENDPOINTS ====================

  /**
   * POST /api/v1/integrations/email/config
   * Sets email service configuration
   */
  app.post('/api/v1/integrations/email/config', authenticate, async (req: Request, res: Response) => {
    try {
      const { provider, from, smtpHost, smtpPort, smtpUser, smtpPassword, sendgridApiKey, mailgunApiKey, mailgunDomain, isActive } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!provider || !from) throw new AppError('Provider and from address required', 400);

      const config = await emailService.setEmailConfig(tenantId, {
        provider,
        from,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPassword,
        sendgridApiKey,
        mailgunApiKey,
        mailgunDomain,
        isActive,
      });

      await loggingService.logIntegrationActivity(
        tenantId,
        'email',
        'config_updated',
        'success',
        10,
        { metadata: { provider } }
      );

      res.status(201).json({ success: true, data: config });
    } catch (error) {
      logger.error('Failed to set email config', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/email/config
   * Gets email service configuration
   */
  app.get('/api/v1/integrations/email/config', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) throw new AppError('User context required', 401);

      const config = await emailService.getEmailConfig(tenantId);
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      logger.error('Failed to get email config', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/integrations/email/templates
   * Creates or updates email template
   */
  app.post('/api/v1/integrations/email/templates', authenticate, async (req: Request, res: Response) => {
    try {
      const { name, subject, htmlContent, textContent, category, isActive } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!name || !subject || !htmlContent || !category) {
        throw new AppError('Name, subject, htmlContent, and category required', 400);
      }

      const template = await emailService.createEmailTemplate(tenantId, {
        name,
        subject,
        htmlContent,
        textContent,
        category,
        isActive: isActive ?? true,
      });

      await loggingService.logIntegrationActivity(
        tenantId,
        'email',
        'template_created',
        'success',
        15,
        { metadata: { templateName: name } }
      );

      res.status(201).json({ success: true, data: template });
    } catch (error) {
      logger.error('Failed to create email template', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/email/templates
   * Gets email templates
   */
  app.get('/api/v1/integrations/email/templates', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { category } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);

      const templates = await emailService.getEmailTemplates(tenantId, category as string | undefined);
      res.status(200).json({ success: true, data: templates });
    } catch (error) {
      logger.error('Failed to get email templates', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/integrations/email/send
   * Sends email
   */
  app.post('/api/v1/integrations/email/send', authenticate, async (req: Request, res: Response) => {
    try {
      const { to, subject, htmlContent, textContent, cc, bcc, templateId, templateVariables } = req.body;
      const tenantId = req.user?.tenantId;
      const startTime = Date.now();

      if (!tenantId) throw new AppError('User context required', 401);
      if (!to || (!htmlContent && !templateId)) {
        throw new AppError('To address and either htmlContent or templateId required', 400);
      }

      const message = templateId
        ? await emailService.sendEmailFromTemplate(tenantId, templateId, to, templateVariables || {}, { cc, bcc })
        : await emailService.sendEmail(tenantId, to, subject, htmlContent, textContent, { cc, bcc });

      const responseTime = Date.now() - startTime;
      await loggingService.logIntegrationActivity(
        tenantId,
        'email',
        'send',
        'success',
        responseTime,
        { endpoint: '/send', statusCode: 200 }
      );

      res.status(200).json({ success: true, data: message });
    } catch (error) {
      logger.error('Failed to send email', error);
      await loggingService.logIntegrationActivity(
        req.user?.tenantId || 'unknown',
        'email',
        'send',
        'failure',
        0,
        { errorMessage: (error as Error).message }
      );
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/email/history
   * Gets email message history
   */
  app.get('/api/v1/integrations/email/history', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { limit = 100, offset = 0 } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);

      const messages = await emailService.getEmailHistory(tenantId, parseInt(limit as string), parseInt(offset as string));
      res.status(200).json({ success: true, data: messages, pagination: { limit, offset } });
    } catch (error) {
      logger.error('Failed to get email history', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/integrations/email/retry
   * Retries failed emails
   */
  app.post('/api/v1/integrations/email/retry', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) throw new AppError('User context required', 401);

      const retriedCount = await emailService.retryFailedEmails(tenantId);
      res.status(200).json({ success: true, data: { retriedCount } });
    } catch (error) {
      logger.error('Failed to retry emails', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/email/health
   * Gets email service health
   */
  app.get('/api/v1/integrations/email/health', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) throw new AppError('User context required', 401);

      const health = await emailService.getEmailServiceHealth(tenantId);
      res.status(200).json({ success: true, data: health });
    } catch (error) {
      logger.error('Failed to get email health', error);
      throw error;
    }
  });

  // ==================== SMS ENDPOINTS ====================

  /**
   * POST /api/v1/integrations/sms/config
   * Sets SMS service configuration
   */
  app.post('/api/v1/integrations/sms/config', authenticate, async (req: Request, res: Response) => {
    try {
      const { provider, fromNumber, accountSid, authToken, awsAccessKeyId, awsSecretAccessKey, awsRegion, nexmoApiKey, nexmoApiSecret, isActive } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!provider || !fromNumber) throw new AppError('Provider and from number required', 400);

      const config = await smsService.setSMSConfig(tenantId, {
        provider,
        fromNumber,
        accountSid,
        authToken,
        awsAccessKeyId,
        awsSecretAccessKey,
        awsRegion,
        nexmoApiKey,
        nexmoApiSecret,
        isActive,
      });

      await loggingService.logIntegrationActivity(
        tenantId,
        'sms',
        'config_updated',
        'success',
        10,
        { metadata: { provider } }
      );

      res.status(201).json({ success: true, data: config });
    } catch (error) {
      logger.error('Failed to set SMS config', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/sms/config
   * Gets SMS service configuration
   */
  app.get('/api/v1/integrations/sms/config', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) throw new AppError('User context required', 401);

      const config = await smsService.getSMSConfig(tenantId);
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      logger.error('Failed to get SMS config', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/integrations/sms/templates
   * Creates or updates SMS template
   */
  app.post('/api/v1/integrations/sms/templates', authenticate, async (req: Request, res: Response) => {
    try {
      const { name, message, category, characterLimit = 160, isActive } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!name || !message || !category) {
        throw new AppError('Name, message, and category required', 400);
      }

      const template = await smsService.createSMSTemplate(tenantId, {
        name,
        message,
        category,
        characterLimit,
        isActive: isActive ?? true,
      });

      await loggingService.logIntegrationActivity(
        tenantId,
        'sms',
        'template_created',
        'success',
        15,
        { metadata: { templateName: name } }
      );

      res.status(201).json({ success: true, data: template });
    } catch (error) {
      logger.error('Failed to create SMS template', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/sms/templates
   * Gets SMS templates
   */
  app.get('/api/v1/integrations/sms/templates', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { category } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);

      const templates = await smsService.getSMSTemplates(tenantId, category as string | undefined);
      res.status(200).json({ success: true, data: templates });
    } catch (error) {
      logger.error('Failed to get SMS templates', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/integrations/sms/send
   * Sends SMS
   */
  app.post('/api/v1/integrations/sms/send', authenticate, async (req: Request, res: Response) => {
    try {
      const { phoneNumber, message, templateId, templateVariables } = req.body;
      const tenantId = req.user?.tenantId;
      const startTime = Date.now();

      if (!tenantId) throw new AppError('User context required', 401);
      if (!phoneNumber || (!message && !templateId)) {
        throw new AppError('Phone number and either message or templateId required', 400);
      }

      const sms = templateId
        ? await smsService.sendSMSFromTemplate(tenantId, templateId, phoneNumber, templateVariables || {})
        : await smsService.sendSMS(tenantId, phoneNumber, message);

      const responseTime = Date.now() - startTime;
      await loggingService.logIntegrationActivity(
        tenantId,
        'sms',
        'send',
        'success',
        responseTime,
        { endpoint: '/send', statusCode: 200 }
      );

      res.status(200).json({ success: true, data: sms });
    } catch (error) {
      logger.error('Failed to send SMS', error);
      await loggingService.logIntegrationActivity(
        req.user?.tenantId || 'unknown',
        'sms',
        'send',
        'failure',
        0,
        { errorMessage: (error as Error).message }
      );
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/sms/history
   * Gets SMS message history
   */
  app.get('/api/v1/integrations/sms/history', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { limit = 100, offset = 0 } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);

      const messages = await smsService.getSMSHistory(tenantId, parseInt(limit as string), parseInt(offset as string));
      res.status(200).json({ success: true, data: messages, pagination: { limit, offset } });
    } catch (error) {
      logger.error('Failed to get SMS history', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/integrations/sms/retry
   * Retries failed SMS
   */
  app.post('/api/v1/integrations/sms/retry', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) throw new AppError('User context required', 401);

      const retriedCount = await smsService.retryFailedSMS(tenantId);
      res.status(200).json({ success: true, data: { retriedCount } });
    } catch (error) {
      logger.error('Failed to retry SMS', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/sms/health
   * Gets SMS service health
   */
  app.get('/api/v1/integrations/sms/health', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) throw new AppError('User context required', 401);

      const health = await smsService.getSMSServiceHealth(tenantId);
      res.status(200).json({ success: true, data: health });
    } catch (error) {
      logger.error('Failed to get SMS health', error);
      throw error;
    }
  });

  // ==================== PAYMENT ENDPOINTS ====================

  /**
   * POST /api/v1/integrations/payment/config
   * Sets payment gateway configuration
   */
  app.post('/api/v1/integrations/payment/config', authenticate, async (req: Request, res: Response) => {
    try {
      const { provider, publicKey, secretKey, webhookSecret, currency, testMode, isActive } = req.body;
      const tenantId = req.user?.tenantId;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!provider || !publicKey || !secretKey) {
        throw new AppError('Provider, publicKey, and secretKey required', 400);
      }

      const config = await paymentService.setPaymentGatewayConfig(tenantId, {
        provider,
        publicKey,
        secretKey,
        webhookSecret,
        currency: currency || 'USD',
        testMode: testMode ?? true,
        isActive: isActive ?? false,
      });

      await loggingService.logIntegrationActivity(
        tenantId,
        'payment_gateway',
        'config_updated',
        'success',
        10,
        { metadata: { provider, testMode } }
      );

      res.status(201).json({ success: true, data: config });
    } catch (error) {
      logger.error('Failed to set payment config', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/payment/config
   * Gets payment gateway configuration
   */
  app.get('/api/v1/integrations/payment/config', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) throw new AppError('User context required', 401);

      const config = await paymentService.getPaymentGatewayConfig(tenantId);
      res.status(200).json({ success: true, data: config });
    } catch (error) {
      logger.error('Failed to get payment config', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/integrations/payment/initiate
   * Initiates payment
   */
  app.post('/api/v1/integrations/payment/initiate', authenticate, async (req: Request, res: Response) => {
    try {
      const { studentId, feeId, amount, description } = req.body;
      const tenantId = req.user?.tenantId;
      const startTime = Date.now();

      if (!tenantId) throw new AppError('User context required', 401);
      if (!studentId || !feeId || !amount || !description) {
        throw new AppError('studentId, feeId, amount, and description required', 400);
      }

      const transaction = await paymentService.initiatePayment(
        tenantId,
        studentId,
        feeId,
        amount,
        description
      );

      const responseTime = Date.now() - startTime;
      await loggingService.logIntegrationActivity(
        tenantId,
        'payment_gateway',
        'initiate',
        'success',
        responseTime,
        { metadata: { studentId, amount } }
      );

      res.status(201).json({ success: true, data: transaction });
    } catch (error) {
      logger.error('Failed to initiate payment', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/integrations/payment/verify
   * Verifies payment
   */
  app.post('/api/v1/integrations/payment/verify', authenticate, async (req: Request, res: Response) => {
    try {
      const { transactionId, externalTransactionId, paymentData } = req.body;
      const tenantId = req.user?.tenantId;
      const startTime = Date.now();

      if (!tenantId) throw new AppError('User context required', 401);
      if (!transactionId || !externalTransactionId || !paymentData) {
        throw new AppError('transactionId, externalTransactionId, and paymentData required', 400);
      }

      const transaction = await paymentService.verifyPayment(
        tenantId,
        transactionId,
        externalTransactionId,
        paymentData
      );

      const responseTime = Date.now() - startTime;
      await loggingService.logIntegrationActivity(
        tenantId,
        'payment_gateway',
        'verify',
        'success',
        responseTime,
        { statusCode: 200 }
      );

      res.status(200).json({ success: true, data: transaction });
    } catch (error) {
      logger.error('Failed to verify payment', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/integrations/payment/refund
   * Processes refund
   */
  app.post('/api/v1/integrations/payment/refund', authenticate, async (req: Request, res: Response) => {
    try {
      const { transactionId, amount, reason } = req.body;
      const tenantId = req.user?.tenantId;
      const startTime = Date.now();

      if (!tenantId) throw new AppError('User context required', 401);
      if (!transactionId || !reason) {
        throw new AppError('transactionId and reason required', 400);
      }

      const refund = await paymentService.processRefund(tenantId, transactionId, amount, reason);

      const responseTime = Date.now() - startTime;
      await loggingService.logIntegrationActivity(
        tenantId,
        'payment_gateway',
        'refund',
        'success',
        responseTime,
        { metadata: { amount, reason } }
      );

      res.status(200).json({ success: true, data: refund });
    } catch (error) {
      logger.error('Failed to process refund', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/integrations/payment/webhook
   * Handles payment webhook
   */
  app.post('/api/v1/integrations/payment/webhook', async (req: Request, res: Response) => {
    try {
      const { tenantId, signature, payload } = req.body;

      if (!tenantId || !signature || !payload) {
        throw new AppError('tenantId, signature, and payload required', 400);
      }

      await paymentService.handleWebhook(tenantId, signature, payload);
      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Failed to handle payment webhook', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/payment/history
   * Gets payment transaction history
   */
  app.get('/api/v1/integrations/payment/history', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { studentId, limit = 100, offset = 0 } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);

      const transactions = await paymentService.getPaymentHistory(
        tenantId,
        studentId as string | undefined,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.status(200).json({ success: true, data: transactions, pagination: { limit, offset } });
    } catch (error) {
      logger.error('Failed to get payment history', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/payment/refunds
   * Gets refund history
   */
  app.get('/api/v1/integrations/payment/refunds', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { transactionId } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);

      const refunds = await paymentService.getRefundHistory(tenantId, transactionId as string | undefined);
      res.status(200).json({ success: true, data: refunds });
    } catch (error) {
      logger.error('Failed to get refund history', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/payment/health
   * Gets payment gateway health
   */
  app.get('/api/v1/integrations/payment/health', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) throw new AppError('User context required', 401);

      const health = await paymentService.getPaymentGatewayHealth(tenantId);
      res.status(200).json({ success: true, data: health });
    } catch (error) {
      logger.error('Failed to get payment health', error);
      throw error;
    }
  });

  // ==================== MONITORING ENDPOINTS ====================

  /**
   * GET /api/v1/integrations/health
   * Gets overall integration health
   */
  app.get('/api/v1/integrations/health', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) throw new AppError('User context required', 401);

      const health = await loggingService.getIntegrationHealthDashboard(tenantId);
      res.status(200).json({ success: true, data: health });
    } catch (error) {
      logger.error('Failed to get integration health', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/logs
   * Gets integration logs
   */
  app.get('/api/v1/integrations/logs', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { integrationName, eventType, status, startDate, endDate, limit = 100, offset = 0 } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);

      const logs = await loggingService.getIntegrationLogs(tenantId, {
        integrationName: integrationName as string | undefined,
        eventType: eventType as string | undefined,
        status: status as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      res.status(200).json({ success: true, data: logs, pagination: { limit, offset } });
    } catch (error) {
      logger.error('Failed to get integration logs', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/metrics
   * Gets integration metrics
   */
  app.get('/api/v1/integrations/metrics', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { integrationName, periodDays = 30 } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);
      if (!integrationName) throw new AppError('integrationName required', 400);

      const metrics = await loggingService.getIntegrationMetrics(
        tenantId,
        integrationName as string,
        parseInt(periodDays as string)
      );

      res.status(200).json({ success: true, data: metrics });
    } catch (error) {
      logger.error('Failed to get integration metrics', error);
      throw error;
    }
  });

  /**
   * GET /api/v1/integrations/alerts
   * Gets integration alerts
   */
  app.get('/api/v1/integrations/alerts', authenticate, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user?.tenantId;
      const { integrationName, resolved } = req.query;

      if (!tenantId) throw new AppError('User context required', 401);

      const resolvedFilter = resolved === 'true' ? true : resolved === 'false' ? false : undefined;
      const alerts = await loggingService.getIntegrationAlerts(
        tenantId,
        integrationName as string | undefined,
        resolvedFilter
      );

      res.status(200).json({ success: true, data: alerts });
    } catch (error) {
      logger.error('Failed to get integration alerts', error);
      throw error;
    }
  });

  /**
   * POST /api/v1/integrations/alerts/:alertId/resolve
   * Resolves integration alert
   */
  app.post('/api/v1/integrations/alerts/:alertId/resolve', authenticate, async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;

      const alert = await loggingService.resolveIntegrationAlert(alertId);
      res.status(200).json({ success: true, data: alert });
    } catch (error) {
      logger.error('Failed to resolve alert', error);
      throw error;
    }
  });

  logger.info('Phase 19 Integration routes registered (28 endpoints)');
}
