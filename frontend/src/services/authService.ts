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
} from '@types/index';

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

    if (response.success && response.data) {
      // Store tokens and user info
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.data.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.data.refreshToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data.user));
    }

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

    if (response.success && response.data) {
      // Store tokens and user info
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.data.accessToken);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.data.refreshToken);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(response.data.user));
    }

    return response;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
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
      refreshToken,
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
  fetchMe: async (): Promise<ApiResponse<AuthUser>> => {
    const response = await apiClient.get<AuthUser>(API_ENDPOINTS.AUTH.ME);

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
      currentPassword,
      newPassword,
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
      token,
      newPassword,
    });
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
