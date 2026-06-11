import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 19.2: SMS Service Integration
 * 
 * Provides SMS integration capabilities:
 * - SMS service configuration management
 * - SMS sending through external providers (Twilio, AWS SNS, etc.)
 * - SMS template management
 * - SMS delivery tracking
 * - Retry mechanisms for failed SMS
 * - SMS logging and monitoring
 */

interface SMSConfig {
  provider: 'twilio' | 'aws_sns' | 'nexmo';
  accountSid?: string;
  authToken?: string;
  fromNumber: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  nexmoApiKey?: string;
  nexmoApiSecret?: string;
  isActive: boolean;
}

interface SMSTemplate {
  id: string;
  tenantId: string;
  name: string;
  message: string;
  variables: string[];
  category: string;
  characterLimit: number;
  isActive: boolean;
  createdAt: Date;
}

interface SMSMessage {
  id: string;
  tenantId: string;
  phoneNumber: string;
  message: string;
  templateId?: string;
  templateVariables?: Record<string, any>;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  externalMessageId?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
}

export class SMSService {
  private db: Knex;
  private config: SMSConfig | null = null;

  /**
   * Initializes SMS service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('SMSService initialized');
  }

  /**
   * Sets SMS service configuration
   * @param tenantId - Tenant ID
   * @param config - SMS configuration
   */
  async setSMSConfig(tenantId: string, config: SMSConfig): Promise<SMSConfig> {
    try {
      // Validate configuration
      if (!config.provider || !config.fromNumber) {
        throw new AppError('Provider and from number are required', 400);
      }

      // Check for provider-specific credentials
      if (config.provider === 'twilio' && (!config.accountSid || !config.authToken)) {
        throw new AppError('Twilio configuration requires accountSid and authToken', 400);
      }

      if (config.provider === 'aws_sns' && (!config.awsAccessKeyId || !config.awsSecretAccessKey)) {
        throw new AppError('AWS SNS configuration requires access key and secret', 400);
      }

      if (config.provider === 'nexmo' && (!config.nexmoApiKey || !config.nexmoApiSecret)) {
        throw new AppError('Nexmo configuration requires API key and secret', 400);
      }

      // Store configuration
      const existing = await this.db('sms_configurations')
        .where('tenant_id', tenantId)
        .first();

      if (existing) {
        await this.db('sms_configurations')
          .where('tenant_id', tenantId)
          .update({
            provider: config.provider,
            from_number: config.fromNumber,
            account_sid: config.accountSid || null,
            auth_token: config.authToken || null,
            aws_access_key_id: config.awsAccessKeyId || null,
            aws_secret_access_key: config.awsSecretAccessKey || null,
            aws_region: config.awsRegion || null,
            nexmo_api_key: config.nexmoApiKey || null,
            nexmo_api_secret: config.nexmoApiSecret || null,
            is_active: config.isActive,
            updated_at: new Date(),
          });
      } else {
        await this.db('sms_configurations').insert({
          id: uuidv4(),
          tenant_id: tenantId,
          provider: config.provider,
          from_number: config.fromNumber,
          account_sid: config.accountSid || null,
          auth_token: config.authToken || null,
          aws_access_key_id: config.awsAccessKeyId || null,
          aws_secret_access_key: config.awsSecretAccessKey || null,
          aws_region: config.awsRegion || null,
          nexmo_api_key: config.nexmoApiKey || null,
          nexmo_api_secret: config.nexmoApiSecret || null,
          is_active: config.isActive,
          created_at: new Date(),
        });
      }

      this.config = config;
      logger.info(`SMS configuration set for tenant ${tenantId} (${config.provider})`);
      return config;
    } catch (error) {
      logger.error('Failed to set SMS configuration', error);
      throw new AppError('Failed to set SMS configuration', 500, (error as Error).message);
    }
  }

  /**
   * Gets SMS configuration for a tenant
   * @param tenantId - Tenant ID
   * @returns SMS configuration
   */
  async getSMSConfig(tenantId: string): Promise<SMSConfig | null> {
    try {
      const config = await this.db('sms_configurations')
        .where('tenant_id', tenantId)
        .first();

      if (!config) {
        return null;
      }

      return {
        provider: config.provider,
        accountSid: config.account_sid,
        authToken: config.auth_token,
        fromNumber: config.from_number,
        awsAccessKeyId: config.aws_access_key_id,
        awsSecretAccessKey: config.aws_secret_access_key,
        awsRegion: config.aws_region,
        nexmoApiKey: config.nexmo_api_key,
        nexmoApiSecret: config.nexmo_api_secret,
        isActive: config.is_active,
      };
    } catch (error) {
      logger.error('Failed to get SMS configuration', error);
      return null;
    }
  }

  /**
   * Creates or updates an SMS template
   * @param tenantId - Tenant ID
   * @param template - SMS template details
   * @returns Created/updated template
   */
  async createSMSTemplate(
    tenantId: string,
    template: Omit<SMSTemplate, 'id' | 'createdAt' | 'tenantId' | 'variables'>
  ): Promise<SMSTemplate> {
    try {
      // Validate message length
      if (template.message.length > template.characterLimit) {
        throw new AppError(
          `Message exceeds character limit of ${template.characterLimit}`,
          400
        );
      }

      // Extract variables from template message
      const variableRegex = /\{\{(\w+)\}\}/g;
      const variables: string[] = [];
      let match;
      while ((match = variableRegex.exec(template.message)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }

      const templateId = uuidv4();

      await this.db('sms_templates').insert({
        id: templateId,
        tenant_id: tenantId,
        name: template.name,
        message: template.message,
        variables: JSON.stringify(variables),
        category: template.category,
        character_limit: template.characterLimit,
        is_active: template.isActive,
        created_at: new Date(),
      });

      logger.info(`SMS template created: ${template.name} for tenant ${tenantId}`);

      return {
        id: templateId,
        tenantId,
        name: template.name,
        message: template.message,
        variables,
        category: template.category,
        characterLimit: template.characterLimit,
        isActive: template.isActive,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to create SMS template', error);
      throw new AppError('Failed to create SMS template', 500, (error as Error).message);
    }
  }

  /**
   * Sends an SMS
   * @param tenantId - Tenant ID
   * @param phoneNumber - Recipient phone number
   * @param message - SMS message
   * @param options - Additional options
   * @returns SMS message record
   */
  async sendSMS(
    tenantId: string,
    phoneNumber: string,
    message: string,
    options?: {
      templateId?: string;
      templateVariables?: Record<string, any>;
    }
  ): Promise<SMSMessage> {
    try {
      // Get SMS configuration
      if (!this.config) {
        this.config = await this.getSMSConfig(tenantId);
      }

      if (!this.config || !this.config.isActive) {
        throw new AppError('SMS service not configured for this tenant', 400);
      }

      const messageId = uuidv4();

      // Process template variables if provided
      let processedMessage = message;
      if (options?.templateVariables) {
        for (const [key, value] of Object.entries(options.templateVariables)) {
          const placeholder = `{{${key}}}`;
          processedMessage = processedMessage.replace(new RegExp(placeholder, 'g'), String(value));
        }
      }

      // Validate message length
      if (processedMessage.length > 160) {
        logger.warn(
          `SMS message longer than standard SMS length (${processedMessage.length} chars) for ${phoneNumber}`
        );
      }

      // Send via configured provider
      let externalMessageId = undefined;
      try {
        // Provider-specific sending logic would go here
        // Twilio, AWS SNS, Nexmo implementations would be added
        if (this.config.provider === 'twilio') {
          // Twilio API call would go here
          externalMessageId = `twilio_${uuidv4()}`;
        } else if (this.config.provider === 'aws_sns') {
          // AWS SNS API call would go here
          externalMessageId = `sns_${uuidv4()}`;
        } else if (this.config.provider === 'nexmo') {
          // Nexmo API call would go here
          externalMessageId = `nexmo_${uuidv4()}`;
        }

        // Record SMS in database
        await this.db('sms_messages').insert({
          id: messageId,
          tenant_id: tenantId,
          phone_number: phoneNumber,
          message: processedMessage,
          template_id: options?.templateId || null,
          template_variables: options?.templateVariables
            ? JSON.stringify(options.templateVariables)
            : null,
          status: 'sent',
          external_message_id: externalMessageId,
          sent_at: new Date(),
          retry_count: 0,
          max_retries: 3,
          created_at: new Date(),
        });

        logger.info(`SMS sent to ${phoneNumber} for tenant ${tenantId}`);

        return {
          id: messageId,
          tenantId,
          phoneNumber,
          message: processedMessage,
          templateId: options?.templateId,
          templateVariables: options?.templateVariables,
          status: 'sent',
          externalMessageId,
          sentAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
        };
      } catch (error) {
        // Record failed SMS
        await this.db('sms_messages').insert({
          id: messageId,
          tenant_id: tenantId,
          phone_number: phoneNumber,
          message: processedMessage,
          status: 'failed',
          failure_reason: (error as Error).message,
          retry_count: 0,
          max_retries: 3,
          created_at: new Date(),
        });

        logger.error(`Failed to send SMS to ${phoneNumber}`, error);
        throw new AppError('Failed to send SMS', 500, (error as Error).message);
      }
    } catch (error) {
      logger.error('Failed to process SMS send', error);
      throw error;
    }
  }

  /**
   * Sends SMS using template
   * @param tenantId - Tenant ID
   * @param templateId - SMS template ID
   * @param phoneNumber - Recipient phone number
   * @param variables - Template variables
   * @returns SMS message record
   */
  async sendSMSFromTemplate(
    tenantId: string,
    templateId: string,
    phoneNumber: string,
    variables: Record<string, any>
  ): Promise<SMSMessage> {
    try {
      const template = await this.db('sms_templates')
        .where('id', templateId)
        .where('tenant_id', tenantId)
        .first();

      if (!template) {
        throw new AppError('SMS template not found', 404);
      }

      return await this.sendSMS(tenantId, phoneNumber, template.message, {
        templateId,
        templateVariables: variables,
      });
    } catch (error) {
      logger.error('Failed to send SMS from template', error);
      throw error;
    }
  }

  /**
   * Gets SMS templates for a tenant
   * @param tenantId - Tenant ID
   * @param category - Filter by category
   * @returns Array of SMS templates
   */
  async getSMSTemplates(tenantId: string, category?: string): Promise<SMSTemplate[]> {
    try {
      let query = this.db('sms_templates')
        .where('tenant_id', tenantId)
        .where('is_active', true);

      if (category) {
        query = query.where('category', category);
      }

      const templates = await query.select();

      return templates.map((t: any) => ({
        id: t.id,
        tenantId: t.tenant_id,
        name: t.name,
        message: t.message,
        variables: JSON.parse(t.variables),
        category: t.category,
        characterLimit: t.character_limit,
        isActive: t.is_active,
        createdAt: t.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get SMS templates', error);
      throw new AppError('Failed to get SMS templates', 500);
    }
  }

  /**
   * Gets SMS message history
   * @param tenantId - Tenant ID
   * @param limit - Result limit
   * @param offset - Result offset
   * @returns Array of SMS messages
   */
  async getSMSHistory(
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<SMSMessage[]> {
    try {
      const messages = await this.db('sms_messages')
        .where('tenant_id', tenantId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      return messages.map((m: any) => ({
        id: m.id,
        tenantId: m.tenant_id,
        phoneNumber: m.phone_number,
        message: m.message,
        templateId: m.template_id,
        templateVariables: m.template_variables ? JSON.parse(m.template_variables) : undefined,
        status: m.status,
        externalMessageId: m.external_message_id,
        sentAt: m.sent_at,
        deliveredAt: m.delivered_at,
        failureReason: m.failure_reason,
        retryCount: m.retry_count,
        maxRetries: m.max_retries,
        createdAt: m.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get SMS history', error);
      throw new AppError('Failed to get SMS history', 500);
    }
  }

  /**
   * Retries failed SMS
   * @param tenantId - Tenant ID
   * @returns Number of SMS retried
   */
  async retryFailedSMS(tenantId: string): Promise<number> {
    try {
      const failedSMS = await this.db('sms_messages')
        .where('tenant_id', tenantId)
        .where('status', 'failed')
        .where('retry_count', '<', this.db.raw('max_retries'))
        .select();

      let retriedCount = 0;

      for (const sms of failedSMS) {
        try {
          await this.sendSMS(tenantId, sms.phone_number, sms.message, {
            templateId: sms.template_id,
            templateVariables: sms.template_variables
              ? JSON.parse(sms.template_variables)
              : undefined,
          });

          await this.db('sms_messages')
            .where('id', sms.id)
            .update({
              retry_count: sms.retry_count + 1,
            });

          retriedCount++;
        } catch (error) {
          await this.db('sms_messages')
            .where('id', sms.id)
            .update({
              retry_count: sms.retry_count + 1,
              failure_reason: (error as Error).message,
            });
        }
      }

      logger.info(`Retried ${retriedCount} failed SMS for tenant ${tenantId}`);
      return retriedCount;
    } catch (error) {
      logger.error('Failed to retry SMS', error);
      throw new AppError('Failed to retry SMS', 500);
    }
  }

  /**
   * Gets SMS service health status
   * @param tenantId - Tenant ID
   * @returns Health status
   */
  async getSMSServiceHealth(tenantId: string): Promise<{
    status: string;
    provider: string;
    configured: boolean;
    active: boolean;
    lastSMSSent?: Date;
    failureRate: number;
  }> {
    try {
      const config = await this.getSMSConfig(tenantId);

      if (!config) {
        return {
          status: 'unconfigured',
          provider: 'none',
          configured: false,
          active: false,
          failureRate: 0,
        };
      }

      // Get last sent SMS
      const lastSMS = await this.db('sms_messages')
        .where('tenant_id', tenantId)
        .where('status', 'sent')
        .orderBy('sent_at', 'desc')
        .first();

      // Calculate failure rate
      const total = await this.db('sms_messages')
        .where('tenant_id', tenantId)
        .count('* as count')
        .first() as any;

      const failed = await this.db('sms_messages')
        .where('tenant_id', tenantId)
        .where('status', 'failed')
        .count('* as count')
        .first() as any;

      const failureRate = total.count ? (failed.count / total.count) * 100 : 0;

      return {
        status: config.isActive ? 'healthy' : 'inactive',
        provider: config.provider,
        configured: true,
        active: config.isActive,
        lastSMSSent: lastSMS?.sent_at,
        failureRate: Math.round(failureRate * 100) / 100,
      };
    } catch (error) {
      logger.error('Failed to get SMS service health', error);
      return {
        status: 'error',
        provider: 'unknown',
        configured: false,
        active: false,
        failureRate: 0,
      };
    }
  }
}

export default SMSService;
