import { apiClient } from '@lib/apiClient';

export interface OwnerOverview {
  schoolName: string | null;
  hasNamedOwner: boolean;
  plan: { planType: string; status: string; isTrial: boolean; isComp: boolean; endsAt: string | null } | null;
  usage: {
    students: { current: number; max: number } | null;
    staff: { current: number; max: number } | null;
  };
  payments: { feeCollectionConfigured: boolean };
  verification: { status: 'verified' | 'unverified'; verifiedAt: string | null };
  people: {
    principals: Array<{ id: string; name: string; email: string; status: string; isOwner: boolean; lastLogin: string | null }>;
    counts: { teachers: number; bursars: number; admissionsOfficers: number; students: number };
  };
  activity: Array<{ id: string; action: string; at: string; by: string }>;
}

export const ownerService = {
  /** Owner-only school overview. */
  getOverview: () => apiClient.get<OwnerOverview>('/api/v1/owner/overview'),
};

export default ownerService;
