import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscriptionService';
import { EntitlementService, ROLE_PORTAL, portalAllowed, assertPortalAllowed } from '../services/entitlementService';
import { dutyForPath, effectiveDuties } from '../utils/staffDuties';
import { FEATURES } from '../services/planCatalogService';
import { JWTService } from '../services/jwtService';
import { db } from '../utils/database';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const featureLabel = (key: string) => FEATURES.find((f) => f.key === key)?.label || key;

/**
 * Decide one request against the tenant's entitlement for a feature:
 *  - enabled   → allowed
 *  - read_only → reads allowed, writes refused (FEATURE_READ_ONLY)
 *  - locked    → refused (PLAN_LIMIT_REACHED)
 * Throws an AppError when refused.
 */
export async function assertFeatureAccess(tenantId: string, featureKey: string, method: string): Promise<void> {
  const { access, ent } = await EntitlementService.access(tenantId, featureKey);
  if (access === 'enabled') return;
  if (access === 'read_only') {
    if (READ_METHODS.has(method.toUpperCase())) return;
    if (ent.lapsed) {
      throw new AppError(
        `Your school subscription has ${ent.status}. Your records are safe and can be viewed; renew your plan to make changes.`,
        403,
        'SUBSCRIPTION_EXPIRED'
      );
    }
    throw new AppError(
      `${featureLabel(featureKey)} is read-only on the ${ent.plan_name} plan. Your existing records are kept and can be viewed; upgrade to add or change them.`,
      403,
      'FEATURE_READ_ONLY'
    );
  }
  logger.warn(`Tenant ${tenantId} tried to use '${featureKey}', not in their ${ent.plan_name} plan.`);
  throw new AppError(
    `${featureLabel(featureKey)} is not included in your ${ent.plan_name} plan. Upgrade to use it.`,
    403,
    'PLAN_LIMIT_REACHED'
  );
}

/**
 * Route middleware: the tenant's plan must include `featureKey`. Reads still
 * work when the feature is read-only (held on an earlier plan / trial).
 */
export const requirePlanFeature = (featureKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (req.user?.role === 'super_admin' || req.auth?.role === ('super_admin' as any)) return next();
      const tenantId = req.user?.tenant_id || (req.auth as any)?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant context required', 400, 'TENANT_CONTEXT_MISSING');
      }

      await assertFeatureAccess(tenantId, featureKey, req.method);
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * API prefix → plan feature. Matched against the full URL on whole path
 * segments, so one global gate covers routers mounted at bare /api/v1 too.
 * Core modules (classes, students, attendance, fees, …) are not listed.
 */
export const FEATURE_PREFIXES: Array<[string, string]> = [
  ['/api/v1/payments/monime/checkout', 'online_payments'],
  ['/api/v1/payments/monime/payment-code', 'online_payments'],
  ['/api/v1/admissions', 'admissions'],
  ['/api/v1/dashboards/admissions', 'admissions'],
  ['/api/v1/promotions', 'promotions'],
  ['/api/v1/discipline', 'discipline'],
  ['/api/v1/id-cards', 'id_cards'],
  ['/api/v1/card-templates', 'id_cards'],
  ['/api/v1/print-configs', 'id_cards'],
  ['/api/v1/events', 'events'],
  ['/api/v1/finance/aging', 'fee_management'],
  ['/api/v1/finance/discounts', 'fee_management'],
  ['/api/v1/finance/late-fees', 'fee_management'],
  ['/api/v1/finance/plans', 'fee_management'],
  ['/api/v1/finance/credits', 'fee_management'],
  ['/api/v1/finance/expenses', 'expenses'],
  ['/api/v1/finance/expenses-v2', 'expenses'],
  ['/api/v1/finance/expense-categories', 'expenses'],
  ['/api/v1/finance/petty-cash', 'expenses'],
  ['/api/v1/finance/budgets', 'expenses'],
  ['/api/v1/finance/summary', 'expenses'],
  ['/api/v1/finance/payroll', 'payroll'],
  ['/api/v1/finance/gl', 'accounting'],
  ['/api/v1/finance/bank', 'accounting'],
  ['/api/v1/finance/audit', 'accounting'],
  ['/api/v1/school-config/archive', 'academic_archive'],
];

/**
 * Writes that must keep working while a school is read-only for non-payment:
 * signing in / security, paying for a plan (and the verification it needs),
 * fee payments + provider webhooks, notifications, support and live sync pings.
 */
const LAPSE_EXEMPT_PREFIXES = [
  '/api/v1/auth',
  '/api/v1/school-config/subscription',
  '/api/v1/verification',
  '/api/v1/payments',
  '/api/v1/public',
  '/api/v1/cron',
  '/api/v1/sms-whatsapp/webhooks',
  '/api/v1/notifications',
  '/api/v1/in-app-notifications',
  '/api/v1/notification-preferences',
  '/api/v1/support',
  '/api/v1/help',
  '/api/v1/live',
];

export function isLapseExempt(url: string): boolean {
  const path = String(url || '').split('?')[0].replace(/\/+$/, '');
  return LAPSE_EXEMPT_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));
}

export function featureForPath(url: string): string | null {
  const path = String(url || '').split('?')[0].replace(/\/+$/, '');
  for (const [prefix, key] of FEATURE_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + '/')) return key;
  }
  return null;
}

/**
 * Global plan gate (mounted once in index.ts, before the routers). Resolves the
 * caller's school from the bearer token itself because per-router
 * authentication hasn't run yet. Requests without a valid token pass through
 * untouched: the router's own `authenticate` rejects them as before.
 */
export const planFeatureGate = async (req: Request, _res: Response, next: NextFunction) => {
  const url = req.originalUrl || req.url;
  const featureKey = featureForPath(url);
  const isWrite = !READ_METHODS.has(req.method.toUpperCase());
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  let payload: any;
  try { payload = JWTService.verifyAccessToken(header.substring(7)); } catch { return next(); }
  const userId: string | undefined = payload?.userId;
  if (!userId) return next();
  // Who needs a DB look-up: users of plan-gated portals (every request), a
  // teacher on a staff-duty module, gated features, and core-module writes.
  const tokenRole = String(payload?.role || '');
  const dutyPath = ['teacher', 'accountant', 'admissions_officer'].includes(tokenRole)
    ? dutyForPath(url, ['accountant', 'admissions_officer'] as any) : null;
  const portalRole = !!ROLE_PORTAL[tokenRole];
  if (!portalRole && !dutyPath && !featureKey && (!isWrite || isLapseExempt(url))) return next();
  try {
    const user = await db('users').where({ id: userId }).first('tenant_id', 'role', 'staff_duties');
    if (!user || user.role === 'super_admin' || !user.tenant_id) return next();
    // Portal not in the plan: fully disabled (sign-out and the auth endpoints
    // still answer so the app can explain it and log out cleanly).
    if (ROLE_PORTAL[user.role] && !url.startsWith('/api/v1/auth')) {
      await assertPortalAllowed(user.tenant_id, user.role);
    }
    // An extra Bursar / Admissions job works only when the plan includes that portal.
    if (dutyPath) {
      const duties = effectiveDuties(user.role, user.staff_duties);
      const duty = dutyForPath(url, duties);
      if ((duty === 'accountant' || duty === 'admissions_officer') && !(await portalAllowed(user.tenant_id, duty))) {
        // Different code from PORTAL_NOT_IN_PLAN: the teacher keeps their own
        // portal; only the duty is unavailable.
        throw new AppError(
          `Your school's plan doesn't include the ${duty === 'accountant' ? 'Bursar' : 'Admissions Officer'} duty. Ask your principal about upgrading the plan.`,
          403,
          'PLAN_LIMIT_REACHED'
        );
      }
    }
    if (!featureKey && (!isWrite || isLapseExempt(url))) return next();
    if (featureKey) {
      await assertFeatureAccess(user.tenant_id, featureKey, req.method);
    } else {
      // Trial ended with payment required: the whole school is read-only.
      const ent = await EntitlementService.forTenant(user.tenant_id);
      if (ent.lapsed) {
        throw new AppError(
          user.role === 'principal'
            ? 'Your free period has ended. Choose a plan in Settings → Plan & Billing to keep adding and changing records. Everything you have is safe.'
            : 'Your school’s free period has ended, so changes are paused. Ask your principal to choose a plan. Everything is safe and can still be viewed.',
          403,
          'SUBSCRIPTION_EXPIRED'
        );
      }
    }
    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    // Never lock a school out because the entitlement lookup hiccuped.
    logger.warn(`planFeatureGate lookup failed (${featureKey}): ${(error as any)?.message || error}`);
    next();
  }
};

/**
 * Middleware to check if the tenant is within subscription limits before creating entities (students/staff)
 */
export const checkSubscriptionLimit = (limitType: 'students' | 'staff') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenant_id || (req.auth as any)?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant context required', 400, 'TENANT_CONTEXT_MISSING');
      }

      const subscription = await SubscriptionService.getActiveSubscription(tenantId);
      
      // Enforce active subscription status checks
      if (subscription.status === 'expired' || subscription.status === 'suspended') {
        throw new AppError(
          `Your school subscription has ${subscription.status}. Please renew your plan to restore access.`,
          403,
          'SUBSCRIPTION_EXPIRED'
        );
      }

      const limitCheck = await SubscriptionService.checkLimit(tenantId, limitType);

      if (!limitCheck.allowed) {
        logger.warn(`Tenant ${tenantId} reached the maximum limit of ${limitType} (${limitCheck.current}/${limitCheck.max}). Creation blocked.`);
        throw new AppError(
          `You have reached the maximum limit of ${limitType} for your current plan (${limitCheck.current} of ${limitCheck.max}). Please upgrade your subscription plan to add more.`,
          403,
          'PLAN_LIMIT_REACHED'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
