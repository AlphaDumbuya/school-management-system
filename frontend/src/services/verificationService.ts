/**
 * verificationService (frontend) — school verification API calls.
 *
 * The account owner submits the school's details; WiSkul (the platform's super
 * admin) reviews them and approves or rejects. Lifecycle:
 *   unverified → (submit) pending → verified | rejected → (resubmit) pending …
 * and a verified school can be revoked back to unverified.
 */
import { apiClient } from '@lib/apiClient';
import { ApiResponse } from '@appTypes/index';

export type IdType = 'national_id' | 'passport' | 'drivers_license';

export type VerificationState = 'unverified' | 'pending' | 'verified' | 'rejected';

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
  status: VerificationState;
  submittedAt?: string | null;
  verifiedAt?: string | null;
  /** Why it was last rejected or revoked (shown to the owner). */
  lastReason?: string | null;
  /** The account owner's name on file (the ID name must match it). */
  ownerName?: string;
  idLast4?: string | null;
  emisCode?: string | null;
  schoolLevel?: string | null;
  district?: string | null;
  yearEstablished?: number | null;
  idType?: IdType | null;
  idName?: string | null;
}

/** EMIS / school registration codes: letters, digits, "/" and "-". Same rule as the server. */
export const EMIS_RE = /^[A-Za-z0-9][A-Za-z0-9/-]{2,28}[A-Za-z0-9]$/;

export const ID_TYPE_LABEL: Record<IdType, string> = {
  national_id: 'National ID',
  passport: 'Passport',
  drivers_license: "Driver's licence",
};

/** Is the signed-in owner's school verified? (cached on the user, either spelling). Only 'verified' counts. */
export const isVerifiedUser = (user: any) =>
  user?.verificationStatus === 'verified' || user?.verification_status === 'verified';

/** The cached verification state on the signed-in user (either spelling). */
export const userVerificationState = (user: any): VerificationState | null => {
  const v = user?.verificationStatus ?? user?.verification_status;
  return v === 'unverified' || v === 'pending' || v === 'verified' || v === 'rejected' ? v : null;
};

export const verificationService = {
  getStatus: async (): Promise<ApiResponse<VerificationStatus>> =>
    apiClient.get('/api/v1/verification/status'),

  getOptions: async (): Promise<ApiResponse<{ school_levels: string[]; districts: string[] }>> =>
    apiClient.get('/api/v1/verification/options'),

  /** Submit (or resubmit) the details for WiSkul's review. */
  verify: async (payload: VerifyPayload): Promise<ApiResponse<{ status: 'pending'; submittedAt: string }>> =>
    apiClient.post('/api/v1/verification/verify', payload),
};

export default verificationService;
