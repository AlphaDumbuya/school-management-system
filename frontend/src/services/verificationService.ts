/**
 * verificationService (frontend) — school verification API calls.
 */
import { apiClient } from '@lib/apiClient';
import { ApiResponse } from '@appTypes/index';

export type IdType = 'national_id' | 'passport' | 'drivers_license';

export interface VerifyPayload {
  legalName: string;
  emisCode: string;
  idType: IdType;
  idNumber: string;
  idName: string;
  schoolLevel?: string;
  district?: string;
  yearEstablished?: number;
}

export interface VerificationStatus {
  status: 'unverified' | 'verified';
  verifiedAt?: string | null;
  lastReason?: string | null;
}

export const verificationService = {
  getStatus: async (): Promise<ApiResponse<VerificationStatus>> =>
    apiClient.get('/api/v1/verification/status'),

  verify: async (payload: VerifyPayload): Promise<ApiResponse<{ status: 'verified' }>> =>
    apiClient.post('/api/v1/verification/verify', payload),

  setProfilePhoto: async (url: string): Promise<ApiResponse<{ ok?: boolean }>> =>
    apiClient.post('/api/v1/verification/profile-photo', { url }),
};

export default verificationService;
