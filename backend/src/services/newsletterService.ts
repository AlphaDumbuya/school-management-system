/**
 * Newsletter / Marketing Service (platform)
 *
 * Consent-aware marketing list + campaign sending. Auto-added contacts start
 * OUT of marketing; only explicitly opted-in subscribers ever receive campaigns.
 * Every campaign email carries a token-based one-click unsubscribe link.
 */
import crypto from 'crypto';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import emailService from './emailService';
import { platformBranding } from './email/emailBranding';
import { renderEmail, emailButton, escapeHtml } from './email/emailLayout';
import { appUrl } from '../utils/publicUrl';

type Segment = 'all' | 'tenants' | 'prospects';

export class NewsletterService {
  private static newToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  /**
   * Idempotent upsert. `optIn=true` sets/keeps status 'subscribed'; otherwise a
   * brand-new row is created 'unsubscribed' (auto-added, no consent yet) and an
   * existing row's status is left unchanged.
   */
  static async upsertSubscriber(input: {
    email: string;
    name?: string | null;
    source: 'tenant' | 'contact' | 'public' | 'manual';
    tenantId?: string | null;
    optIn: boolean;
  }) {
    const email = input.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError('Invalid email address', 400, 'VALIDATION_ERROR');
    }
    const existing = await db('newsletter_subscribers').where({ email }).first();
    if (existing) {
      const patch: any = {};
      let justSubscribed = false;
      // Was this email already actively subscribed before this call?
      const alreadySubscribed = existing.status === 'subscribed';
      if (input.name && !existing.name) patch.name = input.name;
      if (input.tenantId && !existing.tenant_id) patch.tenant_id = input.tenantId;
      if (input.optIn && existing.status !== 'subscribed') {
        patch.status = 'subscribed';
        patch.unsubscribed_at = null;
        justSubscribed = true;
      }
      if (Object.keys(patch).length) await db('newsletter_subscribers').where({ id: existing.id }).update(patch);
      const row = await db('newsletter_subscribers').where({ id: existing.id }).first();
      return { ...row, justSubscribed, alreadySubscribed, isNew: false };
    }
    let row: any;
    try {
      [row] = await db('newsletter_subscribers')
        .insert({
          email,
          name: input.name || null,
          source: input.source,
          tenant_id: input.tenantId || null,
          status: input.optIn ? 'subscribed' : 'unsubscribed',
          unsubscribe_token: this.newToken(),
          created_at: new Date(),
        })
        .returning('*');
    } catch (err: any) {
      // Race: another request inserted this email between our check and insert.
      // The `email` column is UNIQUE, so re-read and treat as an existing row.
      const raced = await db('newsletter_subscribers').where({ email }).first();
      if (raced) {
        const alreadySubscribed = raced.status === 'subscribed';
        if (input.optIn && !alreadySubscribed) {
          await db('newsletter_subscribers').where({ id: raced.id }).update({ status: 'subscribed', unsubscribed_at: null });
          const updated = await db('newsletter_subscribers').where({ id: raced.id }).first();
          return { ...updated, justSubscribed: true, alreadySubscribed: false, isNew: false };
        }
        return { ...raced, justSubscribed: false, alreadySubscribed, isNew: false };
      }
      throw err;
    }
    // A brand-new row counts as "just subscribed" only when it opted in.
    return { ...row, justSubscribed: !!input.optIn, alreadySubscribed: false, isNew: true };
  }

  /** Absolute unsubscribe URL for a subscriber token. */
  static unsubscribeUrl(token: string): string {
    return appUrl(`/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
  }

  static async unsubscribeByToken(token: string): Promise<boolean> {
    if (!token) return false;
    const row = await db('newsletter_subscribers').where({ unsubscribe_token: token }).first();
    if (!row) return false;
    if (row.status !== 'unsubscribed') {
      await db('newsletter_subscribers').where({ id: row.id }).update({ status: 'unsubscribed', unsubscribed_at: new Date() });
    }
    return true;
  }

  static async list(filters?: { status?: string; search?: string; limit?: number; offset?: number }) {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    let q = db('newsletter_subscribers').orderBy('created_at', 'desc');
    if (filters?.status && filters.status !== 'all') q = q.where('status', filters.status);
    if (filters?.search) {
      q = q.where((b) => {
        b.where('email', 'ilike', `%${filters.search}%`).orWhere('name', 'ilike', `%${filters.search}%`);
      });
    }
    const countRow = await q.clone().count('* as count').first();
    const data = await q.limit(limit).offset(offset);
    return { data, total: parseInt((countRow?.count as string) || '0', 10) };
  }

  static async counts() {
    const rows = await db('newsletter_subscribers').select('status').count('* as count').groupBy('status');
    const map: Record<string, number> = { subscribed: 0, unsubscribed: 0 };
    rows.forEach((r: any) => { map[r.status] = parseInt(r.count as string, 10) || 0; });
    return map;
  }

  static async setStatus(id: string, status: 'subscribed' | 'unsubscribed') {
    const row = await db('newsletter_subscribers').where({ id }).first();
    if (!row) throw new AppError('Subscriber not found', 404, 'NOT_FOUND');
    await db('newsletter_subscribers').where({ id }).update({
      status,
      unsubscribed_at: status === 'unsubscribed' ? new Date() : null,
    });
    return db('newsletter_subscribers').where({ id }).first();
  }

  /** Send a campaign to opted-in subscribers in the segment. */
  static async sendCampaign(
    sentBy: string,
    data: { subject: string; body: string; segment: Segment }
  ): Promise<{ recipients: number; delivered: number }> {
    if (!data.subject?.trim() || !data.body?.trim()) {
      throw new AppError('Subject and message are required', 400, 'VALIDATION_ERROR');
    }
    let q = db('newsletter_subscribers').where({ status: 'subscribed' });
    if (data.segment === 'tenants') q = q.whereNotNull('tenant_id');
    else if (data.segment === 'prospects') q = q.whereNull('tenant_id');

    const subscribers = await q.select('email', 'name', 'unsubscribe_token');
    const branding = platformBranding();
    let delivered = 0;

    for (const s of subscribers) {
      const unsubscribeUrl = `${branding.appUrl}/newsletter/unsubscribe?token=${encodeURIComponent(s.unsubscribe_token)}`;
      const bodyHtml = `
        <p>Hello ${escapeHtml(s.name || 'there')},</p>
        <div style="white-space:pre-wrap;">${escapeHtml(data.body)}</div>
        ${emailButton('Visit WiSkul', branding.appUrl)}`;
      try {
        await emailService.sendEmail({
          ...emailService.platformSenderFor('sales'),
          to: s.email,
          subject: data.subject,
          body: renderEmail({ branding, eyebrow: 'WiSkul Newsletter', heading: data.subject, bodyHtml, preheader: data.subject, unsubscribeUrl }),
          isHtml: true,
        });
        delivered += 1;
      } catch (err: any) {
        logger.warn(`[newsletter] failed to ${s.email}: ${err?.message || err}`);
      }
      await new Promise((res) => setTimeout(res, 60));
    }

    await db('newsletter_campaigns').insert({
      sent_by: sentBy,
      subject: data.subject,
      body: data.body,
      segment: data.segment,
      recipients_count: subscribers.length,
      delivered_count: delivered,
      created_at: new Date(),
    });

    return { recipients: subscribers.length, delivered };
  }

  static async listCampaigns(limit = 20) {
    return db('newsletter_campaigns').orderBy('created_at', 'desc').limit(limit);
  }
}

export default NewsletterService;
