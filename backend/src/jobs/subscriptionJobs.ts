/**
 * Subscription lifecycle jobs.
 *
 * Auto-expiry: subscriptions were only flipped to `expired` lazily (when someone
 * hit a guarded route). This scheduled job flips any active subscription whose
 * end_date has passed to `expired` and marks its tenant `expired`, so a dormant
 * tenant is reliably locked out at its end date — not only when it happens to
 * make a guarded request.
 *
 * Runs daily at 01:15. Uses node-cron like the other jobs in this folder.
 */
import cron from 'node-cron';
import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';

type ScheduledTask = ReturnType<typeof cron.schedule>;

let job: ScheduledTask | null = null;

/**
 * Process subscriptions past their end_date.
 *
 *  - TRIAL subscriptions → gracefully DOWNGRADE the tenant to Freetong and keep
 *    it active (a new school must never be locked out just because the promo
 *    trial ended — they simply continue on the free tier).
 *  - PAID subscriptions → expire and lock the tenant (renew/pay to restore).
 */
export async function runSubscriptionExpirySweep(): Promise<number> {
  const now = new Date();

  // Find active subscriptions that have passed their end_date.
  const expiredSubs = await db('subscriptions')
    .where({ status: 'active' })
    .whereNotNull('end_date')
    .where('end_date', '<', now)
    .select('id', 'tenant_id', 'is_trial', 'is_comp');

  if (expiredSubs.length === 0) return 0;

  // Trials AND time-boxed comps both downgrade gracefully (never a lockout).
  // Only genuinely PAID subscriptions expire + lock the tenant.
  const gracefulSubs = expiredSubs.filter((s: any) => s.is_trial || s.is_comp);
  const paidSubs = expiredSubs.filter((s: any) => !s.is_trial && !s.is_comp);

  if (gracefulSubs.length) {
    const { SubscriptionService } = await import('../services/subscriptionService.js');
    for (const s of gracefulSubs) {
      try {
        await SubscriptionService.downgradeExpiredTrial(s.tenant_id);
      } catch (err) {
        logger.warn(`[subscriptionJobs] graceful downgrade failed for tenant ${s.tenant_id}`, { error: String(err) });
      }
    }
    logger.info(`[subscriptionJobs] downgraded ${gracefulSubs.length} expired trial/comp subscription(s) to Freetong`);
  }

  // Paid → expire + lock tenant.
  if (paidSubs.length) {
    const subIds = paidSubs.map((s: any) => s.id);
    const tenantIds = [...new Set(paidSubs.map((s: any) => s.tenant_id))];
    await db('subscriptions').whereIn('id', subIds).update({ status: 'expired', updated_at: db.fn.now() });
    // Only touch currently-active tenants so we don't override suspended/archived.
    await db('tenants').whereIn('id', tenantIds).where({ status: 'active' }).update({ status: 'expired', updated_at: db.fn.now() });
    logger.info(`[subscriptionJobs] auto-expired ${subIds.length} paid subscription(s) across ${tenantIds.length} tenant(s)`);
  }

  return expiredSubs.length;
}

/** Start the daily subscription-expiry sweep. */
export function startSubscriptionJobs(): void {
  if (job) return;
  // 01:15 every day.
  job = cron.schedule('15 1 * * *', () => {
    runSubscriptionExpirySweep().catch((err) => {
      logger.warn('[subscriptionJobs] expiry sweep failed', { error: String(err) });
    });
  });
  // Run once shortly after boot so a restart doesn't leave stale-active tenants.
  setTimeout(() => {
    runSubscriptionExpirySweep().catch(() => undefined);
  }, 30_000);
  logger.info('[subscriptionJobs] subscription expiry sweep scheduled (daily 01:15)');
}

export function stopSubscriptionJobs(): void {
  if (job) {
    job.stop();
    job = null;
  }
}
