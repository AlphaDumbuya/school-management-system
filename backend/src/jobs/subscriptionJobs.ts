/**
 * Subscription lifecycle jobs.
 *
 * Auto-expiry: subscriptions were only flipped to `expired` lazily (when someone
 * hit a guarded route). This scheduled job flips any active subscription whose
 * end_date has passed to `expired` and marks its tenant `expired`, so a dormant
 * tenant is reliably locked out at its end date — not only when it happens to
 * make a guarded request.
 *
 * Also sends the automatic lifecycle emails to the school contact:
 *   - trial ending (7 days and 1 day before), paid plan ending (7 / 1 days)
 *   - trial / complimentary plan ended → moved to the base plan
 *   - paid plan expired (access paused, pay-and-restore link)
 * Every notice is claimed once per subscription (finance_notices), so retries,
 * reboots and the lazy path never send it twice.
 *
 * Runs daily at 01:15 via node-cron on long-running servers, and from the
 * Vercel Cron route (/api/v1/cron/finance-daily) on serverless, where node-cron
 * never fires.
 */
import cron from 'node-cron';
import { db } from '../utils/database.js';
import { logger } from '../utils/logger.js';

type ScheduledTask = ReturnType<typeof cron.schedule>;

let job: ScheduledTask | null = null;

const DAY = 86_400_000;

/** Best contact for a school: tenant contact, else school email, else the principal. */
export async function tenantContactEmail(tenantId: string): Promise<string | null> {
  const tenant = await db('tenants').where({ id: tenantId }).first('contact_email');
  if (tenant?.contact_email) return tenant.contact_email;
  const school = await db('schools').where({ tenant_id: tenantId }).first('email').catch(() => null);
  if (school?.email) return school.email;
  const principal = await db('users').where({ tenant_id: tenantId, role: 'principal', status: 'active' }).first('email');
  return principal?.email || null;
}

async function claim(tenantId: string, key: string): Promise<boolean> {
  const { claimNotice } = await import('../services/finance/core.js');
  return claimNotice(tenantId, key);
}

async function planName(planType: string): Promise<string> {
  const { PlanCatalog } = await import('../services/planCatalogService.js');
  return PlanCatalog.isPlanId(planType) ? (await PlanCatalog.get(planType)).name : String(planType || '');
}

/**
 * "Your trial / complimentary plan has ended" (once per ended subscription).
 * Called by the sweep and by the lazy downgrade in getActiveSubscription.
 */
export async function notifyTrialEnded(tenantId: string, endedSub: { id: string; plan_type: string }): Promise<void> {
  try {
    if (!(await claim(tenantId, `sub:${endedSub.id}:ended`))) return;
    const to = await tenantContactEmail(tenantId);
    if (!to) return;
    const [{ EntitlementService }, { FEATURES }, tenant] = await Promise.all([
      import('../services/entitlementService.js'),
      import('../services/planCatalogService.js'),
      db('tenants').where({ id: tenantId }).first('name'),
    ]);
    EntitlementService.clear(tenantId);
    const ent = await EntitlementService.forTenant(tenantId);
    const readOnly = FEATURES.filter((f) => !f.soon && ent.features[f.key] === 'read_only').map((f) => f.label);
    const { default: emailService } = await import('../services/emailService.js');
    await emailService.sendSubscriptionLifecycleEmail(to, {
      kind: 'trial_ended', schoolName: tenant?.name || 'your school',
      planName: await planName(endedSub.plan_type), newPlanName: ent.plan_name, readOnlyFeatures: readOnly,
    });
  } catch (err) {
    logger.warn(`[subscriptionJobs] trial-ended notice failed for tenant ${tenantId}: ${(err as any)?.message || err}`);
  }
}

/** Reminders for subscriptions ending within 7 days (7-day and 1-day notices). */
export async function runSubscriptionReminders(): Promise<number> {
  const now = Date.now();
  const soon = await db('subscriptions as s')
    .join('tenants as t', 't.id', 's.tenant_id')
    .where('s.status', 'active').where('t.status', 'active')
    .whereNotNull('s.end_date')
    .where('s.end_date', '>', new Date(now))
    .where('s.end_date', '<=', new Date(now + 7 * DAY))
    .select('s.id', 's.tenant_id', 's.plan_type', 's.end_date', 's.is_trial', 's.is_comp', 't.name as school_name');

  let sent = 0;
  const { default: emailService } = await import('../services/emailService.js');
  for (const s of soon) {
    try {
      const daysLeft = Math.max(1, Math.ceil((new Date(s.end_date).getTime() - now) / DAY));
      const bucket = daysLeft <= 1 ? '1d' : '7d';
      // A comp that simply ends is announced by the "ended" notice only.
      if (s.is_comp && !s.is_trial) continue;
      if (!(await claim(s.tenant_id, `sub:${s.id}:remind:${bucket}`))) continue;
      const to = await tenantContactEmail(s.tenant_id);
      if (!to) continue;
      await emailService.sendSubscriptionLifecycleEmail(to, {
        kind: s.is_trial ? 'trial_ending' : 'expiring',
        schoolName: s.school_name || 'your school', planName: await planName(s.plan_type),
        endDate: s.end_date, daysLeft,
      });
      sent++;
    } catch (err) {
      logger.warn(`[subscriptionJobs] reminder failed for subscription ${s.id}: ${(err as any)?.message || err}`);
    }
  }
  if (sent) logger.info(`[subscriptionJobs] sent ${sent} subscription reminder(s)`);
  return sent;
}

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
    .select('id', 'tenant_id', 'is_trial', 'is_comp', 'plan_type');

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
        await notifyTrialEnded(s.tenant_id, s);
      } catch (err) {
        logger.warn(`[subscriptionJobs] graceful downgrade failed for tenant ${s.tenant_id}`, { error: String(err) });
      }
    }
    logger.info(`[subscriptionJobs] downgraded ${gracefulSubs.length} expired trial/comp subscription(s) to Freetong`);
  }

  // Paid → expire + lock tenant.
  if (paidSubs.length) {
    const subIds = paidSubs.map((s: any) => s.id);
    const tenantIds = [...new Set(paidSubs.map((s: any) => s.tenant_id))] as string[];
    await db('subscriptions').whereIn('id', subIds).update({ status: 'expired', updated_at: db.fn.now() });
    // Only touch currently-active tenants so we don't override suspended/archived.
    await db('tenants').whereIn('id', tenantIds).where({ status: 'active' }).update({ status: 'expired', updated_at: db.fn.now() });
    logger.info(`[subscriptionJobs] auto-expired ${subIds.length} paid subscription(s) across ${tenantIds.length} tenant(s)`);

    // "Your subscription expired" with the no-login pay & restore link.
    const { default: emailService } = await import('../services/emailService.js');
    const { EntitlementService } = await import('../services/entitlementService.js');
    for (const s of paidSubs) {
      try {
        EntitlementService.clear(s.tenant_id);
        if (!(await claim(s.tenant_id, `sub:${s.id}:expired`))) continue;
        const to = await tenantContactEmail(s.tenant_id);
        if (!to) continue;
        const tenant = await db('tenants').where({ id: s.tenant_id }).first('name');
        await emailService.sendTenantSubscriptionEmail(to, {
          schoolName: tenant?.name || 'your school', planLabel: await planName(s.plan_type), action: 'expired', tenantId: s.tenant_id,
        });
      } catch (err) {
        logger.warn(`[subscriptionJobs] expiry notice failed for tenant ${s.tenant_id}: ${(err as any)?.message || err}`);
      }
    }
  }

  return expiredSubs.length;
}

/** Reminders first (they skip subscriptions that are already past their end). */
export async function runSubscriptionDaily(): Promise<{ reminders: number; processed: number }> {
  const reminders = await runSubscriptionReminders().catch((e) => { logger.warn('[subscriptionJobs] reminders failed', { error: String(e) }); return 0; });
  const processed = await runSubscriptionExpirySweep();
  return { reminders, processed };
}

/** Start the daily subscription-expiry sweep. */
export function startSubscriptionJobs(): void {
  if (job) return;
  // 01:15 every day.
  job = cron.schedule('15 1 * * *', () => {
    runSubscriptionDaily().catch((err) => {
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
