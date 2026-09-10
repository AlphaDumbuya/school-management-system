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
