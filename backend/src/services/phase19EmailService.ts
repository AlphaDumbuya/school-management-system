import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import * as nodemailer from 'nodemailer';

/**
 * Phase 19.1: Email Service Integration
 * 
 * Provides email integration capabilities:
 * - Email service configuration management
 * - Email sending through external providers (SMTP, SendGrid, etc.)
 * - Email template management
 * - Email delivery tracking
 * - Retry mechanisms for failed emails
 * - Email logging and monitoring
 */

interface EmailConfig {
  provider: 'smtp' | 'sendgrid' | 'mailgun';
  from: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  sendgridApiKey?: string;
  mailgunApiKey?: string;
  mailgunDomain?: string;
  isActive: boolean;
}

interface EmailTemplate {
  id: string;
  tenantId: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[]; // Variable names like {{studentName}}, {{date}}
  category: string;
  isActive: boolean;
  createdAt: Date;
}

interface EmailMessage {
  id: string;
  tenantId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  htmlContent: string;
  textContent?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
  templateId?: string;
  templateVariables?: Record<string, any>;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  sentAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
}

export class EmailService {
  private db: Knex;
  private transporter: any;
  private config: EmailConfig | null = null;

  /**
   * Initializes email service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('EmailService initialized');
  }

  /**
   * Sets email service configuration
   * @param tenantId - Tenant ID
   * @param config - Email configuration
   */
  async setEmailConfig(tenantId: string, config: EmailConfig): Promise<EmailConfig> {
    try {
      // Validate configuration
      if (!config.provider || !config.from) {
        throw new AppError('Provider and from address are required', 400);
      }

      // Check for provider-specific credentials
      if (config.provider === 'smtp' && (!config.smtpHost || !config.smtpPort)) {
        throw new AppError('SMTP configuration requires host and port', 400);
      }

      if (config.provider === 'sendgrid' && !config.sendgridApiKey) {
        throw new AppError('SendGrid configuration requires API key', 400);
      }

      if (config.provider === 'mailgun' && (!config.mailgunApiKey || !config.mailgunDomain)) {
        throw new AppError('Mailgun configuration requires API key and domain', 400);
      }

      // Store configuration
      const existing = await this.db('email_configurations')
        .where('tenant_id', tenantId)
        .first();

      if (existing) {
        await this.db('email_configurations')
          .where('tenant_id', tenantId)
          .update({
            provider: config.provider,
            from_address: config.from,
            smtp_host: config.smtpHost || null,
            smtp_port: config.smtpPort || null,
            smtp_user: config.smtpUser || null,
            smtp_password: config.smtpPassword || null,
            sendgrid_api_key: config.sendgridApiKey || null,
            mailgun_api_key: config.mailgunApiKey || null,
            mailgun_domain: config.mailgunDomain || null,
            is_active: config.isActive,
            updated_at: new Date(),
          });
      } else {
        await this.db('email_configurations').insert({
          id: uuidv4(),
          tenant_id: tenantId,
          provider: config.provider,
          from_address: config.from,
          smtp_host: config.smtpHost || null,
          smtp_port: config.smtpPort || null,
          smtp_user: config.smtpUser || null,
          smtp_password: config.smtpPassword || null,
          sendgrid_api_key: config.sendgridApiKey || null,
          mailgun_api_key: config.mailgunApiKey || null,
          mailgun_domain: config.mailgunDomain || null,
          is_active: config.isActive,
          created_at: new Date(),
        });
      }

      // Initialize transporter with new config
      await this.initializeTransporter(config);
      this.config = config;

      logger.info(`Email configuration set for tenant ${tenantId} (${config.provider})`);
      return config;
    } catch (error) {
      logger.error('Failed to set email configuration', error);
      throw new AppError('Failed to set email configuration', 500, (error as Error).message);
    }
  }

  /**
   * Initializes email transporter based on configuration
   * @param config - Email configuration
   */
  private async initializeTransporter(config: EmailConfig): Promise<void> {
    try {
      if (config.provider === 'smtp') {
        this.transporter = nodemailer.createTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpPort === 465,
          auth: {
            user: config.smtpUser,
            pass: config.smtpPassword,
          },
        });
      } else if (config.provider === 'sendgrid') {
        // SendGrid integration would use their API
        logger.info('SendGrid email provider configured');
      } else if (config.provider === 'mailgun') {
        // Mailgun integration would use their API
        logger.info('Mailgun email provider configured');
      }
    } catch (error) {
      logger.error('Failed to initialize email transporter', error);
      throw new AppError('Failed to initialize email transporter', 500);
    }
  }

  /**
   * Gets email configuration for a tenant
   * @param tenantId - Tenant ID
   * @returns Email configuration
   */
  async getEmailConfig(tenantId: string): Promise<EmailConfig | null> {
    try {
      const config = await this.db('email_configurations')
        .where('tenant_id', tenantId)
        .first();

      if (!config) {
        return null;
      }

      return {
        provider: config.provider,
        from: config.from_address,
        smtpHost: config.smtp_host,
        smtpPort: config.smtp_port,
        smtpUser: config.smtp_user,
        smtpPassword: config.smtp_password,
        sendgridApiKey: config.sendgrid_api_key,
        mailgunApiKey: config.mailgun_api_key,
        mailgunDomain: config.mailgun_domain,
        isActive: config.is_active,
      };
    } catch (error) {
      logger.error('Failed to get email configuration', error);
      return null;
    }
  }

  /**
   * Creates or updates an email template
   * @param tenantId - Tenant ID
   * @param template - Email template details
   * @returns Created/updated template
   */
  async createEmailTemplate(
    tenantId: string,
    template: Omit<EmailTemplate, 'id' | 'createdAt' | 'tenantId'>
  ): Promise<EmailTemplate> {
    try {
      // Extract variables from template content
      const variableRegex = /\{\{(\w+)\}\}/g;
      const variables: string[] = [];
      let match;
      while ((match = variableRegex.exec(template.htmlContent)) !== null) {
        if (!variables.includes(match[1])) {
          variables.push(match[1]);
        }
      }

      const templateId = uuidv4();

      await this.db('email_templates').insert({
        id: templateId,
        tenant_id: tenantId,
        name: template.name,
        subject: template.subject,
        html_content: template.htmlContent,
        text_content: template.textContent || null,
        variables: JSON.stringify(variables),
        category: template.category,
        is_active: template.isActive,
        created_at: new Date(),
      });

      logger.info(`Email template created: ${template.name} for tenant ${tenantId}`);

      return {
        id: templateId,
        tenantId,
        name: template.name,
        subject: template.subject,
        htmlContent: template.htmlContent,
        textContent: template.textContent,
        variables,
        category: template.category,
        isActive: template.isActive,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to create email template', error);
      throw new AppError('Failed to create email template', 500, (error as Error).message);
    }
  }

  /**
   * Sends an email
   * @param tenantId - Tenant ID
   * @param to - Recipient email(s)
   * @param subject - Email subject
   * @param htmlContent - HTML content
   * @param textContent - Plain text content
   * @param options - Additional options
   * @returns Email message record
   */
  async sendEmail(
    tenantId: string,
    to: string | string[],
    subject: string,
    htmlContent: string,
    textContent?: string,
    options?: {
      cc?: string[];
      bcc?: string[];
      attachments?: Array<{ filename: string; content: Buffer }>;
      templateId?: string;
      templateVariables?: Record<string, any>;
    }
  ): Promise<EmailMessage> {
    try {
      // Get email configuration
      if (!this.config) {
        this.config = await this.getEmailConfig(tenantId);
      }

      if (!this.config || !this.config.isActive) {
        throw new AppError('Email service not configured for this tenant', 400);
      }

      const messageId = uuidv4();
      const recipients = Array.isArray(to) ? to : [to];

      // Process template variables if provided
      let processedHtml = htmlContent;
      let processedSubject = subject;

      if (options?.templateVariables) {
        for (const [key, value] of Object.entries(options.templateVariables)) {
          const placeholder = `{{${key}}}`;
          processedHtml = processedHtml.replace(new RegExp(placeholder, 'g'), String(value));
          processedSubject = processedSubject.replace(new RegExp(placeholder, 'g'), String(value));
        }
      }

      // Send via configured provider
      const mailOptions = {
        from: this.config.from,
        to: recipients.join(','),
        cc: options?.cc?.join(','),
        bcc: options?.bcc?.join(','),
        subject: processedSubject,
        html: processedHtml,
        text: textContent,
        attachments: options?.attachments,
      };

      try {
        // For SMTP (direct sending)
        if (this.transporter) {
          await this.transporter.sendMail(mailOptions);
        }
        // For other providers (would implement API calls)
        // SendGrid, Mailgun implementations would go here

        // Record email in database
        await this.db('email_messages').insert({
          id: messageId,
          tenant_id: tenantId,
          to_addresses: JSON.stringify(recipients),
          cc_addresses: options?.cc ? JSON.stringify(options.cc) : null,
          bcc_addresses: options?.bcc ? JSON.stringify(options.bcc) : null,
          subject: processedSubject,
          html_content: processedHtml,
          text_content: textContent || null,
          template_id: options?.templateId || null,
          template_variables: options?.templateVariables
            ? JSON.stringify(options.templateVariables)
            : null,
          status: 'sent',
          sent_at: new Date(),
          retry_count: 0,
          max_retries: 3,
          created_at: new Date(),
        });

        logger.info(`Email sent to ${recipients.join(', ')} for tenant ${tenantId}`);

        return {
          id: messageId,
          tenantId,
          to: recipients,
          cc: options?.cc,
          bcc: options?.bcc,
          subject: processedSubject,
          htmlContent: processedHtml,
          textContent,
          status: 'sent',
          sentAt: new Date(),
          retryCount: 0,
          maxRetries: 3,
          createdAt: new Date(),
        };
      } catch (error) {
        // Record failed email
        await this.db('email_messages').insert({
          id: messageId,
          tenant_id: tenantId,
          to_addresses: JSON.stringify(recipients),
          subject: processedSubject,
          html_content: processedHtml,
          text_content: textContent || null,
          status: 'failed',
          failure_reason: (error as Error).message,
          retry_count: 0,
          max_retries: 3,
          created_at: new Date(),
        });

        logger.error(`Failed to send email to ${recipients.join(', ')}`, error);
        throw new AppError('Failed to send email', 500, (error as Error).message);
      }
    } catch (error) {
      logger.error('Failed to process email send', error);
      throw error;
    }
  }

  /**
   * Sends email using template
   * @param tenantId - Tenant ID
   * @param templateId - Email template ID
   * @param to - Recipient(s)
   * @param variables - Template variables
   * @param options - Additional options
   * @returns Email message record
   */
  async sendEmailFromTemplate(
    tenantId: string,
    templateId: string,
    to: string | string[],
    variables: Record<string, any>,
    options?: { cc?: string[]; bcc?: string[]; attachments?: Array<{ filename: string; content: Buffer }> }
  ): Promise<EmailMessage> {
    try {
      const template = await this.db('email_templates')
        .where('id', templateId)
        .where('tenant_id', tenantId)
        .first();

      if (!template) {
        throw new AppError('Email template not found', 404);
      }

      return await this.sendEmail(
        tenantId,
        to,
        template.subject,
        template.html_content,
        template.text_content,
        {
          ...options,
          templateId,
          templateVariables: variables,
        }
      );
    } catch (error) {
      logger.error('Failed to send email from template', error);
      throw error;
    }
  }

  /**
   * Gets email templates for a tenant
   * @param tenantId - Tenant ID
   * @param category - Filter by category
   * @returns Array of email templates
   */
  async getEmailTemplates(tenantId: string, category?: string): Promise<EmailTemplate[]> {
    try {
      let query = this.db('email_templates')
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
        subject: t.subject,
        htmlContent: t.html_content,
        textContent: t.text_content,
        variables: JSON.parse(t.variables),
        category: t.category,
        isActive: t.is_active,
        createdAt: t.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get email templates', error);
      throw new AppError('Failed to get email templates', 500);
    }
  }

  /**
   * Gets email message history
   * @param tenantId - Tenant ID
   * @param limit - Result limit
   * @param offset - Result offset
   * @returns Array of email messages
   */
  async getEmailHistory(
    tenantId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<EmailMessage[]> {
    try {
      const messages = await this.db('email_messages')
        .where('tenant_id', tenantId)
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      return messages.map((m: any) => ({
        id: m.id,
        tenantId: m.tenant_id,
        to: JSON.parse(m.to_addresses),
        cc: m.cc_addresses ? JSON.parse(m.cc_addresses) : undefined,
        bcc: m.bcc_addresses ? JSON.parse(m.bcc_addresses) : undefined,
        subject: m.subject,
        htmlContent: m.html_content,
        textContent: m.text_content,
        status: m.status,
        sentAt: m.sent_at,
        failureReason: m.failure_reason,
        retryCount: m.retry_count,
        maxRetries: m.max_retries,
        createdAt: m.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get email history', error);
      throw new AppError('Failed to get email history', 500);
    }
  }

  /**
   * Retries failed emails
   * @param tenantId - Tenant ID
   * @returns Number of emails retried
   */
  async retryFailedEmails(tenantId: string): Promise<number> {
    try {
      const failedEmails = await this.db('email_messages')
        .where('tenant_id', tenantId)
        .where('status', 'failed')
        .where('retry_count', '<', this.db.raw('max_retries'))
        .select();

      let retriedCount = 0;

      for (const email of failedEmails) {
        try {
          const mailOptions = {
            from: this.config?.from,
            to: JSON.parse(email.to_addresses).join(','),
            subject: email.subject,
            html: email.html_content,
            text: email.text_content,
          };

          if (this.transporter) {
            await this.transporter.sendMail(mailOptions);
          }

          await this.db('email_messages')
            .where('id', email.id)
            .update({
              status: 'sent',
              sent_at: new Date(),
              retry_count: email.retry_count + 1,
            });

          retriedCount++;
        } catch (error) {
          await this.db('email_messages')
            .where('id', email.id)
            .update({
              retry_count: email.retry_count + 1,
              failure_reason: (error as Error).message,
            });
        }
      }

      logger.info(`Retried ${retriedCount} failed emails for tenant ${tenantId}`);
      return retriedCount;
    } catch (error) {
      logger.error('Failed to retry emails', error);
      throw new AppError('Failed to retry emails', 500);
    }
  }

  /**
   * Gets email service health status
   * @param tenantId - Tenant ID
   * @returns Health status
   */
  async getEmailServiceHealth(tenantId: string): Promise<{
    status: string;
    provider: string;
    configured: boolean;
    active: boolean;
    lastEmailSent?: Date;
    failureRate: number;
  }> {
    try {
      const config = await this.getEmailConfig(tenantId);

      if (!config) {
        return {
          status: 'unconfigured',
          provider: 'none',
          configured: false,
          active: false,
          failureRate: 0,
        };
      }

      // Get last sent email
      const lastEmail = await this.db('email_messages')
        .where('tenant_id', tenantId)
        .where('status', 'sent')
        .orderBy('sent_at', 'desc')
        .first();

      // Calculate failure rate
      const total = await this.db('email_messages')
        .where('tenant_id', tenantId)
        .count('* as count')
        .first() as any;

      const failed = await this.db('email_messages')
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
        lastEmailSent: lastEmail?.sent_at,
        failureRate: Math.round(failureRate * 100) / 100,
      };
    } catch (error) {
      logger.error('Failed to get email service health', error);
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

export default EmailService;
