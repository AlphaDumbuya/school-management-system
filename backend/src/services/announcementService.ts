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
  authorRole?: string;
  title: string;
  body: string;
  audience: Audience;
  priority?: Priority;
  notifyByEmail?: boolean;
  /** Optional class scope — announcement targets only this class's members. */
  classId?: string | null;
}

const VALID_AUDIENCE: Audience[] = ['all', 'teacher', 'student', 'parent', 'accountant', 'admissions_officer'];

export class AnnouncementService {
  /**
   * The class ids a teacher may target: subjects they're assigned to + classes
   * they lead. Tenant-scoped via the teacher's user row.
   */
  async getTeacherClassIds(tenantId: string, userId: string): Promise<string[]> {
    const teacher = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.user_id', userId)
      .where('users.tenant_id', tenantId)
      .select('teachers.id')
      .first();
    if (!teacher) return [];
    const assigned = await db('teacher_assignments').where('teacher_id', teacher.id).distinct('class_id');
    const led = await db('classes').where('class_teacher_id', teacher.id).select('id');
    return Array.from(new Set<string>([
      ...assigned.map((r: any) => r.class_id).filter(Boolean),
      ...led.map((r: any) => r.id).filter(Boolean),
    ]));
  }

  /** Classes a teacher can announce to (id + name), for the compose dropdown. */
  async getTeacherClasses(tenantId: string, userId: string): Promise<{ id: string; name: string; level?: string }[]> {
    const ids = await this.getTeacherClassIds(tenantId, userId);
    if (!ids.length) return [];
    const rows = await db('classes').whereIn('id', ids).select('id', 'name', 'level').orderBy('name');
    return rows as any;
  }

  /** The class ids a viewer belongs to: student's enrolled classes, or a guardian's children's classes. */
  private async getViewerClassIds(tenantId: string, userId: string, role?: string): Promise<string[]> {
    if (role === 'student') {
      const student = await db('students').where({ user_id: userId, tenant_id: tenantId }).select('id').first();
      if (!student) return [];
      const rows = await db('enrollments').where('student_id', student.id).whereIn('status', ['enrolled', 'active']).distinct('class_id');
      return rows.map((r: any) => r.class_id).filter(Boolean);
    }
    if (role === 'parent' || role === 'guardian') {
      // Guardian rows link a parent login (user_id) directly to student_id.
      // Scope students to the tenant via the students table.
      const guardianRows = await db('guardians as g')
        .join('students as s', 'g.student_id', 's.id')
        .where('g.user_id', userId)
        .where('s.tenant_id', tenantId)
        .distinct('g.student_id');
      const studentIds = guardianRows.map((r: any) => r.student_id).filter(Boolean);
      if (!studentIds.length) return [];
      const rows = await db('enrollments').whereIn('student_id', studentIds).whereIn('status', ['enrolled', 'active']).distinct('class_id');
      return rows.map((r: any) => r.class_id).filter(Boolean);
    }
    if (role === 'teacher') {
      return this.getTeacherClassIds(tenantId, userId);
    }
    return [];
  }

  /** Create an announcement. Optionally email matching users (best-effort). */
  async create(input: CreateAnnouncementInput) {
    const { tenantId, authorId, title, body } = input;
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    if (!title?.trim() || !body?.trim()) {
      throw new AppError('Title and message are required', 400, 'VALIDATION_ERROR');
    }
    let audience: Audience = VALID_AUDIENCE.includes(input.audience) ? input.audience : 'all';
    const priority: Priority = input.priority === 'high' ? 'high' : 'normal';
    let classId: string | null = input.classId ?? null;

    // Teachers are constrained to their own classes and to student/parent
    // audiences — they cannot broadcast school-wide.
    if (input.authorRole === 'teacher') {
      if (!classId) {
        throw new AppError('Please select one of your classes to announce to', 400, 'CLASS_REQUIRED');
      }
      const myClasses = await this.getTeacherClassIds(tenantId, authorId);
      if (!myClasses.includes(classId)) {
        throw new AppError('You can only post to classes you teach', 403, 'FORBIDDEN');
      }
      // Restrict audience to the class members (students and/or parents).
      if (!['all', 'student', 'parent'].includes(audience)) audience = 'all';
    } else if (input.authorRole === 'accountant' || input.authorRole === 'admissions_officer') {
      // Non-admin staff post school-wide (no class scope) but only to the
      // audiences relevant to their function.
      classId = null;
      const allowed: Audience[] = ['all', 'parent', 'student'];
      if (!allowed.includes(audience)) audience = 'all';
    } else if (classId) {
      // Admins may also class-scope; verify the class belongs to the tenant.
      const cls = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as creator', 'classes.created_by', 'creator.id')
        .where('classes.id', classId)
        .where((q: any) => {
          q.where('academic_sessions.tenant_id', tenantId).orWhere((q2: any) => {
            q2.whereNull('classes.academic_session_id').where('creator.tenant_id', tenantId);
          });
        })
        .first();
      if (!cls) throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
    }

    const [row] = await db('announcements')
      .insert({
        tenant_id: tenantId,
        author_id: authorId,
        title: title.trim().slice(0, 200),
        body: body.trim(),
        audience,
        priority,
        class_id: classId,
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

  /**
   * Build the visibility filter for a viewer (admins see everything).
   *
   * Non-admins see an announcement when BOTH hold:
   *   - audience is 'all' or their own role, AND
   *   - it is not class-scoped, OR they belong to that class (or authored it).
   */
  private applyAudienceFilter(
    query: any,
    tenantId: string,
    viewerRole?: string,
    ctx?: { viewerId?: string; viewerClassIds?: string[] }
  ) {
    query.where('announcements.tenant_id', tenantId);
    if (viewerRole && !['principal', 'super_admin'].includes(viewerRole)) {
      const classIds = ctx?.viewerClassIds ?? [];
      const viewerId = ctx?.viewerId;
      // The audiences this viewer's role should receive. 'guardian' and 'parent'
      // are the same audience (both are parent/guardian logins), so a viewer of
      // either role sees announcements addressed to 'parent'.
      const roleAudiences = (viewerRole === 'guardian' || viewerRole === 'parent')
        ? ['parent', 'guardian']
        : [viewerRole];
      // Audience match: 'all' OR any audience mapped to this role.
      query.andWhere((q: any) => {
        q.where('announcements.audience', 'all').orWhereIn('announcements.audience', roleAudiences);
      });
      // Class scope: null class (school-wide) OR one of the viewer's classes OR authored by them.
      query.andWhere((q: any) => {
        q.whereNull('announcements.class_id');
        if (classIds.length) q.orWhereIn('announcements.class_id', classIds);
        if (viewerId) q.orWhere('announcements.author_id', viewerId);
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
    const viewerClassIds = viewerId ? await this.getViewerClassIds(tenantId, viewerId, opts.viewerRole) : [];
    const ctx = { viewerId, viewerClassIds };

    // Total (for pagination)
    const countRow: any = await this.applyAudienceFilter(db('announcements'), tenantId, opts.viewerRole, ctx)
      .count('announcements.id as count')
      .first();
    const total = Number(countRow?.count ?? 0);

    const q = db('announcements')
      .leftJoin('users', 'announcements.author_id', 'users.id');
    this.applyAudienceFilter(q, tenantId, opts.viewerRole, ctx);

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
        'users.role as author_role',
        db.raw("TRIM(CONCAT(users.first_name, ' ', users.last_name)) as author_name"),
        // Respectful, role-based display name (honorific prefix + full name).
        db.raw(`
          CASE users.role
            WHEN 'principal' THEN CONCAT('Principal ', users.first_name, ' ', users.last_name)
            WHEN 'super_admin' THEN CONCAT('Administrator ', users.first_name, ' ', users.last_name)
            WHEN 'teacher' THEN CONCAT('Tr. ', users.first_name, ' ', users.last_name)
            WHEN 'accountant' THEN CONCAT('Bursar ', users.first_name, ' ', users.last_name)
            WHEN 'admissions_officer' THEN CONCAT('Admissions Officer ', users.first_name, ' ', users.last_name)
            ELSE TRIM(CONCAT(users.first_name, ' ', users.last_name))
          END as author_display
        `),
        opts.viewerId
          ? db.raw('(announcement_reads.id IS NOT NULL) as is_read')
          : db.raw('true as is_read')
      );

    return { items, total };
  }

  /** Count announcements the viewer hasn't read yet. */
  async unreadCount(tenantId: string, viewerId: string, viewerRole?: string): Promise<number> {
    if (!tenantId || !viewerId) return 0;
    const viewerClassIds = await this.getViewerClassIds(tenantId, viewerId, viewerRole);
    const q = db('announcements').leftJoin('announcement_reads', function () {
      this.on('announcement_reads.announcement_id', '=', 'announcements.id').andOn(
        'announcement_reads.user_id',
        '=',
        db.raw('?', [viewerId])
      );
    });
    this.applyAudienceFilter(q, tenantId, viewerRole, { viewerId, viewerClassIds });
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
    const viewerClassIds = await this.getViewerClassIds(tenantId, viewerId, viewerRole);
    const q = db('announcements');
    this.applyAudienceFilter(q, tenantId, viewerRole, { viewerId, viewerClassIds });
    const rows = await q.select('announcements.id');
    if (!rows.length) return;
    const now = new Date();
    const records = rows.map((r: any) => ({ announcement_id: r.id, user_id: viewerId, read_at: now }));
    await db('announcement_reads').insert(records).onConflict(['announcement_id', 'user_id']).ignore();
  }

  /** Whether a role is a full admin (can manage any announcement). */
  private isAdminRole(role?: string) {
    return role === 'principal' || role === 'super_admin';
  }

  /** Fetch an announcement scoped to tenant, enforcing ownership for non-admins. */
  private async findManageable(tenantId: string, id: string, editor?: { editorId?: string; editorRole?: string }) {
    const row = await db('announcements').where({ id, tenant_id: tenantId }).first();
    if (!row) throw new AppError('Announcement not found', 404, 'NOT_FOUND');
    if (editor && !this.isAdminRole(editor.editorRole)) {
      if (row.author_id !== editor.editorId) {
        throw new AppError('You can only manage announcements you created', 403, 'FORBIDDEN');
      }
    }
    return row;
  }

  /** Update an announcement (tenant-scoped; non-admins limited to their own). */
  async update(
    tenantId: string,
    id: string,
    patch: Partial<Pick<CreateAnnouncementInput, 'title' | 'body' | 'audience' | 'priority'>>,
    editor?: { editorId?: string; editorRole?: string }
  ) {
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    const existing = await this.findManageable(tenantId, id, editor);

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
      let aud = VALID_AUDIENCE.includes(patch.audience) ? patch.audience : 'all';
      // Non-admins can't broaden beyond their allowed audiences.
      if (editor && !this.isAdminRole(editor.editorRole)) {
        const allowed: Audience[] = editor.editorRole === 'teacher' ? ['all', 'student', 'parent'] : ['all', 'parent', 'student'];
        if (!allowed.includes(aud)) aud = 'all';
      }
      update.audience = aud;
    }
    if (patch.priority !== undefined) {
      update.priority = patch.priority === 'high' ? 'high' : 'normal';
    }
    const [row] = await db('announcements').where({ id: existing.id, tenant_id: tenantId }).update(update).returning('*');
    return row;
  }

  /** Delete an announcement (tenant-scoped; non-admins limited to their own). */
  async remove(tenantId: string, id: string, editor?: { editorId?: string; editorRole?: string }) {
    if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
    const existing = await this.findManageable(tenantId, id, editor);
    await db('announcements').where({ id: existing.id, tenant_id: tenantId }).del();
  }

  /** Best-effort email fan-out to matching, active recipients. */
  private async notifyByEmail(tenantId: string, audience: Audience, row: any) {
    type Recipient = { email: string; first_name?: string };
    let recipients: Recipient[] = [];

    if (row.class_id) {
      // Class-scoped: email the class's students and/or their guardians.
      const enrolled = await db('enrollments')
        .where('class_id', row.class_id)
        .whereIn('status', ['enrolled', 'active'])
        .distinct('student_id');
      const studentIds = enrolled.map((r: any) => r.student_id).filter(Boolean);
      if (!studentIds.length) return;

      if (audience === 'student' || audience === 'all') {
        const students = await db('students as s')
          .join('users as u', 's.user_id', 'u.id')
          .whereIn('s.id', studentIds)
          .where('u.status', 'active')
          .whereNotNull('u.email')
          .select('u.email', 'u.first_name');
        recipients.push(...students);
      }
      if (audience === 'parent' || audience === 'all') {
        const guardians = await db('guardians')
          .whereIn('student_id', studentIds)
          .whereNotNull('email')
          .select('email', 'first_name');
        recipients.push(...guardians);
      }
    } else {
      // Tenant-wide by role (admins broadcasting).
      const q = db('users').where({ tenant_id: tenantId, status: 'active' }).whereNotNull('email');
      if (audience !== 'all') q.andWhere({ role: audience });
      recipients = await q.select('email', 'first_name');
    }

    // De-duplicate by email.
    const seen = new Set<string>();
    recipients = recipients.filter((r) => r.email && !seen.has(r.email) && seen.add(r.email));
    if (!recipients.length) return;

    const { default: emailService } = await import('./emailService');
    const anyService = emailService as any;
    if (typeof anyService.sendAnnouncementEmail !== 'function') return;

    await Promise.allSettled(
      recipients.map((u) =>
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
