/**
 * API Client with Axios
 * Handles all HTTP requests with interceptors for auth and error handling
 * Phase 11: Frontend Dashboard Implementation
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios';
import { API_CONFIG, getAuthHeaders } from '@config/api.config';
import { ApiResponse } from '@appTypes/index';

// Create axios instance
export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
  withCredentials: true,
});

// Request interceptor - Add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle errors and refresh tokens
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 - Unauthorized (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          // No refresh token, redirect to login
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // Try to refresh the token
        const response = await axios.post(
          `${API_CONFIG.baseURL}/api/v1/auth/refresh`,
          { refreshToken },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        // Update stored tokens
        localStorage.setItem('accessToken', accessToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        // Retry original request with new token
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle 403 - Forbidden (don't redirect, let the UI handle it)
    if (error.response?.status === 403) {
      console.warn('403 Forbidden:', error.response?.config?.url);
    }

    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
    }

    return Promise.reject(error);
  }
);

// ============================================================================
// API Client Methods
// ============================================================================

export const apiClient = {
  /**
   * GET request
   */
  get: async <T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => {
    try {
      const response = await axiosInstance.get<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },

  /**
   * POST request
   */
  post: async <T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => {
    try {
      const response = await axiosInstance.post<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },

  /**
   * PUT request
   */
  put: async <T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => {
    try {
      const response = await axiosInstance.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },

  /**
   * PATCH request
   */
  patch: async <T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => {
    try {
      const response = await axiosInstance.patch<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },

  /**
   * DELETE request
   */
  delete: async <T = unknown>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => {
    try {
      const response = await axiosInstance.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
      return handleError(error);
    }
  },
};

// ============================================================================
// Error Handling
// ============================================================================

interface ErrorResponse {
  success: false;
  error: string;
  message?: string;
  statusCode?: number;
}

const handleError = (error: unknown): ErrorResponse => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 500;
    const data = error.response?.data as any;

    // Backend sends { error: { status, code, message, ... } }
    // Handle both nested object and flat string shapes
    const errorField = data?.error;
    const message =
      (typeof errorField === 'object' && errorField !== null
        ? errorField.message
        : typeof errorField === 'string'
        ? errorField
        : undefined) ||
      data?.message ||
      error.message ||
      'An error occurred';

    // Add a user-friendly hint for rate limiting
    const friendlyMessage =
      status === 429
        ? message || 'Too many attempts. Please wait a moment before trying again.'
        : message;

    console.error(`API Error [${status}]:`, friendlyMessage);

    return {
      success: false,
      error: friendlyMessage,
      statusCode: status,
    };
  }

  console.error('Unexpected error:', error);
  return {
    success: false,
    error: 'An unexpected error occurred',
    statusCode: 500,
  };
};

export default apiClient;
