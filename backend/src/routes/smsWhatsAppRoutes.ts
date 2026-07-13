import express, { Router, Request, Response } from 'express';
import { authenticate, authorize } from '@middleware/authMiddleware';
import { logger } from '@utils/logger';
import smsWhatsAppProviderService from '@services/smsWhatsAppProviderService';
import smsWhatsAppService from '@services/smsWhatsAppService';
import smsWhatsAppTemplateService from '@services/smsWhatsAppTemplateService';
import smsWhatsAppSchedulingService from '@services/smsWhatsAppSchedulingService';
import phoneNumberService from '@services/phoneNumberService';

const router: Router = express.Router();

// ==================== PROVIDERS ====================

/**
 * Create SMS/WhatsApp provider
 * POST /api/v1/sms-whatsapp/providers
 */
router.post('/providers', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user.tenant_id;
    const provider = await smsWhatsAppProviderService.createProvider(
      tenantId,
      req.body,
      req.user.id
    );

    res.status(201).json({
      success: true,
      data: provider,
    });
  } catch (error) {
    logger.error(`Error creating provider: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Get all providers
 * GET /api/v1/sms-whatsapp/providers
 */
router.get('/providers', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.user.tenant_id;
    const providers = await smsWhatsAppProviderService.getProvidersByTenant(tenantId);

    res.json({
      success: true,
      data: providers,
      total: providers.length,
    });
  } catch (error) {
    logger.error(`Error fetching providers: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Get provider by ID
 * GET /api/v1/sms-whatsapp/providers/:providerId
 */
router.get('/providers/:providerId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const provider = await smsWhatsAppProviderService.getProviderById(req.params.providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider not found',
      });
    }

    res.json({
      success: true,
      data: provider,
    });
  } catch (error) {
    logger.error(`Error fetching provider: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Update provider
 * PATCH /api/v1/sms-whatsapp/providers/:providerId
 */
router.patch('/providers/:providerId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const provider = await smsWhatsAppProviderService.updateProvider(
      req.params.providerId,
      req.body,
      req.user.id
    );

    res.json({
      success: true,
      data: provider,
    });
  } catch (error) {
    logger.error(`Error updating provider: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Toggle provider status
 * PATCH /api/v1/sms-whatsapp/providers/:providerId/toggle
 */
router.patch('/providers/:providerId/toggle', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const provider = await smsWhatsAppProviderService.toggleProviderStatus(
      req.params.providerId,
      req.body.enabled
    );

    res.json({
      success: true,
      data: provider,
    });
  } catch (error) {
    logger.error(`Error toggling provider: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Set primary provider
 * PUT /api/v1/sms-whatsapp/providers/:providerId/set-primary
 */
router.put('/providers/:providerId/set-primary', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const provider = await smsWhatsAppProviderService.setPrimaryProvider(
      req.user.tenant_id,
      req.params.providerId
    );

    res.json({
      success: true,
      data: provider,
    });
  } catch (error) {
    logger.error(`Error setting primary provider: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Test provider connection
 * POST /api/v1/sms-whatsapp/providers/:providerId/test
 */
router.post('/providers/:providerId/test', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const status = await smsWhatsAppProviderService.testProviderConnection(req.params.providerId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error(`Error testing provider: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Delete provider
 * DELETE /api/v1/sms-whatsapp/providers/:providerId
 */
router.delete('/providers/:providerId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    await smsWhatsAppProviderService.deleteProvider(req.params.providerId);

    res.json({
      success: true,
      message: 'Provider deleted successfully',
    });
  } catch (error) {
    logger.error(`Error deleting provider: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

// ==================== TEMPLATES ====================

/**
 * Create message template
 * POST /api/v1/sms-whatsapp/templates
 */
router.post('/templates', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const template = await smsWhatsAppTemplateService.createTemplate(
      req.user.tenant_id,
      req.body,
      req.user.id
    );

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error(`Error creating template: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Get templates
 * GET /api/v1/sms-whatsapp/templates
 */
router.get('/templates', authenticate, async (req: Request, res: Response) => {
  try {
    const { type, channel, active } = req.query;
    let templates;

    if (type) {
      templates = await smsWhatsAppTemplateService.getTemplatesByType(
        req.user.tenant_id,
        String(type) as any,
        channel as string
      );
    } else {
      templates = await smsWhatsAppTemplateService.getTemplatesByTenant(
        req.user.tenant_id,
        channel as string,
        active === 'true'
      );
    }

    res.json({
      success: true,
      data: templates,
      total: templates.length,
    });
  } catch (error) {
    logger.error(`Error fetching templates: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Get template by ID
 * GET /api/v1/sms-whatsapp/templates/:templateId
 */
router.get('/templates/:templateId', authenticate, async (req: Request, res: Response) => {
  try {
    const template = await smsWhatsAppTemplateService.getTemplateById(req.params.templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error(`Error fetching template: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Update template
 * PATCH /api/v1/sms-whatsapp/templates/:templateId
 */
router.patch('/templates/:templateId', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const template = await smsWhatsAppTemplateService.updateTemplate(
      req.params.templateId,
      req.body
    );

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error(`Error updating template: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Get template statistics
 * GET /api/v1/sms-whatsapp/templates/:templateId/stats
 */
router.get('/templates/:templateId/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const stats = await smsWhatsAppTemplateService.getTemplateStats(req.params.templateId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error(`Error fetching template stats: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

// ==================== MESSAGES ====================

/**
 * Send message
 * POST /api/v1/sms-whatsapp/messages/send
 */
router.post('/messages/send', authenticate, async (req: Request, res: Response) => {
  try {
    const response = await smsWhatsAppService.sendMessage(
      req.user.tenant_id,
      req.body,
      req.user.id
    );

    res.status(201).json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error(`Error sending message: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Bulk send messages
 * POST /api/v1/sms-whatsapp/messages/bulk-send
 */
router.post('/messages/bulk-send', authenticate, async (req: Request, res: Response) => {
  try {
    const responses = await smsWhatsAppService.bulkSendMessages(
      req.user.tenant_id,
      req.body,
      req.user.id
    );

    res.status(201).json({
      success: true,
      data: responses,
      total: responses.length,
    });
  } catch (error) {
    logger.error(`Error bulk sending: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Get messages
 * GET /api/v1/sms-whatsapp/messages
 */
router.get('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, channel, recipient_id, limit, offset } = req.query;
    const result = await smsWhatsAppService.getMessages(req.user.tenant_id, {
      status: status as any,
      channel: channel as any,
      recipient_id: recipient_id as string,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({
      success: true,
      data: result.messages,
      total: result.total,
    });
  } catch (error) {
    logger.error(`Error fetching messages: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Get message status
 * GET /api/v1/sms-whatsapp/messages/:messageId
 */
router.get('/messages/:messageId', authenticate, async (req: Request, res: Response) => {
  try {
    const status = await smsWhatsAppService.getMessageStatus(req.params.messageId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    logger.error(`Error fetching message status: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Retry message
 * POST /api/v1/sms-whatsapp/messages/:messageId/retry
 */
router.post('/messages/:messageId/retry', authenticate, async (req: Request, res: Response) => {
  try {
    const response = await smsWhatsAppService.retryMessage(req.params.messageId);

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error(`Error retrying message: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

// ==================== PHONE NUMBERS ====================

/**
 * Add phone number
 * POST /api/v1/sms-whatsapp/phone-numbers
 */
router.post('/phone-numbers', authenticate, async (req: Request, res: Response) => {
  try {
    const phoneNumber = await phoneNumberService.addPhoneNumber(
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    res.status(201).json({
      success: true,
      data: phoneNumber,
    });
  } catch (error) {
    logger.error(`Error adding phone number: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Get my phone numbers
 * GET /api/v1/sms-whatsapp/phone-numbers
 */
router.get('/phone-numbers', authenticate, async (req: Request, res: Response) => {
  try {
    const phoneNumbers = await phoneNumberService.getUserPhoneNumbers(
      req.user.tenant_id,
      req.user.id
    );

    res.json({
      success: true,
      data: phoneNumbers,
      total: phoneNumbers.length,
    });
  } catch (error) {
    logger.error(`Error fetching phone numbers: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Verify phone number
 * POST /api/v1/sms-whatsapp/phone-numbers/:phoneId/verify
 */
router.post('/phone-numbers/:phoneId/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const phoneNumber = await phoneNumberService.verifyPhoneNumber({
      phone_id: req.params.phoneId,
      verification_code: req.body.verification_code,
    });

    res.json({
      success: true,
      data: phoneNumber,
    });
  } catch (error) {
    logger.error(`Error verifying phone number: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Resend verification code
 * POST /api/v1/sms-whatsapp/phone-numbers/:phoneId/resend-code
 */
router.post('/phone-numbers/:phoneId/resend-code', authenticate, async (req: Request, res: Response) => {
  try {
    await phoneNumberService.resendVerificationCode(req.params.phoneId);

    res.json({
      success: true,
      message: 'Verification code sent',
    });
  } catch (error) {
    logger.error(`Error resending code: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Delete phone number
 * DELETE /api/v1/sms-whatsapp/phone-numbers/:phoneId
 */
router.delete('/phone-numbers/:phoneId', authenticate, async (req: Request, res: Response) => {
  try {
    await phoneNumberService.deletePhoneNumber(req.params.phoneId);

    res.json({
      success: true,
      message: 'Phone number deleted',
    });
  } catch (error) {
    logger.error(`Error deleting phone number: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

// ==================== SCHEDULING ====================

/**
 * Create scheduled message
 * POST /api/v1/sms-whatsapp/schedules
 */
router.post('/schedules', authenticate, async (req: Request, res: Response) => {
  try {
    const schedule = await smsWhatsAppSchedulingService.createSchedule(
      req.user.tenant_id,
      req.body,
      req.user.id
    );

    res.status(201).json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    logger.error(`Error creating schedule: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Get my schedules
 * GET /api/v1/sms-whatsapp/schedules
 */
router.get('/schedules', authenticate, async (req: Request, res: Response) => {
  try {
    const schedules = await smsWhatsAppSchedulingService.getUserSchedules(
      req.user.tenant_id,
      req.user.id
    );

    res.json({
      success: true,
      data: schedules,
      total: schedules.length,
    });
  } catch (error) {
    logger.error(`Error fetching schedules: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Get analytics
 * GET /api/v1/sms-whatsapp/analytics
 */
router.get('/analytics', authenticate, authorize('admin', 'principal'), async (req: Request, res: Response) => {
  try {
    const { channel, date_from, date_to } = req.query;
    const analytics = await smsWhatsAppSchedulingService.getAnalytics(
      req.user.tenant_id,
      {
        channel: channel as any,
        date_from: date_from ? new Date(date_from as string) : undefined,
        date_to: date_to ? new Date(date_to as string) : undefined,
      }
    );

    res.json({
      success: true,
      data: analytics,
      total: analytics.length,
    });
  } catch (error) {
    logger.error(`Error fetching analytics: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

export default router;
