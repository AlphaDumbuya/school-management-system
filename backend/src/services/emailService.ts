import axios, { AxiosInstance } from 'axios';
import { logger } from '@utils/logger';
import db from '@utils/database';

export interface EmailTemplate {
  id: string;
  templateName: string;
  notificationType: string;
  channel: string;
  subject: string;
  body: string;
  variables?: Record<string, any>;
  isActive: boolean;
  createdBy?: string;
  createdAt: string;
}

export interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  templateName?: string;
  variables?: Record<string, any>;
  isHtml?: boolean;
}

export interface EmailResponse {
  messageId: string;
  status: string;
  timestamp: string;
}

class EmailService {
  private brevoClient: AxiosInstance;
  private readonly BREVO_API_URL = 'https://api.brevo.com/v3';
  private readonly BREVO_API_KEY = process.env.BREVO_API_KEY;
  private readonly SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@schoolms.com';
  private readonly SENDER_NAME = process.env.BREVO_SENDER_NAME || 'School Management System';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second base delay

  constructor() {
    if (!this.BREVO_API_KEY) {
      logger.warn('BREVO_API_KEY not configured - email notifications disabled');
    }

    this.brevoClient = axios.create({
      baseURL: this.BREVO_API_URL,
      headers: {
        'api-key': this.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Send email using Brevo API
   */
  async sendEmail(emailRequest: EmailRequest, retryCount: number = 0): Promise<EmailResponse> {
    try {
      if (!this.BREVO_API_KEY) {
        logger.warn(`Email sending disabled for ${emailRequest.to}`);
        return {
          messageId: 'local-' + Date.now(),
          status: 'disabled',
          timestamp: new Date().toISOString(),
        };
      }

      // Get email body (from template or provided)
      let body = emailRequest.body;
      if (emailRequest.templateName) {
        const template = await this.getTemplate(emailRequest.templateName);
        body = this.interpolateTemplate(template.body, emailRequest.variables);
      } else if (emailRequest.variables) {
        body = this.interpolateTemplate(body, emailRequest.variables);
      }

      const payload = {
        sender: {
          email: this.SENDER_EMAIL,
          name: this.SENDER_NAME,
        },
        to: [
          {
            email: emailRequest.to,
          },
        ],
        subject: emailRequest.subject,
        htmlContent: emailRequest.isHtml !== false ? body : undefined,
        textContent: emailRequest.isHtml === true ? undefined : body,
      };

      const response = await this.brevoClient.post('/smtp/email', payload);

      logger.info(`Email sent to ${emailRequest.to} - Message ID: ${response.data.messageId}`);

      return {
        messageId: response.data.messageId,
        status: 'sent',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error(`Error sending email to ${emailRequest.to}: ${error.message}`);

      // Retry logic with exponential backoff
      if (retryCount < this.MAX_RETRIES) {
        const delay = this.RETRY_DELAY * Math.pow(2, retryCount);
        logger.info(`Retrying email send in ${delay}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.sendEmail(emailRequest, retryCount + 1);
      }

      throw new Error(`Failed to send email after ${this.MAX_RETRIES} attempts: ${error.message}`);
    }
  }

  /**
   * Send bulk emails
   */
  async sendBulkEmails(emailRequests: EmailRequest[]): Promise<EmailResponse[]> {
    try {
      const results: EmailResponse[] = [];
      
      for (const emailRequest of emailRequests) {
        try {
          const result = await this.sendEmail(emailRequest);
          results.push(result);
          
          // Rate limiting - add small delay between emails
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error(`Failed to send email to ${emailRequest.to}: ${error}`);
          results.push({
            messageId: 'failed-' + Date.now(),
            status: 'failed',
            timestamp: new Date().toISOString(),
          });
        }
      }

      logger.info(`Bulk email send completed: ${results.length} emails processed`);
      return results;
    } catch (error) {
      logger.error(`Error sending bulk emails: ${error}`);
      throw new Error(`Failed to send bulk emails: ${error}`);
    }
  }

  /**
   * Create email template
   */
  async createTemplate(template: {
    templateName: string;
    notificationType: string;
    subject: string;
    body: string;
    variables?: Record<string, any>;
    isActive?: boolean;
    createdBy?: string;
  }): Promise<EmailTemplate> {
    try {
      const [created] = await db('notification_templates')
        .insert({
          templateName: template.templateName,
          notificationType: template.notificationType,
          channel: 'email',
          subject: template.subject,
          body: template.body,
          variables: template.variables ? JSON.stringify(template.variables) : null,
          isActive: template.isActive !== false,
          createdBy: template.createdBy,
        })
        .returning('*');

      logger.info(`Email template created: ${template.templateName}`);
      return this.formatTemplate(created);
    } catch (error) {
      logger.error(`Error creating email template: ${error}`);
      throw new Error(`Failed to create email template: ${error}`);
    }
  }

  /**
   * Get template by name
   */
  async getTemplate(templateName: string): Promise<EmailTemplate> {
    try {
      const template = await db('notification_templates')
        .where({ templateName, channel: 'email', isActive: true })
        .first();

      if (!template) {
        throw new Error(`Template not found: ${templateName}`);
      }

      return this.formatTemplate(template);
    } catch (error) {
      logger.error(`Error fetching template ${templateName}: ${error}`);
      throw new Error(`Failed to fetch template: ${error}`);
    }
  }

  /**
   * Update template
   */
  async updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    try {
      const [updated] = await db('notification_templates')
        .where({ id: templateId })
        .update({
          ...(updates.templateName && { templateName: updates.templateName }),
          ...(updates.subject && { subject: updates.subject }),
          ...(updates.body && { body: updates.body }),
          ...(updates.variables && { variables: JSON.stringify(updates.variables) }),
          ...(updates.isActive !== undefined && { isActive: updates.isActive }),
        })
        .returning('*');

      if (!updated) {
        throw new Error('Template not found');
      }

      logger.info(`Email template updated: ${templateId}`);
      return this.formatTemplate(updated);
    } catch (error) {
      logger.error(`Error updating email template: ${error}`);
      throw new Error(`Failed to update email template: ${error}`);
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
        throw new Error('Template not found');
      }

      logger.info(`Email template deleted: ${templateId}`);
    } catch (error) {
      logger.error(`Error deleting email template: ${error}`);
      throw new Error(`Failed to delete email template: ${error}`);
    }
  }

  /**
   * List all templates
   */
  async listTemplates(notificationType?: string): Promise<EmailTemplate[]> {
    try {
      let query = db('notification_templates').where({ channel: 'email' });
      
      if (notificationType) {
        query = query.where({ notificationType });
      }

      const templates = await query.where({ isActive: true });
      return templates.map(t => this.formatTemplate(t));
    } catch (error) {
      logger.error(`Error fetching email templates: ${error}`);
      throw new Error(`Failed to fetch email templates: ${error}`);
    }
  }

  /**
   * Get email status
   */
  async getEmailStatus(messageId: string): Promise<Record<string, any>> {
    try {
      if (!this.BREVO_API_KEY || messageId.startsWith('local-')) {
        return { messageId, status: 'unknown' };
      }

      // This would require Brevo's message status API
      // For now, return a basic response
      logger.info(`Checking email status for message: ${messageId}`);
      
      return {
        messageId,
        status: 'sent',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Error checking email status: ${error}`);
      throw new Error(`Failed to check email status: ${error}`);
    }
  }

  /**
   * Retry failed emails
   */
  async retryFailedEmails(limit: number = 50): Promise<number> {
    try {
      const failedDeliveries = await db('notification_deliveries')
        .where({ channel: 'email', deliveryStatus: 'failed' })
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
            await this.sendEmail({
              to: notification.recipientId, // This would need to be mapped to actual email
              subject: notification.subject || 'Notification',
              body: notification.message,
            });

            await db('notification_deliveries')
              .where({ id: delivery.id })
              .update({
                deliveryAttempts: delivery.deliveryAttempts + 1,
                lastAttemptAt: db.fn.now(),
                deliveryStatus: 'sent',
              });

            retryCount++;
          }
        } catch (error) {
          logger.error(`Error retrying delivery ${delivery.id}: ${error}`);
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

      logger.info(`Retried ${retryCount} failed email deliveries`);
      return retryCount;
    } catch (error) {
      logger.error(`Error retrying failed emails: ${error}`);
      throw new Error(`Failed to retry failed emails: ${error}`);
    }
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
  private formatTemplate(template: any): EmailTemplate {
    return {
      id: template.id,
      templateName: template.templateName,
      notificationType: template.notificationType,
      channel: template.channel,
      subject: template.subject,
      body: template.body,
      variables: template.variables ? JSON.parse(template.variables) : undefined,
      isActive: template.isActive,
      createdBy: template.createdBy,
      createdAt: template.createdAt,
    };
  }
}

// ── Contact Form Specific Functions ──────────────────────────────────────────

/**
 * Send contact form submission notification to WiSkul team
 */
export async function sendContactEmail(data: {
  name: string;
  email: string;
  phone: string;
  school: string;
  role: string;
  message: string;
}): Promise<EmailResponse> {
  const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .field { margin-bottom: 20px; }
    .label { font-weight: bold; color: #00d4aa; margin-bottom: 5px; }
    .value { background: white; padding: 12px; border-radius: 6px; border-left: 3px solid #00d4aa; }
    .message { background: white; padding: 15px; border-radius: 6px; border-left: 3px solid #7c3aed; white-space: pre-wrap; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 24px;">🎓 New Contact Form Submission</h1>
      <p style="margin: 10px 0 0 0; opacity: 0.9;">WiSkul Contact Request</p>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Name:</div>
        <div class="value">${data.name}</div>
      </div>
      <div class="field">
        <div class="label">Email:</div>
        <div class="value"><a href="mailto:${data.email}" style="color: #00d4aa; text-decoration: none;">${data.email}</a></div>
      </div>
      <div class="field">
        <div class="label">Phone:</div>
        <div class="value">${data.phone}</div>
      </div>
      <div class="field">
        <div class="label">School:</div>
        <div class="value">${data.school}</div>
      </div>
      <div class="field">
        <div class="label">Role:</div>
        <div class="value">${data.role}</div>
      </div>
      <div class="field">
        <div class="label">Message:</div>
        <div class="message">${data.message}</div>
      </div>
      <div style="margin-top: 30px; padding: 15px; background: linear-gradient(135deg, #00d4aa15, #7c3aed15); border-radius: 6px; text-align: center;">
        <p style="margin: 0; color: #666; font-size: 13px;">⚡ Please respond within 24 hours</p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0;">WiSkul School Management System</p>
      <p style="margin: 5px 0 0 0;">This email was sent from your website contact form</p>
    </div>
  </div>
</body>
</html>
  `;

  const emailService = new EmailService();
  return emailService.sendEmail({
    to: 'alphadumbuya7@gmail.com',
    subject: `🎓 New Contact: ${data.name} from ${data.school}`,
    body: emailBody,
    isHtml: true,
  });
}

/**
 * Send auto-response to contact form submitter
 */
export async function sendAutoResponse(email: string, name: string): Promise<EmailResponse> {
  const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 40px 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
    .logo-accent { color: #00d4aa; }
    .content { background: #f9f9f9; padding: 40px 30px; }
    .message { background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #00d4aa; margin: 20px 0; }
    .button { display: inline-block; background: linear-gradient(135deg, #00d4aa, #00e6b8); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
    .features { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0; }
    .feature { background: white; padding: 15px; border-radius: 8px; text-align: center; }
    .feature-icon { font-size: 24px; margin-bottom: 8px; }
    .footer { text-align: center; padding: 30px; color: #666; font-size: 12px; background: #1a1a2e; border-radius: 0 0 8px 8px; }
    .footer a { color: #00d4aa; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Wi<span class="logo-accent">Skul</span></div>
      <p style="margin: 0; font-size: 18px; opacity: 0.9;">Thank You for Contacting Us!</p>
    </div>
    <div class="content">
      <h2 style="color: #1a1a2e; margin-top: 0;">Hi ${name},</h2>
      
      <div class="message">
        <p style="margin: 0 0 15px 0; font-size: 16px;">We've received your message and our team will get back to you within <strong style="color: #00d4aa;">24 hours</strong>.</p>
        <p style="margin: 0; color: #666;">In the meantime, feel free to explore what WiSkul can do for your school:</p>
      </div>

      <div class="features">
        <div class="feature">
          <div class="feature-icon">🛡️</div>
          <strong style="color: #1a1a2e;">Secure Data</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Military-grade encryption</p>
        </div>
        <div class="feature">
          <div class="feature-icon">📊</div>
          <strong style="color: #1a1a2e;">Smart Analytics</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">AI-powered insights</p>
        </div>
        <div class="feature">
          <div class="feature-icon">⚡</div>
          <strong style="color: #1a1a2e;">Fast Setup</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Ready in minutes</p>
        </div>
        <div class="feature">
          <div class="feature-icon">💰</div>
          <strong style="color: #1a1a2e;">Affordable</strong>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Plans from NLe 400/mo</p>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${process.env.FRONTEND_URL || 'https://wiskul.com'}/features" class="button">Explore Features →</a>
      </div>

      <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #7c3aed15, #00d4aa15); border-radius: 8px;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #1a1a2e;">🚀 Quick Links:</p>
        <p style="margin: 5px 0; font-size: 13px;">
          <a href="${process.env.FRONTEND_URL || 'https://wiskul.com'}/why" style="color: #7c3aed; text-decoration: none;">Why WiSkul</a> • 
          <a href="${process.env.FRONTEND_URL || 'https://wiskul.com'}/benefits" style="color: #7c3aed; text-decoration: none;">Benefits</a> • 
          <a href="${process.env.FRONTEND_URL || 'https://wiskul.com'}/pricing" style="color: #7c3aed; text-decoration: none;">Pricing</a>
        </p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 10px 0; color: white; font-weight: bold;">WiSkul - Securing Education, One School at a Time</p>
      <p style="margin: 0; color: #999;">📧 alphadumbuya7@gmail.com | 📱 +232 78 261 892</p>
      <p style="margin: 10px 0 0 0; color: #666;">75 Main Road, Kossoh Town, Sierra Leone</p>
      <p style="margin: 15px 0 0 0; color: #666;">
        <a href="${process.env.FRONTEND_URL || 'https://wiskul.com'}/privacy">Privacy Policy</a> • 
        <a href="${process.env.FRONTEND_URL || 'https://wiskul.com'}/terms">Terms of Service</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const emailService = new EmailService();
  return emailService.sendEmail({
    to: email,
    subject: '🎓 Thank You for Contacting WiSkul - We\'ll Be in Touch Soon!',
    body: emailBody,
    isHtml: true,
  });
}

export default new EmailService();
