/**
 * verificationService (frontend) — school verification API calls.
 */
import { apiClient } from '@lib/apiClient';
import { ApiResponse } from '@appTypes/index';

export type IdType = 'national_id' | 'passport' | 'drivers_license';

export interface VerifyPayload {
  emisCode: string;
  idType: IdType;
  idNumber: string;
  idName: string;
  schoolLevel?: string;
  district?: string;
  yearEstablished?: number;
  /** The owner confirms the details are true and theirs. */
  declaration: boolean;
}

export interface VerificationStatus {
  status: 'unverified' | 'verified';
  verifiedAt?: string | null;
  lastReason?: string | null;
  /** The account owner's name on file (the ID name must match it). */
  ownerName?: string;
  idLast4?: string | null;
  emisCode?: string | null;
}

/** EMIS / school registration codes: letters, digits, "/" and "-". Same rule as the server. */
export const EMIS_RE = /^[A-Za-z0-9][A-Za-z0-9/-]{2,28}[A-Za-z0-9]$/;

/** Is the signed-in owner's school verified? (cached on the user, either spelling) */
export const isVerifiedUser = (user: any) =>
  user?.verificationStatus === 'verified' || user?.verification_status === 'verified';

export const verificationService = {
  getStatus: async (): Promise<ApiResponse<VerificationStatus>> =>
    apiClient.get('/api/v1/verification/status'),

  getOptions: async (): Promise<ApiResponse<{ school_levels: string[]; districts: string[] }>> =>
    apiClient.get('/api/v1/verification/options'),

  verify: async (payload: VerifyPayload): Promise<ApiResponse<{ status: 'verified' }>> =>
    apiClient.post('/api/v1/verification/verify', payload),

  setProfilePhoto: async (url: string): Promise<ApiResponse<{ ok?: boolean }>> =>
    apiClient.post('/api/v1/verification/profile-photo', { url }),
};

export default verificationService;
