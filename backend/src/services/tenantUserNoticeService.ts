/**
 * tenantUserNoticeService: tells a school's own people (teachers, bursar,
 * admissions staff, students, parents) when the school is suspended or comes
 * back, so they are not left guessing why they can't sign in.
 *
 * The school owner already gets the detailed email (with the reason and how to
 * fix it). Everyone else gets a neutral message by category and is pointed to
 * their school administrator: the internal reason is never shared with them.
 *
 * Safe to run twice: each person is claimed once per suspension (per
 * restoration), so a second run only reaches people who were missed. A person
 * whose email fails is released so the next run retries them.
 */
import crypto from 'crypto';
import { db } from '@utils/database';
import { logger } from '@utils/logger';

export type TenantNoticeKind = 'suspended' | 'restored';

export interface TenantUserNoticeResult {
  total: number;
  sent: number;
  /** Not sent: already told earlier, or the address can't receive mail here. */
  skipped: number;
  failed: number;
  /** Left over because the time budget ran out; run again to continue. */
  remaining: number;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Everyone to tell except the owner (principal) and the platform operator. */
export async function schoolUserRecipients(tenantId: string): Promise<Array<{ email: string; name: string }>> {
  const [users, guardians] = await Promise.all([
    db('users').where({ tenant_id: tenantId, status: 'active' }).whereNotIn('role', ['principal', 'super_admin']).select('email', 'first_name'),
    db('guardians as g').join('students as s', 's.id', 'g.student_id').where('s.tenant_id', tenantId).whereNotNull('g.email').select('g.email', 'g.first_name'),
  ]);
  const seen = new Set<string>();
  const out: Array<{ email: string; name: string }> = [];
  for (const r of [...users, ...guardians] as any[]) {
    const email = String(r.email || '').trim();
    const key = email.toLowerCase();
    if (!EMAIL.test(email) || seen.has(key)) continue;
    seen.add(key);
    out.push({ email, name: String(r.first_name || '').trim() });
  }
  return out;
}

export async function notifyTenantUsers(
  tenantId: string,
  kind: TenantNoticeKind,
  opts: { budgetMs?: number; concurrency?: number } = {},
): Promise<TenantUserNoticeResult> {
  const started = Date.now();
  const budgetMs = opts.budgetMs ?? 35_000;
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 12, 30));

  const tenant = await db('tenants').where({ id: tenantId }).first('name', 'settings', 'status');
  if (!tenant) return { total: 0, sent: 0, skipped: 0, failed: 0, remaining: 0 };
  const settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings || '{}') : (tenant.settings || {});
  // One "round" per suspension; a restore is its own round (per hour, so a double click doesn't double send).
  const round = kind === 'suspended' ? String(settings.suspended_at || 'unknown') : new Date().toISOString().slice(0, 13);
  const category = String(settings.suspension_category || 'other');

  const { claimNotice } = await import('./finance/core');
  const { default: emailService } = await import('./emailService');
  const recipients = await schoolUserRecipients(tenantId);
  const result: TenantUserNoticeResult = { total: recipients.length, sent: 0, skipped: 0, failed: 0, remaining: 0 };

  let next = 0;
  const worker = async () => {
    while (next < recipients.length) {
      if (Date.now() - started > budgetMs) return;
      const r = recipients[next++];
      const key = `tenant-users:${kind}:${round}:${crypto.createHash('sha1').update(r.email.toLowerCase()).digest('hex').slice(0, 20)}`;
      if (!(await claimNotice(tenantId, key))) { result.skipped++; continue; }
      try {
        const res: any = await emailService.sendTenantUserNoticeEmail(tenantId, r.email, { schoolName: tenant.name, kind, category, name: r.name });
        if (res?.status === 'sent') result.sent++;
        else {
          // 'disabled' = nothing left the building (demo address / no email key): free the claim.
          result.skipped++;
          await db('finance_notices').where({ tenant_id: tenantId, key }).del().catch(() => undefined);
        }
      } catch (e: any) {
        result.failed++;
        await db('finance_notices').where({ tenant_id: tenantId, key }).del().catch(() => undefined);
        logger.warn(`[tenant user notice] ${kind} email to ${r.email} failed: ${e?.message || e}`);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  result.remaining = Math.max(0, recipients.length - next);
  logger.info(`[tenant user notice] ${kind} for tenant ${tenantId}: ${JSON.stringify(result)}`);
  return result;
}

/** A sentence for the super admin. */
export function describeUserNotice(r: TenantUserNoticeResult): string {
  if (!r.total) return 'No other users have an email address on file.';
  const parts = [`${r.sent} of ${r.total} school users emailed`];
  if (r.failed) parts.push(`${r.failed} failed`);
  if (r.remaining) parts.push(`${r.remaining} still to go, use "Email users" to continue`);
  return `${parts.join(', ')}.`;
}
