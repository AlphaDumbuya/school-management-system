/**
 * Plan catalog client. The catalog is edited by the super admin and read by the
 * pricing page, the school billing tab and the platform console, so every
 * place shows the same prices, limits and features.
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@lib/apiClient';

export type PlanId = 'freetong' | 'combra' | 'bintumani';

export interface PlanFeatureDef {
  key: string;
  label: string;
  description: string;
  group: string;
  core?: boolean;
  soon?: boolean;
}

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  badge: string;
  monthly_price: number;
  yearly_price: number;
  max_students: number;
  max_staff: number;
  max_users: number;
  max_storage_gb: number;
  features: Record<string, boolean>;
  highlights: string[];
  is_public: boolean;
  featured: boolean;
  sort: number;
}

export interface PlanCatalogPayload {
  plans: PlanDef[];
  features: PlanFeatureDef[];
  unlimited: number;
  currency?: string;
  /** Admin only: active schools per plan. */
  tenants?: Record<string, number>;
}

/** Built-in fallback so marketing pages still render if the API is unreachable. */
export const FALLBACK_UNLIMITED = 999999;

export const isUnlimited = (n: number, unlimited = FALLBACK_UNLIMITED) => Number(n) >= unlimited;

export const fmtLimit = (n: number, noun: string, unlimited = FALLBACK_UNLIMITED) =>
  isUnlimited(n, unlimited) ? `Unlimited ${noun}` : `Up to ${Number(n).toLocaleString('en-US')} ${noun}`;

export const fmtPrice = (n: number) => `NLe ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/**
 * Bullet list for a plan card: limits, then included features (core first),
 * then the plan's own marketing highlights. `soon` features are tagged.
 */
export function planBullets(plan: PlanDef, catalog: PlanCatalogPayload, opts: { includeCore?: boolean } = {}) {
  const bullets: Array<{ label: string; soon?: boolean }> = [
    { label: fmtLimit(plan.max_students, 'students', catalog.unlimited) },
    { label: fmtLimit(plan.max_staff, 'staff', catalog.unlimited) },
  ];
  for (const f of catalog.features) {
    if (f.core ? opts.includeCore !== false : plan.features[f.key]) bullets.push({ label: f.label, soon: f.soon });
  }
  for (const h of plan.highlights || []) bullets.push({ label: h });
  return bullets;
}

/** Features in `plan` that `prev` doesn't include (for "Everything in X, plus"). */
export function planAdds(plan: PlanDef, prev: PlanDef | undefined, catalog: PlanCatalogPayload) {
  return catalog.features.filter((f) => !f.core && plan.features[f.key] && !(prev?.features[f.key]));
}

export const planService = {
  async getPublicPlans(): Promise<PlanCatalogPayload | null> {
    const res: any = await apiClient.get('/api/v1/public/plans');
    return res?.success && res.data ? res.data : null;
  },
  async getAdminPlans(): Promise<PlanCatalogPayload | null> {
    const res: any = await apiClient.get('/api/v1/platform/plans');
    return res?.success && res.data ? res.data : null;
  },
  async updatePlan(id: PlanId, patch: Partial<PlanDef>) {
    return apiClient.put<{ success: boolean; message: string; data: PlanDef }>(`/api/v1/platform/plans/${id}`, patch);
  },
  async resetPlan(id: PlanId) {
    return apiClient.post<{ success: boolean; message: string; data: PlanDef }>(`/api/v1/platform/plans/${id}/reset`);
  },
};

/** Public catalog (cached for a few minutes). */
export function usePublicPlans() {
  return useQuery({
    queryKey: ['public-plans'],
    queryFn: () => planService.getPublicPlans(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export default planService;
