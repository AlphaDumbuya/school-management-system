/**
 * Authentication Store (Zustand)
 * Manages authentication state globally
 * Phase 11: Frontend Dashboard Implementation
 */

import { create } from 'zustand';
import { AuthUser, UserRole } from '@appTypes/index';
import authService from '@services/authService';
import { clearQueue } from '@lib/offlineQueue';
import { wipeOfflineDb, wipeOtherUsers } from '../offline/db';
import { runSync } from '../offline/syncEngine';

interface AuthStore {
  // State
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  /** Backend error code from the last failed login (e.g. TENANT_SUSPENDED). */
  loginErrorCode: string | null;
  /** School support contact attached to an access-denied login error. */
  loginErrorContact: { schoolName: string | null; email: string | null; phone: string | null } | null;
  accessToken: string | null;
  isInitialized: boolean;
  /** Short-lived token issued when a login needs a 2FA code. */
  mfaToken: string | null;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setIsAuthenticated: (value: boolean) => void;
  setIsLoading: (value: boolean) => void;
  setError: (error: string | null) => void;
  setAccessToken: (token: string | null) => void;

  // Auth actions
  initialize: () => Promise<void>;
  /**
   * Re-fetch the current user from /me and update the cached store/localStorage.
   * If the role changed (e.g. an admin promoted a teacher to principal), clear
   * the query cache so role-scoped data + UI gating refresh without a re-login.
   */
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean | 'mfa_required'>;
  verifyMfa: (code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<boolean>;
  clearAuthState: () => void;

  // Helpers
  hasRole: (role: UserRole | UserRole[]) => boolean;
  canAccess: (requiredRoles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  user: authService.getCurrentUser(),
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,
  error: null,
  loginErrorCode: null,
  loginErrorContact: null,
  accessToken: authService.getAccessToken(),
  isInitialized: false,
  mfaToken: null,

  // State setters
  setUser: (user) => set({ user }),
  setIsAuthenticated: (value) => set({ isAuthenticated: value }),
  setIsLoading: (value) => set({ isLoading: value }),
  setError: (error) => set({ error }),
  setAccessToken: (token) => set({ accessToken: token }),

  // Initialize auth state on app load
  initialize: async () => {
    const { setIsLoading, setError } = get();
    setIsLoading(true);

    try {
      // Check if we have stored tokens and user data
      const token = authService.getAccessToken();
      const storedUser = authService.getCurrentUser();
      
      if (!token) {
        set({ isAuthenticated: false });
        setIsLoading(false);
        return;
      }

      // If we have both token and user, restore the session
      if (storedUser && token) {
        set({
          user: storedUser,
          isAuthenticated: true,
          accessToken: token,
          error: null,
        });

        // Try to refresh user data from server in the background
        // but don't block if it fails
        try {
          const response = await authService.fetchMe();
          if (response.success && response.data) {
            set({ user: response.data });
          }
        } catch (error) {
          // User data refresh failed, but keep the session
          console.warn('Could not refresh user data:', error);
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      // Don't clear auth data on error, just log it
    } finally {
      setIsLoading(false);
      set({ isInitialized: true });
    }
  },

  // Re-fetch /me and refresh the cached user. If the role changed, purge the
  // query cache so role-gated UI (sidebar/routes) and data update immediately —
  // this closes the gap where a promoted/re-roled user kept seeing their old
  // portal until a manual reload or re-login.
  refreshUser: async () => {
    const prevRole = get().user?.role;
    try {
      const response = await authService.fetchMe();
      if (response.success && response.data) {
        set({ user: response.data });
        if (response.data.role && response.data.role !== prevRole) {
          // Role actually changed → clear cached role-scoped queries + send the
          // user to their dashboard so the new portal renders cleanly.
          try {
            const mod = await import('../App');
            mod.clearQueryCache?.();
          } catch { /* non-fatal */ }
        }
      }
    } catch {
      // Non-fatal — keep the existing session/user on a transient failure.
    }
  },

  // Login action
  login: async (email, password) => {
    const { setIsLoading, setError, setUser, setIsAuthenticated, setAccessToken } = get();

    setIsLoading(true);
    setError(null);
    set({ loginErrorCode: null, loginErrorContact: null });

    try {
      const response = await authService.login({ email, password });

      const resAny = response as any;
      const dataAny = response?.data as any;

      // 2FA challenge — no tokens yet. Stash the mfa token for the verify step.
      if (dataAny?.mfaRequired && dataAny?.mfaToken) {
        set({ mfaToken: dataAny.mfaToken });
        return 'mfa_required';
      }

      const token = resAny?.token || resAny?.accessToken || dataAny?.accessToken || dataAny?.tokens?.accessToken || dataAny?.token;
      const user = resAny?.user || dataAny?.user;

      if (token && user) {
        setUser(user);
        setAccessToken(token);
        setIsAuthenticated(true);
        if (user.id) wipeOtherUsers(user.id).catch(() => {});
        return true;
      } else if (response.success && dataAny) {
        if (dataAny.user) setUser(dataAny.user);
        if (token) setAccessToken(token);
        setIsAuthenticated(true);
        if (dataAny.user?.id) wipeOtherUsers(dataAny.user.id).catch(() => {});
        return true;
      } else {
        setError(response.error || 'Login failed');
        // Capture the backend code + school contact so the login screen can
        // show dynamic, tenant-specific guidance for access-denied states.
        set({
          loginErrorCode: (response as any)?.code ?? null,
          loginErrorContact: (response as any)?.schoolContact ?? null,
        });
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  },

  // Verify a 2FA code to finish login
  verifyMfa: async (code: string) => {
    const { setIsLoading, setError, setUser, setAccessToken, setIsAuthenticated, mfaToken } = get();
    if (!mfaToken) {
      setError('Your session expired. Please sign in again.');
      return false;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await authService.verifyTwoFactorLogin(mfaToken, code);
      const dataAny = (response as any)?.data;
      const token = dataAny?.accessToken;
      const user = dataAny?.user;
      if (response.success && token && user) {
        setUser(user);
        setAccessToken(token);
        setIsAuthenticated(true);
        set({ mfaToken: null });
        if (user.id) wipeOtherUsers(user.id).catch(() => {});
        return true;
      }
      setError(response.error || 'Invalid verification code');
      return false;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Verification failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  },

  // Logout action
  logout: async () => {
    const { setIsLoading, user } = get();
    setIsLoading(true);

    // Capture the user id BEFORE clearing state so we can wipe their local data.
    const userId = user?.id || null;

    try {
      // Best-effort: flush any pending offline writes while we (maybe) still
      // have connectivity, so a teacher's queued work isn't lost on logout.
      if (userId && user?.role === 'teacher' && navigator.onLine) {
        await runSync(userId).catch(() => undefined);
      }
      await authService.logout();
      get().clearAuthState();
    } catch (error) {
      console.error('Logout error:', error);
      get().clearAuthState();
    } finally {
      // Wipe the per-user offline database so student PII never lingers on a
      // shared device after logout (privacy — Req 8).
      if (userId) {
        await wipeOfflineDb(userId).catch(() => undefined);
      }
      setIsLoading(false);
    }
  },

  // Refresh tokens
  refreshTokens: async () => {
    try {
      const response = await authService.refreshToken();
      if (response.success && response.data) {
        set({
          accessToken: response.data.accessToken,
          user: response.data.user,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  },

  // Clear auth state
  clearAuthState: () => {
    // Purge any queued offline writes so they never replay under a different
    // tenant/user after logout.
    clearQueue().catch(() => {});
    set({
      user: null,
      isAuthenticated: false,
      error: null,
      accessToken: null,
    });
  },

  // Helper: Check if user has a specific role
  // super_admin implicitly has all roles
  hasRole: (role) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'super_admin') return true;

    if (Array.isArray(role)) {
      return role.includes(user.role);
    }

    return user.role === role;
  },

  // Helper: Check if user can access resource (has any of required roles)
  // super_admin always has access to everything. A teacher who is also the
  // Bursar / Admissions Officer (staffDuties) can open those pages too; the
  // server applies the matching role on those modules.
  canAccess: (requiredRoles) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    if (requiredRoles.includes(user.role)) return true;
    const duties = (user as any).staffDuties as UserRole[] | undefined;
    return Array.isArray(duties) && duties.some((d) => requiredRoles.includes(d));
  },
}));

export default useAuthStore;
