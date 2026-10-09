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
      else if (held[f.key]) features[f.key] = 'read_only';
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

/** Safe wrapper for payloads (/me): never fails the caller. */
export async function entitlementsOrNull(tenantId?: string | null): Promise<Entitlements | null> {
  if (!tenantId) return null;
  try { return await EntitlementService.forTenant(tenantId); } catch (e) {
    logger.warn(`entitlements unavailable for ${tenantId}: ${(e as any)?.message || e}`);
    return null;
  }
}

export default EntitlementService;
