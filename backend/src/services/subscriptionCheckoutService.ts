/**
 * subscriptionCheckoutService — starts a PAID plan change.
 *
 * MONEY ROUTING (critical): subscription revenue is the PLATFORM's income. This
 * service creates a Monime checkout against the PLATFORM's own account (env
 * credentials, the monimeService default) — NEVER a school's account. The plan
 * only activates from the webhook after payment is confirmed
 * (see monimeRoutes.ts → reconcileSubscriptionSession).
 *
 * Up-front validation (downgrade-over-limit) runs here so the payer gets
 * immediate feedback before being redirected to pay.
 */
import type { Request } from 'express';
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { PLAN_LIMITS, SubscriptionService } from './subscriptionService';
import { monimeService } from './monimeService';

type PlanType = 'freetong' | 'combra' | 'bintumani';
type BillingCycle = 'monthly' | 'yearly';

/** Resolve the public app origin for building success/cancel URLs. */
function appOrigin(req: Request): string {
  const envBase = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.FRONTEND_URL;
  if (envBase && !/localhost|127\.0\.0\.1/.test(envBase)) return envBase.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol || 'https';
  const host = (req.headers['x-forwarded-host'] as string)?.split(',')[0]?.trim() || req.get('host');
  if (host && !/localhost|127\.0\.0\.1/.test(host)) return `${proto}://${host}`;
  return (envBase || '').replace(/\/+$/, '') || `${proto}://${host}`;
}

export class SubscriptionCheckout {
  /**
   * Validate the requested plan change, guard downgrades against current usage,
   * create a subscription_payment_sessions row, and open a PLATFORM-account
   * Monime checkout. Returns the redirect URL for the browser.
   */
  static async startPlanChange(opts: {
    tenantId: string;
    userId: string;
    planType: PlanType;
    billingCycle: BillingCycle;
    req: Request;
  }): Promise<{ sessionId: string; redirectUrl: string | null; amount: number }> {
    const { tenantId, userId, planType, billingCycle, req } = opts;

    const limits = PLAN_LIMITS[planType];
    if (!limits) throw new AppError('Invalid subscription plan type', 400, 'VALIDATION_ERROR');

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
    const maxStaff = planType === 'freetong' ? 15 : planType === 'combra' ? 40 : 999999;

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

    const amount = billingCycle === 'monthly' ? limits.monthly_price : limits.monthly_price * 10;
    if (!(amount > 0)) {
      // No plan is free today, but guard anyway: nothing to collect → apply now.
      await SubscriptionService.changePlan(tenantId, planType, billingCycle, userId);
      return { sessionId: 'immediate', redirectUrl: null, amount: 0 };
    }

    // Create our session row first so the webhook can correlate the payment.
    const [session] = await db('subscription_payment_sessions')
      .insert({
        tenant_id: tenantId,
        plan_type: planType,
        billing_cycle: billingCycle,
        amount,
        currency: 'SLE',
        provider: 'monime',
        status: 'pending',
        initiated_by: userId || null,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    const origin = appOrigin(req);
    const successUrl = `${origin}/settings?tab=billing&subscription=${session.id}&status=success`;
    const cancelUrl = `${origin}/settings?tab=billing&subscription=${session.id}&status=cancelled`;

    // PLATFORM account (no explicit creds → monimeService uses env defaults).
    let checkout;
    try {
      checkout = await monimeService.createCheckoutSession({
        name: `WiSkul ${planType.toUpperCase()} plan (${billingCycle})`,
        amount,
        successUrl,
        cancelUrl,
        metadata: { subscriptionSessionId: session.id, tenantId, planType, billingCycle },
        callbackState: `subscription:${session.id}`,
      });
    } catch (err) {
      // Mark the dangling session failed and surface a clear, actionable error
      // instead of an opaque 500. A 403 here means the PLATFORM Monime token is
      // missing the checkout.checkout_sessions:create permission.
      await db('subscription_payment_sessions')
        .where({ id: session.id })
        .update({ status: 'failed', updated_at: new Date() })
        .catch(() => { /* best effort */ });
      const msg = (err as Error).message || '';
      logger.error(`Subscription checkout failed to open (tenant ${tenantId}, session ${session.id}): ${msg}`);
      throw new AppError(
        'We could not start the plan payment right now. Our payment provider rejected the request — please contact support.',
        502,
        'PLATFORM_CHECKOUT_FAILED'
      );
    }

    if (!checkout.redirectUrl) {
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
        provider_session_id: checkout.sessionId,
        redirect_url: checkout.redirectUrl,
        updated_at: new Date(),
      });

    logger.info(`Subscription checkout opened for tenant ${tenantId} → ${planType}/${billingCycle} (session ${session.id})`);

    return { sessionId: session.id, redirectUrl: checkout.redirectUrl, amount };
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
  }

  /** Read a subscription session's status (for the return page to poll). */
  static async getStatus(sessionId: string, tenantId: string): Promise<{ status: string; planType: string } | null> {
    const session = await db('subscription_payment_sessions').where({ id: sessionId }).first();
    if (!session) return null;
    if (session.tenant_id !== tenantId) return null;

    // Refresh from Monime (PLATFORM account) if still pending.
    if (session.status === 'pending' && session.provider_session_id && monimeService.isConfigured()) {
      try {
        const remote = await monimeService.getCheckoutSession(session.provider_session_id);
        const remoteStatus = monimeService.normaliseStatus(remote?.status);
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
