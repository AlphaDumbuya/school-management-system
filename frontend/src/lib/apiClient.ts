/**
 * API Client with Axios
 * Handles all HTTP requests with interceptors for auth and error handling
 * Phase 11: Frontend Dashboard Implementation
 */

import axios, { AxiosInstance, AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios';
import { API_CONFIG, getAuthHeaders } from '@config/api.config';
import { ApiResponse } from '@appTypes/index';
import { enqueueRequest } from './offlineQueue';

let lastDemoToast = 0;

/** Marketing / public pages: a dead session is dropped quietly, no redirect. */
const isPublicPath = (path: string) =>
  path === '/' || /^\/(features|pricing|why|benefits|contact|register|privacy-policy|demo|login|apply|verify|verify-receipt|verify-report-card|verify-id|forgot-password|reset-password|newsletter|restore-access|request-reactivation)(\/|$)/.test(path);

/**
 * Master switch for the offline write-queue. Disabled for now: it was
 * intercepting failed mutations (including school registration) and returning a
 * "saved offline" sentinel instead of surfacing the real error. Set back to
 * true to re-enable offline queueing of POST/PUT/PATCH/DELETE.
 */
const OFFLINE_QUEUE_ENABLED = false;

/** Methods that mutate server state and are safe to queue + replay offline. */
const QUEUEABLE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

/**
 * Endpoints that must NEVER be queued for offline replay. Authentication is
 * interactive and time-sensitive — you can't sign in without the server — so
 * these must fail cleanly rather than being silently replayed later. Also
 * excludes actions that only make sense while online (payments, checkout).
 */
const NON_QUEUEABLE_PATTERNS: RegExp[] = [
  /\/auth\/login/i,
  /\/auth\/register/i,
  /\/auth\/refresh/i,
  /\/auth\/logout/i,
  /\/auth\/forgot/i,
  /\/auth\/reset/i,
  /\/payments\/.*checkout/i, // Monime hosted checkout needs a live redirect
];

/** Sentinel error thrown when a mutation is captured by the offline queue. */
export class OfflineQueuedError extends Error {
  offlineQueued = true;
  constructor(message = 'Saved offline. It will sync when you reconnect.') {
    super(message);
    this.name = 'OfflineQueuedError';
  }
}

/**
 * When a mutating request fails purely because we're offline (no HTTP response),
 * persist it to the durable queue so it replays on reconnect. Returns true if
 * the request was captured.
 */
async function maybeQueueOffline(config?: AxiosRequestConfig): Promise<boolean> {
  if (!OFFLINE_QUEUE_ENABLED) return false;
  if (!config) return false;
  const method = (config.method || 'get').toLowerCase();
  if (!QUEUEABLE_METHODS.has(method)) return false;

  const rawPath = config.url || '';
  // Never queue auth / payment-checkout style requests.
  if (NON_QUEUEABLE_PATTERNS.some((re) => re.test(rawPath))) return false;

  // Build an absolute URL from axios baseURL + url.
  const base = (config.baseURL || API_CONFIG.baseURL || '').replace(/\/$/, '');
  const path = rawPath;
  const url = /^https?:\/\//i.test(path) ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;

  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: string | null = null;
  if (config.data != null) {
    body = typeof config.data === 'string' ? config.data : JSON.stringify(config.data);
  }

  await enqueueRequest({ url, method: method.toUpperCase(), headers, body });

  // Ask the SW to fire a background sync so it flushes even if the tab closes.
  try {
    const reg = await navigator.serviceWorker?.ready;
    // @ts-expect-error - sync is not in all TS lib versions
    await reg?.sync?.register('sync-offline-queue');
  } catch {
    /* background sync unsupported — the online-event replay still covers it */
  }
  return true;
}

// Create axios instance
export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
  withCredentials: true,
});

// ============================================================================
// Access-token refresh
// ============================================================================
//
// Why this is careful: after the app is resumed (screen on, back from the
// camera / file picker / another app) every screen refetches at once. With an
// expired access token that used to fire one /auth/refresh PER request, and ANY
// non-network failure of any of them (a 429 from the shared per-IP limit on
// school Wi-Fi, a 5xx while the database wakes up) signed an active user out.
// Now: one refresh at a time, and only a definite "no" from the server
// (400/401/403/404) ends the session. Transient failures keep it.

/** Refresh was definitively refused by the server (or there's no refresh token). */
class RefreshRejectedError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'RefreshRejectedError';
    this.code = code;
  }
}

/** HTTP statuses on /auth/refresh that mean "this session is over". */
const REFRESH_REJECT_STATUSES = new Set([400, 401, 403, 404]);

let refreshInFlight: Promise<string> | null = null;

const readAccessToken = () => localStorage.getItem('accessToken') || localStorage.getItem('token');

/** Seconds-since-epoch `exp` of a JWT, or null if it can't be read. */
function jwtExp(token: string): number | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    const exp = JSON.parse(json)?.exp;
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

async function doRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) throw new RefreshRejectedError('No refresh token');
  try {
    // Backend expects snake_case { refresh_token } and responds with
    // { access_token, ... } (also snake_case, top-level). Bare axios so this
    // call never re-enters the interceptors.
    const response = await axios.post(
      `${API_CONFIG.baseURL}/api/v1/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' }, timeout: API_CONFIG.timeout || 30000, withCredentials: true }
    );
    const body = response.data || {};
    const accessToken = body.access_token || body.accessToken || body?.data?.accessToken;
    const newRefreshToken = body.refresh_token || body.refreshToken || body?.data?.refreshToken;
    if (!accessToken) throw new Error('No access token in refresh response'); // treated as transient
    localStorage.setItem('accessToken', accessToken);
    if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
    return accessToken;
  } catch (err) {
    const ax = err as AxiosError;
    const status = ax?.response?.status;
    if (status && REFRESH_REJECT_STATUSES.has(status)) {
      // Another tab may have signed in again / replaced the token while this
      // call was in flight. If so, the session isn't over: use the new one.
      const current = localStorage.getItem('refreshToken');
      if (current && current !== refreshToken) {
        const fresh = readAccessToken();
        if (fresh) return fresh;
      }
      const data = ax.response?.data as any;
      throw new RefreshRejectedError('Refresh token rejected', data?.error?.code || data?.code);
    }
    throw err; // network error, timeout, 429, 5xx → transient
  }
}

/**
 * Get a new access token. Concurrent callers share ONE in-flight request, so a
 * burst of 401s (common right after the app resumes) makes a single refresh.
 * Rejects with RefreshRejectedError only when the server refused the session.
 */
export function refreshAccessToken(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** The server ended the session: drop it and go to sign-in (app pages only). */
function endSession(code?: string) {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  } catch { /* ignore */ }
  // On public pages (homepage, demo form, pricing…) just drop the dead
  // session; only app pages need to go to the sign-in screen.
  if (typeof window === 'undefined' || isPublicPath(window.location.pathname)) return;
  const target =
    code === 'ACCOUNT_INACTIVE' ? '/login?disabled=1'
    : code === 'TENANT_SUSPENDED' || code === 'TENANT_UNAVAILABLE' ? '/login?suspended=1'
    : code === 'PORTAL_NOT_IN_PLAN' ? '/login?portal=off'
    : '/login';
  window.location.href = target;
}

const isRefreshExemptUrl = (url?: string) =>
  !!url && /\/auth\/(login|register|refresh|2fa\/verify-login|passkeys\/(login|authenticate))/.test(url);

// Request interceptor - Add auth token (refreshing first if it has just expired,
// so a resumed app doesn't send a burst of requests that all 401).
axiosInstance.interceptors.request.use(
  async (config) => {
    let token = readAccessToken();
    if (token && !isRefreshExemptUrl(config.url) && localStorage.getItem('refreshToken')) {
      const exp = jwtExp(token);
      if (exp && exp * 1000 - Date.now() < 30_000) {
        try {
          token = await refreshAccessToken();
        } catch {
          // Send with the old token; the 401 handler below decides what to do.
        }
      }
    }
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
    const isAuthRequest = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/register');
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;

      if (!localStorage.getItem('refreshToken')) {
        // No refresh token at all → genuine unauthenticated state. Public
        // pages stay put; app pages go to sign-in.
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        if (!isPublicPath(window.location.pathname)) window.location.href = '/login';
        return Promise.reject(error);
      }

      // If the token was already renewed (by a parallel request or another
      // tab) since this request went out, just retry with the current one.
      const sentAuth = String((originalRequest.headers as any)?.Authorization || '');
      const current = readAccessToken();
      let accessToken: string | null = current && sentAuth !== `Bearer ${current}` ? current : null;

      if (!accessToken) {
        try {
          accessToken = await refreshAccessToken();
        } catch (refreshError) {
          if (refreshError instanceof RefreshRejectedError) {
            // The server refused the refresh token → the session is over.
            endSession(refreshError.code);
            return Promise.reject(refreshError);
          }
          // Offline, timed out, rate-limited or a server error: the session
          // may be perfectly valid. Keep it; the next request tries again.
          console.warn('[auth] token refresh failed transiently — keeping session', (refreshError as Error)?.message);
          return Promise.reject(error);
        }
      }

      // Retry original request with the new token
      originalRequest.headers = originalRequest.headers || {};
      (originalRequest.headers as any).Authorization = `Bearer ${accessToken}`;
      return axiosInstance(originalRequest);
    }

    // Handle 403 - Forbidden
    if (error.response?.status === 403) {
      // Tenant-level restriction (suspended/expired by the platform owner) cascades
      // to all its users: force a logout so the whole session is cut off, not just
      // scattered 403s. Any authenticated request can carry this.
      const code = (error.response?.data as any)?.error?.code
        || (error.response?.data as any)?.code;
      if (code === 'DEMO_READ_ONLY') {
        // Demo school: one friendly toast, however many requests were refused.
        const now = Date.now();
        if (now - lastDemoToast > 4000) {
          lastDemoToast = now;
          void import('@utils/toast').then(({ showToast }) => showToast.info('This is the demo school, so changes are switched off. Start a free trial to try it with your own school.')).catch(() => undefined);
        }
      } else if (code === 'PORTAL_NOT_IN_PLAN' && !String(error.config?.url || '').includes('/auth/')) {
        // This user's portal isn't in the school's plan any more: sign out
        // with an explanation instead of a page of errors.
        try {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        } catch { /* ignore */ }
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.assign('/login?portal=off');
        }
      } else if (code === 'TENANT_SUSPENDED' || code === 'TENANT_UNAVAILABLE' || code === 'ACCOUNT_INACTIVE') {
        // Either the whole school was suspended, or THIS user's own account was
        // deactivated / suspended / dismissed mid-session. Cut the session off
        // immediately rather than leaving a half-working stale session.
        try {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        } catch { /* ignore */ }
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.assign(code === 'ACCOUNT_INACTIVE' ? '/login?disabled=1' : '/login?suspended=1');
        }
      } else if (code === 'SUBSCRIPTION_EXPIRED' || code === 'PLAN_LIMIT_REACHED' || code === 'FEATURE_READ_ONLY') {
        // Broadcast so a single global listener can toast + prompt an upgrade,
        // instead of every call site handling plan limits individually.
        // Only for actions the user took (writes): background reads of a
        // feature outside the plan (dashboard widgets) fail quietly, since the
        // UI already hides or marks those features.
        const method = String(error.config?.method || 'get').toLowerCase();
        const msg = (error.response?.data as any)?.error?.message
          || (error.response?.data as any)?.message
          || (error.response?.data as any)?.error
          || 'Your plan limit was reached. Upgrade to continue.';
        if (method !== 'get' && method !== 'head') {
          try {
            window.dispatchEvent(new CustomEvent('wiskul:plan-limit', { detail: { code, message: msg } }));
          } catch { /* SSR / non-DOM */ }
        }
      }
      console.warn('403 Forbidden:', error.response?.config?.url);
    }

    // Handle network errors — likely offline. Queue mutations for later replay.
    if (!error.response) {
      console.error('Network error:', error.message);
      const queued = await maybeQueueOffline(originalRequest);
      if (queued) {
        // Surface a distinct error the UI can treat as "saved, will sync".
        return Promise.reject(new OfflineQueuedError());
      }
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
  /** Backend error code, e.g. TENANT_SUSPENDED / ACCOUNT_INACTIVE. */
  code?: string;
  /** School's own support contact, attached on access-denied login errors. */
  schoolContact?: { schoolName: string | null; email: string | null; phone: string | null } | null;
  /** Why the school is blocked (reason shown to the owner only), on suspended-school login errors. */
  suspension?: SuspensionDetails | null;
}
export interface SuspensionDetails {
  status: string;
  category: 'payment' | 'policy' | 'abuse' | 'review' | 'security' | 'other';
  headline: string;
  summary: string;
  reason?: string;
  nextStep?: string;
  suspendedAt?: string;
}

const handleError = (error: unknown): ErrorResponse => {
  // A mutation captured by the offline queue — treat as a soft success so the
  // UI shows "saved offline" rather than a hard failure.
  if (error instanceof OfflineQueuedError || (error as any)?.offlineQueued) {
    const msg = (error as Error).message;
    // Broadcast so a single global listener can toast "saved offline" without
    // every call site needing bespoke handling.
    try {
      window.dispatchEvent(new CustomEvent('wiskul:offline-queued', { detail: { message: msg } }));
    } catch {
      /* SSR / non-DOM env */
    }
    return {
      success: false,
      error: msg,
      statusCode: 0, // 0 = offline-queued sentinel
    };
  }

  if (axios.isAxiosError(error)) {
    // No HTTP response at all → could be genuinely offline OR the server was
    // unreachable (DNS/TLS/CORS/timeout) even with a live connection. Only claim
    // "offline" when the device actually reports it; otherwise say we couldn't
    // reach the server, which is accurate and less confusing.
    if (!error.response) {
      const reallyOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
      return {
        success: false,
        error: reallyOffline
          ? "You appear to be offline. Check your connection and try again."
          : "Couldn't reach the WiSkul server. Please check your connection and try again.",
        statusCode: 0,
      };
    }

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

    const code = (typeof errorField === 'object' && errorField !== null) ? errorField.code : undefined;
    const schoolContact = (typeof errorField === 'object' && errorField !== null) ? errorField.schoolContact : undefined;
    const suspension = (typeof errorField === 'object' && errorField !== null) ? errorField.suspension : undefined;

    return {
      success: false,
      error: friendlyMessage,
      statusCode: status,
      code,
      schoolContact,
      suspension,
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
