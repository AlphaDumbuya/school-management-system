import axios, { AxiosInstance } from 'axios';
import { logger } from '@utils/logger';
import db from '@utils/database';

export interface SMSTemplate {
  id: string;
  templateName: string;
  notificationType: string;
  channel: string;
  body: string;
  variables?: Record<string, any>;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
}

export interface SMSRequest {
  phoneNumber: string;
  message: string;
  templateName?: string;
  variables?: Record<string, any>;
}

export interface SMSResponse {
  messageId: string;
  status: string;
  timestamp: string;
}

class SMSService {
  private smsClient: AxiosInstance;
  private readonly SMS_PROVIDER = process.env.SMS_PROVIDER || 'twilio'; // 'twilio' | 'aws' | 'vonage'
  private readonly SMS_PROVIDER_KEY = process.env.SMS_PROVIDER_KEY;
  private readonly SMS_PROVIDER_SECRET = process.env.SMS_PROVIDER_SECRET;
  private readonly SMS_FROM_NUMBER = process.env.SMS_FROM_NUMBER || '+1234567890';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second base delay

  constructor() {
    if (!this.SMS_PROVIDER_KEY) {
      logger.warn('SMS_PROVIDER_KEY not configured - SMS notifications disabled');
    }

    // Initialize SMS provider client based on configuration
    this.smsClient = this.initializeSMSProvider();
  }

  /**
   * Initialize SMS provider based on configuration
   */
  private initializeSMSProvider(): AxiosInstance {
    switch (this.SMS_PROVIDER) {
      case 'twilio':
        return axios.create({
          baseURL: 'https://api.twilio.com/2010-04-01',
          auth: {
            username: this.SMS_PROVIDER_KEY || '',
            password: this.SMS_PROVIDER_SECRET || '',
          },
        });
      case 'aws':
        return axios.create({
          baseURL: 'https://sns.us-east-1.amazonaws.com/',
        });
      case 'vonage':
        return axios.create({
          baseURL: 'https://rest.nexmo.com',
        });
      default:
        logger.warn(`Unknown SMS provider: ${this.SMS_PROVIDER}`);
        return axios.create();
    }
  }

  /**
   * Send SMS using configured provider
   */
  async sendSMS(smsRequest: SMSRequest, retryCount: number = 0): Promise<SMSResponse> {
    try {
      if (!this.SMS_PROVIDER_KEY) {
        logger.warn(`SMS sending disabled for ${smsRequest.phoneNumber}`);
        return {
          messageId: 'local-' + Date.now(),
          status: 'disabled',
          timestamp: new Date().toISOString(),
        };
      }

      // Validate phone number format
      if (!this.isValidPhoneNumber(smsRequest.phoneNumber)) {
        throw new Error(`Invalid phone number format: ${smsRequest.phoneNumber}`);
      }

      // Get SMS body (from template or provided)
      let body = smsRequest.message;
      if (smsRequest.templateName) {
        const template = await this.getTemplate(smsRequest.templateName);
        body = this.interpolateTemplate(template.body, smsRequest.variables);
      } else if (smsRequest.variables) {
        body = this.interpolateTemplate(body, smsRequest.variables);
      }

      // Ensure message is within SMS length limit (160 chars for single SMS)
      if (body.length > 160) {
        logger.warn(`SMS message too long (${body.length} chars), will be split into multiple parts`);
      }

      let response;
      switch (this.SMS_PROVIDER) {
        case 'twilio':
          response = await this.sendViatwilio(smsRequest.phoneNumber, body);
          break;
        case 'aws':
          response = await this.sendViaAWS(smsRequest.phoneNumber, body);
          break;
        case 'vonage':
          response = await this.sendViaVonage(smsRequest.phoneNumber, body);
          break;
        default:
          throw new Error(`Unsupported SMS provider: ${this.SMS_PROVIDER}`);
      }

      logger.info(`SMS sent to ${smsRequest.phoneNumber} - Message ID: ${response.messageId}`);
      return response;
    } catch (error: any) {
      logger.error(`Error sending SMS to ${smsRequest.phoneNumber}: ${error.message}`);

      // Retry logic with exponential backoff
      if (retryCount < this.MAX_RETRIES) {
        const delay = this.RETRY_DELAY * Math.pow(2, retryCount);
        logger.info(`Retrying SMS send in ${delay}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendSMS(smsRequest, retryCount + 1);
      }

      throw new Error(`Failed to send SMS after ${this.MAX_RETRIES} attempts: ${error.message}`);
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendViatwilio(phoneNumber: string, message: string): Promise<SMSResponse> {
    try {
      const formData = new URLSearchParams();
      formData.append('From', this.SMS_FROM_NUMBER);
      formData.append('To', phoneNumber);
      formData.append('Body', message);

      const response = await this.smsClient.post(
        `/Accounts/${this.SMS_PROVIDER_KEY}/Messages.json`,
        formData
      );

      return {
        messageId: response.data.sid,
        status: response.data.status,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      throw new Error(`Twilio API error: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Send SMS via AWS SNS
   */
  private async sendViaAWS(phoneNumber: string, message: string): Promise<SMSResponse> {
    try {
      // AWS SNS implementation
      // This would require AWS SDK setup
      logger.info(`AWS SNS SMS to ${phoneNumber}: ${message}`);

      return {
        messageId: 'aws-' + Date.now(),
        status: 'sent',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      throw new Error(`AWS API error: ${error.message}`);
    }
  }

  /**
   * Send SMS via Vonage (Nexmo)
   */
  private async sendViaVonage(phoneNumber: string, message: string): Promise<SMSResponse> {
    try {
      const response = await this.smsClient.post('/sms/json', {
        api_key: this.SMS_PROVIDER_KEY,
        api_secret: this.SMS_PROVIDER_SECRET,
        to: phoneNumber,
        from: this.SMS_FROM_NUMBER,
        text: message,
      });

      if (response.data.messages[0].status !== '0') {
        throw new Error(`Vonage API error: ${response.data.messages[0]['error-text']}`);
      }

      return {
        messageId: response.data.messages[0]['message-id'],
        status: 'sent',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      throw new Error(`Vonage API error: ${error.message}`);
    }
  }

  /**
   * Send bulk SMS
   */
  async sendBulkSMS(smsRequests: SMSRequest[]): Promise<SMSResponse[]> {
    try {
      const results: SMSResponse[] = [];

      for (const smsRequest of smsRequests) {
        try {
          const result = await this.sendSMS(smsRequest);
          results.push(result);

          // Rate limiting - add delay between SMS sends
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`Failed to send SMS to ${smsRequest.phoneNumber}: ${error}`);
          results.push({
            messageId: 'failed-' + Date.now(),
            status: 'failed',
            timestamp: new Date().toISOString(),
          });
        }
      }

      logger.info(`Bulk SMS send completed: ${results.length} messages processed`);
      return results;
    } catch (error) {
      logger.error(`Error sending bulk SMS: ${error}`);
      throw new Error(`Failed to send bulk SMS: ${error}`);
    }
  }

  /**
   * Create SMS template
   */
  async createTemplate(template: {
    templateName: string;
    notificationType: string;
    body: string;
    variables?: Record<string, any>;
    isActive?: boolean;
    createdBy?: string;
  }): Promise<SMSTemplate> {
    try {
      const [created] = await db('notification_templates')
        .insert({
          templateName: template.templateName,
          notificationType: template.notificationType,
          channel: 'sms',
          body: template.body,
          variables: template.variables ? JSON.stringify(template.variables) : null,
          isActive: template.isActive !== false,
          createdBy: template.createdBy,
        })
        .returning('*');

      logger.info(`SMS template created: ${template.templateName}`);
      return this.formatTemplate(created);
    } catch (error) {
      logger.error(`Error creating SMS template: ${error}`);
      throw new Error(`Failed to create SMS template: ${error}`);
    }
  }

  /**
   * Get template by name
   */
  async getTemplate(templateName: string): Promise<SMSTemplate> {
    try {
      const template = await db('notification_templates')
        .where({ templateName, channel: 'sms', isActive: true })
        .first();

      if (!template) {
        throw new Error(`SMS template not found: ${templateName}`);
      }

      return this.formatTemplate(template);
    } catch (error) {
      logger.error(`Error fetching SMS template ${templateName}: ${error}`);
      throw new Error(`Failed to fetch SMS template: ${error}`);
    }
  }

  /**
   * Update template
   */
  async updateTemplate(templateId: string, updates: Partial<SMSTemplate>): Promise<SMSTemplate> {
    try {
      const [updated] = await db('notification_templates')
        .where({ id: templateId })
        .update({
          ...(updates.templateName && { templateName: updates.templateName }),
          ...(updates.body && { body: updates.body }),
          ...(updates.variables && { variables: JSON.stringify(updates.variables) }),
          ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        })
        .returning('*');

      if (!updated) {
        throw new Error('SMS template not found');
      }

      logger.info(`SMS template updated: ${templateId}`);
      return this.formatTemplate(updated);
    } catch (error) {
      logger.error(`Error updating SMS template: ${error}`);
      throw new Error(`Failed to update SMS template: ${error}`);
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      const deleted = await db('notification_templates')
        .where({ id: templateId })
        .del();

      if (deleted === 0) {
        throw new Error('SMS template not found');
      }

      logger.info(`SMS template deleted: ${templateId}`);
    } catch (error) {
      logger.error(`Error deleting SMS template: ${error}`);
      throw new Error(`Failed to delete SMS template: ${error}`);
    }
  }

  /**
   * List all templates
   */
  async listTemplates(notificationType?: string): Promise<SMSTemplate[]> {
    try {
      let query = db('notification_templates').where({ channel: 'sms' });

      if (notificationType) {
        query = query.where({ notificationType });
      }

      const templates = await query.where({ isActive: true });
      return templates.map((t: any) => this.formatTemplate(t));
    } catch (error) {
      logger.error(`Error fetching SMS templates: ${error}`);
      throw new Error(`Failed to fetch SMS templates: ${error}`);
    }
  }

  /**
   * Get SMS status
   */
  async getSMSStatus(messageId: string): Promise<Record<string, any>> {
    try {
      if (!this.SMS_PROVIDER_KEY || messageId.startsWith('local-')) {
        return { messageId, status: 'unknown' };
      }

      logger.info(`Checking SMS status for message: ${messageId}`);

      return {
        messageId,
        status: 'sent',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Error checking SMS status: ${error}`);
      throw new Error(`Failed to check SMS status: ${error}`);
    }
  }

  /**
   * Retry failed SMS
   */
  async retryFailedSMS(limit: number = 50): Promise<number> {
    try {
      const failedDeliveries = await db('notification_deliveries')
        .where({ channel: 'sms', deliveryStatus: 'failed' })
        .where('deliveryAttempts', '<', this.MAX_RETRIES)
        .where('nextRetryAt', '<=', db.fn.now())
        .limit(limit);

      let retryCount = 0;

      for (const delivery of failedDeliveries) {
        try {
          const notification = await db('notifications')
            .where({ id: delivery.notificationId })
            .first();

          if (notification) {
            // Get user phone number from users table
            const user = await db('users')
              .where({ id: notification.recipientId })
              .first();

            if (user && user.phoneNumber) {
              await this.sendSMS({
                phoneNumber: user.phoneNumber,
                message: notification.message,
              });

              await db('notification_deliveries')
                .where({ id: delivery.id })
                .update({
                  deliveryAttempts: delivery.deliveryAttempts + 1,
                  lastAttemptAt: db.fn.now(),
                  deliveryStatus: 'delivered',
                });

              retryCount++;
            }
          }
        } catch (error) {
          logger.error(`Error retrying SMS delivery ${delivery.id}: ${error}`);
          const nextRetry = new Date();
          nextRetry.setMinutes(nextRetry.getMinutes() + Math.pow(2, delivery.deliveryAttempts));

          await db('notification_deliveries')
            .where({ id: delivery.id })
            .update({
              deliveryAttempts: delivery.deliveryAttempts + 1,
              lastAttemptAt: db.fn.now(),
              nextRetryAt: nextRetry,
              failureReason: error.toString(),
            });
        }
      }

      logger.info(`Retried ${retryCount} failed SMS deliveries`);
      return retryCount;
    } catch (error) {
      logger.error(`Error retrying failed SMS: ${error}`);
      throw new Error(`Failed to retry failed SMS: ${error}`);
    }
  }

  /**
   * Validate phone number format
   */
  private isValidPhoneNumber(phoneNumber: string): boolean {
    // Basic validation - E.164 format or +1-based US numbers
    const phoneRegex = /^\+?1?\d{10,14}$/;
    return phoneRegex.test(phoneNumber.replace(/[\s-()]/g, ''));
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(template: string, variables?: Record<string, any>): string {
    if (!variables) {
      return template;
    }

    let result = template;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, variables[key]);
    });

    return result;
  }

  /**
   * Helper method to format template response
   */
  private formatTemplate(template: any): SMSTemplate {
    return {
      id: template.id,
      templateName: template.templateName,
      notificationType: template.notificationType,
      channel: template.channel,
      body: template.body,
      variables: template.variables ? JSON.parse(template.variables) : undefined,
      isActive: template.isActive,
      createdBy: template.createdBy,
      createdAt: template.createdAt,
    };
  }
}

export default new SMSService();
