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
  private readonly SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'info@wiskulsl.com';
  private readonly SENDER_NAME = process.env.BREVO_SENDER_NAME || 'WiSkul';
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
      <p>Thank you — we've received your payment to <strong>${escapeHtml(branding.name)}</strong>. This email is your receipt.</p>
      ${detailsCard(rows)}
      ${calloutBlock('Please keep this receipt for your records. You can view your full payment history in your portal.', 'success')}
      ${emailButton('View Payment History', portalUrl)}`;

    return this.sendEmail({
      to: toEmail,
      subject: `Payment Receipt — ${this.fmtMoney(data.amount, currency)} to ${branding.name}`,
      body: renderEmail({ branding, eyebrow: 'Payment Receipt', heading: 'Payment Received — Thank You', bodyHtml, preheader: `Receipt for your ${this.fmtMoney(data.amount, currency)} payment.` }),
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
      to: toEmail,
      subject: `${data.overdue ? 'Overdue' : 'Fee'} Reminder — ${this.fmtMoney(data.amountDue, currency)} · ${branding.name}`,
      body: renderEmail({ branding, eyebrow: data.overdue ? 'Overdue Notice' : 'Fee Reminder', heading: data.overdue ? 'Payment Overdue' : 'Upcoming Fee Payment', bodyHtml, preheader: `${data.overdue ? 'Overdue' : 'Fee'} reminder: ${this.fmtMoney(data.amountDue, currency)} due.` }),
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
    to: process.env.CONTACT_EMAIL || 'info@wiskulsl.com',
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
        <a href="${process.env.FRONTEND_URL || 'https://www.wiskulsl.com'}/features" class="button">Explore Features →</a>
      </div>

      <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #7c3aed15, #00d4aa15); border-radius: 8px;">
        <p style="margin: 0 0 10px 0; font-weight: bold; color: #1a1a2e;">🚀 Quick Links:</p>
        <p style="margin: 5px 0; font-size: 13px;">
          <a href="${process.env.FRONTEND_URL || 'https://www.wiskulsl.com'}/why" style="color: #7c3aed; text-decoration: none;">Why WiSkul</a> • 
          <a href="${process.env.FRONTEND_URL || 'https://www.wiskulsl.com'}/benefits" style="color: #7c3aed; text-decoration: none;">Benefits</a> • 
          <a href="${process.env.FRONTEND_URL || 'https://www.wiskulsl.com'}/pricing" style="color: #7c3aed; text-decoration: none;">Pricing</a>
        </p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0 0 10px 0; color: white; font-weight: bold;">WiSkul - Securing Education, One School at a Time</p>
      <p style="margin: 0; color: #999;">📧 support@wiskulsl.com | 📱 +232 78 261 892</p>
      <p style="margin: 10px 0 0 0; color: #666;">75 Main Road, Kossoh Town, Sierra Leone</p>
      <p style="margin: 15px 0 0 0; color: #666;">
        <a href="${process.env.FRONTEND_URL || 'https://www.wiskulsl.com'}/privacy">Privacy Policy</a> • 
        <a href="${process.env.FRONTEND_URL || 'https://www.wiskulsl.com'}/terms">Terms of Service</a>
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

/**
 * Send Professional Welcome Email on School Registration
 */
export async function sendSchoolWelcomeEmail(data: {
  toEmail: string;
  adminName: string;
  schoolName: string;
  loginUrl?: string;
}): Promise<EmailResponse> {
  const loginUrl = data.loginUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`;
  
  const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1a1a2e; background-color: #f4f6f9; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #16213e 0%, #00d4aa 100%); padding: 35px 30px; text-align: center; color: #ffffff; }
    .logo { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
    .content { padding: 35px 30px; }
    .welcome-card { background: #f8fafc; border-left: 4px solid #00d4aa; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .details-table td { padding: 10px 14px; border-bottom: 1px solid #edf2f7; font-size: 14px; }
    .button { display: inline-block; background: #00d4aa; color: #1a1a2e !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 14px; margin: 20px 0; tracking: 0.5px; }
    .footer { background: #1a1a2e; color: #a0aec0; padding: 25px 30px; text-align: center; font-size: 12px; }
    .badge { display: inline-block; background: #e6fffa; color: #047857; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">Wi<span style="color: #00d4aa;">Skul</span></h1>
      <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 14px;">School Management System</p>
    </div>
    
    <div class="content">
      <h2 style="color: #1a1a2e; margin-top: 0;">Welcome to WiSkul, ${data.adminName}! 🎓</h2>
      <p>Congratulations on successfully registering <strong>${data.schoolName}</strong> on WiSkul. Your isolated school workspace and administrator dashboard have been provisioned.</p>

      <div class="welcome-card">
        <span class="badge">v1.0.0 Free Launch Edition</span>
        <h4 style="margin: 8px 0 4px 0; color: #1a1a2e;">Your Workspace Summary:</h4>
        <table class="details-table">
          <tr><td><strong>School Name:</strong></td><td>${data.schoolName}</td></tr>
          <tr><td><strong>Administrator Email:</strong></td><td>${data.toEmail}</td></tr>
          <tr><td><strong>Academic Session:</strong></td><td>2026/2027 Academic Year (Current)</td></tr>
          <tr><td><strong>Included Modules:</strong></td><td>Admissions, Attendance, ID Cards, Staff, Portals</td></tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="${loginUrl}" class="button">Access School Dashboard →</a>
      </div>

      <h3 style="color: #1a1a2e; font-size: 16px; margin-top: 25px;">🚀 Recommended Onboarding Steps:</h3>
      <ol style="font-size: 14px; color: #4a5568; padding-left: 20px;">
        <li style="margin-bottom: 8px;"><strong>Set up Classes & Streams:</strong> Add your grade levels under Academic Management.</li>
        <li style="margin-bottom: 8px;"><strong>Add Teachers & Staff:</strong> Invite teaching staff to access their class registers.</li>
        <li style="margin-bottom: 8px;"><strong>Process Admissions or Import Students:</strong> Enroll students to issue digital ID cards.</li>
      </ol>

      <p style="font-size: 13px; color: #718096; background: #fff5f5; border-left: 3px solid #f56565; padding: 12px; border-radius: 6px; margin-top: 20px;">
        💡 <strong>Note:</strong> Your core v1.0.0 management features are 100% free. Upgrade announcements for v2.0 (Automated Report Cards & Fee Collection) will be shared directly in your admin portal.
      </p>
    </div>

    <div class="footer">
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #ffffff;">WiSkul Customer Support</p>
      <p style="margin: 0;">📧 support@wiskulsl.com | 📱 +232 78 261 892</p>
      <p style="margin: 10px 0 0 0;">75 Main Road, Kossoh Town, Sierra Leone</p>
    </div>
  </div>
</body>
</html>
  `;

  const emailService = new EmailService();
  return emailService.sendEmail({
    to: data.toEmail,
    subject: `🎉 Welcome to WiSkul! Workspace Ready for ${data.schoolName}`,
    body: emailBody,
    isHtml: true,
  });
}

export default new EmailService();
