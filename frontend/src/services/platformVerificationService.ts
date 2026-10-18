/**
 * platformVerificationService (frontend) — super admin review of school
 * verification submissions (/api/v1/platform/verifications…).
 */
import { apiClient } from '@lib/apiClient';
import { ApiResponse } from '@appTypes/index';
import type { IdType, VerificationState } from '@services/verificationService';

export type VerificationFilter = VerificationState | 'all';

export interface VerificationRow {
  tenant_id: string;
  school_name: string;
  tenant_status: string;
  owner_name: string | null;
  owner_email: string | null;
  emis_code: string | null;
  school_level: string | null;
  district: string | null;
  year_established: number | null;
  id_type: IdType | null;
  id_last4: string | null;
  id_name: string | null;
  /** Does the name on the ID match the account owner's name? */
  name_match: boolean | null;
  status: VerificationState;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  last_reason: string | null;
  review_notes: string | null;
  /** The same EMIS code is also on another school. */
  emis_conflict: boolean;
}

export interface VerificationHistoryItem {
  action: string;
  at: string;
  by_name: string | null;
  reason?: string | null;
}

export interface VerificationDetail extends VerificationRow {
  /** Full ID number. Reading it is audited server-side. */
  id_number: string | null;
  owner_phone?: string | null;
  school: {
    name: string;
    emis_code?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    school_type?: string | null;
  };
  history: VerificationHistoryItem[];
}

/** Reasons a reviewer can pick with one tap when rejecting. */
export const QUICK_REJECT_REASONS = [
  'EMIS code could not be confirmed',
  'Name on ID does not match the account owner',
  'ID details are incomplete or unreadable',
  'School details do not match MBSSE records',
];

export const REASON_MIN = 5;
export const REASON_MAX = 500;

const base = '/api/v1/platform';

export const platformVerificationService = {
  list: async (status: VerificationFilter, search = ''): Promise<ApiResponse<VerificationRow[]>> =>
    apiClient.get(`${base}/verifications`, { params: { status, ...(search ? { search } : {}) } }),

  count: async (): Promise<ApiResponse<{ pending: number }>> =>
    apiClient.get(`${base}/verifications/count`),

  detail: async (tenantId: string): Promise<ApiResponse<VerificationDetail>> =>
    apiClient.get(`${base}/tenants/${encodeURIComponent(tenantId)}/verification`),

  approve: async (tenantId: string, notes?: string): Promise<ApiResponse<{ status: 'verified' }>> =>
    apiClient.post(`${base}/tenants/${encodeURIComponent(tenantId)}/verification/approve`, notes ? { notes } : {}),

  reject: async (tenantId: string, reason: string): Promise<ApiResponse<{ status: 'rejected' }>> =>
    apiClient.post(`${base}/tenants/${encodeURIComponent(tenantId)}/verification/reject`, { reason }),

  revoke: async (tenantId: string, reason: string): Promise<ApiResponse<{ status: 'unverified' }>> =>
    apiClient.post(`${base}/tenants/${encodeURIComponent(tenantId)}/verification/revoke`, { reason }),
};

/** react-query keys, so every screen invalidates the same lists and count. */
export const verificationKeys = {
  all: ['platform-verifications'] as const,
  list: (status: VerificationFilter, search: string) => ['platform-verifications', 'list', status, search] as const,
  count: ['platform-verifications', 'count'] as const,
  detail: (tenantId: string) => ['platform-verifications', 'detail', tenantId] as const,
};

export default platformVerificationService;
