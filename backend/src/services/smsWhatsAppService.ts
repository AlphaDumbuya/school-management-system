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
import notificationService from './notificationService';

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
      // Get user's phone number
      const phoneRecord = await db('phone_numbers')
        .where({
          tenant_id: tenantId,
          user_id: request.recipient_id,
          is_primary: true,
        })
        .first();

      if (!phoneRecord) {
        throw new Error('No verified phone number found for recipient');
      }

      // Check opt-out status
      const optOut = await db('sms_whatsapp_opt_outs')
        .where({
          tenant_id: tenantId,
          user_id: request.recipient_id,
          channel: ['sms', 'whatsapp'].includes(request.channel) ? request.channel : 'both',
          status: 'active',
        })
        .first();

      if (optOut) {
        throw new Error(`User has opted out of ${request.channel} messages`);
      }

      // Get message content
      let messageContent = request.message_content;
      if (request.template_id) {
        const template = await db('sms_whatsapp_templates')
          .where({ template_id: request.template_id })
          .first();

        if (!template) {
          throw new Error('Template not found');
        }

        messageContent = this.replaceTemplateVariables(
          request.channel === 'sms' ? template.sms_content : template.whatsapp_content,
          request.template_variables || {}
        );
      }

      if (!messageContent) {
        throw new Error('Message content is required');
      }

      // Get primary provider
      const provider = await smsWhatsAppProviderService.getPrimaryProvider(
        tenantId,
        request.channel as any
      );

      if (!provider) {
        throw new Error(`No ${request.channel} provider configured`);
      }

      // Create message record
      const [message] = await db('sms_whatsapp_messages')
        .insert({
          tenant_id: tenantId,
          provider_id: provider.provider_id,
          template_id: request.template_id,
          recipient_id: request.recipient_id,
          recipient_phone_number: phoneRecord.phone_number,
          recipient_country_code: phoneRecord.country_code,
          channel: request.channel,
          message_content: messageContent,
          message_type: request.template_id ? 'event_reminder' : 'general', // Will be updated by caller
          status: request.scheduled_at ? 'pending' : 'pending',
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

      // Send immediately if not scheduled
      if (!request.scheduled_at) {
        await this.sendViaProvider(message);
      }

      return {
        message_id: message.message_id,
        status: message.status,
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

      const total = await query.clone().count('* as count').first();
      const messages = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      return {
        messages: messages.map(m => this.formatMessage(m)),
        total: total.count,
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

      // Resend message
      await this.sendViaProvider(message);

      return {
        message_id: messageId,
        status: 'sent',
      };
    } catch (error) {
      logger.error(`Error retrying message: ${error}`);
      throw new Error(`Failed to retry message: ${error}`);
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
   * Private helper methods
   */

  private async sendViaProvider(message: any): Promise<void> {
    try {
      const provider = await smsWhatsAppProviderService.getProviderById(message.provider_id);
      if (!provider) {
        throw new Error('Provider not found');
      }

      let providerMessageId: string;

      // Send based on provider type
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
          throw new Error(`Unsupported provider: ${provider.provider_name}`);
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

      // Add delivery log
      await db('sms_whatsapp_delivery_logs').insert({
        message_id: message.message_id,
        status: 'sent',
        log_time: db.fn.now(),
      });

      logger.info(`Message sent via ${provider.provider_name}: ${message.message_id}`);
    } catch (error) {
      logger.error(`Error sending via provider: ${error}`);
      // Mark as failed
      await db('sms_whatsapp_messages')
        .where({ message_id: message.message_id })
        .update({
          status: 'failed',
          error_message: String(error),
          updated_at: db.fn.now(),
        });
    }
  }

  private async sendViaTwilio(message: any, provider: any): Promise<string> {
    // Implement Twilio sending
    const url = `https://api.twilio.com/2010-04-01/Accounts/${provider.account_sid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('From', provider.phone_number);
    formData.append('To', message.recipient_phone_number);
    formData.append('Body', message.message_content);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${provider.account_sid}:${provider.auth_token}`).toString('base64'),
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Twilio error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.sid;
  }

  private async sendViaBrevo(message: any, provider: any): Promise<string> {
    // Implement Brevo sending
    const url = 'https://api.brevo.com/v3/sms/send';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': provider.api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: 'School',
        recipient: message.recipient_phone_number,
        content: message.message_content,
      }),
    });

    if (!response.ok) {
      throw new Error(`Brevo error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.reference;
  }

  private async sendViaMessageBird(message: any, provider: any): Promise<string> {
    // Implement MessageBird sending
    const url = 'https://rest.messagebird.com/messages/create';

    const formData = new URLSearchParams();
    formData.append('originator', 'School');
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
      throw new Error(`MessageBird error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
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
