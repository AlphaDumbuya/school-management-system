/**
 * Plan features on the client: which page belongs to which plan feature, and
 * what the signed-in school may do with it. Mirrors the backend
 * FEATURE_PREFIXES (middleware/subscriptionGuard.ts); the server is the real
 * enforcement, this only shapes the UI.
 *
 *   enabled   → normal
 *   read_only → visible, records can be viewed, nothing can be added/changed
 *               (the school had it on its trial / an earlier plan)
 *   locked    → hidden (not part of any plan the school has had)
 */
import type { AuthUser, FeatureAccess, PlanAccess } from '@appTypes/index';

/** App route prefix → plan feature key. Core pages are not listed. */
export const ROUTE_FEATURES: Array<[string, string]> = [
  ['/students/admissions', 'admissions'],
  ['/admissions/dashboard', 'admissions'],
  ['/academic/promotions', 'promotions'],
  ['/discipline', 'discipline'],
  ['/reports/discipline', 'discipline'],
  ['/identity', 'id_cards'],
  ['/events', 'events'],
  ['/finance/aging', 'fee_management'],
  ['/finance/discounts', 'fee_management'],
  ['/finance/expenses', 'expenses'],
  ['/finance/petty-cash', 'expenses'],
  ['/finance/budgets', 'expenses'],
  ['/finance/payroll', 'payroll'],
  ['/finance/my-payslips', 'payroll'],
  ['/finance/reports', 'accounting'],
  ['/finance/journal', 'accounting'],
  ['/finance/accounts', 'accounting'],
  ['/finance/bank-reconciliation', 'accounting'],
  ['/finance/audit-log', 'accounting'],
  ['/reports/academic', 'academic_archive'],
];

export function featureForRoute(path: string): string | null {
  const p = String(path || '').split('?')[0].replace(/\/+$/, '');
  for (const [prefix, key] of ROUTE_FEATURES) {
    if (p === prefix || p.startsWith(prefix + '/')) return key;
  }
  return null;
}

/** The school's plan access, or null when unknown (super admin / not loaded). */
export function planAccessOf(user: AuthUser | null | undefined): PlanAccess | null {
  if (!user || user.role === 'super_admin') return null;
  return user.planAccess ?? null;
}

/**
 * Access to a feature. Unknown (no plan data yet, or an ungated key) is treated
 * as enabled so the UI never hides things by mistake; the server still checks.
 */
export function featureAccess(user: AuthUser | null | undefined, featureKey: string | null): FeatureAccess {
  if (!featureKey) return 'enabled';
  const pa = planAccessOf(user);
  if (!pa) return 'enabled';
  return pa.features?.[featureKey] ?? 'enabled';
}

export function routeAccess(user: AuthUser | null | undefined, path: string): FeatureAccess {
  return featureAccess(user, featureForRoute(path));
}
