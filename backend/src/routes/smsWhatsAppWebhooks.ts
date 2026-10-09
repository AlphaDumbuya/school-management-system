import express, { Request, Response } from 'express';
import crypto from 'crypto';
import db from '@utils/database';
import smsWhatsAppProviderService from '@services/smsWhatsAppProviderService';
import smsWhatsAppService from '@services/smsWhatsAppService';
import phoneNumberService from '@services/phoneNumberService';
import messagingSettingsService from '@services/messagingSettingsService';
import { logger } from '@utils/logger';

const router = express.Router();

/** Constant-time string comparison (false on length mismatch, never throws). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Public webhook endpoint for providers to POST delivery updates
// POST /api/v1/sms-whatsapp/webhooks/:providerId
// Capture raw body for signature verification using the verify option
const rawJsonMiddleware = express.json({
  type: '*/*',
  verify: (req: any, _res, buf: Buffer) => {
    req.rawBody = buf;
  },
});

router.post('/:providerId', rawJsonMiddleware, async (req: Request, res: Response) => {
  try {
    const providerId = req.params.providerId;
    const provider = await smsWhatsAppProviderService.getProviderById(providerId);
    if (!provider) {
      logger.warn(`Webhook received for unknown provider: ${providerId}`);
      return res.status(404).send('Provider not found');
    }

    // Fail closed: in production an unsigned payload is never accepted. A
    // provider without a webhook_secret can't be authenticated, so anyone
    // could forge delivery statuses or STOP/START opt-outs for its tenant.
    if (!provider.webhook_secret) {
      if (process.env.NODE_ENV === 'production') {
        logger.warn(`Rejected webhook for provider ${providerId}: no webhook_secret configured`);
        return res.status(401).send('Webhook secret not configured');
      }
      logger.warn(`Accepting UNSIGNED webhook for provider ${providerId} (non-production only)`);
    }

    // Verify webhook signature for Brevo (Sendinblue) using HMAC-SHA256
    if (provider.webhook_secret && (provider.provider_name?.toLowerCase().includes('brevo') || provider.provider_name?.toLowerCase().includes('sendinblue'))) {
      const headerSigRaw = (req.header('x-mailin-signature') || req.header('x-brevo-signature') || req.header('x-signature') || req.header('x-sendinblue-signature') || '').toString();
      if (!headerSigRaw) {
        logger.warn(`Missing Brevo signature header for provider ${providerId}`);
        return res.status(403).send('Missing signature');
      }

      // Remove possible prefixes like 'sha256='
      const headerSig = headerSigRaw.replace(/^sha256=/i, '').trim();

      const rawBodyBuf = (req as any).rawBody instanceof Buffer ? (req as any).rawBody : Buffer.from(JSON.stringify(req.body || {}));
      const expected = crypto.createHmac('sha256', provider.webhook_secret).update(rawBodyBuf).digest();

      let providedBuf: Buffer | null = null;
      // Try hex
      try {
        providedBuf = Buffer.from(headerSig, 'hex');
      } catch (e) {
        providedBuf = null;
      }
      // If hex decode looks wrong length, try base64
      if (!providedBuf || providedBuf.length !== expected.length) {
        try {
          providedBuf = Buffer.from(headerSig, 'base64');
        } catch (e) {
          providedBuf = null;
        }
      }

      if (!providedBuf || providedBuf.length !== expected.length) {
        logger.warn(`Invalid Brevo signature format for provider ${providerId}`);
        return res.status(403).send('Invalid signature');
      }

      // Constant-time compare
      if (!crypto.timingSafeEqual(expected, providedBuf)) {
        logger.warn(`Brevo signature mismatch for provider ${providerId}`);
        return res.status(403).send('Invalid signature');
      }
    } else if (provider.webhook_secret) {
      // Fallback: support a simple shared-secret header for other providers
      const headerSecret = (req.header('x-webhook-secret') || req.header('x-hook-secret') || req.header('x-signature') || '').toString();
      if (!headerSecret || !safeEqual(headerSecret, String(provider.webhook_secret))) {
        logger.warn(`Invalid webhook secret for provider ${providerId}`);
        return res.status(403).send('Invalid webhook signature');
      }
    }

    const payload = req.body || {};

    // Detect inbound messages (many providers use different shapes)
    const possibleFrom =
      payload.from || payload.sender || payload.msisdn || payload.originator || payload.telephone ||
      payload.message?.from || payload.data?.from || payload.contact?.phone || (payload._embedded && payload._embedded.messages && payload._embedded.messages[0] && payload._embedded.messages[0].from) || null;

    const possibleBody =
      payload.text || payload.body || payload.content || payload.message?.text || payload.data?.content || payload.message?.message || null;

    const normalizePhone = (p: any) => (p ? String(p).trim() : null);
    const fromPhone = normalizePhone(possibleFrom);
    const bodyText = possibleBody ? String(possibleBody).trim() : '';

    // Use tenant-configurable STOP/START keyword lists (multilingual, per-tenant)
    const isStop = bodyText ? await messagingSettingsService.isStopMessage(provider.tenant_id, bodyText) : false;
    const isStart = bodyText ? await messagingSettingsService.isStartMessage(provider.tenant_id, bodyText) : false;

    if (isStop && fromPhone) {
      try {
        // Map sender phone to user (tenant-scoped lookup)
        const phoneRecord = await db('phone_numbers')
          .where({ tenant_id: provider.tenant_id, phone_number: fromPhone })
          .first();

        if (phoneRecord) {
          // Create opt-out for this user for SMS channel
          await phoneNumberService.createOptOut(
            provider.tenant_id,
            { user_id: phoneRecord.user_id, channel: 'sms', reason: 'inbound', notes: bodyText },
            phoneRecord.user_id
          );
          logger.info(`Created opt-out for user ${phoneRecord.user_id} from inbound message`);
        } else {
          logger.info(`Inbound STOP from ${fromPhone} but phone not linked to any user (tenant ${provider.tenant_id})`);
        }
      } catch (e) {
        logger.error(`Failed to create opt-out from inbound STOP: ${e}`);
      }
    } else if (isStart && fromPhone) {
      try {
        const phoneRecord = await db('phone_numbers')
          .where({ tenant_id: provider.tenant_id, phone_number: fromPhone })
          .first();

        if (phoneRecord) {
          await db('sms_whatsapp_opt_outs')
            .where({ tenant_id: provider.tenant_id, user_id: phoneRecord.user_id, status: 'active' })
            .update({ status: 'removed', verified_at: db.fn.now(), updated_at: db.fn.now() });
          logger.info(`Removed opt-out(s) for user ${phoneRecord.user_id} from inbound START message`);
        } else {
          logger.info(`Inbound START from ${fromPhone} but phone not linked to any user (tenant ${provider.tenant_id})`);
        }
      } catch (e) {
        logger.error(`Failed to process inbound START: ${e}`);
      }
    }

    // Try to extract provider message id and status from payload
    const providerMessageId = (payload.MessageSid || payload.messageSid || payload.sid || payload.reference || payload.id || payload.message_id || payload.data?.id || payload.data?.reference) as string | undefined;
    const rawStatus = (payload.SmsStatus || payload.MessageStatus || payload.status || payload.status_description || payload.event || payload.statusCode) as string | undefined;

    if (!providerMessageId) {
      logger.warn(`Webhook payload missing provider message id: ${JSON.stringify(payload).slice(0,200)}`);
      return res.status(400).send('Missing provider message id');
    }

    // Map raw provider status to internal MessageStatus
    const mapStatus = (s?: string) => {
      if (!s) return 'sent';
      const v = String(s).toLowerCase();
      if (v.includes('deliv') || v === 'delivered') return 'delivered';
      if (v.includes('read')) return 'read';
      if (v.includes('fail') || v.includes('undeliver') || v.includes('bounced') || v === 'failed' || v === 'undelivered' || v === 'bounced') return 'failed';
      if (v === 'sent' || v === 'queued' || v === 'accepted') return 'sent';
      return 'sent';
    };

    const status = mapStatus(rawStatus);

    // Collect useful details (error codes/messages) if present
    const details: Record<string, any> = {
      provider: provider.provider_name,
      raw_status: rawStatus,
      payload,
    };

    await smsWhatsAppService.updateMessageStatusFromWebhook(providerMessageId, status as any, details);

    res.status(200).send('OK');
  } catch (error) {
    logger.error(`Error processing webhook: ${error}`);
    res.status(500).send('Webhook processing error');
  }
});

export default router;
