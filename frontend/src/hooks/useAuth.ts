/**
 * Custom Hook: useAuth
 * Provides auth state and methods to components
 * Phase 11: Frontend Dashboard Implementation
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@store/authStore';
import { UserRole } from '@appTypes/index';

interface UseAuthReturn {
  user: typeof useAuthStore extends { getState: () => infer T } ? T['user'] : any;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean | 'mfa_required'>;
  verifyMfa: (code: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  canAccess: (roles: UserRole[]) => boolean;
}

/** Returns the home path for a given role */
export const getDashboardPath = (role: UserRole): string => {
  switch (role) {
    case 'super_admin':
      return '/platform/dashboard';
    case 'teacher':
      return '/teacher/dashboard';
    case 'student':
      return '/student/dashboard';
    case 'parent':
    case 'guardian':
      return '/parent/dashboard';
    case 'accountant':
      return '/accountant/dashboard';
    case 'admissions_officer':
      return '/admissions/dashboard';
    case 'principal':
    case 'staff':
    default:
      return '/admin/dashboard';
  }
};

export const useAuth = (): UseAuthReturn => {
  const navigate = useNavigate();
  const authStore = useAuthStore();

  const {
    user,
    isAuthenticated,
    isLoading,
    error,
    login: storeLogin,
    logout: storeLogout,
    hasRole,
    canAccess,
  } = authStore;

  // Login handler — navigates to the correct dashboard based on role.
  // Returns 'mfa_required' when a second factor is needed (no navigation yet).
  const login = useCallback(
    async (email: string, password: string) => {
      const result = await storeLogin(email, password);
      if (result === 'mfa_required') return result;
      if (result) {
        const { user: loggedInUser } = useAuthStore.getState();
        const path = loggedInUser ? getDashboardPath(loggedInUser.role) : '/dashboard';
        navigate(path, { replace: true });
      }
      return result;
    },
    [storeLogin, navigate]
  );

  // Verify a 2FA code, then navigate to the dashboard on success.
  const verifyMfa = useCallback(
    async (code: string) => {
      const ok = await useAuthStore.getState().verifyMfa(code);
      if (ok) {
        const { user: loggedInUser } = useAuthStore.getState();
        const path = loggedInUser ? getDashboardPath(loggedInUser.role) : '/dashboard';
        navigate(path, { replace: true });
      }
      return ok;
    },
    [navigate]
  );

  // Logout handler with navigation
  const logout = useCallback(async () => {
    await storeLogout();
    navigate('/login', { replace: true });
  }, [storeLogout, navigate]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    verifyMfa,
    logout,
    hasRole,
    canAccess,
  };
};

export default useAuth;
