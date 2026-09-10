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
};

export default restoreService;
