/**
 * Authentication Store (Zustand)
 * Manages authentication state globally
 * Phase 11: Frontend Dashboard Implementation
 */

import { create } from 'zustand';
import { AuthUser, UserRole } from '@appTypes/index';
import authService from '@services/authService';

interface AuthStore {
  // State
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  accessToken: string | null;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setIsAuthenticated: (value: boolean) => void;
  setIsLoading: (value: boolean) => void;
  setError: (error: string | null) => void;
  setAccessToken: (token: string | null) => void;

  // Auth actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
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
  accessToken: authService.getAccessToken(),

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
    }
  },

  // Login action
  login: async (email, password) => {
    const { setIsLoading, setError, setUser, setIsAuthenticated, setAccessToken } = get();

    setIsLoading(true);
    setError(null);

    try {
      const response = await authService.login({ email, password });

      if (response.success && response.data) {
        setUser(response.data.user);
        setAccessToken(response.data.accessToken);
        setIsAuthenticated(true);
        return true;
      } else {
        setError(response.error || 'Login failed');
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

  // Logout action
  logout: async () => {
    const { setIsLoading } = get();
    setIsLoading(true);

    try {
      await authService.logout();
      get().clearAuthState();
    } catch (error) {
      console.error('Logout error:', error);
      get().clearAuthState();
    } finally {
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
  // super_admin always has access to everything
  canAccess: (requiredRoles) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    return requiredRoles.includes(user.role);
  },
}));

export default useAuthStore;
