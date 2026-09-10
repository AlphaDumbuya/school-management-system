/**
 * restoreAccessService — lets a SUSPENDED school pay to restore access WITHOUT
 * logging in.
 *
 * Flow:
 *   1. On payment-suspension, the notification email includes a signed link:
 *        {APP_URL}/restore-access?token=<jwt>
 *      minted by `mintRestoreToken(tenantId)` — short-lived, purpose-scoped.
 *   2. The public restore page calls `getRestoreInfo(token)` to show the school
 *      name, plan and amount due (no auth needed).
 *   3. It then calls the public checkout which creates a Monime session tagged
 *      with metadata.purpose='restore'. On payment completion the Monime webhook
 *      calls `completeRestore(tenantId)` which renews the subscription and
 *      reactivates the tenant.
 *
 * Security: the token only encodes a tenantId + purpose and is signed with
 * JWT_SECRET, so it can't be forged and only grants the ability to PAY (never
 * to read data or sign in).
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { PLAN_LIMITS, SubscriptionService } from './subscriptionService';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const RESTORE_TOKEN_TTL = '30d'; // owner may act days after the email

interface RestorePayload { tenantId: string; purpose: 'restore'; }

/** Mint a signed restore link token for a tenant. */
export function mintRestoreToken(tenantId: string): string {
  return jwt.sign({ tenantId, purpose: 'restore' } as RestorePayload, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: RESTORE_TOKEN_TTL,
  });
}

/** Verify a restore token → tenantId (throws AppError on invalid/expired). */
export function verifyRestoreToken(token: string): string {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as RestorePayload;
    if (decoded.purpose !== 'restore' || !decoded.tenantId) {
      throw new AppError('Invalid restore link', 400, 'RESTORE_TOKEN_INVALID');
    }
    return decoded.tenantId;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('This link is invalid or has expired. Please contact support.', 400, 'RESTORE_TOKEN_INVALID');
  }
}

/** Public info shown on the restore page — school name, plan, amount due. */
export async function getRestoreInfo(token: string): Promise<{
  tenantId: string;
  schoolName: string;
  status: string;
  planType: string;
  amountDue: number;
  currency: string;
  alreadyActive: boolean;
}> {
  const tenantId = verifyRestoreToken(token);
  const tenant = await db('tenants').select('id', 'name', 'status').where({ id: tenantId }).first();
  if (!tenant) throw new AppError('School not found', 404, 'TENANT_NOT_FOUND');

  const sub = await SubscriptionService.getActiveSubscription(tenantId);
  const planType = (sub.plan_type as keyof typeof PLAN_LIMITS) || 'freetong';
  const amountDue = PLAN_LIMITS[planType]?.monthly_price ?? 0;

  return {
    tenantId,
    schoolName: tenant.name,
    status: tenant.status,
    planType,
    amountDue,
    currency: 'SLE',
    alreadyActive: tenant.status === 'active',
  };
}

/**
 * Public info for the reactivation-request page (non-payment suspensions):
 * school name + why it was suspended, so the owner can respond appropriately.
 */
export async function getReactivationInfo(token: string): Promise<{
  tenantId: string;
  schoolName: string;
  status: string;
  category: string;
  reason: string | null;
  alreadyActive: boolean;
}> {
  const tenantId = verifyRestoreToken(token);
  const tenant = await db('tenants').select('id', 'name', 'status', 'settings').where({ id: tenantId }).first();
  if (!tenant) throw new AppError('School not found', 404, 'TENANT_NOT_FOUND');
  const settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings || '{}') : (tenant.settings || {});
  return {
    tenantId,
    schoolName: tenant.name,
    status: tenant.status,
    category: settings.suspension_category || 'other',
    reason: settings.suspension_reason || null,
    alreadyActive: tenant.status === 'active',
  };
}

/**
 * Submit a professional reactivation request (non-payment suspensions). Creates
 * a HIGH-priority platform support ticket attributed to the tenant owner and
 * notifies the platform support inbox. Does NOT reactivate — the platform owner
 * reviews and lifts the suspension manually.
 */
export async function submitReactivationRequest(
  token: string,
  message: string,
  contactEmail?: string
): Promise<{ reference: string }> {
  const tenantId = verifyRestoreToken(token);
  const cleaned = (message || '').trim();
  if (cleaned.length < 10) {
    throw new AppError('Please provide a short explanation (at least 10 characters).', 400, 'REACTIVATION_MESSAGE_TOO_SHORT');
  }

  const tenant = await db('tenants').select('id', 'name', 'status', 'contact_email', 'settings').where({ id: tenantId }).first();
  if (!tenant) throw new AppError('School not found', 404, 'TENANT_NOT_FOUND');
  if (tenant.status === 'active') {
    return { reference: 'ALREADY_ACTIVE' };
  }

  const settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings || '{}') : (tenant.settings || {});
  const category = settings.suspension_category || 'other';
  const suspensionReason = settings.suspension_reason || 'Not specified';

  // Attribute the ticket to the tenant owner (principal) so it links to a real
  // user (support_tickets.user_id is NOT NULL). Fall back to any tenant user.
  const owner = await db('users')
    .where({ tenant_id: tenantId, role: 'principal' })
    .first()
    .catch(() => null);
  const anyUser = owner || (await db('users').where({ tenant_id: tenantId }).first().catch(() => null));
  if (!anyUser) throw new AppError('No account found for this school.', 404, 'NO_TENANT_USER');

  const ticketId = crypto.randomUUID();
  const now = new Date();
  const replyTo = (contactEmail || tenant.contact_email || anyUser.email || '').trim();
  const description =
    `REACTIVATION REQUEST\n` +
    `Suspension category: ${category}\n` +
    `Suspension reason: ${suspensionReason}\n` +
    `Contact email: ${replyTo || 'n/a'}\n\n` +
    `Message from school:\n${cleaned}`;

  await db('support_tickets').insert({
    id: ticketId,
    tenant_id: tenantId,
    user_id: anyUser.id,
    subject: `Reactivation request — ${tenant.name}`,
    description,
    priority: 'high',
    status: 'open',
    category: 'reactivation',
    attachments: JSON.stringify([]),
    created_at: now,
    updated_at: now,
  });

  const reference = 'TKT-' + ticketId.replace(/-/g, '').slice(0, 8).toUpperCase();
  logger.info(`Reactivation request submitted for tenant ${tenantId} (ticket ${reference})`);

  // Notify the platform support inbox (best-effort).
  try {
    const { default: emailService } = await import('./emailService');
    const supportInbox = process.env.SUPPORT_EMAIL || 'support@wiskulsl.com';
    await emailService.sendEmail({
      ...(emailService as any).platformSender?.('support') ?? { to: supportInbox },
      to: supportInbox,
      subject: `Reactivation request — ${tenant.name} (${reference})`,
      body:
        `<p><strong>${tenant.name}</strong> has requested reactivation.</p>` +
        `<p><b>Reference:</b> ${reference}<br/>` +
        `<b>Category:</b> ${category}<br/>` +
        `<b>Suspension reason:</b> ${suspensionReason}<br/>` +
        `<b>Reply to:</b> ${replyTo || 'n/a'}</p>` +
        `<p><b>Message:</b></p><p style="white-space:pre-wrap;">${cleaned.replace(/</g, '&lt;')}</p>`,
      isHtml: true,
    });
  } catch (mailErr: any) {
    logger.warn(`Reactivation request email failed for tenant ${tenantId}: ${mailErr?.message || mailErr}`);
  }

  return { reference };
}

/**
 * Complete a restore after a successful payment: renew the subscription (extends
 * end date + records billing) and reactivate the tenant. Idempotent-ish — safe
 * to call once per completed payment.
 */
export async function completeRestore(tenantId: string): Promise<void> {
  try {
    await SubscriptionService.renewSubscription(tenantId, 'monthly', 'public-restore');
    // renewSubscription already sets tenant status = active, but be explicit.
    await db('tenants').where({ id: tenantId }).update({ status: 'active', updated_at: db.fn.now() });
    logger.info(`Access restored via public payment for tenant ${tenantId}`);
  } catch (err) {
    logger.error(`completeRestore failed for tenant ${tenantId}: ${String((err as any)?.message || err)}`);
    throw err;
  }
}
