/**
 * subscriptionCheckoutService — starts a PAID plan change.
 *
 * MONEY ROUTING (critical): subscription revenue is the PLATFORM's income. This
 * service creates an in-app Monime USSD payment code against the PLATFORM's own
 * account (env credentials, the monimeService default) — NEVER a school's
 * account. The plan only activates from the webhook after payment is confirmed
 * (see monimeRoutes.ts → subscription branch → SubscriptionCheckout.reconcile).
 *
 * Up-front validation (downgrade-over-limit) runs here so the payer gets
 * immediate feedback before dialing the code.
 */
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { planLimits, SubscriptionService } from './subscriptionService';
import { monimeService } from './monimeService';

type PlanType = 'freetong' | 'combra' | 'bintumani';
type BillingCycle = 'monthly' | 'yearly';

export class SubscriptionCheckout {
  /**
   * Validate the requested plan change, guard downgrades against current usage,
   * create a subscription_payment_sessions row, and open a PLATFORM-account
   * Monime USSD payment code. Returns the USSD code for the in-app modal.
   */
  static async startPlanChange(opts: {
    tenantId: string;
    userId: string;
    planType: PlanType;
    billingCycle: BillingCycle;
  }): Promise<{ sessionId: string; ussdCode: string | null; amount: number; expireTime: string | null }> {
    const { tenantId, userId, planType, billingCycle } = opts;

    const limits = await planLimits(planType); // throws on an unknown plan

    // Platform must have its own Monime account configured to collect revenue.
    if (!monimeService.isConfigured()) {
      throw new AppError(
        'Plan payments are temporarily unavailable. Please try again later or contact support.',
        503,
        'PLATFORM_PAYMENTS_UNAVAILABLE'
      );
    }

    // Guard downgrades: refuse to move to a plan whose limits are below current
    // usage, so a school can't strand itself over-limit (mirrors changePlan).
    const [studentCountRow] = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .where('users.tenant_id', tenantId)
      .count('* as count');
    const [staffCountRow] = await db('users')
      .where({ tenant_id: tenantId })
      .whereIn('role', ['teacher', 'accountant', 'admissions_officer', 'principal'])
      .count('* as count');
    const currentStudents = parseInt((studentCountRow as any)?.count as string, 10) || 0;
    const currentStaff = parseInt((staffCountRow as any)?.count as string, 10) || 0;
    const maxStaff = limits.max_staff;

    if (currentStudents > limits.max_students) {
      throw new AppError(
        `This plan allows up to ${limits.max_students} students but your school has ${currentStudents}. Reduce students or choose a higher plan.`,
        400,
        'DOWNGRADE_OVER_LIMIT'
      );
    }
    if (currentStaff > maxStaff) {
      throw new AppError(
        `This plan allows up to ${maxStaff} staff but your school has ${currentStaff}. Reduce staff or choose a higher plan.`,
        400,
        'DOWNGRADE_OVER_LIMIT'
      );
    }

    const amount = billingCycle === 'monthly' ? limits.monthly_price : limits.yearly_price;
    if (!(amount > 0)) {
      // A free plan (price set to 0 in the catalog): nothing to collect → apply now.
      await SubscriptionService.changePlan(tenantId, planType, billingCycle, userId);
      return { sessionId: 'immediate', ussdCode: null, amount: 0, expireTime: null };
    }

    // Create our session row first so the webhook can correlate the payment.
    // provider 'monime_ussd' so status polling uses the payment-code endpoint.
    const [session] = await db('subscription_payment_sessions')
      .insert({
        tenant_id: tenantId,
        plan_type: planType,
        billing_cycle: billingCycle,
        amount,
        currency: 'SLE',
        provider: 'monime_ussd',
        status: 'pending',
        initiated_by: userId || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // In-app USSD payment code against the PLATFORM account (no explicit creds
    // → monimeService uses env defaults). The webhook correlates via
    // metadata.sessionId, which we prefix "subscription:" so the existing
    // subscription branch in monimeRoutes routes it to us.
    let code;
    try {
      code = await monimeService.createPaymentCode({
        name: `WiSkul ${planType.toUpperCase()} plan (${billingCycle})`,
        amount,
        duration: '30m', // subscription codes stay valid for 30 minutes
        metadata: { sessionId: `subscription:${session.id}`, tenantId, planType, billingCycle },
      });
    } catch (err) {
      await db('subscription_payment_sessions')
        .where({ id: session.id })
        .update({ status: 'failed', updated_at: new Date() })
        .catch(() => { /* best effort */ });
      const msg = (err as Error).message || '';
      logger.error(`Subscription payment code failed to open (tenant ${tenantId}, session ${session.id}): ${msg}`);
      throw new AppError(
        'We could not start the plan payment right now. Our payment provider rejected the request — please contact support.',
        502,
        'PLATFORM_CHECKOUT_FAILED'
      );
    }

    if (!code.id) {
      await db('subscription_payment_sessions')
        .where({ id: session.id })
        .update({ status: 'failed', updated_at: new Date() })
        .catch(() => { /* best effort */ });
      throw new AppError(
        'We could not start the plan payment right now. Please try again or contact support.',
        502,
        'PLATFORM_CHECKOUT_FAILED'
      );
    }

    await db('subscription_payment_sessions')
      .where({ id: session.id })
      .update({
        provider_session_id: code.id,
        updated_at: new Date(),
      });

    logger.info(`Subscription USSD payment opened for tenant ${tenantId} → ${planType}/${billingCycle} (session ${session.id})`);

    return { sessionId: session.id, ussdCode: code.ussdCode, amount, expireTime: code.expireTime };
  }

  /**
   * Reconcile a subscription payment session from the webhook. On completion,
   * apply the plan change (which records billing + activates). Idempotent — a
   * session only applies its plan change once.
   */
  static async reconcile(
    sessionId: string,
    status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired'
  ): Promise<void> {
    const session = await db('subscription_payment_sessions').where({ id: sessionId }).first();
    if (!session) {
      logger.warn(`Subscription webhook: no matching session ${sessionId}`);
      return;
    }
    if (session.status === 'completed') return; // already applied

    if (status !== 'completed') {
      await db('subscription_payment_sessions').where({ id: sessionId }).update({ status, updated_at: new Date() });
      return;
    }

    // Payment confirmed → activate the plan now.
    await SubscriptionService.changePlan(
      session.tenant_id,
      session.plan_type,
      session.billing_cycle,
      session.initiated_by || 'monime-webhook'
    );
    await db('subscription_payment_sessions')
      .where({ id: sessionId })
      .update({ status: 'completed', updated_at: new Date() });

    logger.info(`Subscription payment reconciled — tenant ${session.tenant_id} now on ${session.plan_type} (session ${sessionId})`);

    // Payment confirmation / receipt to the school owner(s) and billing contact (best-effort).
    try {
      const { billingRecipients } = await import('../jobs/subscriptionJobs.js');
      const recipients = await billingRecipients(session.tenant_id);
      if (recipients.length) {
        const [tenant, sub, limits] = await Promise.all([
          db('tenants').where({ id: session.tenant_id }).first('name'),
          SubscriptionService.getActiveSubscription(session.tenant_id),
          planLimits(session.plan_type),
        ]);
        const { default: emailService } = await import('./emailService.js');
        const paidAt = new Date();
        for (const to of recipients) {
          await emailService.sendSubscriptionLifecycleEmail(to, {
            kind: 'payment_received', schoolName: tenant?.name || 'your school', planName: limits.name,
            amount: Number(session.amount) || undefined, billingCycle: session.billing_cycle, endDate: sub?.end_date || null,
            // Same receipt number on any resend: derived from the payment session.
            receiptNumber: `SUB-${paidAt.getFullYear()}-${String(session.id).replace(/-/g, '').slice(0, 8).toUpperCase()}`,
            reference: session.provider_session_id || undefined,
            paidAt,
          }).catch((e: any) => logger.warn(`Subscription payment email to ${to} failed: ${e?.message || e}`));
        }
      }
    } catch (mailErr: any) {
      logger.warn(`Subscription payment email failed for tenant ${session.tenant_id}: ${mailErr?.message || mailErr}`);
    }
  }

  /** Read a subscription session's status (for the return page to poll). */
  static async getStatus(sessionId: string, tenantId: string): Promise<{ status: string; planType: string } | null> {
    const session = await db('subscription_payment_sessions').where({ id: sessionId }).first();
    if (!session) return null;
    if (session.tenant_id !== tenantId) return null;

    // Refresh from Monime (PLATFORM account) if still pending. Subscriptions use
    // a payment code (USSD), so read the code's authoritative status.
    if (session.status === 'pending' && session.provider_session_id && monimeService.isConfigured()) {
      try {
        const remote = await monimeService.getPaymentCode(session.provider_session_id);
        const remoteStatus = remote?.progress?.isCompleted ? 'completed' : monimeService.normaliseStatus(remote?.status);
        if (remoteStatus !== 'pending') {
          await this.reconcile(session.id, remoteStatus);
          const refreshed = await db('subscription_payment_sessions').where({ id: session.id }).first();
          return { status: refreshed.status, planType: refreshed.plan_type };
        }
      } catch { /* fall through to stored status */ }
    }

    return { status: session.status, planType: session.plan_type };
  }
}
