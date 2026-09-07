/**
 * announcementService — tenant-scoped school announcements.
 *
 * All queries are scoped by tenant_id. Audience filtering lets a viewer see
 * announcements addressed to 'all' or to their specific role.
 */
import { db } from '@utils/database';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/errorHandler';

export type Audience = 'all' | 'teacher' | 'student' | 'parent' | 'accountant' | 'admissions_officer';
export type Priority = 'normal' | 'high';

export interface CreateAnnouncementInput {
  tenantId: string;
  authorId: string;
  title: string;
  body: string;
  audience: Audience;
  priority?: Priority;
  notifyByEmail?: boolean;
}

const VALID_AUDIENCE: Audience[] = ['all', 'teacher', 'student', 'parent', 'accountant', 'admissions_officer'];

export class AnnouncementService {
  /** Create an announcement. Optionally email matching users (best-effort). */
  async create(input: CreateAnnouncementInput) {
    const { tenantId, authorId, title, body } = input;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    if (!title?.trim() || !body?.trim()) {
      throw new AppError('Title and message are required', 400, 'VALIDATION_ERROR');
    }
    const audience: Audience = VALID_AUDIENCE.includes(input.audience) ? input.audience : 'all';
    const priority: Priority = input.priority === 'high' ? 'high' : 'normal';

    const [row] = await db('announcements')
      .insert({
        tenant_id: tenantId,
        author_id: authorId,
        title: title.trim().slice(0, 200),
        body: body.trim(),
        audience,
        priority,
        email_sent: false,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    if (input.notifyByEmail) {
      this.notifyByEmail(tenantId, audience, row).catch((e) =>
        logger.warn(`Announcement email notify failed: ${(e as any)?.message || e}`)
      );
    }

    return row;
  }

  /** Build the audience filter for a viewer (admins see everything). */
  private applyAudienceFilter(query: any, tenantId: string, viewerRole?: string) {
    query.where('announcements.tenant_id', tenantId);
    if (viewerRole && !['principal', 'super_admin'].includes(viewerRole)) {
      query.andWhere((q: any) => {
        q.where('announcements.audience', 'all').orWhere('announcements.audience', viewerRole);
      });
    }
    return query;
  }

  /**
   * List announcements for a tenant with pagination + per-user read state.
   * Returns { items, total } so the UI can page.
   */
  async list(
    tenantId: string,
    opts: { viewerRole?: string; viewerId?: string; limit?: number; offset?: number } = {}
  ) {
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    const limit = Math.min(opts.limit ?? 20, 100);
    const offset = opts.offset ?? 0;

    const viewerId = opts.viewerId;

    // Total (for pagination)
    const countRow: any = await this.applyAudienceFilter(db('announcements'), tenantId, opts.viewerRole)
      .count('announcements.id as count')
      .first();
    const total = Number(countRow?.count ?? 0);

    const q = db('announcements')
      .leftJoin('users', 'announcements.author_id', 'users.id');
    this.applyAudienceFilter(q, tenantId, opts.viewerRole);

    // Join read receipts for the viewer so we can flag is_read.
    if (viewerId) {
      q.leftJoin('announcement_reads', function () {
        this.on('announcement_reads.announcement_id', '=', 'announcements.id').andOn(
          'announcement_reads.user_id',
          '=',
          db.raw('?', [viewerId])
        );
      });
    }

    const items = await q
      .orderBy('announcements.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select(
        'announcements.*',
        db.raw("CONCAT(users.first_name, ' ', users.last_name) as author_name"),
        opts.viewerId
          ? db.raw('(announcement_reads.id IS NOT NULL) as is_read')
          : db.raw('true as is_read')
      );

    return { items, total };
  }

  /** Count announcements the viewer hasn't read yet. */
  async unreadCount(tenantId: string, viewerId: string, viewerRole?: string): Promise<number> {
    if (!tenantId || !viewerId) return 0;
    const q = db('announcements').leftJoin('announcement_reads', function () {
      this.on('announcement_reads.announcement_id', '=', 'announcements.id').andOn(
        'announcement_reads.user_id',
        '=',
        db.raw('?', [viewerId])
      );
    });
    this.applyAudienceFilter(q, tenantId, viewerRole);
    q.whereNull('announcement_reads.id');
    const row: any = await q.count('announcements.id as count').first();
    return Number(row?.count ?? 0);
  }

  /** Mark a single announcement as read for a user (idempotent). */
  async markRead(tenantId: string, viewerId: string, announcementId: string) {
    if (!tenantId || !viewerId) return;
    // Ensure the announcement belongs to the tenant before recording a read.
    const exists = await db('announcements').where({ id: announcementId, tenant_id: tenantId }).first();
    if (!exists) throw new AppError('Announcement not found', 404, 'NOT_FOUND');
    await db('announcement_reads')
      .insert({ announcement_id: announcementId, user_id: viewerId, read_at: new Date() })
      .onConflict(['announcement_id', 'user_id'])
      .ignore();
  }

  /** Mark all visible announcements as read for a user. */
  async markAllRead(tenantId: string, viewerId: string, viewerRole?: string) {
    if (!tenantId || !viewerId) return;
    const q = db('announcements');
    this.applyAudienceFilter(q, tenantId, viewerRole);
    const rows = await q.select('announcements.id');
    if (!rows.length) return;
    const now = new Date();
    const records = rows.map((r: any) => ({ announcement_id: r.id, user_id: viewerId, read_at: now }));
    await db('announcement_reads').insert(records).onConflict(['announcement_id', 'user_id']).ignore();
  }

  /** Update an announcement (tenant-scoped). */
  async update(tenantId: string, id: string, patch: Partial<Pick<CreateAnnouncementInput, 'title' | 'body' | 'audience' | 'priority'>>) {
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    const update: any = { updated_at: new Date() };
    if (patch.title !== undefined) {
      if (!patch.title.trim()) throw new AppError('Title cannot be empty', 400, 'VALIDATION_ERROR');
      update.title = patch.title.trim().slice(0, 200);
    }
    if (patch.body !== undefined) {
      if (!patch.body.trim()) throw new AppError('Message cannot be empty', 400, 'VALIDATION_ERROR');
      update.body = patch.body.trim();
    }
    if (patch.audience !== undefined) {
      update.audience = VALID_AUDIENCE.includes(patch.audience) ? patch.audience : 'all';
    }
    if (patch.priority !== undefined) {
      update.priority = patch.priority === 'high' ? 'high' : 'normal';
    }
    const [row] = await db('announcements').where({ id, tenant_id: tenantId }).update(update).returning('*');
    if (!row) throw new AppError('Announcement not found', 404, 'NOT_FOUND');
    return row;
  }

  /** Delete an announcement (tenant-scoped). */
  async remove(tenantId: string, id: string) {
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    const deleted = await db('announcements').where({ id, tenant_id: tenantId }).del();
    if (!deleted) throw new AppError('Announcement not found', 404, 'NOT_FOUND');
  }

  /** Best-effort email fan-out to matching, active users in the tenant. */
  private async notifyByEmail(tenantId: string, audience: Audience, row: any) {
    const q = db('users').where({ tenant_id: tenantId, status: 'active' }).whereNotNull('email');
    if (audience !== 'all') q.andWhere({ role: audience });
    const users = await q.select('email', 'first_name');
    if (!users.length) return;

    const { default: emailService } = await import('./emailService');
    // Reuse the generic announcement email if present; otherwise skip quietly.
    const anyService = emailService as any;
    if (typeof anyService.sendAnnouncementEmail !== 'function') return;

    await Promise.allSettled(
      users.map((u: any) =>
        anyService.sendAnnouncementEmail(tenantId, u.email, {
          userName: u.first_name || 'there',
          title: row.title,
          body: row.body,
          priority: row.priority,
        })
      )
    );
    await db('announcements').where({ id: row.id }).update({ email_sent: true });
  }
}

export default new AnnouncementService();
