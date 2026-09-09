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

/** Expire subscriptions past their end_date and lock their tenants. */
export async function runSubscriptionExpirySweep(): Promise<number> {
  const now = new Date();

  // Find active subscriptions that have passed their end_date.
  const expiredSubs = await db('subscriptions')
    .where({ status: 'active' })
    .whereNotNull('end_date')
    .where('end_date', '<', now)
    .select('id', 'tenant_id');

  if (expiredSubs.length === 0) return 0;

  const subIds = expiredSubs.map((s: any) => s.id);
  const tenantIds = [...new Set(expiredSubs.map((s: any) => s.tenant_id))];

  await db('subscriptions').whereIn('id', subIds).update({ status: 'expired', updated_at: db.fn.now() });
  // Mark tenants expired (auth/middleware then blocks their users). Only touch
  // tenants that are currently active so we don't override suspended/archived.
  await db('tenants').whereIn('id', tenantIds).where({ status: 'active' }).update({ status: 'expired', updated_at: db.fn.now() });

  logger.info(`[subscriptionJobs] auto-expired ${subIds.length} subscription(s) across ${tenantIds.length} tenant(s)`);
  return subIds.length;
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
