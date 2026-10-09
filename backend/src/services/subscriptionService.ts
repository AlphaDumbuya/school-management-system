import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import { PlanCatalog } from './planCatalogService';
import { EntitlementService } from './entitlementService';

export interface ActiveSubscription {
  id: string;
  tenant_id: string;
  plan_type: 'freetong' | 'combra' | 'bintumani';
  status: 'active' | 'suspended' | 'expired' | 'cancelled';
  /** Live staff limit from the plan catalog. */
  max_staff?: number;
  is_comp?: boolean;
  start_date: Date;
  end_date: Date | null;
  monthly_price: number;
  max_users: number;
  max_students: number;
  max_storage_gb: number;
  features: Record<string, boolean>;
  is_trial?: boolean;
  created_at: Date;
  updated_at: Date;
}

/**
 * Live plan limits + full feature map from the super-admin-editable catalog
 * (planCatalogService). Replaces the old hardcoded PLAN_LIMITS table.
 */
export async function planLimits(planType: string) {
  const plan = await PlanCatalog.get(planType);
  return {
    name: plan.name,
    monthly_price: plan.monthly_price,
    yearly_price: plan.yearly_price,
    max_users: plan.max_users,
    max_students: plan.max_students,
    max_staff: plan.max_staff,
    max_storage_gb: plan.max_storage_gb,
    features: await PlanCatalog.featuresFor(planType),
  };
}

const priceFor = (l: { monthly_price: number; yearly_price: number }, cycle: 'monthly' | 'yearly') =>
  cycle === 'yearly' ? l.yearly_price : l.monthly_price;

export class SubscriptionService {
  /**
   * Get active subscription for a tenant.
   * If none exists, creates a default Freetong trial subscription.
   */
  static async getActiveSubscription(tenantId: string): Promise<ActiveSubscription> {
    try {
      let subscription = await db('subscriptions')
        .where({ tenant_id: tenantId })
        .whereIn('status', ['active', 'expired', 'suspended'])
        .orderBy('created_at', 'desc')
        .first();

      // Lazily process an end-of-term subscription (in case the daily sweep
      // hasn't run yet). TRIALS gracefully downgrade to Freetong (no lockout);
      // PAID subscriptions expire and lock the tenant.
      if (subscription && subscription.status === 'active' && subscription.end_date && new Date(subscription.end_date) < new Date()) {
        if (subscription.is_trial || subscription.is_comp) {
          const ended = { id: subscription.id, plan_type: subscription.plan_type };
          const outcome = await this.endTrialOrComp(tenantId, subscription);
          // "Your trial has ended" (claimed once per subscription; best-effort).
          void import('../jobs/subscriptionJobs.js').then((m) => m.notifyTrialEnded(tenantId, ended)).catch(() => undefined);
          if (outcome === 'payment_required') {
            subscription.status = 'expired';
          } else {
            return {
              ...(await db('subscriptions').where({ tenant_id: tenantId, status: 'active' }).orderBy('created_at', 'desc').first()),
              features: await PlanCatalog.featuresFor('freetong'),
            } as any;
          }
        } else {
          logger.info(`Subscription ${subscription.id} for tenant ${tenantId} has expired. Updating database status.`);
          await db('subscriptions').where({ id: subscription.id }).update({ status: 'expired', updated_at: db.fn.now() });
          await db('tenants').where({ id: tenantId }).update({ status: 'expired', updated_at: db.fn.now() });
          subscription.status = 'expired';
        }
      }

      if (!subscription) {
        logger.info(`No active or past subscription found for tenant ${tenantId}. Initializing default Freetong plan.`);
        subscription = await this.initializeDefaultSubscription(tenantId);
      }

      // Features and limits come LIVE from the plan catalog, so a super admin
      // edit to a plan applies to every school on it immediately. (The row's
      // `features` snapshot is kept as history for read-only entitlements.)
      if (PlanCatalog.isPlanId(subscription.plan_type)) {
        const live = await planLimits(subscription.plan_type);
        return {
          ...subscription,
          max_users: live.max_users,
          max_students: live.max_students,
          max_staff: live.max_staff,
          max_storage_gb: live.max_storage_gb,
          features: live.features,
        };
      }
      return {
        ...subscription,
        features: typeof subscription.features === 'string' 
          ? JSON.parse(subscription.features) 
          : subscription.features || {},
      };
    } catch (error) {
      logger.error(`Error in getActiveSubscription: ${error}`);
      throw new AppError('Failed to get active subscription', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Initialize a new tenant's subscription as a promotional TRIAL of the top
   * plan (Bintumani) so the school can explore every V1 feature. When the trial
   * ends, the expiry sweep gracefully DOWNGRADES the tenant to Freetong instead
   * of locking it out (see subscriptionJobs.runSubscriptionExpirySweep).
   */
  private static async initializeDefaultSubscription(tenantId: string): Promise<any> {
    // Trial config is controlled by the PLATFORM OWNER from the superadmin
    // portal (platform_settings). When the promo is disabled, new schools start
    // on Freetong directly with no trial.
    const { PlatformSettingsService } = await import('./platformSettingsService.js');
    const trial = await PlatformSettingsService.getTrialConfig();
    const useTrial = trial.enabled;

    const planType = useTrial ? trial.planType : 'freetong';
    const limits = await planLimits(planType);
    const startDate = new Date();
    const endDate = new Date();
    if (useTrial) {
      endDate.setDate(startDate.getDate() + trial.durationDays);
    } else {
      endDate.setFullYear(startDate.getFullYear() + 1);
    }

    const [subscription] = await db('subscriptions')
      .insert({
        tenant_id: tenantId,
        plan_type: planType,
        status: 'active',
        is_trial: useTrial,
        start_date: startDate,
        end_date: endDate,
        monthly_price: limits.monthly_price,
        max_users: limits.max_users,
        max_students: limits.max_students,
        max_storage_gb: limits.max_storage_gb,
        features: JSON.stringify(limits.features),
      })
      .returning('*');

    // Link subscription back to the tenant
    await db('tenants')
      .where({ id: tenantId })
      .update({ subscription_id: subscription.id });

    return subscription;
  }

  /**
   * A trial or time-boxed comp reached its end date. Comps always fall back to
   * Freetong. Trials follow the platform setting (Platform → Subscriptions):
   *  - 'downgrade'       → Freetong, keeps working.
   *  - 'require_payment' → the trial row is marked expired but the SCHOOL stays
   *    active: everyone can sign in and view, every change is refused
   *    (planFeatureGate) until a plan is paid. Nothing is deleted.
   */
  static async endTrialOrComp(tenantId: string, sub: { id: string; is_trial?: boolean; is_comp?: boolean }): Promise<'downgraded' | 'payment_required'> {
    if (sub.is_trial && !sub.is_comp) {
      const { PlatformSettingsService } = await import('./platformSettingsService.js');
      const cfg = await PlatformSettingsService.getTrialConfig();
      if (cfg.afterTrial === 'require_payment') {
        await db('subscriptions').where({ id: sub.id }).update({ status: 'expired', updated_at: db.fn.now() });
        EntitlementService.clear(tenantId);
        logger.info(`Trial ${sub.id} for tenant ${tenantId} ended — payment required (school is read-only until paid).`);
        return 'payment_required';
      }
    }
    logger.info(`${sub.is_comp ? 'Comp' : 'Trial'} ${sub.id} for tenant ${tenantId} ended — downgrading to Freetong.`);
    await this.downgradeExpiredTrial(tenantId);
    return 'downgraded';
  }

  /**
   * When a TRIAL ends, drop the tenant to the free-tier baseline (Freetong)
   * WITHOUT locking them out. They keep using the system within Freetong
   * limits/features and can upgrade any time.
   */
  static async downgradeExpiredTrial(tenantId: string): Promise<any> {
    const limits = await planLimits('freetong');
    EntitlementService.clear(tenantId);
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(startDate.getFullYear() + 1);

    // Cancel any active subscriptions, then create a fresh Freetong one.
    await db('subscriptions')
      .where({ tenant_id: tenantId, status: 'active' })
      .update({ status: 'cancelled', updated_at: db.fn.now() });

    const [sub] = await db('subscriptions')
      .insert({
        tenant_id: tenantId,
        plan_type: 'freetong',
        status: 'active',
        is_trial: false,
        start_date: startDate,
        end_date: endDate,
        monthly_price: limits.monthly_price,
        max_users: limits.max_users,
        max_students: limits.max_students,
        max_storage_gb: limits.max_storage_gb,
        features: JSON.stringify(limits.features),
      })
      .returning('*');

    await db('tenants').where({ id: tenantId }).update({
      subscription_id: sub.id,
      max_users: limits.max_users,
      max_storage_gb: limits.max_storage_gb,
      status: 'active', // stay active — trial expiry is NOT a lockout
      updated_at: db.fn.now(),
    });

    logger.info(`Trial ended for tenant ${tenantId} — gracefully downgraded to Freetong`);
    return sub;
  }

  /**
   * Platform-owner COMP grant: give a school a plan for FREE (no payment, no
   * tenant-side renewal). Used for enterprise offers or relief for struggling
   * schools.
   *
   *  - durationDays omitted / null → open-ended (never expires, never swept).
   *  - durationDays set            → time-boxed; when it ends the expiry sweep
   *    gracefully downgrades to Freetong (never a lockout).
   *
   * Reactivates the tenant (a suspended/expired school becomes active) and does
   * NOT write a paid billing_history row (nothing was charged).
   */
  static async grantCompPlan(
    tenantId: string,
    planType: 'freetong' | 'combra' | 'bintumani',
    grantedBy: string,
    opts?: { durationDays?: number | null; reason?: string }
  ): Promise<ActiveSubscription> {
    const limits = await planLimits(planType); // throws on an unknown plan
    EntitlementService.clear(tenantId);
    const startDate = new Date();
    let endDate: Date | null = null;
    if (opts?.durationDays && opts.durationDays > 0) {
      endDate = new Date();
      endDate.setDate(startDate.getDate() + opts.durationDays);
    }

    // Cancel current active subscriptions, then create the comp.
    await db('subscriptions')
      .where({ tenant_id: tenantId, status: 'active' })
      .update({ status: 'cancelled', updated_at: db.fn.now() });

    const [sub] = await db('subscriptions')
      .insert({
        tenant_id: tenantId,
        plan_type: planType,
        status: 'active',
        is_trial: false,
        is_comp: true,
        comp_reason: opts?.reason || null,
        start_date: startDate,
        end_date: endDate,               // null = open-ended / no expiry
        monthly_price: 0,                // comped — nothing charged
        max_users: limits.max_users,
        max_students: limits.max_students,
        max_storage_gb: limits.max_storage_gb,
        features: JSON.stringify(limits.features),
        created_by: grantedBy,
      })
      .returning('*');

    await db('tenants').where({ id: tenantId }).update({
      subscription_id: sub.id,
      max_users: limits.max_users,
      max_storage_gb: limits.max_storage_gb,
      status: 'active', // a comp reactivates a suspended/expired school
      updated_at: db.fn.now(),
    });

    logger.info(`Comp ${planType} granted to tenant ${tenantId} by ${grantedBy}${endDate ? ` until ${endDate.toISOString()}` : ' (no expiry)'}`);
    return { ...sub, features: limits.features } as any;
  }

  /**
   * Revoke a comp grant: the platform owner wants the school to start paying.
   * Drops them to Freetong immediately (non-destructive — same soft-cap
   * behaviour as trial downgrade). The school can then upgrade via payment.
   */
  static async revokeCompPlan(tenantId: string, revokedBy: string): Promise<ActiveSubscription> {
    const current = await db('subscriptions')
      .where({ tenant_id: tenantId, status: 'active' })
      .orderBy('created_at', 'desc')
      .first();
    if (!current?.is_comp) {
      throw new AppError('This school is not on a complimentary plan.', 400, 'NOT_A_COMP');
    }
    const sub = await this.downgradeExpiredTrial(tenantId); // reuse graceful downgrade
    logger.info(`Comp revoked for tenant ${tenantId} by ${revokedBy} — moved to Freetong`);
    return { ...sub, features: await PlanCatalog.featuresFor('freetong') } as any;
  }

  /**
   * Change plan for tenant
   */
  static async changePlan(
    tenantId: string,
    newPlanType: 'freetong' | 'combra' | 'bintumani',
    billingCycle: 'monthly' | 'yearly',
    userId: string
  ): Promise<ActiveSubscription> {
    try {
      const limits = await planLimits(newPlanType); // throws on an unknown plan
      EntitlementService.clear(tenantId);

      // Guard downgrades: refuse to move to a plan whose limits are below the
      // tenant's CURRENT usage, so a school can't strand itself over-limit.
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
      const price = priceFor(limits, billingCycle);
      
      const startDate = new Date();
      const endDate = new Date();
      if (billingCycle === 'monthly') {
        endDate.setMonth(startDate.getMonth() + 1);
      } else {
        endDate.setFullYear(startDate.getFullYear() + 1);
      }

      // Deactivate all previous subscriptions
      await db('subscriptions')
        .where({ tenant_id: tenantId, status: 'active' })
        .update({ status: 'cancelled', updated_at: db.fn.now() });

      // Create new subscription
      const [newSub] = await db('subscriptions')
        .insert({
          tenant_id: tenantId,
          plan_type: newPlanType,
          status: 'active',
          start_date: startDate,
          end_date: endDate,
          monthly_price: billingCycle === 'monthly' ? limits.monthly_price : Math.round((limits.yearly_price / 12) * 100) / 100,
          max_users: limits.max_users,
          max_students: limits.max_students,
          max_storage_gb: limits.max_storage_gb,
          features: JSON.stringify(limits.features),
          created_by: userId,
        })
        .returning('*');

      // Update tenant subscription reference and limits. Changing/renewing a
      // plan also restores a tenant that was expired/suspended back to active.
      await db('tenants')
        .where({ id: tenantId })
        .update({
          subscription_id: newSub.id,
          max_users: limits.max_users,
          max_storage_gb: limits.max_storage_gb,
          status: 'active',
          updated_at: db.fn.now(),
        });

      // Generate invoice record in billing_history (currency: SLE — Leone)
      await db('billing_history').insert({
        tenant_id: tenantId,
        subscription_id: newSub.id,
        amount: price,
        currency: 'SLE',
        payment_method: 'card',
        transaction_id: 'sub_' + uuidv4().substring(0, 12),
        status: 'paid',
        billing_date: startDate,
        due_date: startDate,
        paid_date: startDate,
        notes: `Subscription set to ${newPlanType.toUpperCase()} (${billingCycle})`,
      });

      logger.info(`Tenant ${tenantId} subscription updated to ${newPlanType} by ${userId}`);

      return {
        ...newSub,
        features: limits.features,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`Error changing subscription plan: ${error}`);
      throw new AppError('Failed to change subscription plan', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Get billing history for a tenant
   */
  static async getBillingHistory(tenantId: string) {
    try {
      const history = await db('billing_history')
        .where({ tenant_id: tenantId })
        .orderBy('billing_date', 'desc');
      return history;
    } catch (error) {
      logger.error(`Error fetching billing history: ${error}`);
      throw new AppError('Failed to fetch billing history', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Renew the active subscription: extend the end date by one billing cycle and
   * record a paid billing entry. Restores the tenant to active.
   */
  static async renewSubscription(
    tenantId: string,
    billingCycle: 'monthly' | 'yearly',
    userId: string
  ): Promise<ActiveSubscription> {
    try {
      const sub = await this.getActiveSubscription(tenantId);
      const limits = await planLimits(sub.plan_type);
      EntitlementService.clear(tenantId);
      const base = sub.end_date && new Date(sub.end_date) > new Date() ? new Date(sub.end_date) : new Date();
      const newEnd = new Date(base);
      if (billingCycle === 'monthly') newEnd.setMonth(newEnd.getMonth() + 1);
      else newEnd.setFullYear(newEnd.getFullYear() + 1);

      const price = priceFor(limits, billingCycle);

      const [updated] = await db('subscriptions')
        .where({ id: sub.id })
        .update({ status: 'active', end_date: newEnd, updated_at: db.fn.now() })
        .returning('*');

      await db('tenants').where({ id: tenantId }).update({ status: 'active', updated_at: db.fn.now() });

      await db('billing_history').insert({
        tenant_id: tenantId,
        subscription_id: sub.id,
        amount: price,
        currency: 'SLE',
        payment_method: 'card',
        transaction_id: 'ren_' + uuidv4().substring(0, 12),
        status: 'paid',
        billing_date: new Date(),
        due_date: new Date(),
        paid_date: new Date(),
        notes: `Renewal of ${sub.plan_type.toUpperCase()} (${billingCycle})`,
      });

      logger.info(`Tenant ${tenantId} subscription renewed by ${userId}`);
      return { ...updated, features: typeof updated.features === 'string' ? JSON.parse(updated.features) : updated.features };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`Error renewing subscription: ${error}`);
      throw new AppError('Failed to renew subscription', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Manually extend the current subscription end date by a number of days
   * (a grace period). Keeps the tenant active.
   */
  static async extendSubscription(tenantId: string, days: number, userId: string): Promise<ActiveSubscription> {
    try {
      if (!Number.isFinite(days) || days <= 0) {
        throw new AppError('Days must be a positive number', 400, 'VALIDATION_ERROR');
      }
      const sub = await this.getActiveSubscription(tenantId);
      EntitlementService.clear(tenantId);
      const base = sub.end_date && new Date(sub.end_date) > new Date() ? new Date(sub.end_date) : new Date();
      const newEnd = new Date(base);
      newEnd.setDate(newEnd.getDate() + Math.floor(days));

      const [updated] = await db('subscriptions')
        .where({ id: sub.id })
        .update({ status: 'active', end_date: newEnd, updated_at: db.fn.now() })
        .returning('*');

      await db('tenants').where({ id: tenantId }).update({ status: 'active', updated_at: db.fn.now() });

      logger.info(`Tenant ${tenantId} subscription extended by ${days} days by ${userId}`);
      return { ...updated, features: typeof updated.features === 'string' ? JSON.parse(updated.features) : updated.features };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`Error extending subscription: ${error}`);
      throw new AppError('Failed to extend subscription', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Force-expire the current subscription (e.g. non-payment). Flips the tenant
   * status to expired so feature/limit enforcement blocks access.
   */
  static async expireSubscription(tenantId: string, userId: string): Promise<ActiveSubscription> {
    try {
      const sub = await this.getActiveSubscription(tenantId);
      EntitlementService.clear(tenantId);
      const [updated] = await db('subscriptions')
        .where({ id: sub.id })
        .update({ status: 'expired', end_date: new Date(), updated_at: db.fn.now() })
        .returning('*');

      await db('tenants').where({ id: tenantId }).update({ status: 'expired', updated_at: db.fn.now() });

      logger.info(`Tenant ${tenantId} subscription force-expired by ${userId}`);
      return { ...updated, features: typeof updated.features === 'string' ? JSON.parse(updated.features) : updated.features };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`Error expiring subscription: ${error}`);
      throw new AppError('Failed to expire subscription', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Usage snapshot vs plan limits for the platform console.
   */
  static async getUsage(tenantId: string): Promise<{
    students: { current: number; max: number };
    staff: { current: number; max: number };
    users: { current: number; max: number };
  }> {
    try {
      const [students, staff] = await Promise.all([
        this.checkLimit(tenantId, 'students'),
        this.checkLimit(tenantId, 'staff'),
      ]);
      const [{ count }] = await db('users').where({ tenant_id: tenantId }).count('* as count');
      const sub = await this.getActiveSubscription(tenantId);
      return {
        students: { current: students.current, max: students.max },
        staff: { current: staff.current, max: staff.max },
        users: { current: parseInt(count as string, 10) || 0, max: sub.max_users },
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`Error getting usage: ${error}`);
      throw new AppError('Failed to get usage', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Check if tenant is within subscription limits
   */
  static async checkLimit(
    tenantId: string,
    limitType: 'students' | 'staff'
  ): Promise<{ allowed: boolean; current: number; max: number }> {
    try {
      const sub = await this.getActiveSubscription(tenantId);
      let currentCount = 0;

      if (limitType === 'students') {
        const [{ count }] = await db('students')
          .join('users', 'students.user_id', 'users.id')
          .where('users.tenant_id', tenantId)
          .count('* as count');
        currentCount = parseInt(count as string, 10);
        return {
          allowed: currentCount < sub.max_students,
          current: currentCount,
          max: sub.max_students,
        };
      } else if (limitType === 'staff') {
        const [{ count }] = await db('users')
          .where({ tenant_id: tenantId })
          .whereIn('role', ['teacher', 'accountant', 'admissions_officer', 'principal'])
          .count('* as count');
        currentCount = parseInt(count as string, 10);
        
        // Staff limit from the live plan catalog.
        const maxStaff = sub.max_staff ?? (await planLimits(sub.plan_type)).max_staff;

        return {
          allowed: currentCount < maxStaff,
          current: currentCount,
          max: maxStaff,
        };
      }

      return { allowed: true, current: 0, max: 999999 };
    } catch (error) {
      logger.error(`Error checking subscription limits: ${error}`);
      throw new AppError('Failed to check subscription limits', 500, 'DATABASE_ERROR');
    }
  }
}
