/**
 * Platform Communication Service (super admin)
 *
 * The operator's communication hub:
 *  - Inbox: inbound messages (contact-form submissions, replies) with read/
 *    archive management and unread counts.
 *  - Broadcast: send an announcement/email to schools filtered by status, using
 *    the platform-branded email sender. Records a broadcast log with counts.
 */
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import emailService from './emailService';
import { platformBranding } from './email/emailBranding';
import { renderEmail, emailButton, escapeHtml } from './email/emailLayout';

export class PlatformCommunicationService {
  // ── Inbox ─────────────────────────────────────────────────────────────────

  static async listMessages(filters?: { status?: string; search?: string; limit?: number; offset?: number }) {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    let query = db('platform_messages').orderBy('created_at', 'desc');

    if (filters?.status && filters.status !== 'all') query = query.where('status', filters.status);
    if (filters?.search) {
      query = query.where((b) => {
        b.where('name', 'ilike', `%${filters.search}%`)
          .orWhere('email', 'ilike', `%${filters.search}%`)
          .orWhere('school', 'ilike', `%${filters.search}%`)
          .orWhere('message', 'ilike', `%${filters.search}%`);
      });
    }

    const countRow = await query.clone().count('* as count').first();
    const rows = await query.limit(limit).offset(offset);
    return { data: rows, total: parseInt((countRow?.count as string) || '0', 10) };
  }

  static async unreadCount(): Promise<number> {
    const row = await db('platform_messages').where({ status: 'unread' }).count('* as count').first();
    return parseInt((row?.count as string) || '0', 10);
  }

  static async setStatus(id: string, status: 'unread' | 'read' | 'archived') {
    const msg = await db('platform_messages').where({ id }).first();
    if (!msg) throw new AppError('Message not found', 404, 'NOT_FOUND');
    await db('platform_messages').where({ id }).update({
      status,
      read_at: status === 'read' ? new Date() : msg.read_at,
    });
    return db('platform_messages').where({ id }).first();
  }

  static async deleteMessage(id: string) {
    await db('platform_messages').where({ id }).del();
    return { success: true };
  }

  /** Reply to an inbound message by email (platform-branded). */
  static async reply(id: string, subject: string, body: string) {
    const msg = await db('platform_messages').where({ id }).first();
    if (!msg) throw new AppError('Message not found', 404, 'NOT_FOUND');

    const branding = platformBranding();
    const bodyHtml = `
      <p>Hello ${escapeHtml(msg.name || 'there')},</p>
      <div style="white-space:pre-wrap;">${escapeHtml(body)}</div>
      ${emailButton('Visit WiSkul', branding.appUrl)}`;

    await emailService.sendEmail({
      to: msg.email,
      subject: subject || 'Re: your message to WiSkul',
      body: renderEmail({ branding, eyebrow: 'WiSkul Support', heading: subject || 'A reply from WiSkul', bodyHtml, preheader: 'A reply from the WiSkul team.' }),
      isHtml: true,
    });

    await db('platform_messages').where({ id }).update({ status: 'read', read_at: new Date() });
    return { success: true };
  }

  // ── Broadcast ───────────────────────────────────────────────────────────

  /**
   * Send a broadcast email to schools matching the audience filter. Returns the
   * recipient/delivered counts and records a broadcast log entry.
   */
  static async broadcast(
    sentBy: string,
    data: { subject: string; body: string; audience: 'all' | 'active' | 'trial' | 'suspended' }
  ): Promise<{ recipients: number; delivered: number }> {
    if (!data.subject?.trim() || !data.body?.trim()) {
      throw new AppError('Subject and message are required', 400, 'VALIDATION_ERROR');
    }

    // Resolve recipient schools (exclude archived/expired-deleted tenants).
    let q = db('tenants').whereRaw(`NOT (status = 'expired' AND jsonb_exists(settings, 'archived_from'))`);
    if (data.audience === 'active') q = q.where('status', 'active');
    else if (data.audience === 'trial') q = q.where('status', 'trial');
    else if (data.audience === 'suspended') q = q.where('status', 'suspended');

    const tenants = await q.select('id', 'name', 'contact_email');

    // Resolve the best contact email per tenant (contact_email → school.email → principal).
    const recipients: { email: string; schoolName: string }[] = [];
    for (const t of tenants) {
      let email = t.contact_email as string | null;
      if (!email) {
        const school = await db('schools').where({ tenant_id: t.id }).first();
        email = school?.email || null;
      }
      if (!email) {
        const principal = await db('users').where({ tenant_id: t.id, role: 'principal' }).first();
        email = principal?.email || null;
      }
      if (email) recipients.push({ email, schoolName: t.name });
    }

    const branding = platformBranding();
    let delivered = 0;
    for (const r of recipients) {
      const bodyHtml = `
        <p>Hello ${escapeHtml(r.schoolName)},</p>
        <div style="white-space:pre-wrap;">${escapeHtml(data.body)}</div>
        ${emailButton('Open WiSkul', `${branding.appUrl}/login`)}`;
      try {
        await emailService.sendEmail({
          to: r.email,
          subject: data.subject,
          body: renderEmail({ branding, eyebrow: 'WiSkul Announcement', heading: data.subject, bodyHtml, preheader: data.subject }),
          isHtml: true,
        });
        delivered += 1;
      } catch (err: any) {
        logger.warn(`[broadcast] failed to ${r.email}: ${err?.message || err}`);
      }
      // Gentle pacing to respect provider rate limits.
      await new Promise((res) => setTimeout(res, 60));
    }

    await db('platform_broadcasts').insert({
      sent_by: sentBy,
      subject: data.subject,
      body: data.body,
      audience: data.audience,
      recipients_count: recipients.length,
      delivered_count: delivered,
      created_at: new Date(),
    });

    return { recipients: recipients.length, delivered };
  }

  static async listBroadcasts(limit = 20) {
    return db('platform_broadcasts').orderBy('created_at', 'desc').limit(limit);
  }
}

export default PlatformCommunicationService;
