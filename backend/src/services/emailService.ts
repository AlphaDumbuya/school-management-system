import axios, { AxiosInstance } from 'axios';
import { logger } from '@utils/logger';
import db from '@utils/database';
import { resolveTenantBranding, platformBranding } from './email/emailBranding.js';
import {
  renderEmail,
  emailButton,
  detailsCard,
  detailRow,
  calloutBlock,
  escapeHtml,
} from './email/emailLayout.js';

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

export interface EmailAttachment {
  /** File name shown in the email, e.g. "receipt.pdf". */
  name: string;
  /** Base64-encoded file content. */
  content: string;
}

/**
 * Which platform mailbox a message should come from / reply to.
 *   info    — general/onboarding/account notices
 *   support — operational, security, and help
 *   sales   — billing/subscription/marketing
 *   no-reply— automated messages that don't expect a reply
 */
export type PlatformSenderPurpose = 'info' | 'support' | 'sales' | 'no-reply';

export interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  templateName?: string;
  variables?: Record<string, any>;
  isHtml?: boolean;
  attachments?: EmailAttachment[];
  /** Optional custom sender (e.g. a tenant school). Falls back to platform. */
  sender?: { email: string; name: string };
  /** Optional reply-to (e.g. the school's own email). */
  replyTo?: { email: string; name?: string };
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
  private readonly SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'info@wiskulsl.com';
  private readonly SENDER_NAME = process.env.BREVO_SENDER_NAME || 'WiSkul';
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second base delay

  /**
   * Purpose-specific platform mailboxes. Each platform email should send from
   * (and reply to) the address that matches its intent, so recipients reply to
   * the right team. All are env-overridable; default names are branded per team.
   */
  /** Public accessor for other services that call sendEmail directly. */
  public platformSenderFor(purpose: PlatformSenderPurpose) {
    return this.platformSender(purpose);
  }

  private platformSender(purpose: PlatformSenderPurpose): { sender: { email: string; name: string }; replyTo: { email: string; name: string } } {
    // Deliverability rule: Brevo REJECTS any send whose From address is not a
    // verified sender. Only BREVO_SENDER_EMAIL (info@wiskulsl.com) is verified
    // by default. Purpose-specific mailboxes (sales@, support@, no-reply@) are
    // used as the From address ONLY when explicitly configured via their env
    // var — meaning the operator has verified that address in Brevo. Otherwise
    // we fall back to the verified BREVO_SENDER_EMAIL as the From address and
    // keep the purpose mailbox as Reply-To so replies still route correctly.
    // This is why the newsletter welcome (purpose 'sales') previously failed:
    // sales@ was never verified, so Brevo refused the send.
    const verifiedFrom = this.SENDER_EMAIL; // info@wiskulsl.com by default
    const map: Record<PlatformSenderPurpose, { fromEnv?: string; replyTo: string; name: string }> = {
      info: { fromEnv: process.env.INFO_EMAIL, replyTo: process.env.INFO_EMAIL || 'info@wiskulsl.com', name: 'WiSkul' },
      support: { fromEnv: process.env.SUPPORT_EMAIL, replyTo: process.env.SUPPORT_EMAIL || 'support@wiskulsl.com', name: 'WiSkul Support' },
      sales: { fromEnv: process.env.SALES_EMAIL, replyTo: process.env.SALES_EMAIL || 'sales@wiskulsl.com', name: 'WiSkul Sales' },
      'no-reply': { fromEnv: process.env.NOREPLY_EMAIL, replyTo: process.env.NOREPLY_EMAIL || 'no-reply@wiskulsl.com', name: 'WiSkul' },
    };
    const cfg = map[purpose] || map.info;
    // Use the purpose mailbox as From only when its env var is set (verified);
    // otherwise use the known-verified platform sender.
    const fromEmail = cfg.fromEnv || verifiedFrom;
    return {
      sender: { email: fromEmail, name: cfg.name },
      replyTo: { email: cfg.replyTo, name: cfg.name },
    };
  }

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
   * Build the sender + reply-to for a tenant-branded email.
   *
   * Deliverability rule: an email's "From" address must belong to a domain that
   * is verified in Brevo. A school's own email usually isn't, so by default we:
   *   - keep the verified platform address as the From EMAIL,
   *   - use the SCHOOL'S NAME as the From display name (white-label look), and
   *   - set Reply-To to the school's email so replies reach the school.
   *
   * If TENANT_SENDER_STRICT=true (the school has verified its domain in Brevo),
   * we send fully from the school's own email address.
   */
  private senderFromBranding(branding: {
    name: string;
    contactEmail?: string;
    isPlatform: boolean;
    senderMode?: 'platform' | 'own';
    senderVerified?: boolean;
    fromAddress?: string;
  }): {
    sender: { email: string; name: string };
    replyTo?: { email: string; name?: string };
  } {
    // Platform emails always use the platform sender.
    if (branding.isPlatform || !branding.contactEmail) {
      return { sender: { email: this.SENDER_EMAIL, name: branding.name || this.SENDER_NAME } };
    }

    // 'own' mode is only honoured once the setup team has verified the school's
    // sender in the provider — otherwise the send would fail SPF/DKIM. This is
    // the paid-setup switch: schools start on 'platform' and are upgraded to
    // 'own' after verification.
    if (branding.senderMode === 'own' && branding.senderVerified) {
      const fromEmail = branding.fromAddress || branding.contactEmail;
      return {
        sender: { email: fromEmail, name: branding.name },
        replyTo: { email: branding.contactEmail, name: branding.name },
      };
    }

    // Default (deliverable): platform From email + school display name, reply to school.
    return {
      sender: { email: this.SENDER_EMAIL, name: branding.name },
      replyTo: { email: branding.contactEmail, name: branding.name },
    };
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
        // Sender: use the per-request sender when provided (tenant school),
        // otherwise the platform default. See resolveSender() for the
        // deliverability rules (verified-domain vs. name-only + reply-to).
        sender: emailRequest.sender ?? {
          email: this.SENDER_EMAIL,
          name: this.SENDER_NAME,
        },
        // Reply-To lets recipients reply to the school directly even when the
        // From address stays on the verified platform domain.
        replyTo: emailRequest.replyTo,
        to: [
          {
            email: emailRequest.to,
          },
        ],
        subject: emailRequest.subject,
        htmlContent: emailRequest.isHtml !== false ? body : undefined,
        textContent: emailRequest.isHtml === true ? undefined : body,
        // Brevo expects attachment: [{ content: <base64>, name: <filename> }]
        attachment:
          emailRequest.attachments && emailRequest.attachments.length
            ? emailRequest.attachments.map((a) => ({ name: a.name, content: a.content }))
            : undefined,
      };

      const response = await this.brevoClient.post('/smtp/email', payload);

      logger.info(`Email sent to ${emailRequest.to} - Message ID: ${response.data.messageId}`);

      return {
        messageId: response.data.messageId,
        status: 'sent',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      // Brevo returns the actionable reason (e.g. "sender not valid",
      // "Key not found") in error.response.data — log it so delivery failures
      // are diagnosable instead of hidden behind a generic axios message.
      const providerDetail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message;
      logger.error(
        `Error sending email to ${emailRequest.to} (from ${emailRequest.sender?.email || this.SENDER_EMAIL}): ${providerDetail}`
      );

      // A rejected/invalid sender (400) will never succeed on retry — fail fast.
      const status = error?.response?.status;
      if (status === 400 || status === 401) {
        throw new Error(`Email rejected by provider: ${providerDetail}`);
      }

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
              failureReason: error instanceof Error ? error.message : String(error),
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

  // ==========================================================================
  // Branded transactional emails (mobile-first, tenant-branded)
  // ==========================================================================

  private fmtDate(d?: Date | string): string {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  private titleCase(s?: string): string {
    if (!s) return '';
    return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Detention scheduled notice → guardian.
   */
  async sendDetentionNotification(
    tenantId: string,
    toEmail: string,
    guardianName: string,
    detention: any
  ): Promise<EmailResponse> {
    const branding = await resolveTenantBranding(tenantId);
    const portalUrl = `${branding.appUrl}/discipline`;

    const rows =
      detailRow('Type', escapeHtml(this.titleCase(detention.detention_type))) +
      detailRow('Date', escapeHtml(this.fmtDate(detention.scheduled_date))) +
      (detention.start_time
        ? detailRow('Time', `${escapeHtml(detention.start_time)}${detention.end_time ? ' – ' + escapeHtml(detention.end_time) : ''}`)
        : '') +
      (detention.location ? detailRow('Location', escapeHtml(detention.location)) : '');

    const bodyHtml = `
      <p>Dear ${escapeHtml(guardianName)},</p>
      <p>This is to inform you that a detention has been scheduled for your child at <strong>${escapeHtml(branding.name)}</strong>. Please see the details below.</p>
      ${detailsCard(rows)}
      ${calloutBlock('Kindly ensure your child attends on time. If the scheduled time poses a difficulty, please contact the school so alternative arrangements can be discussed.', 'warn')}
      ${emailButton('View in Portal', portalUrl)}
      <p style="color:#64748b;font-size:13px;">If you have any questions, reply to this email or reach us using the contact details below.</p>`;

    return this.sendEmail({
      ...this.senderFromBranding(branding),
      to: toEmail,
      subject: `Detention Notice — ${branding.name}`,
      body: renderEmail({ branding, eyebrow: 'Discipline Notice', heading: 'Detention Scheduled', bodyHtml, preheader: `A detention has been scheduled for your child on ${this.fmtDate(detention.scheduled_date)}.` }),
      isHtml: true,
    });
  }

  /**
   * Infraction recorded notice → guardian.
   */
  async sendInfractionNotification(
    tenantId: string,
    toEmail: string,
    guardianName: string,
    infraction: any
  ): Promise<EmailResponse> {
    const branding = await resolveTenantBranding(tenantId);
    const portalUrl = `${branding.appUrl}/discipline`;

    const rows =
      detailRow('Date of Incident', escapeHtml(this.fmtDate(infraction.incident_date))) +
      (infraction.incident_location ? detailRow('Location', escapeHtml(infraction.incident_location)) : '') +
      (infraction.incident_description ? detailRow('Description', escapeHtml(infraction.incident_description)) : '') +
      detailRow('Status', escapeHtml(this.titleCase(infraction.status)));

    const bodyHtml = `
      <p>Dear ${escapeHtml(guardianName)},</p>
      <p>We are writing to let you know that a behavioural incident involving your child has been recorded at <strong>${escapeHtml(branding.name)}</strong>. We share this in the spirit of partnership so we can support your child together.</p>
      ${detailsCard(rows)}
      ${calloutBlock('We encourage you to speak with your child about this and to contact us if you would like to discuss it further. Working together helps us support positive behaviour.', 'info')}
      ${emailButton('View Details', portalUrl)}`;

    return this.sendEmail({
      ...this.senderFromBranding(branding),
      to: toEmail,
      subject: `Behaviour Notice — ${branding.name}`,
      body: renderEmail({ branding, eyebrow: 'Discipline Notice', heading: 'Behaviour Incident Recorded', bodyHtml, preheader: 'A behavioural incident involving your child has been recorded.' }),
      isHtml: true,
    });
  }

  /**
   * Conduct report shared → guardian.
   */
  async sendConductReport(
    tenantId: string,
    toEmail: string,
    guardianName: string,
    studentName: string,
    report: any
  ): Promise<EmailResponse> {
    const branding = await resolveTenantBranding(tenantId);
    const portalUrl = `${branding.appUrl}/discipline`;

    const rows =
      detailRow('Student', escapeHtml(studentName)) +
      detailRow('Period', escapeHtml(this.titleCase(report.report_period))) +
      (report.period_start_date
        ? detailRow('From', escapeHtml(this.fmtDate(report.period_start_date)))
        : '') +
      (report.period_end_date
        ? detailRow('To', escapeHtml(this.fmtDate(report.period_end_date)))
        : '') +
      detailRow('Total Infractions', String(report.total_infractions ?? 0)) +
      (report.behavioral_rating != null
        ? detailRow('Behaviour Rating', `${escapeHtml(String(report.behavioral_rating))} / 5`)
        : '');

    const comments = [
      report.strengths ? `<p><strong>Strengths:</strong> ${escapeHtml(report.strengths)}</p>` : '',
      report.areas_for_improvement ? `<p><strong>Areas for improvement:</strong> ${escapeHtml(report.areas_for_improvement)}</p>` : '',
      report.teacher_comments ? `<p><strong>Teacher's comments:</strong> ${escapeHtml(report.teacher_comments)}</p>` : '',
      report.overall_assessment ? `<p><strong>Overall assessment:</strong> ${escapeHtml(report.overall_assessment)}</p>` : '',
    ].filter(Boolean).join('');

    const bodyHtml = `
      <p>Dear ${escapeHtml(guardianName)},</p>
      <p><strong>${escapeHtml(branding.name)}</strong> has prepared a conduct report for <strong>${escapeHtml(studentName)}</strong>. A summary is below.</p>
      ${detailsCard(rows)}
      ${comments ? calloutBlock(comments, 'info') : ''}
      ${emailButton('Open Full Report', portalUrl)}
      <p style="color:#64748b;font-size:13px;">Please reach out if you would like to discuss any part of this report.</p>`;

    return this.sendEmail({
      ...this.senderFromBranding(branding),
      to: toEmail,
      subject: `Conduct Report for ${studentName} — ${branding.name}`,
      body: renderEmail({ branding, eyebrow: 'Conduct Report', heading: 'Student Conduct Report', bodyHtml, preheader: `Conduct report for ${studentName} is ready.` }),
      isHtml: true,
    });
  }

  /**
   * Appeal decision → the person who submitted the appeal.
   */
  async sendAppealDecision(
    tenantId: string,
    toEmail: string,
    recipientName: string,
    appeal: any,
    decision: string,
    notes: string
  ): Promise<EmailResponse> {
    const branding = await resolveTenantBranding(tenantId);
    const portalUrl = `${branding.appUrl}/discipline`;
    const approved = decision?.toLowerCase() === 'approved';

    const bodyHtml = `
      <p>Dear ${escapeHtml(recipientName)},</p>
      <p>Your discipline appeal submitted to <strong>${escapeHtml(branding.name)}</strong> has been reviewed.</p>
      ${calloutBlock(
        `<strong>Decision: ${approved ? 'Approved' : 'Not upheld'}</strong>${notes ? `<br/>${escapeHtml(notes)}` : ''}`,
        approved ? 'success' : 'warn'
      )}
      ${emailButton('View Appeal', portalUrl)}
      <p style="color:#64748b;font-size:13px;">If you have questions about this decision, please contact the school using the details below.</p>`;

    return this.sendEmail({
      ...this.senderFromBranding(branding),
      to: toEmail,
      subject: `Appeal ${approved ? 'Approved' : 'Decision'} — ${branding.name}`,
      body: renderEmail({ branding, eyebrow: 'Appeal Outcome', heading: `Appeal ${approved ? 'Approved' : 'Decision'}`, bodyHtml, preheader: `Your discipline appeal has been ${decision}.` }),
      isHtml: true,
    });
  }

  /**
   * Password reset → any user. Platform-branded (auth is a platform concern),
   * but the link points to the app's reset page with the token.
   */
  async sendPasswordResetEmail(
    toEmail: string,
    userName: string,
    resetToken: string
  ): Promise<EmailResponse> {
    const branding = platformBranding();
    const resetUrl = `${branding.appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

    const bodyHtml = `
      <p>Hello ${escapeHtml(userName || 'there')},</p>
      <p>We received a request to reset the password for your WiSkul account. Click the button below to choose a new password. This link will expire in <strong>1 hour</strong>.</p>
      ${emailButton('Reset My Password', resetUrl)}
      ${calloutBlock("If you didn't request a password reset, you can safely ignore this email — your password will not change.", 'info')}
      <p style="color:#64748b;font-size:13px;">If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${resetUrl}" style="color:${'#00d4aa'};word-break:break-all;">${resetUrl}</a></p>`;

    return this.sendEmail({
      ...this.platformSender('support'),
      to: toEmail,
      subject: 'Reset your WiSkul password',
      body: renderEmail({ branding, eyebrow: 'Account Security', heading: 'Password Reset Request', bodyHtml, preheader: 'Reset your WiSkul password — link valid for 1 hour.' }),
      isHtml: true,
    });
  }

  private fmtMoney(amount: number | string, currency = 'Le'): string {
    const n = Number(amount) || 0;
    return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Platform operator emails — sent to a school's contact when the super admin
  // performs a lifecycle/billing action. Always platform-branded (from WiSkul).
  // Failures are swallowed by callers so they never block the admin action.
  // ────────────────────────────────────────────────────────────────────────

  /** School onboarded → welcome + (optional) principal login details. */
  async sendTenantWelcomeEmail(
    toEmail: string,
    data: { schoolName: string; loginEmail?: string; tempPassword?: string }
  ): Promise<EmailResponse> {
    const branding = platformBranding();
    const creds = data.tempPassword
      ? detailsCard(
          detailRow('Login email', escapeHtml(data.loginEmail || toEmail)) +
          detailRow('Temporary password', escapeHtml(data.tempPassword))
        ) + calloutBlock('For security, change this password right after your first sign-in.', 'warn')
      : '';
    const bodyHtml = `
      <p>Hello,</p>
      <p>Welcome to WiSkul! Your school workspace for <strong>${escapeHtml(data.schoolName)}</strong> has been created and is ready to use.</p>
      ${creds}
      ${emailButton('Sign in to WiSkul', `${branding.appUrl}/login`)}
      <p style="color:#64748b;font-size:13px;">Need help getting set up? Reply to this email and our team will assist you.</p>`;
    return this.sendEmail({
      ...this.platformSender('info'),
      to: toEmail,
      subject: `Welcome to WiSkul — ${data.schoolName}`,
      body: renderEmail({ branding, eyebrow: 'Onboarding', heading: 'Your school is ready', bodyHtml, preheader: `Welcome to WiSkul, ${data.schoolName}.` }),
      isHtml: true,
    });
  }

  /** Newsletter subscription confirmation → the new subscriber. */
  async sendNewsletterWelcomeEmail(
    toEmail: string,
    data: { name?: string; unsubscribeUrl?: string }
  ): Promise<EmailResponse> {
    const branding = platformBranding();
    const bodyHtml = `
      <p>Hello ${escapeHtml(data.name || 'there')},</p>
      <p>Thanks for subscribing to the <strong>WiSkul</strong> newsletter! You'll now receive product news, tips, and important updates straight to your inbox.</p>
      ${calloutBlock('We keep it useful and occasional — no spam, and you can unsubscribe anytime.', 'info')}
      ${emailButton('Explore WiSkul', branding.appUrl)}`;
    return this.sendEmail({
      ...this.platformSender('sales'),
      to: toEmail,
      subject: 'Welcome to the WiSkul newsletter 🎉',
      body: renderEmail({
        branding,
        eyebrow: 'Newsletter',
        heading: "You're subscribed!",
        bodyHtml,
        preheader: 'Thanks for subscribing to the WiSkul newsletter.',
        unsubscribeUrl: data.unsubscribeUrl,
      }),
      isHtml: true,
    });
  }

  /** Subscription plan changed / renewed → school contact. */
  async sendTenantSubscriptionEmail(
    toEmail: string,
    data: { schoolName: string; planLabel: string; action: 'changed' | 'renewed' | 'extended' | 'expired'; endDate?: string }
  ): Promise<EmailResponse> {
    const branding = platformBranding();
    const verb = {
      changed: 'updated', renewed: 'renewed', extended: 'extended', expired: 'expired',
    }[data.action];
    const tone: 'info' | 'success' | 'warn' = data.action === 'expired' ? 'warn' : 'success';
    const bodyHtml = `
      <p>Hello,</p>
      <p>The subscription for <strong>${escapeHtml(data.schoolName)}</strong> has been <strong>${verb}</strong>.</p>
      ${detailsCard(
        detailRow('Plan', escapeHtml(data.planLabel)) +
        (data.endDate ? detailRow('Valid until', escapeHtml(new Date(data.endDate).toLocaleDateString())) : '')
      )}
      ${data.action === 'expired'
        ? calloutBlock('Access to premium features is paused until the subscription is renewed.', tone)
        : calloutBlock('Your plan features and limits are now active.', tone)}
      ${emailButton('Open WiSkul', `${branding.appUrl}/login`)}`;
    return this.sendEmail({
      ...this.platformSender('sales'),
      to: toEmail,
      subject: `Subscription ${verb} — ${data.schoolName}`,
      body: renderEmail({ branding, eyebrow: 'Billing', heading: `Subscription ${verb}`, bodyHtml, preheader: `${data.schoolName} subscription ${verb}.` }),
      isHtml: true,
    });
  }

  /** Account status changed (suspend / activate / restore) → school contact. */
  async sendTenantStatusEmail(
    toEmail: string,
    data: { schoolName: string; status: 'suspended' | 'activated' | 'restored'; reason?: string }
  ): Promise<EmailResponse> {
    const branding = platformBranding();
    const tone: 'info' | 'success' | 'warn' = data.status === 'suspended' ? 'warn' : 'success';
    const bodyHtml = `
      <p>Hello,</p>
      <p>The WiSkul account for <strong>${escapeHtml(data.schoolName)}</strong> has been <strong>${data.status}</strong>.</p>
      ${data.status === 'suspended'
        ? calloutBlock(`Access is temporarily paused.${data.reason ? ' Reason: ' + escapeHtml(data.reason) : ''} Please contact support to resolve this.`, tone)
        : calloutBlock('Your account is active and users can sign in normally.', tone)}
      ${emailButton('Open WiSkul', `${branding.appUrl}/login`)}`;
    return this.sendEmail({
      ...this.platformSender('support'),
      to: toEmail,
      subject: `Account ${data.status} — ${data.schoolName}`,
      body: renderEmail({ branding, eyebrow: 'Account', heading: `Account ${data.status}`, bodyHtml, preheader: `${data.schoolName} account ${data.status}.` }),
      isHtml: true,
    });
  }

  /**
   * Admissions decision → applicant's guardian.
   * decision: 'accepted' | 'rejected' | 'waitlist'
   */
  async sendAdmissionDecisionEmail(
    tenantId: string,
    toEmail: string,
    data: {
      guardianName: string;
      studentName: string;
      decision: string;
      applicationNumber?: string;
      className?: string;
      notes?: string;
    }
  ): Promise<EmailResponse> {
    const branding = await resolveTenantBranding(tenantId);
    const loginUrl = `${branding.appUrl}/login`;
    const decision = (data.decision || '').toLowerCase();
    const isAccepted = decision === 'accepted' || decision === 'approved' || decision === 'enrolled';
    const isWaitlist = decision === 'waitlist' || decision === 'waitlisted';

    const rows =
      detailRow('Applicant', escapeHtml(data.studentName)) +
      (data.applicationNumber ? detailRow('Application No.', escapeHtml(data.applicationNumber)) : '') +
      (data.className ? detailRow('Class Applied For', escapeHtml(data.className)) : '') +
      detailRow('Decision', escapeHtml(this.titleCase(data.decision)));

    let heading: string;
    let eyebrow: string;
    let intro: string;
    let callout: string;

    if (isAccepted) {
      heading = 'Congratulations — Application Accepted!';
      eyebrow = 'Admissions Decision';
      intro = `We are delighted to inform you that <strong>${escapeHtml(data.studentName)}</strong> has been <strong>accepted</strong> to <strong>${escapeHtml(branding.name)}</strong>.`;
      callout = calloutBlock(
        `${data.notes ? escapeHtml(data.notes) + '<br/><br/>' : ''}Please sign in to your parent portal to complete the next enrolment steps. We look forward to welcoming your child.`,
        'success'
      ) + emailButton('Complete Enrolment', loginUrl);
    } else if (isWaitlist) {
      heading = 'Application Update — Waitlisted';
      eyebrow = 'Admissions Decision';
      intro = `Thank you for applying to <strong>${escapeHtml(branding.name)}</strong>. <strong>${escapeHtml(data.studentName)}</strong> has been placed on our <strong>waitlist</strong>.`;
      callout = calloutBlock(
        `${data.notes ? escapeHtml(data.notes) + '<br/><br/>' : ''}We will contact you as soon as a place becomes available. Thank you for your patience.`,
        'info'
      );
    } else {
      heading = 'Application Update';
      eyebrow = 'Admissions Decision';
      intro = `Thank you for the interest shown in <strong>${escapeHtml(branding.name)}</strong> and for taking the time to apply.`;
      callout = calloutBlock(
        `After careful consideration, we are unable to offer <strong>${escapeHtml(data.studentName)}</strong> a place at this time.${data.notes ? '<br/><br/>' + escapeHtml(data.notes) : ''}<br/><br/>We wish your child every success in their education.`,
        'warn'
      );
    }

    const bodyHtml = `
      <p>Dear ${escapeHtml(data.guardianName)},</p>
      <p>${intro}</p>
      ${detailsCard(rows)}
      ${callout}
      <p style="color:#64748b;font-size:13px;">For any questions about this decision, please contact us using the details below.</p>`;

    return this.sendEmail({
      ...this.senderFromBranding(branding),
      to: toEmail,
      subject: `${isAccepted ? '🎉 ' : ''}Admission ${this.titleCase(decision)} — ${branding.name}`,
      body: renderEmail({ branding, eyebrow, heading, bodyHtml, preheader: `Admissions decision for ${data.studentName}.` }),
      isHtml: true,
    });
  }

  /**
   * Payment receipt → payer (guardian/student). Sent after a successful payment.
   */
  async sendPaymentReceiptEmail(
    tenantId: string,
    toEmail: string,
    data: {
      payerName: string;
      studentName?: string;
      amount: number | string;
      currency?: string;
      method?: string;
      reference?: string;
      date?: Date | string;
      balanceRemaining?: number | string;
    }
  ): Promise<EmailResponse> {
    const branding = await resolveTenantBranding(tenantId);
    const portalUrl = `${branding.appUrl}/dashboard`;
    const currency = data.currency || 'Le';

    const rows =
      (data.studentName ? detailRow('Student', escapeHtml(data.studentName)) : '') +
      detailRow('Amount Paid', `<strong style="color:#059669;">${escapeHtml(this.fmtMoney(data.amount, currency))}</strong>`) +
      (data.method ? detailRow('Payment Method', escapeHtml(this.titleCase(data.method))) : '') +
      (data.reference ? detailRow('Reference', escapeHtml(data.reference)) : '') +
      detailRow('Date', escapeHtml(this.fmtDate(data.date || new Date()))) +
      (data.balanceRemaining != null
        ? detailRow('Balance Remaining', escapeHtml(this.fmtMoney(data.balanceRemaining, currency)))
        : '');

    const bodyHtml = `
      <p>Dear ${escapeHtml(data.payerName)},</p>
      <p>Thank you — we've received your payment to <strong>${escapeHtml(branding.name)}</strong>. Your official receipt is attached to this email as a PDF.</p>
      ${detailsCard(rows)}
      ${calloutBlock('Please keep the attached PDF receipt for your records. You can also view your full payment history in your portal.', 'success')}
      ${emailButton('View Payment History', portalUrl)}`;

    // Generate a professional, tenant-branded PDF receipt to attach.
    let attachments: { name: string; content: string }[] | undefined;
    try {
      const { generateReceiptPdfBase64 } = await import('./email/receiptPdf.js');
      const receiptNumber = data.reference || `RCPT-${Date.now()}`;
      const { base64 } = await generateReceiptPdfBase64(tenantId, {
        receiptNumber,
        payerName: data.payerName,
        studentName: data.studentName,
        amount: Number(data.amount),
        currency,
        method: data.method,
        reference: data.reference,
        date: data.date ? new Date(data.date) : new Date(),
        balanceRemaining: data.balanceRemaining != null ? Number(data.balanceRemaining) : undefined,
      });
      attachments = [{ name: `Receipt-${receiptNumber}.pdf`, content: base64 }];
    } catch (err) {
      logger.warn(`Could not generate PDF receipt; sending email without attachment: ${err}`);
    }

    return this.sendEmail({
      ...this.senderFromBranding(branding),
      to: toEmail,
      subject: `Payment Receipt — ${this.fmtMoney(data.amount, currency)} to ${branding.name}`,
      body: renderEmail({ branding, eyebrow: 'Payment Receipt', heading: 'Payment Received — Thank You', bodyHtml, preheader: `Receipt for your ${this.fmtMoney(data.amount, currency)} payment.` }),
      isHtml: true,
      attachments,
    });
  }

  /**
   * Account credentials / welcome → newly created user (staff, teacher, parent,
   * student). Tenant-branded, includes their login email and a portal link. If
   * a temporary password is provided we include it with a change-it advisory.
   */
  async sendAccountCredentialsEmail(
    tenantId: string,
    toEmail: string,
    data: {
      userName: string;
      role?: string;
      tempPassword?: string;
    }
  ): Promise<EmailResponse> {
    const branding = await resolveTenantBranding(tenantId);
    const loginUrl = `${branding.appUrl}/login`;

    const rows =
      detailRow('Login Email', escapeHtml(toEmail)) +
      (data.role ? detailRow('Role', escapeHtml(this.titleCase(data.role))) : '') +
      (data.tempPassword
        ? detailRow('Temporary Password', `<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;">${escapeHtml(data.tempPassword)}</code>`)
        : '');

    const bodyHtml = `
      <p>Hello ${escapeHtml(data.userName || 'there')},</p>
      <p>An account has been created for you at <strong>${escapeHtml(branding.name)}</strong>. You can now sign in to your portal using the details below.</p>
      ${detailsCard(rows)}
      ${data.tempPassword
        ? calloutBlock('For your security, please sign in and change this temporary password right away.', 'warn')
        : calloutBlock('Use the password provided to you by your school. If you need help, contact your administrator.', 'info')}
      ${emailButton('Sign In to Your Portal', loginUrl)}
      <p style="color:#64748b;font-size:13px;">If you weren't expecting this, please contact your school using the details below.</p>`;

    return this.sendEmail({
      ...this.senderFromBranding(branding),
      to: toEmail,
      subject: `Your ${branding.name} account is ready`,
      body: renderEmail({ branding, eyebrow: 'Welcome', heading: `Welcome to ${branding.name}`, bodyHtml, preheader: `Your account at ${branding.name} is ready — sign in to get started.` }),
      isHtml: true,
    });
  }

  /**
   * Security notice → user, when two-factor authentication is enabled/disabled.
   */
  async sendTwoFactorStatusEmail(
    tenantId: string,
    toEmail: string,
    data: { userName: string; action: 'enabled' | 'disabled' }
  ): Promise<EmailResponse> {
    const branding = await resolveTenantBranding(tenantId);
    const loginUrl = `${branding.appUrl}/login`;
    const enabled = data.action === 'enabled';

    const bodyHtml = `
      <p>Hello ${escapeHtml(data.userName)},</p>
      <p>Two-factor authentication (2FA) was just <strong>${enabled ? 'enabled' : 'disabled'}</strong> on your account.</p>
      ${enabled
        ? calloutBlock('Your account is now better protected. You\'ll be asked for a code from your authenticator app each time you sign in.', 'success')
        : calloutBlock('Your account no longer requires a second verification step at sign-in. If you didn\'t make this change, secure your account immediately.', 'warn')}
      ${calloutBlock("If you didn't make this change, reset your password right away and contact your school administrator.", 'info')}
      ${emailButton('Review Account Security', loginUrl)}`;

    return this.sendEmail({
      ...this.senderFromBranding(branding),
      to: toEmail,
      subject: `Two-factor authentication ${enabled ? 'enabled' : 'disabled'}`,
      body: renderEmail({ branding, eyebrow: 'Account Security', heading: `2FA ${enabled ? 'Enabled' : 'Disabled'}`, bodyHtml, preheader: `Two-factor authentication was ${data.action} on your account.` }),
      isHtml: true,
    });
  }

  /**
   * Report cards published → guardian/student.
   */
  async sendReportCardPublishedEmail(
    tenantId: string,
    toEmail: string,
    data: {
      recipientName: string;
      studentName: string;
      className?: string;
      term?: string;
      academicYear?: string;
    }
  ): Promise<EmailResponse> {
    const branding = await resolveTenantBranding(tenantId);
    const portalUrl = `${branding.appUrl}/academic/report-cards`;

    const rows =
      detailRow('Student', escapeHtml(data.studentName)) +
      (data.className ? detailRow('Class', escapeHtml(data.className)) : '') +
      (data.term ? detailRow('Term', escapeHtml(data.term)) : '') +
      (data.academicYear ? detailRow('Academic Year', escapeHtml(data.academicYear)) : '');

    const bodyHtml = `
      <p>Dear ${escapeHtml(data.recipientName)},</p>
      <p>Good news — <strong>${escapeHtml(branding.name)}</strong> has published the report card for <strong>${escapeHtml(data.studentName)}</strong>. You can now view and download it from your portal.</p>
      ${detailsCard(rows)}
      ${calloutBlock('Please review the results and reach out to the school if you have any questions about your child\'s progress.', 'info')}
      ${emailButton('View Report Card', portalUrl)}`;

    return this.sendEmail({
      ...this.senderFromBranding(branding),
      to: toEmail,
      subject: `Report Card Available for ${data.studentName} — ${branding.name}`,
      body: renderEmail({ branding, eyebrow: 'Report Card', heading: 'Report Card Published', bodyHtml, preheader: `${data.studentName}'s report card is now available.` }),
      isHtml: true,
    });
  }

  /**
   * Fee reminder → guardian. For upcoming or overdue balances.
   */
  async sendFeeReminderEmail(
    tenantId: string,
    toEmail: string,
    data: {
      guardianName: string;
      studentName?: string;
      amountDue: number | string;
      currency?: string;
      dueDate?: Date | string;
      overdue?: boolean;
      feeName?: string;
    }
  ): Promise<EmailResponse> {
    const branding = await resolveTenantBranding(tenantId);
    const payUrl = `${branding.appUrl}/dashboard`;
    const currency = data.currency || 'Le';

    const rows =
      (data.studentName ? detailRow('Student', escapeHtml(data.studentName)) : '') +
      (data.feeName ? detailRow('Fee', escapeHtml(data.feeName)) : '') +
      detailRow('Amount Due', `<strong>${escapeHtml(this.fmtMoney(data.amountDue, currency))}</strong>`) +
      (data.dueDate ? detailRow('Due Date', escapeHtml(this.fmtDate(data.dueDate))) : '');

    const bodyHtml = `
      <p>Dear ${escapeHtml(data.guardianName)},</p>
      <p>This is a friendly reminder from <strong>${escapeHtml(branding.name)}</strong> regarding ${data.overdue ? 'an <strong>overdue</strong> balance' : 'an upcoming fee payment'} for your child.</p>
      ${detailsCard(rows)}
      ${calloutBlock(
        data.overdue
          ? 'This balance is now past its due date. Please make payment at your earliest convenience to avoid any disruption. You can pay securely from your portal.'
          : 'You can pay quickly and securely from your portal using mobile money, card, bank transfer or a digital wallet.',
        data.overdue ? 'warn' : 'info'
      )}
      ${emailButton('Pay Fees Now', payUrl)}
      <p style="color:#64748b;font-size:13px;">If you've already paid, please disregard this reminder. Thank you.</p>`;

    return this.sendEmail({
      ...this.senderFromBranding(branding),
      to: toEmail,
      subject: `${data.overdue ? 'Overdue' : 'Fee'} Reminder — ${this.fmtMoney(data.amountDue, currency)} · ${branding.name}`,
      body: renderEmail({ branding, eyebrow: data.overdue ? 'Overdue Notice' : 'Fee Reminder', heading: data.overdue ? 'Payment Overdue' : 'Upcoming Fee Payment', bodyHtml, preheader: `${data.overdue ? 'Overdue' : 'Fee'} reminder: ${this.fmtMoney(data.amountDue, currency)} due.` }),
      isHtml: true,
    });
  }

  /**
   * School announcement → a recipient in the tenant. Branded with the school's
   * identity so it reads as an official message from their school.
   */
  async sendAnnouncementEmail(
    tenantId: string,
    toEmail: string,
    data: { userName: string; title: string; body: string; priority?: 'normal' | 'high' }
  ): Promise<EmailResponse> {
    const branding = await resolveTenantBranding(tenantId);
    const portalUrl = `${branding.appUrl}/communication/announcements`;
    const high = data.priority === 'high';

    // Preserve line breaks from the composer as paragraphs.
    const paragraphs = escapeHtml(data.body)
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('');

    const bodyHtml = `
      <p>Hello ${escapeHtml(data.userName)},</p>
      ${high ? calloutBlock('This is a high-priority announcement from your school.', 'warn') : ''}
      <h2 style="font-size:18px;font-weight:800;color:#0f172a;margin:16px 0 8px;">${escapeHtml(data.title)}</h2>
      ${paragraphs}
      ${emailButton('View in Portal', portalUrl)}
      <p style="color:#64748b;font-size:13px;">You're receiving this because you're a member of ${escapeHtml(branding.name)}.</p>`;

    return this.sendEmail({
      ...this.senderFromBranding(branding),
      to: toEmail,
      subject: `${high ? '[Important] ' : ''}${data.title} — ${branding.name}`,
      body: renderEmail({
        branding,
        eyebrow: high ? 'Important Announcement' : 'Announcement',
        heading: data.title,
        bodyHtml,
        preheader: data.body.slice(0, 120),
      }),
      isHtml: true,
    });
  }

  /**
   * Support ticket notification (platform → user). Sent on create, reply, and
   * status change so the requester always knows where their ticket stands.
   * Uses the WiSkul "support" sender identity.
   */
  async sendSupportTicketEmail(
    toEmail: string,
    data: {
      userName?: string;
      reference: string;
      subject: string;
      event: 'created' | 'replied' | 'status';
      status?: string;
      message?: string;
    }
  ): Promise<EmailResponse> {
    const branding = platformBranding();
    const portalUrl = `${branding.appUrl}/support`;
    const eyebrowMap = { created: 'Ticket Received', replied: 'New Reply', status: 'Status Update' } as const;
    const headingMap = {
      created: 'We received your request',
      replied: 'There is a new reply on your ticket',
      status: `Your ticket is now ${data.status || 'updated'}`,
    } as const;

    const bodyHtml = `
      <p>Hello ${escapeHtml(data.userName || 'there')},</p>
      <p>${
        data.event === 'created'
          ? 'Thanks for reaching out. Our support team has received your ticket and will respond shortly.'
          : data.event === 'replied'
          ? 'Our support team has added a reply to your ticket.'
          : `The status of your ticket has been updated to <strong>${escapeHtml(data.status || '')}</strong>.`
      }</p>
      ${detailsCard([
        detailRow('Reference', escapeHtml(data.reference)),
        detailRow('Subject', escapeHtml(data.subject)),
        ...(data.status ? [detailRow('Status', escapeHtml(data.status))] : []),
      ])}
      ${data.message ? `<p style="background:#f8fafc;border-left:3px solid #1d4ed8;padding:10px 14px;">${escapeHtml(data.message).replace(/\n/g, '<br/>')}</p>` : ''}
      ${emailButton('View your ticket', portalUrl)}`;

    return this.sendEmail({
      ...this.platformSender('support'),
      to: toEmail,
      subject: `[${data.reference}] ${data.subject} — ${eyebrowMap[data.event]}`,
      body: renderEmail({
        branding,
        eyebrow: eyebrowMap[data.event],
        heading: headingMap[data.event],
        bodyHtml,
        preheader: `Ticket ${data.reference}: ${data.subject}`,
      }),
      isHtml: true,
    });
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
  const branding = platformBranding();

  const rows =
    detailRow('Name', escapeHtml(data.name)) +
    detailRow('Email', `<a href="mailto:${escapeHtml(data.email)}" style="color:#00d4aa;text-decoration:none;">${escapeHtml(data.email)}</a>`) +
    detailRow('Phone', escapeHtml(data.phone || '—')) +
    detailRow('School', escapeHtml(data.school || '—')) +
    detailRow('Role', escapeHtml(data.role || '—'));

  const bodyHtml = `
    <p>A new enquiry was submitted through the WiSkul website contact form.</p>
    ${detailsCard(rows)}
    <p style="font-weight:700;color:#1a1a2e;margin:18px 0 6px;">Message</p>
    <div style="background:#f8fafc;border-left:4px solid #7c3aed;border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.6;color:#334155;white-space:pre-wrap;">${escapeHtml(data.message)}</div>
    ${emailButton('Reply to ' + escapeHtml(data.name), `mailto:${data.email}`)}
    ${calloutBlock('Please respond within 24 hours.', 'warn')}`;

  const emailService = new EmailService();
  return emailService.sendEmail({
    ...emailService.platformSenderFor('info'),
    to: process.env.CONTACT_EMAIL || 'info@wiskulsl.com',
    subject: `New Contact: ${data.name} from ${data.school || 'website'}`,
    body: renderEmail({
      branding,
      eyebrow: 'Website Contact Form',
      heading: 'New Contact Enquiry',
      bodyHtml,
      preheader: `${data.name} (${data.school || 'website'}) sent a message.`,
    }),
    isHtml: true,
  });
}

/**
 * Send auto-response to contact form submitter
 */
export async function sendAutoResponse(email: string, name: string): Promise<EmailResponse> {
  const branding = platformBranding();
  const base = branding.appUrl;

  const bodyHtml = `
    <p>Hi ${escapeHtml(name)},</p>
    <p>Thanks for reaching out to <strong>WiSkul</strong>. We've received your message and a member of our team will get back to you within <strong>24 hours</strong>.</p>
    ${calloutBlock('While you wait, here are a few links you might find useful.', 'info')}
    <p style="font-size:14px;line-height:1.9;">
      🔎 <a href="${base}/features" target="_blank" style="color:#00d4aa;text-decoration:none;font-weight:600;">Explore Features</a><br/>
      💡 <a href="${base}/why" target="_blank" style="color:#00d4aa;text-decoration:none;font-weight:600;">Why WiSkul</a><br/>
      🎯 <a href="${base}/benefits" target="_blank" style="color:#00d4aa;text-decoration:none;font-weight:600;">Benefits for your school</a><br/>
      💳 <a href="${base}/pricing" target="_blank" style="color:#00d4aa;text-decoration:none;font-weight:600;">Pricing</a>
    </p>
    ${emailButton('Explore WiSkul', `${base}/features`)}
    <p style="color:#64748b;font-size:13px;">If your enquiry is urgent, just reply to this email and we'll prioritise it.</p>`;

  const emailService = new EmailService();
  return emailService.sendEmail({
    ...emailService.platformSenderFor('support'),
    to: email,
    subject: "Thanks for contacting WiSkul — we'll be in touch soon",
    body: renderEmail({
      branding,
      eyebrow: 'We received your message',
      heading: `Thanks for reaching out, ${name}!`,
      bodyHtml,
      preheader: "We've received your message and will reply within 24 hours.",
    }),
    isHtml: true,
  });
}

/**
 * Send Professional Welcome Email on School Registration
 */
export async function sendSchoolWelcomeEmail(data: {
  toEmail: string;
  adminName: string;
  schoolName: string;
  loginUrl?: string;
}): Promise<EmailResponse> {
  // Platform-branded (WiSkul → the new school owner). Uses the shared
  // mobile-first responsive layout so it reads well on phones.
  const branding = platformBranding();
  const loginUrl = data.loginUrl || `${branding.appUrl}/login`;

  const rows =
    detailRow('School', escapeHtml(data.schoolName)) +
    detailRow('Administrator', escapeHtml(data.adminName)) +
    detailRow('Login Email', escapeHtml(data.toEmail)) +
    detailRow('Included', 'Academics, Admissions, Attendance, Fees, ID Cards, Portals');

  const bodyHtml = `
    <p>Hello ${escapeHtml(data.adminName)},</p>
    <p>Congratulations — <strong>${escapeHtml(data.schoolName)}</strong> is now set up on WiSkul. Your school's private workspace and principal dashboard are ready to use.</p>
    ${detailsCard(rows)}
    ${emailButton('Go to Your Dashboard', loginUrl)}
    <p style="font-weight:700;color:#1a1a2e;margin-bottom:6px;">A few good first steps:</p>
    <ol style="font-size:14px;color:#334155;line-height:1.7;padding-left:20px;margin-top:0;">
      <li><strong>Add your classes</strong> under Academic Management.</li>
      <li><strong>Invite teachers &amp; staff</strong> so they can manage their registers.</li>
      <li><strong>Admit or import students</strong> to start issuing digital ID cards.</li>
      <li><strong>Set up your fee structures</strong> to bill and collect payments online.</li>
    </ol>
    ${calloutBlock('Tip: complete your school profile (logo, contact details, address) in Settings — it personalises the emails, ID cards and receipts your school sends to parents.', 'info')}
    <p style="color:#64748b;font-size:13px;">Need a hand getting started? Just reply to this email — we're happy to help.</p>`;

  const emailService = new EmailService();
  return emailService.sendEmail({
    ...emailService.platformSenderFor('info'),
    to: data.toEmail,
    subject: `Welcome to WiSkul — ${data.schoolName} is ready 🎉`,
    body: renderEmail({
      branding,
      eyebrow: 'Welcome Aboard',
      heading: `Welcome to WiSkul, ${data.adminName}!`,
      bodyHtml,
      preheader: `${data.schoolName} is set up on WiSkul — here's how to get started.`,
    }),
    isHtml: true,
  });
}

export default new EmailService();
