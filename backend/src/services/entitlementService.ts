/**
 * entitlementService — what a school may use right now, per feature.
 *
 *   enabled   → in the school's current plan: full access.
 *   read_only → NOT in the current plan, but the school had it on an earlier
 *               subscription (typically the new-school trial / a promo / comp
 *               grant, or a higher plan before a downgrade). Their records are
 *               kept and stay visible; nothing new can be created or changed.
 *   locked    → never part of any plan the school had: hidden.
 *
 * Feature sets come from the LIVE plan catalog (super admin edits apply
 * immediately), OR'ed with the feature snapshot stored on each past
 * subscription row (what the school actually had at the time).
 */
import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { PlanCatalog, FEATURES, PlanId } from './planCatalogService';

export type FeatureAccess = 'enabled' | 'read_only' | 'locked';

export interface Entitlements {
  plan_type: PlanId | string;
  plan_name: string;
  status: string;
  is_trial: boolean;
  is_comp: boolean;
  end_date: string | null;
  /** Subscription expired/suspended: everything is read-only until renewal. */
  lapsed: boolean;
  features: Record<string, FeatureAccess>;
}

const CACHE_MS = 15_000;
const cache = new Map<string, { at: number; value: Entitlements }>();

const parse = (v: any): Record<string, boolean> => {
  if (!v) return {};
  try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return {}; }
};

export const EntitlementService = {
  async forTenant(tenantId: string): Promise<Entitlements> {
    const hit = cache.get(tenantId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

    // Lazy import: subscriptionService imports this module (cache clearing).
    const { SubscriptionService } = await import('./subscriptionService.js');
    const sub: any = await SubscriptionService.getActiveSubscription(tenantId);
    const current = await PlanCatalog.featuresFor(sub.plan_type);

    // Everything the school held on any earlier subscription.
    const history = await db('subscriptions').where({ tenant_id: tenantId }).whereNot('id', sub.id)
      .select('plan_type', 'features').catch(() => [] as any[]);
    const held: Record<string, boolean> = {};
    for (const row of history) {
      const live = await PlanCatalog.featuresFor(row.plan_type);
      const snap = parse(row.features);
      for (const f of FEATURES) if (live[f.key] || snap[f.key] === true) held[f.key] = true;
    }

    const lapsed = sub.status === 'expired' || sub.status === 'suspended';
    const features: Record<string, FeatureAccess> = {};
    for (const f of FEATURES) {
      if (current[f.key]) features[f.key] = lapsed ? 'read_only' : 'enabled';
      // Portals outside the plan are fully disabled, even if held on a trial.
      else if (held[f.key] && !f.key.startsWith('portal_')) features[f.key] = 'read_only';
      else features[f.key] = 'locked';
    }

    const plan = PlanCatalog.isPlanId(sub.plan_type) ? await PlanCatalog.get(sub.plan_type) : null;
    const value: Entitlements = {
      plan_type: sub.plan_type,
      plan_name: plan?.name || String(sub.plan_type || ''),
      status: sub.status,
      is_trial: !!sub.is_trial,
      is_comp: !!sub.is_comp,
      end_date: sub.end_date ? new Date(sub.end_date).toISOString() : null,
      lapsed,
      features,
    };
    cache.set(tenantId, { at: Date.now(), value });
    return value;
  },

  /** Access for one feature; unknown keys are treated as enabled (not gated). */
  async access(tenantId: string, featureKey: string): Promise<{ access: FeatureAccess; ent: Entitlements }> {
    const ent = await this.forTenant(tenantId);
    return { access: ent.features[featureKey] ?? 'enabled', ent };
  },

  /** Call after any subscription change for the tenant (or all when omitted). */
  clear(tenantId?: string) {
    if (tenantId) cache.delete(tenantId);
    else cache.clear();
  },
};

/** Which plan feature each role's (or staff duty's) portal needs. */
export const ROLE_PORTAL: Record<string, string> = {
  parent: 'portal_parent',
  guardian: 'portal_parent',
  admissions_officer: 'portal_admissions',
  accountant: 'portal_bursar',
};

const PORTAL_NAMES: Record<string, string> = {
  portal_parent: 'parent portal',
  portal_admissions: 'Admissions Officer portal',
  portal_bursar: 'Bursar / Accountant portal',
};

/** Is this role's portal included in the school's plan? Core roles always are. */
export async function portalAllowed(tenantId: string | null | undefined, role: string): Promise<boolean> {
  const key = ROLE_PORTAL[String(role || '')];
  if (!key || !tenantId) return true;
  const { access } = await EntitlementService.access(tenantId, key);
  return access !== 'locked';
}

/**
 * Refuse sign-in / requests / new accounts for a portal the plan doesn't
 * include. `forAccountCreation` words the message for the person adding users.
 */
export async function assertPortalAllowed(tenantId: string | null | undefined, role: string, opts: { forAccountCreation?: boolean } = {}): Promise<void> {
  if (await portalAllowed(tenantId, role)) return;
  const name = PORTAL_NAMES[ROLE_PORTAL[role]] || 'portal';
  const { AppError } = await import('../middleware/errorHandler.js');
  throw new AppError(
    opts.forAccountCreation
      ? `Your school's plan doesn't include the ${name}. Upgrade in Settings → Plan & Billing to add these accounts.`
      : `Your school's plan doesn't include the ${name}, so this account can't sign in. Please contact your school.`,
    403,
    'PORTAL_NOT_IN_PLAN'
  );
}

/** Safe wrapper for payloads (/me): never fails the caller. */
export async function entitlementsOrNull(tenantId?: string | null): Promise<Entitlements | null> {
  if (!tenantId) return null;
  try { return await EntitlementService.forTenant(tenantId); } catch (e) {
    logger.warn(`entitlements unavailable for ${tenantId}: ${(e as any)?.message || e}`);
    return null;
  }
}

export default EntitlementService;
