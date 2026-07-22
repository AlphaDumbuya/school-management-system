import db from '@utils/database';
import { logger } from '@utils/logger';
import type {
  SMSWhatsAppMessage,
  MessageStatus,
  SendMessageRequest,
  BulkSendRequest,
  SendMessageResponse,
  MessageStatusResponse,
  MessageFilterRequest,
  DeliveryLog,
} from '../types/sms-whatsapp';
import smsWhatsAppProviderService from './smsWhatsAppProviderService';
import phoneNumberService from './phoneNumberService';

/**
 * Structured error thrown by provider adapters so the retry loop can tell
 * transient failures (network blips, 5xx, rate limits) from permanent ones
 * (invalid number, bad credentials, insufficient balance) and avoid wasting
 * retries/time on failures that will never succeed.
 */
class ProviderSendError extends Error {
  code?: string;
  retryable: boolean;

  constructor(message: string, options: { code?: string; retryable: boolean }) {
    super(message);
    this.name = 'ProviderSendError';
    this.code = options.code;
    this.retryable = options.retryable;
  }
}

/**
 * Build a ProviderSendError from a failed fetch Response, parsing each
 * provider's JSON error shape when possible. HTTP 5xx and 429 (rate limit)
 * are treated as retryable; other 4xx client errors are treated as
 * permanent since retrying them will always fail the same way.
 */
async function buildProviderError(providerName: string, response: Response): Promise<ProviderSendError> {
  const status = response.status;
  const retryable = status >= 500 || status === 429;
  const rawText = await response.text().catch(() => '');

  let code: string | undefined;
  let message = `${providerName} error: ${response.statusText || status}`;

  try {
    const parsed = JSON.parse(rawText);
    if (providerName === 'twilio') {
      code = parsed.code !== undefined ? String(parsed.code) : undefined;
      message = parsed.message || message;
    } else if (providerName === 'brevo') {
      code = parsed.code;
      message = parsed.message || message;
    } else if (providerName === 'messagebird') {
      const firstError = Array.isArray(parsed.errors) ? parsed.errors[0] : undefined;
      code = firstError?.code !== undefined ? String(firstError.code) : undefined;
      message = firstError?.description || message;
    }
  } catch {
    // Not JSON — fall back to raw text appended to the message
    if (rawText) message = `${message} ${rawText}`;
  }

  return new ProviderSendError(message, { code, retryable });
}


/**
 * SMS & WhatsApp Messaging Service
 * Handles sending and tracking SMS/WhatsApp messages
 */
class SMSWhatsAppService {
  /**
   * Send a single message
   */
  async sendMessage(
    tenantId: string,
    request: SendMessageRequest,
    userId: string
  ): Promise<SendMessageResponse> {
    try {
      if (!request.recipient_id) {
        throw new Error('Recipient is required');
      }

      if (!['sms', 'whatsapp'].includes(request.channel)) {
        throw new Error('Channel must be sms or whatsapp');
      }

      const phoneRecord = await phoneNumberService.getPrimaryPhoneNumber(
        tenantId,
        request.recipient_id
      );

      if (!phoneRecord) {
        throw new Error('No primary phone number found for recipient');
      }

      if (!phoneRecord.verified) {
        throw new Error('Recipient phone number must be verified');
      }

      if (request.channel === 'sms' && !phoneRecord.sms_enabled) {
        throw new Error('Recipient has disabled SMS messages');
      }

      if (request.channel === 'whatsapp' && !phoneRecord.whatsapp_enabled) {
        throw new Error('Recipient has disabled WhatsApp messages');
      }

      const optOut = await db('sms_whatsapp_opt_outs')
        .where({
          tenant_id: tenantId,
          user_id: request.recipient_id,
          status: 'active',
        })
        .whereIn('channel', [request.channel, 'both'])
        .first();

      if (optOut) {
        throw new Error(`User has opted out of ${request.channel} messages`);
      }

      let messageContent = request.message_content?.trim();
      let messageType = 'general';

      if (request.template_id) {
        const template = await db('sms_whatsapp_templates')
          .where({ template_id: request.template_id, tenant_id: tenantId })
          .first();

        if (!template) {
          throw new Error('Template not found');
        }

        if (template.channel !== request.channel) {
          throw new Error('Template channel does not match selected message channel');
        }

        const templateText =
          request.channel === 'sms'
            ? template.sms_content
            : template.whatsapp_content || template.sms_content;

        messageContent = this.replaceTemplateVariables(
          templateText,
          request.template_variables || {}
        );
        messageType = template.template_type || 'general';
      }

      if (!messageContent || !messageContent.trim()) {
        throw new Error('Message content is required');
      }

      const provider = await smsWhatsAppProviderService.getPrimaryProvider(
        tenantId,
        request.channel as any
      );

      if (!provider) {
        throw new Error(`No ${request.channel} provider configured`);
      }

      let [message] = await db('sms_whatsapp_messages')
        .insert({
          tenant_id: tenantId,
          provider_id: provider.provider_id,
          template_id: request.template_id,
          recipient_id: request.recipient_id,
          recipient_phone_number: phoneRecord.phone_number,
          recipient_country_code: phoneRecord.country_code,
          channel: request.channel,
          message_content: messageContent,
          message_type: messageType,
          status: 'pending',
          message_parts: this.calculateSMSParts(messageContent),
          cost: this.calculateCost(
            request.channel,
            this.calculateSMSParts(messageContent),
            provider
          ),
          source_id: request.source_id,
          source_type: request.source_type,
          metadata: request.metadata ? JSON.stringify(request.metadata) : null,
          scheduled_at: request.scheduled_at,
          sent_by: userId,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      logger.info(
        `Message created: ${message.message_id} for recipient ${request.recipient_id}`
      );

      if (!request.scheduled_at) {
        await this.sendViaProvider(message);
        const refreshed = await db('sms_whatsapp_messages')
          .where({ message_id: message.message_id })
          .first();
        message = refreshed;
      }

      return {
        message_id: message.message_id,
        status: message.status,
        provider_message_id: message.provider_message_id,
        scheduled_at: message.scheduled_at,
        estimated_cost: message.cost,
      };
    } catch (error) {
      logger.error(`Error sending message: ${error}`);
      throw new Error(`Failed to send message: ${error}`);
    }
  }

  /**
   * Send bulk messages
   */
  async bulkSendMessages(
    tenantId: string,
    request: BulkSendRequest,
    userId: string
  ): Promise<SendMessageResponse[]> {
    try {
      const responses: SendMessageResponse[] = [];

      if (!request.recipient_ids || request.recipient_ids.length === 0) {
        throw new Error('recipient_ids are required for bulk send');
      }

      for (const recipientId of request.recipient_ids) {
        try {
          const response = await this.sendMessage(
            tenantId,
            {
              recipient_id: recipientId,
              template_id: request.template_id,
              channel: request.channel,
              message_content: request.message_content,
              template_variables: request.template_variables,
              scheduled_at: request.scheduled_at,
              source_id: request.source_id,
              source_type: request.source_type,
            },
            userId
          );
          responses.push(response);
        } catch (error) {
          logger.error(`Error sending to ${recipientId}: ${error}`);
          responses.push({
            message_id: '',
            status: 'failed',
            error: String(error),
          });
        }
      }

      if (!request.recipient_ids || request.recipient_ids.length === 0) {
        throw new Error('recipient_ids are required for bulk send');
      }

      logger.info(`Bulk sent ${responses.length} messages`);
      return responses;
    } catch (error) {
      logger.error(`Error in bulk send: ${error}`);
      throw new Error(`Failed to bulk send messages: ${error}`);
    }
  }

  /**
   * Get message by ID
   */
  async getMessageById(messageId: string): Promise<SMSWhatsAppMessage | null> {
    try {
      const message = await db('sms_whatsapp_messages')
        .where({ message_id: messageId })
        .first();

      if (!message) {
        return null;
      }

      return this.formatMessage(message);
    } catch (error) {
      logger.error(`Error fetching message ${messageId}: ${error}`);
      throw new Error(`Failed to fetch message: ${error}`);
    }
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<MessageStatusResponse> {
    try {
      const message = await this.getMessageById(messageId);
      if (!message) {
        throw new Error('Message not found');
      }

      const deliveryLogs = await db('sms_whatsapp_delivery_logs')
        .where({ message_id: messageId })
        .orderBy('log_time', 'desc');

      return {
        message_id: message.message_id,
        status: message.status,
        provider_message_id: message.provider_message_id,
        sent_at: message.sent_at,
        delivered_at: message.delivered_at,
        read_at: message.read_at,
        error_code: message.error_code,
        error_message: message.error_message,
        delivery_logs: deliveryLogs.map(log => this.formatDeliveryLog(log)),
      };
    } catch (error) {
      logger.error(`Error fetching message status: ${error}`);
      throw new Error(`Failed to fetch message status: ${error}`);
    }
  }

  /**
   * Get messages with filtering
   */
  async getMessages(
    tenantId: string,
    filter: MessageFilterRequest
  ): Promise<{ messages: SMSWhatsAppMessage[]; total: number }> {
    try {
      const limit = filter.limit || 20;
      const offset = filter.offset || 0;

      let query = db('sms_whatsapp_messages').where({ tenant_id: tenantId });

      if (filter.status) query = query.where({ status: filter.status });
      if (filter.channel) query = query.where({ channel: filter.channel });
      if (filter.recipient_id) query = query.where({ recipient_id: filter.recipient_id });
      if (filter.source_type) query = query.where({ source_type: filter.source_type });
      if (filter.source_id) query = query.where({ source_id: filter.source_id });
      if (filter.date_from) query = query.where('created_at', '>=', filter.date_from);
      if (filter.date_to) query = query.where('created_at', '<=', filter.date_to);

      const totalResult = await query.clone().count('* as count').first();
      const totalCount = totalResult ? Number(totalResult.count) : 0;
      const messages = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      return {
        messages: messages.map(m => this.formatMessage(m)),
        total: totalCount,
      };
    } catch (error) {
      logger.error(`Error fetching messages: ${error}`);
      throw new Error(`Failed to fetch messages: ${error}`);
    }
  }

  /**
   * Retry failed message
   */
  async retryMessage(messageId: string): Promise<SendMessageResponse> {
    try {
      const message = await db('sms_whatsapp_messages')
        .where({ message_id: messageId })
        .first();

      if (!message) {
        throw new Error('Message not found');
      }

      if (!['failed', 'bounced'].includes(message.status)) {
        throw new Error('Only failed or bounced messages can be retried');
      }

      await this.sendViaProvider(message);

      const refreshed = await db('sms_whatsapp_messages')
        .where({ message_id: messageId })
        .first();

      return {
        message_id: messageId,
        status: refreshed?.status || 'failed',
        provider_message_id: refreshed?.provider_message_id,
        error: refreshed?.error_message,
      };
    } catch (error) {
      logger.error(`Error retrying message: ${error}`);
      throw new Error(`Failed to retry message: ${error}`);
    }
  }

  /**
   * Send a resubscribe verification code to a user, bypassing the opt-out
   * block (this is the only way an opted-out user can receive a message —
   * it lets them prove ownership of the phone number to opt back in).
   * The raw code is never logged or returned to callers beyond this call.
   */
  async sendVerificationCode(
    tenantId: string,
    userId: string,
    channel: 'sms' | 'whatsapp',
    code: string
  ): Promise<void> {
    try {
      const phoneRecord = await phoneNumberService.getPrimaryPhoneNumber(tenantId, userId);
      if (!phoneRecord) {
        throw new Error('No primary phone number found for recipient');
      }

      const provider = await smsWhatsAppProviderService.getPrimaryProvider(tenantId, channel);
      if (!provider) {
        throw new Error(`No ${channel} provider configured`);
      }

      const messageContent = `Your verification code to resubscribe to messages is: ${code}. It expires in 15 minutes. If you did not request this, ignore this message.`;

      const [message] = await db('sms_whatsapp_messages')
        .insert({
          tenant_id: tenantId,
          provider_id: provider.provider_id,
          recipient_id: userId,
          recipient_phone_number: phoneRecord.phone_number,
          recipient_country_code: phoneRecord.country_code,
          channel,
          message_content: messageContent,
          message_type: 'opt_out_verification',
          status: 'pending',
          message_parts: this.calculateSMSParts(messageContent),
          cost: this.calculateCost(channel, this.calculateSMSParts(messageContent), provider),
          source_type: 'opt_out_verification',
          sent_by: userId,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      await this.sendViaProvider(message, { bypassOptOutCheck: true });
    } catch (error) {
      logger.error(`Error sending verification code: ${error}`);
      throw new Error(`Failed to send verification code: ${error}`);
    }
  }

  /**
   * Send a verification code while a phone number is being registered. This
   * intentionally does not require an already-verified primary phone record:
   * the recipient is verifying this exact number. It still records a normal
   * delivery attempt and uses the tenant's primary SMS provider.
   */
  async sendPhoneNumberVerificationCode(
    tenantId: string,
    userId: string,
    phoneNumber: string,
    countryCode: string,
    code: string
  ): Promise<void> {
    try {
      const provider = await smsWhatsAppProviderService.getPrimaryProvider(tenantId, 'sms');
      if (!provider) {
        throw new Error('No SMS provider configured for phone verification');
      }

      if (this.normalizePhoneNumber(provider.phone_number) === this.normalizePhoneNumber(phoneNumber)) {
        throw new Error('The verification number cannot be the same as the configured SMS sender number. Add a different mobile number to receive the verification code.');
      }

      const messageContent = `Your school phone verification code is: ${code}. Do not share this code with anyone.`;
      const [message] = await db('sms_whatsapp_messages')
        .insert({
          tenant_id: tenantId,
          provider_id: provider.provider_id,
          recipient_id: userId,
          recipient_phone_number: phoneNumber,
          recipient_country_code: countryCode,
          channel: 'sms',
          message_content: messageContent,
          message_type: 'phone_verification',
          status: 'pending',
          message_parts: this.calculateSMSParts(messageContent),
          cost: this.calculateCost('sms', this.calculateSMSParts(messageContent), provider),
          source_type: 'phone_verification',
          sent_by: userId,
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      await this.sendViaProvider(message, { bypassOptOutCheck: true });
    } catch (error) {
      logger.error(`Error sending phone verification code: ${error}`);
      throw new Error(`Failed to send phone verification code: ${error}`);
    }
  }

  /**
   * Update message status from provider webhook
   */
  async updateMessageStatusFromWebhook(
    providerMessageId: string,
    status: MessageStatus,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const message = await db('sms_whatsapp_messages')
        .where({ provider_message_id: providerMessageId })
        .first();

      if (!message) {
        logger.warn(`Message not found for provider ID: ${providerMessageId}`);
        return;
      }

      const updateData: Record<string, any> = {
        status,
        updated_at: db.fn.now(),
      };

      if (status === 'sent') updateData.sent_at = db.fn.now();
      if (status === 'delivered') updateData.delivered_at = db.fn.now();
      if (status === 'read') updateData.read_at = db.fn.now();
      if (status === 'failed' && details?.error_code) {
        updateData.error_code = details.error_code;
        updateData.error_message = details.error_message;
      }

      await db('sms_whatsapp_messages')
        .where({ message_id: message.message_id })
        .update(updateData);

      // Add delivery log
      await db('sms_whatsapp_delivery_logs').insert({
        message_id: message.message_id,
        status,
        status_details: details ? JSON.stringify(details) : null,
        error_code: details?.error_code,
        error_message: details?.error_message,
        webhook_payload: details ? JSON.stringify(details) : null,
        log_time: db.fn.now(),
      });

      logger.info(`Message status updated: ${message.message_id} -> ${status}`);
    } catch (error) {
      logger.error(`Error updating message status: ${error}`);
      throw new Error(`Failed to update message status: ${error}`);
    }
  }

  /**
   * Get messages pending delivery
   */
  async getMessagesPendingDelivery(channel: string, limit: number = 100): Promise<SMSWhatsAppMessage[]> {
    try {
      const messages = await db('sms_whatsapp_messages')
        .where({ channel, status: 'pending' })
        .whereNotNull('scheduled_at')
        .where('scheduled_at', '<=', db.fn.now())
        .limit(limit)
        .orderBy('scheduled_at', 'asc');

      return messages.map(m => this.formatMessage(m));
    } catch (error) {
      logger.error(`Error fetching pending messages: ${error}`);
      throw new Error(`Failed to fetch pending messages: ${error}`);
    }
  }

  /**
   * Process pending messages due for delivery
   */
  async processPendingDeliveries(limit: number = 100): Promise<void> {
    try {
      const messages = await this.getMessagesPendingDelivery('sms', limit);
      for (const msg of messages) {
        try {
          // skip if user opted out
          const optedOut = await phoneNumberService.isUserOptedOut(msg.tenant_id, msg.recipient_id, msg.channel);
          if (optedOut) {
            logger.info(`Skipping scheduled message ${msg.message_id} because recipient opted out`);
            await db('sms_whatsapp_messages').where({ message_id: msg.message_id }).update({ status: 'blocked', updated_at: db.fn.now() });
            await db('sms_whatsapp_delivery_logs').insert({ message_id: msg.message_id, status: 'blocked', status_details: JSON.stringify({ reason: 'opted_out' }), log_time: db.fn.now() });
            continue;
          }

          // sendViaProvider expects raw DB row, formatMessage returns similar shape
          await this.sendViaProvider(msg);
        } catch (err) {
          // sendViaProvider handles retries and final failure logging
          logger.error(`Failed to process pending message ${msg.message_id}: ${err}`);
        }
      }

      const waMessages = await this.getMessagesPendingDelivery('whatsapp', limit);
      for (const msg of waMessages) {
        try {
          const optedOut = await phoneNumberService.isUserOptedOut(msg.tenant_id, msg.recipient_id, msg.channel);
          if (optedOut) {
            logger.info(`Skipping scheduled WhatsApp message ${msg.message_id} because recipient opted out`);
            await db('sms_whatsapp_messages').where({ message_id: msg.message_id }).update({ status: 'blocked', updated_at: db.fn.now() });
            await db('sms_whatsapp_delivery_logs').insert({ message_id: msg.message_id, status: 'blocked', status_details: JSON.stringify({ reason: 'opted_out' }), log_time: db.fn.now() });
            continue;
          }

          await this.sendViaProvider(msg);
        } catch (err) {
          logger.error(`Failed to process pending WhatsApp message ${msg.message_id}: ${err}`);
        }
      }
    } catch (error) {
      logger.error(`Error processing pending deliveries: ${error}`);
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async sendViaProvider(message: any, options?: { bypassOptOutCheck?: boolean }): Promise<void> {
    const provider = await smsWhatsAppProviderService.getProviderById(message.provider_id);
    if (!provider) {
      throw new Error('Provider not found');
    }

    // Respect opt-outs at send time (unless explicitly bypassed, e.g. resubscribe
    // verification codes which must reach the user even while opted out)
    if (!options?.bypassOptOutCheck) {
      try {
        const optedOut = await phoneNumberService.isUserOptedOut(message.tenant_id, message.recipient_id, message.channel);
        if (optedOut) {
          await db('sms_whatsapp_messages')
            .where({ message_id: message.message_id })
            .update({ status: 'blocked', updated_at: db.fn.now() });

          await db('sms_whatsapp_delivery_logs').insert({
            message_id: message.message_id,
            status: 'blocked',
            status_details: JSON.stringify({ reason: 'opted_out' }),
            log_time: db.fn.now(),
          });

          logger.info(`Message ${message.message_id} blocked due to opt-out`);
          return;
        }
      } catch (err) {
        logger.warn(`Failed to check opt-out for message ${message.message_id}: ${err}`);
        // proceed to attempt send if opt-out check fails
      }
    }

    const maxAttempts = 3;
    const baseDelayMs = 500; // exponential backoff base

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        let providerMessageId: string;

        switch (provider.provider_name) {
          case 'twilio':
            providerMessageId = await this.sendViaTwilio(message, provider);
            break;
          case 'brevo':
            providerMessageId = await this.sendViaBrevo(message, provider);
            break;
          case 'messagebird':
            providerMessageId = await this.sendViaMessageBird(message, provider);
            break;
          default:
            throw new ProviderSendError(`Unsupported provider: ${provider.provider_name}`, { retryable: false });
        }

        // Update message with provider ID
        await db('sms_whatsapp_messages')
          .where({ message_id: message.message_id })
          .update({
            provider_message_id: providerMessageId,
            status: 'sent',
            sent_at: db.fn.now(),
            updated_at: db.fn.now(),
          });

        // Add delivery log indicating send
        await db('sms_whatsapp_delivery_logs').insert({
          message_id: message.message_id,
          status: 'sent',
          attempt_number: attempt,
          retry_count: attempt - 1,
          log_time: db.fn.now(),
        });

        logger.info(`Message sent via ${provider.provider_name}: ${message.message_id} (attempt ${attempt})`);
        return;
      } catch (err) {
        const isProviderError = err instanceof ProviderSendError;
        const errorMessage = isProviderError ? err.message : String(err || 'unknown error');
        const errorCode = isProviderError ? err.code : undefined;
        // Unknown/unexpected errors (e.g. network failures) are treated as
        // retryable; only explicitly classified permanent errors stop early.
        const retryable = isProviderError ? err.retryable : true;

        logger.warn(`Attempt ${attempt} failed for message ${message.message_id}: ${errorMessage}`);

        // Log attempt
        await db('sms_whatsapp_delivery_logs').insert({
          message_id: message.message_id,
          status: 'failed',
          error_code: errorCode,
          error_message: errorMessage,
          attempt_number: attempt,
          retry_count: attempt - 1,
          log_time: db.fn.now(),
          webhook_payload: null,
        });

        if (retryable && attempt < maxAttempts) {
          // Exponential backoff
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          await new Promise(res => setTimeout(res, delay));
          continue;
        }

        // Final failure (either permanent error, or retries exhausted) - mark message failed
        await db('sms_whatsapp_messages')
          .where({ message_id: message.message_id })
          .update({
            status: 'failed',
            error_code: errorCode,
            error_message: errorMessage,
            updated_at: db.fn.now(),
          });

        if (retryable) {
          logger.error(`Message permanently failed after ${attempt} attempts: ${message.message_id}`);
        } else {
          logger.error(`Message failed with non-retryable error on attempt ${attempt}: ${message.message_id} (code: ${errorCode || 'n/a'})`);
        }
        throw err;
      }
    }
  }

  private async sendViaTwilio(message: any, provider: any): Promise<string> {
    if (!provider.account_sid || !provider.auth_token) {
      throw new ProviderSendError('Twilio provider is missing account SID or auth token', { retryable: false });
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${provider.account_sid}/Messages.json`;
    const to = message.channel === 'whatsapp'
      ? `whatsapp:${message.recipient_phone_number}`
      : message.recipient_phone_number;
    const from = message.channel === 'whatsapp'
      ? `whatsapp:${provider.phone_number}`
      : provider.phone_number;

    const formData = new URLSearchParams();
    formData.append('From', from);
    formData.append('To', to);
    formData.append('Body', message.message_content);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${provider.account_sid}:${provider.auth_token}`).toString('base64'),
      },
      body: formData,
    });

    if (!response.ok) {
      throw await buildProviderError('twilio', response);
    }

    const data = await response.json() as any;
    return data.sid;
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/^whatsapp:/i, '').replace(/[\s()-]/g, '');
  }

  private async sendViaBrevo(message: any, provider: any): Promise<string> {
    if (!provider.api_key) {
      throw new ProviderSendError('Brevo provider is missing an API key', { retryable: false });
    }

    if (message.channel === 'whatsapp') {
      const templateId = Number(provider.configuration?.brevo_whatsapp_template_id);
      if (!Number.isInteger(templateId) || templateId <= 0) {
        throw new ProviderSendError('Brevo WhatsApp requires a configured template ID', { retryable: false });
      }

      const response = await fetch('https://api.brevo.com/v3/whatsapp/sendMessage', {
        method: 'POST',
        headers: {
          'api-key': provider.api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactNumbers: [Number(message.recipient_phone_number.replace(/\D/g, ''))],
          senderNumber: provider.phone_number.replace(/\D/g, ''),
          templateId,
        }),
      });

      if (!response.ok) {
        throw await buildProviderError('brevo', response);
      }

      const data = await response.json() as any;
      return data.messageId;
    }

    if (message.channel !== 'sms') {
      throw new ProviderSendError(`Brevo does not support the ${message.channel} channel`, { retryable: false });
    }

    const url = 'https://api.brevo.com/v3/sms/send';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': provider.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: provider.phone_number || 'School',
        recipient: message.recipient_phone_number,
        content: message.message_content,
      }),
    });

    if (!response.ok) {
      throw await buildProviderError('brevo', response);
    }

    const data = await response.json() as any;
    return data.reference || data.id || data.messageId;
  }

  private async sendViaMessageBird(message: any, provider: any): Promise<string> {
    if (!provider.api_key) {
      throw new ProviderSendError('MessageBird provider is missing an API key', { retryable: false });
    }

    if (message.channel === 'whatsapp') {
      const channelId = provider.configuration?.messagebird_whatsapp_channel_id;
      if (!channelId) {
        throw new ProviderSendError('MessageBird WhatsApp requires a configured Conversations channel ID', { retryable: false });
      }

      const response = await fetch('https://conversations.messagebird.com/v1/send', {
        method: 'POST',
        headers: {
          Authorization: `AccessKey ${provider.api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: message.recipient_phone_number,
          from: channelId,
          type: 'text',
          content: { text: message.message_content },
        }),
      });

      if (!response.ok) {
        throw await buildProviderError('messagebird', response);
      }

      const data = await response.json() as any;
      return data.id;
    }

    if (message.channel !== 'sms') {
      throw new ProviderSendError(`MessageBird does not support the ${message.channel} channel`, { retryable: false });
    }

    const url = 'https://rest.messagebird.com/messages/create';
    const formData = new URLSearchParams();
    formData.append('originator', provider.phone_number || 'School');
    formData.append('recipients', message.recipient_phone_number);
    formData.append('body', message.message_content);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `AccessKey ${provider.api_key}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw await buildProviderError('messagebird', response);
    }

    const data = await response.json() as any;
    return data.id || data.items?.[0]?.id;
  }

  private replaceTemplateVariables(
    template: string,
    variables: Record<string, any>
  ): string {
    let content = template;
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return content;
  }

  private calculateSMSParts(content: string): number {
    // SMS is ~160 characters per part (153 for multipart)
    const partLength = content.includes('€') || content.includes('£') ? 70 : 160;
    return Math.ceil(content.length / partLength);
  }

  private calculateCost(channel: string, parts: number, provider: any): number {
    if (channel === 'sms') {
      return provider.cost_per_sms * parts;
    } else {
      return provider.cost_per_whatsapp_message;
    }
  }

  private formatMessage(message: any): SMSWhatsAppMessage {
    return {
      ...message,
      metadata: message.metadata ? JSON.parse(message.metadata) : undefined,
    };
  }

  private formatDeliveryLog(log: any): DeliveryLog {
    return {
      ...log,
      status_details: log.status_details ? JSON.parse(log.status_details) : undefined,
      webhook_payload: log.webhook_payload ? JSON.parse(log.webhook_payload) : undefined,
    };
  }
}

export default new SMSWhatsAppService();
