import { apiClient } from '@lib/apiClient';

export interface RestoreInfo {
  tenantId: string;
  schoolName: string;
  status: string;
  planType: string;
  amountDue: number;
  currency: string;
  alreadyActive: boolean;
}

/**
 * Public "restore access" flow for a SUSPENDED school to pay & reactivate
 * WITHOUT logging in. All calls are token-authenticated (no session).
 */
export const restoreService = {
  async getInfo(token: string) {
    return apiClient.get<{ success: boolean; data: RestoreInfo }>(
      `/api/v1/public/restore/info?token=${encodeURIComponent(token)}`
    );
  },

  async startCheckout(token: string) {
    return apiClient.post<{ success: boolean; data: { redirectUrl?: string; alreadyActive?: boolean } }>(
      '/api/v1/public/restore/checkout',
      { token }
    );
  },

  // ── Non-payment: reactivation request ──────────────────────────────────────
  async getReactivationInfo(token: string) {
    return apiClient.get<{ success: boolean; data: ReactivationInfo }>(
      `/api/v1/public/reactivation/info?token=${encodeURIComponent(token)}`
    );
  },

  async submitReactivationRequest(token: string, message: string, contactEmail?: string) {
    return apiClient.post<{ success: boolean; data: { reference: string } }>(
      '/api/v1/public/reactivation/request',
      { token, message, contactEmail }
    );
  },
};

export interface ReactivationInfo {
  tenantId: string;
  schoolName: string;
  status: string;
  category: string;
  reason: string | null;
  alreadyActive: boolean;
}

export default restoreService;
