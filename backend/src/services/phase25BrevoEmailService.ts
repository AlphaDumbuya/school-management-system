import { logger } from '@utils/logger';
import axios, { AxiosInstance } from 'axios';

/**
 * Interface for email configuration
 */
export interface EmailConfig {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: string;
}

/**
 * Interface for email template data
 */
export interface EmailTemplateData {
  templateId: number;
  params: Record<string, string>;
  to: string;
  replyTo?: string;
}

/**
 * Interface for bulk email request
 */
export interface BulkEmailRequest {
  messageVersions: Array<{
    to: string;
    params?: Record<string, string>;
  }>;
  templateId: number;
  replyTo?: string;
}

/**
 * Interface for email response
 */
export interface EmailResponse {
  messageId: string;
  timestamp: Date;
  status: 'sent' | 'failed';
  error?: string;
}

/**
 * Interface for email tracking
 */
export interface EmailTracking {
  id: string;
  messageId: string;
  email: string;
  subject: string;
  templateId?: number;
  status: 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'bounced';
  sentAt: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  failureReason?: string;
}

/**
 * Brevo Email Service
 * 
 * Handles email sending through Brevo (formerly Sendinblue) service.
 * Supports both transactional and template-based emails with retry logic,
 * rate limiting, and comprehensive logging.
 * 
 * @class BrevoEmailService
 * @example
 * const service = new BrevoEmailService();
 * const result = await service.sendEmail({
 *   to: 'student@example.com',
 *   subject: 'Grade Notification',
 *   htmlContent: '<h1>Your grades are ready</h1>'
 * });
 */
export class BrevoEmailService {
  private client: AxiosInstance;
  private apiKey: string;
  private senderEmail: string;
  private senderName: string;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second
  private rateLimitDelay: number = 100; // 100ms between requests

  /**
   * Initialize Brevo Email Service
   */
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY || '';
    this.senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@school.com';
    this.senderName = process.env.BREVO_SENDER_NAME || 'School Management System';

    if (!this.apiKey) {
      logger.error('BREVO_API_KEY is not configured in environment variables');
      throw new Error('BREVO_API_KEY is required to initialize BrevoEmailService');
    }

    this.client = axios.create({
      baseURL: 'https://api.brevo.com/v3',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    logger.info('BrevoEmailService initialized successfully');
  }

  /**
   * Send a simple email with HTML content
   * 
   * @param config - Email configuration
   * @returns Email response with message ID
   */
  async sendEmail(config: EmailConfig): Promise<EmailResponse> {
    try {
      this.validateEmailConfig(config);

      const payload = {
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: config.to }],
        subject: config.subject,
        htmlContent: config.htmlContent,
        textContent: config.textContent || this.stripHtml(config.htmlContent),
        replyTo: config.replyTo ? { email: config.replyTo } : undefined,
      };

      const response = await this.executeWithRetry(() =>
        this.client.post('/smtp/email', payload)
      );

      logger.info(`Email sent successfully to ${config.to}`, {
        messageId: response.data.messageId,
        subject: config.subject,
      });

      return {
        messageId: response.data.messageId,
        timestamp: new Date(),
        status: 'sent',
      };
    } catch (error) {
      logger.error('Failed to send email', {
        email: config.to,
        subject: config.subject,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        messageId: '',
        timestamp: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send an email using a pre-defined Brevo template
   * 
   * @param templateData - Template configuration and data
   * @returns Email response with message ID
   */
  async sendEmailWithTemplate(templateData: EmailTemplateData): Promise<EmailResponse> {
    try {
      if (!templateData.templateId || templateData.templateId <= 0) {
        throw new Error('Valid templateId is required');
      }

      if (!templateData.to) {
        throw new Error('Recipient email is required');
      }

      const payload = {
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        to: [{ email: templateData.to }],
        templateId: templateData.templateId,
        params: templateData.params || {},
        replyTo: templateData.replyTo ? { email: templateData.replyTo } : undefined,
      };

      const response = await this.executeWithRetry(() =>
        this.client.post('/smtp/email', payload)
      );

      logger.info(`Template email sent successfully to ${templateData.to}`, {
        messageId: response.data.messageId,
        templateId: templateData.templateId,
      });

      return {
        messageId: response.data.messageId,
        timestamp: new Date(),
        status: 'sent',
      };
    } catch (error) {
      logger.error('Failed to send template email', {
        email: templateData.to,
        templateId: templateData.templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        messageId: '',
        timestamp: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send bulk emails to multiple recipients
   * 
   * @param request - Bulk email request with multiple recipients
   * @returns Array of email responses
   */
  async sendBulkEmail(request: BulkEmailRequest): Promise<EmailResponse[]> {
    const results: EmailResponse[] = [];

    try {
      if (!request.templateId || request.templateId <= 0) {
        throw new Error('Valid templateId is required for bulk emails');
      }

      if (!request.messageVersions || request.messageVersions.length === 0) {
        throw new Error('At least one recipient is required');
      }

      const payload = {
        sender: {
          name: this.senderName,
          email: this.senderEmail,
        },
        messageVersions: request.messageVersions,
        templateId: request.templateId,
        replyTo: request.replyTo ? { email: request.replyTo } : undefined,
      };

      const response = await this.executeWithRetry(() =>
        this.client.post('/smtp/email', payload)
      );

      logger.info(`Bulk emails sent successfully`, {
        messageId: response.data.messageId,
        templateId: request.templateId,
        recipientCount: request.messageVersions.length,
      });

      // Create response for each recipient
      request.messageVersions.forEach((version) => {
        results.push({
          messageId: response.data.messageId,
          timestamp: new Date(),
          status: 'sent',
        });
      });

      return results;
    } catch (error) {
      logger.error('Failed to send bulk emails', {
        templateId: request.templateId,
        recipientCount: request.messageVersions?.length || 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return failed responses for all recipients
      return request.messageVersions.map(() => ({
        messageId: '',
        timestamp: new Date(),
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }

  /**
   * Get email send/delivery statistics
   * 
   * @returns Email statistics
   */
  async getEmailStatistics(): Promise<Record<string, any>> {
    try {
      const response = await this.executeWithRetry(() =>
        this.client.get('/smtp/statistics')
      );

      logger.info('Retrieved email statistics', {
        stats: response.data,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to retrieve email statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get list of email campaigns
   * 
   * @returns Array of campaign information
   */
  async getCampaigns(): Promise<any[]> {
    try {
      const response = await this.executeWithRetry(() =>
        this.client.get('/emailCampaigns')
      );

      logger.info('Retrieved email campaigns', {
        campaignCount: response.data.campaigns?.length || 0,
      });

      return response.data.campaigns || [];
    } catch (error) {
      logger.error('Failed to retrieve email campaigns', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get Brevo account information
   * Verifies API key validity and returns account details
   * 
   * @returns Account information including email, firstName, lastName, etc.
   */
  async getAccountInfo(): Promise<Record<string, any>> {
    try {
      const response = await this.executeWithRetry(() =>
        this.client.get('/account')
      );

      logger.info('Retrieved Brevo account information', {
        email: response.data.email,
        firstName: response.data.firstName,
        lastName: response.data.lastName,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to retrieve Brevo account information', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Add a contact to an email list
   * 
   * @param email - Email address
   * @param listId - List ID to add to
   * @param attributes - Additional contact attributes
   */
  async addContactToList(
    email: string,
    listId: number,
    attributes?: Record<string, any>
  ): Promise<void> {
    try {
      const payload = {
        email: email,
        attributes: attributes || {},
      };

      await this.executeWithRetry(() =>
        this.client.post(`/contacts/lists/${listId}/contacts/add`, {
          emails: [email],
        })
      );

      logger.info(`Contact added to list`, {
        email,
        listId,
      });
    } catch (error) {
      logger.error('Failed to add contact to list', {
        email,
        listId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Remove a contact from an email list
   * 
   * @param email - Email address
   * @param listId - List ID to remove from
   */
  async removeContactFromList(email: string, listId: number): Promise<void> {
    try {
      await this.executeWithRetry(() =>
        this.client.post(`/contacts/lists/${listId}/contacts/remove`, {
          emails: [email],
        })
      );

      logger.info(`Contact removed from list`, {
        email,
        listId,
      });
    } catch (error) {
      logger.error('Failed to remove contact from list', {
        email,
        listId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update contact information
   * 
   * @param email - Email address
   * @param attributes - Contact attributes to update
   */
  async updateContact(email: string, attributes: Record<string, any>): Promise<void> {
    try {
      const payload = {
        attributes: {
          ...attributes,
          EMAIL: email,
        },
      };

      await this.executeWithRetry(() =>
        this.client.post(`/contacts`, payload)
      );

      logger.info(`Contact updated`, {
        email,
      });
    } catch (error) {
      logger.error('Failed to update contact', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get contact information
   * 
   * @param email - Email address
   * @returns Contact information
   */
  async getContact(email: string): Promise<Record<string, any>> {
    try {
      const response = await this.executeWithRetry(() =>
        this.client.get(`/contacts/${email}`)
      );

      logger.info(`Retrieved contact information`, {
        email,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to retrieve contact information', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Verify email address format and validity
   * 
   * @param email - Email address to verify
   * @returns True if valid
   */
  verifyEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Execute API call with retry logic
   * 
   * @param fn - Function to execute
   * @returns Response data
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Add rate limiting delay between requests
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }

        await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));

        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          throw error;
        }

        logger.warn(`API call failed, retrying (attempt ${attempt + 1}/${this.maxRetries})`, {
          error: lastError.message,
        });
      }
    }

    throw lastError || new Error('API call failed after retries');
  }

  /**
   * Check if error is retryable
   * 
   * @param error - Error to check
   * @returns True if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Retry on network errors and 5xx server errors
    const message = error.message.toLowerCase();
    return (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('timeout') ||
      message.includes('5')
    );
  }

  /**
   * Validate email configuration
   * 
   * @param config - Email configuration
   */
  private validateEmailConfig(config: EmailConfig): void {
    if (!config.to || !this.verifyEmailFormat(config.to)) {
      throw new Error(`Invalid recipient email: ${config.to}`);
    }

    if (!config.subject || config.subject.trim().length === 0) {
      throw new Error('Email subject is required');
    }

    if (!config.htmlContent || config.htmlContent.trim().length === 0) {
      throw new Error('Email HTML content is required');
    }
  }

  /**
   * Strip HTML tags from content to create plain text version
   * 
   * @param html - HTML content
   * @returns Plain text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  }
}

// Export singleton instance
export default new BrevoEmailService();
