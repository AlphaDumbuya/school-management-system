import express, { Router, Request, Response } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { SubscriptionService } from '@services/subscriptionService';
import { logger } from '@utils/logger';
import { UserRole } from '../types/auth';
import smsWhatsAppProviderService from '@services/smsWhatsAppProviderService';
import smsWhatsAppService from '@services/smsWhatsAppService';
import smsWhatsAppTemplateService from '@services/smsWhatsAppTemplateService';
import smsWhatsAppSchedulingService from '@services/smsWhatsAppSchedulingService';
import phoneNumberService from '@services/phoneNumberService';
import messagingSettingsService from '@services/messagingSettingsService';
import { db } from '@utils/database';

const router: Router = express.Router();

// Apply auth + user context to all routes in this router
router.use(authenticate);
router.use(attachUserContext);

// ==================== PROVIDERS ====================

/**
 * Create SMS/WhatsApp provider
 * POST /api/v1/sms-whatsapp/providers
 */
router.post('/providers', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const tenantId = user.tenant_id;
    const provider = await smsWhatsAppProviderService.createProvider(
      tenantId,
      req.body,
      user.id
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
router.get('/providers', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const tenantId = user.tenant_id;
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
router.get('/providers/:providerId', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const tenantId = user.tenant_id;
    const provider = await smsWhatsAppProviderService.getProviderById(req.params.providerId);
    if (!provider || provider.tenant_id !== tenantId) {
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
router.patch('/providers/:providerId', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const tenantId = user.tenant_id;
    
    const check = await db('sms_whatsapp_providers').where({ provider_id: req.params.providerId, tenant_id: tenantId }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    const provider = await smsWhatsAppProviderService.updateProvider(
      req.params.providerId,
      req.body,
      user.id
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
router.patch('/providers/:providerId/toggle', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const tenantId = user.tenant_id;

    const check = await db('sms_whatsapp_providers').where({ provider_id: req.params.providerId, tenant_id: tenantId }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

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
router.put('/providers/:providerId/set-primary', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const tenantId = user.tenant_id;

    const check = await db('sms_whatsapp_providers').where({ provider_id: req.params.providerId, tenant_id: tenantId }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    const provider = await smsWhatsAppProviderService.setPrimaryProvider(
      user.tenant_id,
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
router.post('/providers/:providerId/test', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const tenantId = user.tenant_id;

    const check = await db('sms_whatsapp_providers').where({ provider_id: req.params.providerId, tenant_id: tenantId }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

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
router.delete('/providers/:providerId', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const tenantId = user.tenant_id;

    const check = await db('sms_whatsapp_providers').where({ provider_id: req.params.providerId, tenant_id: tenantId }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

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
router.post('/templates', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const template = await smsWhatsAppTemplateService.createTemplate(
      user.tenant_id,
      req.body,
      user.id
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
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { type, channel, active } = req.query;
    let templates;

    if (type) {
      templates = await smsWhatsAppTemplateService.getTemplatesByType(
        user.tenant_id,
        String(type) as any,
        channel as string
      );
    } else {
      templates = await smsWhatsAppTemplateService.getTemplatesByTenant(
        user.tenant_id,
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
router.get('/templates/:templateId', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const template = await smsWhatsAppTemplateService.getTemplateById(req.params.templateId);
    if (!template || template.tenant_id !== user.tenant_id) {
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
router.patch('/templates/:templateId', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const check = await db('sms_whatsapp_templates').where({ template_id: req.params.templateId, tenant_id: user.tenant_id }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

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
router.get('/templates/:templateId/stats', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const check = await db('sms_whatsapp_templates').where({ template_id: req.params.templateId, tenant_id: user.tenant_id }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }

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
 * Search recipients eligible for messaging (have a verified, enabled phone
 * number for the given channel). Deliberately scoped to the same roles that
 * can send messages (unlike the broader /api/v1/users list, which excludes
 * TEACHER) and returns only the minimal fields needed to pick a recipient.
 * GET /api/v1/sms-whatsapp/recipients/search?q=&channel=sms|whatsapp
 */
router.get('/recipients/search', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const channel = (req.query.channel as string) === 'whatsapp' ? 'whatsapp' : 'sms';
    const q = ((req.query.q as string) || '').trim();
    const enabledColumn = channel === 'whatsapp' ? 'whatsapp_enabled' : 'sms_enabled';

    let query = db('users')
      .join('phone_numbers', 'phone_numbers.user_id', 'users.id')
      .where('users.tenant_id', user.tenant_id)
      .andWhere('phone_numbers.tenant_id', user.tenant_id)
      .andWhere('phone_numbers.is_primary', true)
      .andWhere('phone_numbers.verified', true)
      .andWhere('phone_numbers.active', true)
      .andWhere(`phone_numbers.${enabledColumn}`, true)
      .andWhere('users.status', 'active');

    if (q) {
      const term = `%${q}%`;
      query = query.andWhere((builder) => {
        builder
          .where('users.first_name', 'ilike', term)
          .orWhere('users.last_name', 'ilike', term)
          .orWhere('users.email', 'ilike', term);
      });
    }

    const rows = await query
      .select(
        'users.id as user_id',
        'users.first_name',
        'users.last_name',
        'users.email',
        'users.role',
        'phone_numbers.phone_number'
      )
      .orderBy('users.first_name', 'asc')
      .limit(15);

    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.user_id,
        name: `${r.first_name} ${r.last_name}`,
        email: r.email,
        role: r.role,
        phone_number: r.phone_number,
      })),
    });
  } catch (error) {
    logger.error(`Error searching messaging recipients: ${error}`);
    res.status(400).json({
      success: false,
      error: String(error),
    });
  }
});

/**
 * Send message
 * POST /api/v1/sms-whatsapp/messages/send
 */
router.post('/messages/send', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { channel, recipient_id, message_content, template_id } = req.body;

    if (!recipient_id || !channel) {
      return res.status(400).json({ success: false, error: 'recipient_id and channel are required' });
    }

    // WhatsApp is a paid-plan feature; SMS is available on all plans. Gate only
    // the WhatsApp channel by plan feature (and block if subscription inactive).
    if (channel === 'whatsapp') {
      const sub = await SubscriptionService.getActiveSubscription(user.tenant_id);
      if (sub.status === 'expired' || sub.status === 'suspended') {
        return res.status(403).json({ success: false, error: `Your subscription has ${sub.status}. Renew to send messages.`, code: 'SUBSCRIPTION_EXPIRED' });
      }
      if (sub.features?.whatsapp !== true) {
        return res.status(403).json({ success: false, error: 'WhatsApp messaging is not included in your plan. Upgrade to enable it.', code: 'PLAN_LIMIT_REACHED' });
      }
    }

    const response = await smsWhatsAppService.sendMessage(
      user.tenant_id,
      req.body,
      user.id
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
router.post('/messages/bulk-send', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { recipient_ids, channel } = req.body;

    if (!recipient_ids || !Array.isArray(recipient_ids) || recipient_ids.length === 0 || !channel) {
      return res.status(400).json({ success: false, error: 'recipient_ids and channel are required' });
    }

    const responses = await smsWhatsAppService.bulkSendMessages(
      user.tenant_id,
      req.body,
      user.id
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
router.get('/messages', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { status, channel, recipient_id, limit, offset } = req.query;
    const result = await smsWhatsAppService.getMessages(user.tenant_id, {
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
router.get('/messages/:messageId', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const check = await db('sms_whatsapp_messages').where({ message_id: req.params.messageId, tenant_id: user.tenant_id }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

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
router.post('/messages/:messageId/retry', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const check = await db('sms_whatsapp_messages').where({ message_id: req.params.messageId, tenant_id: user.tenant_id }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

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
router.post('/phone-numbers', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const phoneNumber = await phoneNumberService.addPhoneNumber(
      user.tenant_id,
      user.id,
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
router.get('/phone-numbers', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const phoneNumbers = await phoneNumberService.getUserPhoneNumbers(
      user.tenant_id,
      user.id
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
router.post('/phone-numbers/:phoneId/verify', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const check = await db('phone_numbers').where({ phone_id: req.params.phoneId, tenant_id: user.tenant_id }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Phone number not found' });
    }

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
router.post('/phone-numbers/:phoneId/resend-code', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const check = await db('phone_numbers').where({ phone_id: req.params.phoneId, tenant_id: user.tenant_id }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Phone number not found' });
    }

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
router.delete('/phone-numbers/:phoneId', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const check = await db('phone_numbers').where({ phone_id: req.params.phoneId, tenant_id: user.tenant_id }).first();
    if (!check) {
      return res.status(404).json({ success: false, error: 'Phone number not found' });
    }

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
router.post('/schedules', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const schedule = await smsWhatsAppSchedulingService.createSchedule(
      user.tenant_id,
      req.body,
      user.id
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
router.get('/schedules', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const schedules = await smsWhatsAppSchedulingService.getUserSchedules(
      user.tenant_id,
      user.id
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
 * Pause a schedule created by the current user.
 * POST /api/v1/sms-whatsapp/schedules/:scheduleId/pause
 */
router.post('/schedules/:scheduleId/pause', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const schedule = await db('message_schedules')
      .where({ schedule_id: req.params.scheduleId, tenant_id: user.tenant_id, created_by: user.id })
      .first();
    if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found' });
    if (schedule.status !== 'active') return res.status(400).json({ success: false, error: 'Only active schedules can be paused' });

    res.json({ success: true, data: await smsWhatsAppSchedulingService.pauseSchedule(schedule.schedule_id) });
  } catch (error) {
    logger.error(`Error pausing schedule: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

/**
 * Resume a schedule created by the current user.
 * POST /api/v1/sms-whatsapp/schedules/:scheduleId/resume
 */
router.post('/schedules/:scheduleId/resume', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const schedule = await db('message_schedules')
      .where({ schedule_id: req.params.scheduleId, tenant_id: user.tenant_id, created_by: user.id })
      .first();
    if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found' });
    if (schedule.status !== 'paused') return res.status(400).json({ success: false, error: 'Only paused schedules can be resumed' });

    res.json({ success: true, data: await smsWhatsAppSchedulingService.resumeSchedule(schedule.schedule_id) });
  } catch (error) {
    logger.error(`Error resuming schedule: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

/**
 * Cancel a schedule created by the current user.
 * DELETE /api/v1/sms-whatsapp/schedules/:scheduleId
 */
router.delete('/schedules/:scheduleId', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL, UserRole.TEACHER), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const schedule = await db('message_schedules')
      .where({ schedule_id: req.params.scheduleId, tenant_id: user.tenant_id, created_by: user.id })
      .first();
    if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found' });
    if (!['active', 'paused'].includes(schedule.status)) return res.status(400).json({ success: false, error: 'Only active or paused schedules can be cancelled' });

    await smsWhatsAppSchedulingService.deleteSchedule(schedule.schedule_id);
    res.json({ success: true, message: 'Schedule cancelled' });
  } catch (error) {
    logger.error(`Error cancelling schedule: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

/**
 * Get analytics
 * GET /api/v1/sms-whatsapp/analytics
 */
router.get('/analytics', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { channel, date_from, date_to } = req.query;
    const analytics = await smsWhatsAppSchedulingService.getAnalytics(
      user.tenant_id,
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

// ==================== OPT-OUTS ====================

/**
 * List opt-outs for tenant
 * GET /api/v1/sms-whatsapp/opt-outs
 */
router.get('/opt-outs', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { channel, user_id, status, limit, offset } = req.query;

    let query = db('sms_whatsapp_opt_outs').where({ tenant_id: user.tenant_id });
    if (channel) query = query.where({ channel: String(channel) });
    if (user_id) query = query.where({ user_id: String(user_id) });
    if (status) query = query.where({ status: String(status) });

    const totalResult = await query.clone().count('* as count').first();
    const total = totalResult ? Number(totalResult.count) : 0;

    const rows = await query.orderBy('created_at', 'desc').limit(limit ? parseInt(limit as string) : 50).offset(offset ? parseInt(offset as string) : 0);

    res.json({ success: true, data: rows, total });
  } catch (error) {
    logger.error(`Error listing opt-outs: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

/**
 * Get my own active opt-outs (any authenticated user) — used by the client
 * to determine whether to show a resubscribe prompt.
 * GET /api/v1/sms-whatsapp/opt-outs/me
 */
router.get('/opt-outs/me', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const optOuts = await phoneNumberService.getUserOptOuts(user.tenant_id, user.id);
    res.json({ success: true, data: optOuts });
  } catch (error) {
    logger.error(`Error fetching my opt-outs: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

/**
 * Admin create opt-out (import/manual)
 * POST /api/v1/sms-whatsapp/opt-outs
 */
router.post('/opt-outs', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const payload = req.body;
    // Expect { user_id, channel, reason?, notes? }
    const opt = await phoneNumberService.createOptOut(user.tenant_id, {
      user_id: payload.user_id,
      channel: payload.channel,
      reason: payload.reason,
      notes: payload.notes,
    }, user.id);

    res.status(201).json({ success: true, data: opt });
  } catch (error) {
    logger.error(`Error creating opt-out: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

/**
 * Admin remove opt-out
 * DELETE /api/v1/sms-whatsapp/opt-outs/:optoutId
 */
router.delete('/opt-outs/:optoutId', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const check = await db('sms_whatsapp_opt_outs').where({ optout_id: req.params.optoutId, tenant_id: user.tenant_id }).first();
    if (!check) return res.status(404).json({ success: false, error: 'Opt-out not found' });

    await phoneNumberService.removeOptOut(req.params.optoutId);

    res.json({ success: true, message: 'Opt-out removed' });
  } catch (error) {
    logger.error(`Error removing opt-out: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

/**
 * Request resubscribe (user) — generates verification codes for active opt-outs
 * and delivers them via SMS/WhatsApp. Codes are never returned in the API response.
 * POST /api/v1/sms-whatsapp/opt-outs/resubscribe/request
 */
router.post('/opt-outs/resubscribe/request', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const codes = await phoneNumberService.requestResubscribe(user.tenant_id, user.id);

    for (const entry of codes) {
      try {
        await smsWhatsAppService.sendVerificationCode(
          user.tenant_id,
          user.id,
          entry.channel as 'sms' | 'whatsapp',
          entry.verification_code
        );
      } catch (sendErr) {
        logger.error(`Failed to deliver resubscribe code for opt-out ${entry.optout_id}: ${sendErr}`);
      }
    }

    res.json({ success: true, message: 'Verification code(s) sent to your registered phone number' });
  } catch (error) {
    logger.error(`Error requesting resubscribe: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

/**
 * Verify resubscribe code (user)
 * POST /api/v1/sms-whatsapp/opt-outs/resubscribe/verify
 */
router.post('/opt-outs/resubscribe/verify', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { verification_code } = req.body;
    if (!verification_code) return res.status(400).json({ success: false, error: 'verification_code is required' });

    await phoneNumberService.verifyResubscribe(user.tenant_id, user.id, String(verification_code), user.id);

    res.json({ success: true, message: 'Resubscribe verified and opt-outs removed' });
  } catch (error) {
    logger.error(`Error verifying resubscribe: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

/**
 * Export opt-outs for tenant (CSV)
 * GET /api/v1/sms-whatsapp/opt-outs/export
 */
router.get('/opt-outs/export', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const rows = await db('sms_whatsapp_opt_outs')
      .where({ tenant_id: user.tenant_id, status: 'active' })
      .orderBy('created_at', 'desc');

    const header = 'optout_id,user_id,channel,reason,status,created_at';
    const lines = rows.map((r: any) =>
      [r.optout_id, r.user_id, r.channel, r.reason || '', r.status, r.created_at?.toISOString?.() || r.created_at]
        .map((v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header, ...lines].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=opt-outs-${user.tenant_id}.csv`);
    res.send(csv);
  } catch (error) {
    logger.error(`Error exporting opt-outs: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

/**
 * Bulk import opt-outs (admin)
 * POST /api/v1/sms-whatsapp/opt-outs/import
 * Body: { records: [{ user_id?, phone_number?, channel, reason?, notes? }] }
 */
router.post('/opt-outs/import', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const records = Array.isArray(req.body?.records) ? req.body.records : [];

    if (records.length === 0) {
      return res.status(400).json({ success: false, error: 'records array is required' });
    }

    const results: { input: any; success: boolean; error?: string }[] = [];

    for (const record of records) {
      try {
        let userId = record.user_id;

        if (!userId && record.phone_number) {
          const phoneRecord = await db('phone_numbers')
            .where({ tenant_id: user.tenant_id, phone_number: String(record.phone_number).trim() })
            .first();
          if (!phoneRecord) {
            throw new Error(`No user found for phone number ${record.phone_number}`);
          }
          userId = phoneRecord.user_id;
        }

        if (!userId || !record.channel) {
          throw new Error('user_id (or phone_number) and channel are required');
        }

        await phoneNumberService.createOptOut(
          user.tenant_id,
          { user_id: userId, channel: record.channel, reason: record.reason || 'bulk_import', notes: record.notes },
          user.id
        );
        results.push({ input: record, success: true });
      } catch (err) {
        results.push({ input: record, success: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    res.json({ success: true, imported: successCount, failed: results.length - successCount, results });
  } catch (error) {
    logger.error(`Error importing opt-outs: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

// ==================== MESSAGING SETTINGS ====================

/**
 * Get tenant messaging settings (STOP/START keywords)
 * GET /api/v1/sms-whatsapp/messaging-settings
 */
router.get('/messaging-settings', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const settings = await messagingSettingsService.getSettings(user.tenant_id);
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error(`Error fetching messaging settings: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

/**
 * Update tenant messaging settings (STOP/START keywords, default language)
 * PATCH /api/v1/sms-whatsapp/messaging-settings
 */
router.patch('/messaging-settings', authorize(UserRole.SUPER_ADMIN, UserRole.PRINCIPAL), async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { stop_keywords, start_keywords, default_language } = req.body;

    if (stop_keywords && !Array.isArray(stop_keywords)) {
      return res.status(400).json({ success: false, error: 'stop_keywords must be an array of strings' });
    }
    if (start_keywords && !Array.isArray(start_keywords)) {
      return res.status(400).json({ success: false, error: 'start_keywords must be an array of strings' });
    }

    const settings = await messagingSettingsService.updateSettings(user.tenant_id, {
      stop_keywords,
      start_keywords,
      default_language,
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error(`Error updating messaging settings: ${error}`);
    res.status(400).json({ success: false, error: String(error) });
  }
});

export default router;
