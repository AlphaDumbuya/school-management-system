/**
 * Protection for a school's payment settings (its Monime access token and space).
 *
 * Whoever controls these decides where every fee payment goes, so changing them
 * is treated like changing a bank account:
 *  - only the school's principal, never through an impersonated session;
 *  - the principal's password (and 2FA code, if on) is asked for again, with a
 *    lock-out after repeated wrong answers (counted in the database, so it
 *    holds across serverless instances);
 *  - the values are validated, the token is stored encrypted and bound to the
 *    school and space (so a copied or edited row stops working);
 *  - every change and every failed attempt is written to the audit log (never
 *    the token itself, only a short fingerprint);
 *  - the principals, the school contact and the person who made it are told by
 *    email and in the app straight away.
 */
import crypto from 'crypto';
import type { Knex } from 'knex';
import type { Request } from 'express';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { PasswordService } from './passwordService';
import { JWTService } from './jwtService';

export const STEP_UP_WINDOW_MINUTES = 15;
export const STEP_UP_MAX_FAILURES = 5;

/** Binds the stored token to this school AND this space. */
export const monimeContext = (tenantId: string, spaceId: string) => `monime:${tenantId}:${spaceId}`;

const SPACE_RE = /^[A-Za-z0-9_-]{3,120}$/;
// A token is opaque; allow printable characters only (no spaces or control characters).
const TOKEN_RE = /^[\x21-\x7E]{10,2048}$/;

export function validateSpaceId(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!SPACE_RE.test(s)) {
    throw new AppError('The Monime Space ID should be 3 to 120 letters, numbers, dashes or underscores (for example spc_abc123).', 400, 'VALIDATION_ERROR');
  }
  return s;
}

export function validateAccessToken(v: unknown): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!TOKEN_RE.test(s)) {
    throw new AppError('That Monime access token does not look right. Copy it again from your Monime dashboard, with no spaces.', 400, 'VALIDATION_ERROR');
  }
  return s;
}

/** A short, non-reversible tag so a log can say "the token changed" without holding it. */
export const tokenFingerprint = (token: string) => crypto.createHash('sha256').update(token).digest('hex').slice(0, 8);

/** Show enough of the space id to recognise it, not all of it. */
export const maskSpace = (id?: string | null) => (id ? (id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`) : 'none');

/** A session started by a platform admin acting as the principal must not move the school's money. */
export function assertNotImpersonated(req: Request): void {
  try {
    const header = req.headers.authorization || '';
    const payload: any = JWTService.verifyAccessToken(header.replace(/^Bearer\s+/i, ''));
    if (payload?.impersonation || payload?.impersonatedBy) {
      throw new AppError('Payment settings can only be changed by the school\'s principal signed in directly.', 403, 'IMPERSONATION_BLOCKED');
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    // An unreadable token never reaches here (authenticate already rejected it).
  }
}

interface RequestMeta { ip?: string; userAgent?: string }

async function recordFailure(conn: Knex, userId: string, role: string, meta: RequestMeta, why: string) {
  await conn('audit_logs').insert({
    user_id: userId, performed_by: userId, performed_by_role: role,
    action: 'payment_settings.stepup_failed', entity_type: 'payment_settings',
    new_values: JSON.stringify({ why }), ip_address: meta.ip || null, user_agent: meta.userAgent || null,
    source: 'api', created_at: new Date(),
  }).catch((e) => logger.warn(`Could not record a failed payment-settings check: ${e?.message || e}`));
}

/**
 * Ask the signed-in principal to prove it is them again. Throws:
 *  - 429 STEP_UP_LOCKED after too many wrong answers in a short time;
 *  - 403 PASSWORD_REQUIRED / TWO_FACTOR_REQUIRED when a value is missing (the app then asks for it);
 *  - 403 STEP_UP_FAILED when it is wrong.
 */
export async function assertStepUp(
  conn: Knex,
  p: { userId: string; role: string; password?: unknown; twoFactorCode?: unknown } & RequestMeta,
  twoFactor: { isEnabled(id: string): Promise<boolean>; verifyCode(id: string, code: string): Promise<boolean> },
): Promise<void> {
  const since = new Date(Date.now() - STEP_UP_WINDOW_MINUTES * 60_000);
  const [{ n }] = (await conn('audit_logs')
    .where({ performed_by: p.userId, action: 'payment_settings.stepup_failed' })
    .where('created_at', '>', since).count('* as n')) as any[];
  if (Number(n) >= STEP_UP_MAX_FAILURES) {
    throw new AppError(`Too many wrong attempts. Payment settings are locked for ${STEP_UP_WINDOW_MINUTES} minutes. If this was not you, change your password.`, 429, 'STEP_UP_LOCKED');
  }

  const password = typeof p.password === 'string' ? p.password : '';
  if (!password) throw new AppError('Enter your password to confirm this change.', 403, 'PASSWORD_REQUIRED');

  const user: any = await conn('users').where({ id: p.userId }).first('password_hash');
  const ok = !!user?.password_hash && (await PasswordService.comparePassword(password, user.password_hash));
  if (!ok) {
    await recordFailure(conn, p.userId, p.role, p, 'wrong password');
    throw new AppError('Your password is not correct.', 403, 'STEP_UP_FAILED');
  }

  if (await twoFactor.isEnabled(p.userId)) {
    const code = typeof p.twoFactorCode === 'string' ? p.twoFactorCode.trim() : '';
    if (!code) throw new AppError('Enter the 6-digit code from your authenticator app.', 403, 'TWO_FACTOR_REQUIRED');
    if (!(await twoFactor.verifyCode(p.userId, code))) {
      await recordFailure(conn, p.userId, p.role, p, 'wrong 2FA code');
      throw new AppError('That code is not correct.', 403, 'STEP_UP_FAILED');
    }
  }
}

export interface PaymentChange {
  kind: 'enabled' | 'updated' | 'disabled';
  tokenChanged: boolean;
  tokenFingerprint?: string;
  spaceFrom?: string | null;
  spaceTo?: string | null;
}

/** Write the change to the audit log (never the token). */
export async function recordChange(conn: Knex, p: { userId: string; role: string; tenantId: string; change: PaymentChange } & RequestMeta) {
  const action = p.change.kind === 'disabled' ? 'payment_settings.disable' : 'payment_settings.update';
  await conn('audit_logs').insert({
    user_id: p.userId, performed_by: p.userId, performed_by_role: p.role,
    action, entity_type: 'payment_settings',
    old_values: JSON.stringify({ space: p.change.spaceFrom ?? null }),
    new_values: JSON.stringify({
      tenantId: p.tenantId, kind: p.change.kind, space: p.change.spaceTo ?? null,
      tokenChanged: p.change.tokenChanged, tokenFingerprint: p.change.tokenFingerprint ?? null,
    }),
    ip_address: p.ip || null, user_agent: p.userAgent || null, source: 'api', created_at: new Date(),
  });
}

/** The last change to this school's payment settings, for display. */
export async function lastChange(conn: Knex, tenantId: string): Promise<{ at: string; by: string | null } | null> {
  const row: any = await conn('audit_logs as a')
    .leftJoin('users as u', 'u.id', 'a.performed_by')
    .whereIn('a.action', ['payment_settings.update', 'payment_settings.disable'])
    .whereRaw("a.new_values->>'tenantId' = ?", [tenantId])
    .orderBy('a.created_at', 'desc')
    .first('a.created_at', conn.raw("TRIM(CONCAT(u.first_name, ' ', u.last_name)) as by_name"));
  return row ? { at: new Date(row.created_at).toISOString(), by: row.by_name || null } : null;
}

/**
 * Tell the school: the school owner(s), the school email and the person who
 * made the change get an email, and the owner(s) get an in-app notice. Payment
 * settings are owner-only, so other principals are not alerted about a page
 * they cannot open. (A school with no named owner: its principals stand in.)
 * Best-effort: a mail problem never blocks the change.
 */
export async function notifyChange(
  conn: Knex,
  p: { tenantId: string; actorId: string; change: PaymentChange } & RequestMeta,
): Promise<void> {
  try {
    const { schoolOwners, uniqueEmails } = await import('../utils/schoolLeaders.js');
    const [actor, owners, school] = await Promise.all([
      conn('users').where({ id: p.actorId }).first('id', 'email', 'first_name', 'last_name'),
      schoolOwners(p.tenantId),
      conn('schools').where({ tenant_id: p.tenantId }).first('email'),
    ]);
    const actorName = [actor?.first_name, actor?.last_name].filter(Boolean).join(' ') || actor?.email || 'A user';
    const recipients = uniqueEmails([actor?.email, ...owners.map((u) => u.email), school?.email]);

    const what = p.change.kind === 'disabled'
      ? 'Online fee payments were turned OFF'
      : [
          p.change.kind === 'enabled' ? 'Online fee payments were turned ON' : 'Payment settings were updated',
          p.change.tokenChanged ? 'the Monime access token was replaced' : null,
          p.change.spaceFrom !== p.change.spaceTo ? `the Monime Space changed from ${maskSpace(p.change.spaceFrom)} to ${maskSpace(p.change.spaceTo)}` : null,
        ].filter(Boolean).join(', ');

    const { default: emailService } = await import('./emailService.js');
    await Promise.all(recipients.map((to) =>
      emailService.sendPaymentSettingsChangedEmail(p.tenantId, to, {
        actorName, what, when: new Date(), ip: p.ip, userAgent: p.userAgent,
      }).catch((e: any) => logger.warn(`Payment-settings alert email failed: ${e?.message || e}`)),
    ));

    const { notifyUsers } = await import('./finance/core.js');
    await notifyUsers(owners.map((u) => u.id), {
      subject: 'Payment settings changed',
      message: `${what} by ${actorName}. If this was not you, change your password and turn off online payments now.`,
      url: '/settings?tab=payments', sourceType: 'payment_settings', sourceId: p.tenantId,
    });
  } catch (e: any) {
    logger.warn(`Could not send the payment-settings change alert: ${e?.message || e}`);
  }
}
