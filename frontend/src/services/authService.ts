/**
 * Authentication Service
 * Handles authentication API calls and token management
 * Phase 11: Frontend Dashboard Implementation
 */

import { apiClient } from '@lib/apiClient';
import { API_ENDPOINTS } from '@config/api.config';
import {
  AuthResponse,
  AuthUser,
  LoginCredentials,
  RegisterPayload,
  ApiResponse,
} from '@appTypes/index';

// Local storage keys
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
};

export const authService = {
  /**
   * Login user with email and password
   */
  login: async (credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> => {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials
    );

    const resAny = response as any;
    const dataAny = response?.data as any;

    const accessToken = resAny?.token || resAny?.accessToken || dataAny?.accessToken || dataAny?.tokens?.accessToken || dataAny?.token;
    const refreshToken = resAny?.refreshToken || dataAny?.refreshToken || dataAny?.tokens?.refreshToken;
    const user = resAny?.user || dataAny?.user;

    if (accessToken) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    return response;
  },

  /**
   * Register new user
   */
  register: async (payload: RegisterPayload): Promise<ApiResponse<AuthResponse>> => {
    const response = await apiClient.post<AuthResponse>(
      API_ENDPOINTS.AUTH.REGISTER,
      payload
    );

    const resAny = response as any;
    const dataAny = response?.data as any;

    const accessToken = resAny?.token || resAny?.accessToken || dataAny?.accessToken || dataAny?.tokens?.accessToken || dataAny?.token;
    const refreshToken = resAny?.refreshToken || dataAny?.refreshToken || dataAny?.tokens?.refreshToken;
    const user = resAny?.user || dataAny?.user;

    if (accessToken) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    return response;
  },

  /**
   * Self-service School & Tenant Registration
   */
  registerSchool: async (payload: {
    school_name: string;
    contact_email: string;
    contact_phone?: string;
    country?: string;
    city?: string;
    address?: string;
    school_type?: string;
    school_motto?: string;
    id_student_prefix?: string;
    id_staff_prefix?: string;
    id_admission_prefix?: string;
    id_student_start_from?: number;
    admin_first_name: string;
    admin_last_name: string;
    /** Only the school owner can register a school. */
    is_school_owner: boolean;
    password: string;
  }): Promise<ApiResponse<AuthResponse>> => {
    const response = await apiClient.post<AuthResponse>(
      '/api/v1/auth/register-school',
      payload
    );

    const resAny = response as any;
    const dataAny = response?.data as any;

    const accessToken = resAny?.token || resAny?.accessToken || dataAny?.accessToken || dataAny?.tokens?.accessToken || dataAny?.token;
    const refreshToken = resAny?.refreshToken || dataAny?.refreshToken || dataAny?.tokens?.refreshToken;
    const user = resAny?.user || dataAny?.user;

    if (accessToken) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    return response;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    try {
      // Send this device's refresh token so the server ends only THIS session,
      // not the user's other active sessions (another tab, phone or laptop).
      const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT, refreshToken ? { refresh_token: refreshToken } : undefined);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local storage regardless of API response
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  },

  /**
   * Get current user profile
   */
  getCurrentUser: (): AuthUser | null => {
    const user = localStorage.getItem(STORAGE_KEYS.USER);
    if (!user) return null;

    try {
      return JSON.parse(user);
    } catch {
      return null;
    }
  },

  /**
   * Get access token
   */
  getAccessToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  /**
   * Get refresh token
   */
  getRefreshToken: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  /**
   * Refresh authentication token
   */
  refreshToken: async (): Promise<ApiResponse<AuthResponse>> => {
    const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

    if (!refreshToken) {
      return {
        success: false,
        error: 'No refresh token available',
      };
    }

    const response = await apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.REFRESH_TOKEN, {
      refresh_token: refreshToken,
    });

    if (response.success && response.data) {
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.data.accessToken);
      if (response.data.refreshToken) {
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.data.refreshToken);
      }
    }

    return response;
  },

  /**
   * Fetch current user info from server
   */
  /** Mark the first-login welcome guide as complete server-side (one-time across devices). */
  markOnboarded: async (): Promise<void> => {
    try { await apiClient.post('/api/v1/auth/onboarded'); } catch { /* non-fatal */ }
  },

  fetchMe: async (): Promise<ApiResponse<AuthUser>> => {
    const response = await apiClient.get<AuthUser>(API_ENDPOINTS.AUTH.ME);

    if (response.success && response.data) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data));
    }

    return response;
  },

  /**
   * Update user profile details
   */
  updateProfile: async (
    userId: string,
    payload: { firstName: string; lastName: string; email: string }
  ): Promise<ApiResponse<AuthUser>> => {
    const response = await apiClient.put<AuthUser>(
      `/api/v1/auth/users/${userId}`,
      {
        first_name: payload.firstName,
        last_name: payload.lastName,
        email: payload.email,
      }
    );

    if (response.success && response.data) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data));
    }

    return response;
  },

  /**
   * Change user password
   */
  changePassword: async (
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse<{ message: string }>> => {
    return apiClient.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      old_password: currentPassword,
      new_password: newPassword,
    });
  },

  /**
   * Request password reset
   */
  forgotPassword: async (email: string): Promise<ApiResponse<{ message: string }>> => {
    return apiClient.post(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, { email });
  },

  /**
   * Reset password with token
   */
  resetPassword: async (
    token: string,
    newPassword: string
  ): Promise<ApiResponse<{ message: string }>> => {
    return apiClient.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
      reset_token: token,
      new_password: newPassword,
    });
  },

  // ── Two-Factor Authentication ────────────────────────────────────────────

  /** Complete a 2FA login by exchanging the mfa token + code for real tokens. */
  verifyTwoFactorLogin: async (
    mfaToken: string,
    code: string
  ): Promise<ApiResponse<any>> => {
    const response = await apiClient.post('/api/v1/auth/2fa/verify-login', {
      mfa_token: mfaToken,
      code,
    });

    // Persist tokens exactly like a normal login so the axios interceptor
    // (which reads localStorage) sends the Authorization header afterwards.
    const resAny = response as any;
    const dataAny = (response as any)?.data;
    const accessToken =
      resAny?.accessToken || dataAny?.accessToken || dataAny?.tokens?.accessToken || dataAny?.token;
    const refreshToken = resAny?.refreshToken || dataAny?.refreshToken || dataAny?.tokens?.refreshToken;
    const user = resAny?.user || dataAny?.user;

    if (accessToken) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));

    return response;
  },

  /** Begin 2FA setup — returns { secret, otpauthUri }. */
  setupTwoFactor: async (): Promise<ApiResponse<{ secret: string; otpauthUri: string }>> => {
    return apiClient.post('/api/v1/auth/2fa/setup');
  },

  /** Verify the first code and enable 2FA — returns { backupCodes }. */
  enableTwoFactor: async (code: string): Promise<ApiResponse<{ backupCodes: string[] }>> => {
    return apiClient.post('/api/v1/auth/2fa/enable', { code });
  },

  /** Disable 2FA (requires a current code). */
  disableTwoFactor: async (code: string): Promise<ApiResponse<{ message: string }>> => {
    return apiClient.post('/api/v1/auth/2fa/disable', { code });
  },

  /** Regenerate backup codes (requires a current code). */
  regenerateBackupCodes: async (code: string): Promise<ApiResponse<{ backupCodes: string[] }>> => {
    return apiClient.post('/api/v1/auth/2fa/backup-codes', { code });
  },

  // ── Passkeys (WebAuthn) ────────────────────────────────────────────────────

  /** Get WebAuthn registration options (creation) for the signed-in user. */
  getPasskeyRegistrationOptions: async (): Promise<ApiResponse<any>> => {
    return apiClient.post('/api/v1/auth/passkeys/register/options');
  },

  /** Verify a registration response + persist the new passkey. */
  verifyPasskeyRegistration: async (
    response: unknown,
    label?: string
  ): Promise<ApiResponse<{ passkey: any }>> => {
    return apiClient.post('/api/v1/auth/passkeys/register/verify', { response, label });
  },

  /** Get WebAuthn authentication options during login (needs the mfa token). */
  getPasskeyAuthOptions: async (mfaToken: string): Promise<ApiResponse<any>> => {
    return apiClient.post('/api/v1/auth/passkeys/authenticate/options', { mfa_token: mfaToken });
  },

  /** Passwordless: options for signing in with a passkey (no email/password). */
  getPasskeyLoginOptions: async (): Promise<ApiResponse<any>> => {
    return apiClient.post('/api/v1/auth/passkeys/login/options');
  },

  /** Passwordless: verify the assertion and start a session (persists tokens). */
  verifyPasskeyLogin: async (response: unknown): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/api/v1/auth/passkeys/login/verify', { response });
    const resAny = res as any;
    const dataAny = (res as any)?.data;
    const accessToken =
      resAny?.accessToken || dataAny?.accessToken || dataAny?.tokens?.accessToken || dataAny?.token;
    const refreshToken = resAny?.refreshToken || dataAny?.refreshToken || dataAny?.tokens?.refreshToken;
    const user = resAny?.user || dataAny?.user;
    if (accessToken) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return res;
  },

  /**
   * Complete a passkey login by verifying the assertion. Persists tokens exactly
   * like verifyTwoFactorLogin so the axios interceptor sends Authorization next.
   */
  verifyPasskeyAuth: async (
    mfaToken: string,
    response: unknown
  ): Promise<ApiResponse<any>> => {
    const res = await apiClient.post('/api/v1/auth/passkeys/authenticate/verify', {
      mfa_token: mfaToken,
      response,
    });
    const resAny = res as any;
    const dataAny = (res as any)?.data;
    const accessToken =
      resAny?.accessToken || dataAny?.accessToken || dataAny?.tokens?.accessToken || dataAny?.token;
    const refreshToken = resAny?.refreshToken || dataAny?.refreshToken || dataAny?.tokens?.refreshToken;
    const user = resAny?.user || dataAny?.user;
    if (accessToken) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    if (user) localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return res;
  },

  /** List the signed-in user's registered passkeys. */
  listPasskeys: async (): Promise<ApiResponse<{ passkeys: any[] }>> => {
    return apiClient.get('/api/v1/auth/passkeys');
  },

  /** Rename a passkey. */
  renamePasskey: async (id: string, label: string): Promise<ApiResponse<{ passkey: any }>> => {
    return apiClient.patch(`/api/v1/auth/passkeys/${id}`, { label });
  },

  /** Remove a passkey. */
  removePasskey: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    return apiClient.delete(`/api/v1/auth/passkeys/${id}`);
  },

  /**
   * Clear all auth data (for logout or errors)
   */
  clearAuthData: (): void => {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
  },
};

export default authService;
