/**
 * Protection for a school's payment settings (its Monime access token and space).
 *
 * Whoever controls these decides where every fee payment goes, so changing them
 * is treated like changing a bank account:
 *  - only the school's principal, never through an impersonated session;
 *  - connecting or changing the account needs a school verified by WiSkul
 *    (EMIS code and the owner's ID checked by a person); turning online
 *    payments OFF is always allowed, as an emergency stop;
 *  - two checks every time: the owner's password, plus the 6-digit code from
 *    their authenticator app (2FA) or, without one, a one-time code emailed to
 *    their account (single use, 10 minutes, a few attempts), with a lock-out
 *    after repeated wrong answers (counted in the database, so it holds across
 *    serverless instances);
 *  - the values are validated, the token is stored encrypted and bound to the
 *    school and space (so a copied or edited row stops working);
 *  - every change and every failed attempt is written to the audit log (never
 *    the token itself, only a short fingerprint);
 *  - the school owner(s), the school contact and the person who made it are
 *    told by email and in the app straight away.
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
  p: {
    userId: string; role: string; password?: unknown; twoFactorCode?: unknown;
    /** Require an emailed code (for this purpose) when the user has no authenticator app. */
    emailCodePurpose?: string; emailCode?: unknown;
  } & RequestMeta,
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
    return;
  }

  // No authenticator app: a code emailed to the account, when the caller asks
  // for a second check (a password alone is one stolen secret away).
  if (p.emailCodePurpose) {
    const code = typeof p.emailCode === 'string' ? p.emailCode.trim() : '';
    if (!code) {
      throw new AppError('Enter the 6-digit code we emailed you. Choose "Email me a code" if you have not got one yet.', 403, 'EMAIL_CODE_REQUIRED');
    }
    const ok = await consumeEmailCode(conn, p.userId, p.emailCodePurpose, code);
    if (!ok) {
      await recordFailure(conn, p.userId, p.role, p, 'wrong email code');
      throw new AppError('That code is not correct or has expired. Ask for a new code and try again.', 403, 'STEP_UP_FAILED');
    }
  }
}

// ── Emailed one-time codes (second check without an authenticator app) ────────

export const EMAIL_CODE_TTL_MINUTES = 10;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
const EMAIL_CODE_RESEND_SECONDS = 60;
const EMAIL_CODE_MAX_PER_HOUR = 5;

/** Codes are kept only as a keyed hash, tied to the person and the purpose. */
function hashEmailCode(userId: string, purpose: string, code: string): string {
  const key = process.env.STEP_UP_CODE_SECRET || process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'wiskul-step-up';
  return crypto.createHmac('sha256', key).update(`${userId}:${purpose}:${code}`).digest('hex');
}

/** "a****@gmail.com": enough to recognise the inbox, not to read the address. */
export function maskEmail(email?: string | null): string {
  const e = String(email || '');
  const at = e.indexOf('@');
  if (at < 1) return 'your email';
  return `${e[0]}${'*'.repeat(Math.max(1, Math.min(4, at - 1)))}${e.slice(at)}`;
}

/**
 * Email a 6-digit code to the signed-in user for `purpose`. A new code replaces
 * any earlier one. At most one a minute and five an hour per person.
 */
export async function sendEmailCode(
  conn: Knex,
  p: { userId: string; tenantId: string | null; purpose: string; purposeText: string } & RequestMeta,
): Promise<{ sentTo: string; expiresInMinutes: number; resendInSeconds: number }> {
  const user: any = await conn('users').where({ id: p.userId }).first('id', 'email', 'first_name', 'last_name', 'tenant_id');
  if (!user?.email) throw new AppError('Your account has no email address to send a code to.', 400, 'NO_EMAIL');

  const recent: any[] = await conn('step_up_codes')
    .where({ user_id: p.userId, purpose: p.purpose })
    .where('created_at', '>', new Date(Date.now() - 60 * 60_000))
    .orderBy('created_at', 'desc')
    .select('created_at');
  if (recent.length) {
    const wait = EMAIL_CODE_RESEND_SECONDS - Math.floor((Date.now() - new Date(recent[0].created_at).getTime()) / 1000);
    if (wait > 0) throw new AppError(`Please wait ${wait} seconds before asking for another code.`, 429, 'EMAIL_CODE_TOO_SOON');
  }
  if (recent.length >= EMAIL_CODE_MAX_PER_HOUR) {
    throw new AppError('Too many codes asked for. Please try again in an hour.', 429, 'EMAIL_CODE_LIMIT');
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const now = new Date();
  await conn.transaction(async (trx) => {
    // Only the newest code counts.
    await trx('step_up_codes').where({ user_id: p.userId, purpose: p.purpose }).whereNull('consumed_at').update({ consumed_at: now });
    await trx('step_up_codes').insert({
      user_id: p.userId, tenant_id: p.tenantId, purpose: p.purpose,
      code_hash: hashEmailCode(p.userId, p.purpose, code),
      expires_at: new Date(now.getTime() + EMAIL_CODE_TTL_MINUTES * 60_000), created_at: now,
    });
  });

  const { default: emailService } = await import('./emailService.js');
  const res: any = await emailService.sendStepUpCodeEmail(p.tenantId, user.email, {
    userName: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'there',
    code, minutes: EMAIL_CODE_TTL_MINUTES, purposeText: p.purposeText, ip: p.ip,
  });
  if (res?.status !== 'sent' && process.env.NODE_ENV === 'development' && !process.env.VERCEL) {
    // Local development without an email provider: show the code in the server log.
    logger.info(`[dev] Step-up code for user ${p.userId} (${p.purpose}): ${code}`);
  } else if (res?.status !== 'sent') {
    logger.warn(`Step-up code email not confirmed for user ${p.userId} (${res?.status || 'no status'})`);
    throw new AppError('We could not send the code by email. Please try again in a minute.', 503, 'EMAIL_CODE_NOT_SENT');
  }
  return { sentTo: maskEmail(user.email), expiresInMinutes: EMAIL_CODE_TTL_MINUTES, resendInSeconds: EMAIL_CODE_RESEND_SECONDS };
}

/** Check (and use up) the newest emailed code. Wrong answers count against it. */
async function consumeEmailCode(conn: Knex, userId: string, purpose: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;
  const row: any = await conn('step_up_codes')
    .where({ user_id: userId, purpose }).whereNull('consumed_at')
    .orderBy('created_at', 'desc').first('id', 'code_hash', 'expires_at', 'attempts');
  if (!row || new Date(row.expires_at).getTime() < Date.now() || Number(row.attempts) >= EMAIL_CODE_MAX_ATTEMPTS) return false;

  const expected = Buffer.from(String(row.code_hash), 'hex');
  const given = Buffer.from(hashEmailCode(userId, purpose, code), 'hex');
  const match = expected.length === given.length && crypto.timingSafeEqual(expected, given);
  if (!match) {
    await conn('step_up_codes').where({ id: row.id }).increment('attempts', 1);
    return false;
  }
  // Single use: only one request can consume it.
  const used = await conn('step_up_codes').where({ id: row.id }).whereNull('consumed_at').update({ consumed_at: new Date() });
  return used === 1;
}

/** Is the school verified by WiSkul? (Its state lives on the owner's account.) */
export async function schoolVerificationState(conn: Knex, tenantId: string): Promise<string> {
  const owner: any = await conn('users')
    .where({ tenant_id: tenantId, role: 'principal' })
    .orderBy([{ column: 'is_owner', order: 'desc' }, { column: 'created_at', order: 'asc' }])
    .first('verification_status');
  return String(owner?.verification_status || 'unverified');
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
