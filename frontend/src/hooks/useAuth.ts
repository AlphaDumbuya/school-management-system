/**
 * Custom Hook: useAuth
 * Provides auth state and methods to components
 * Phase 11: Frontend Dashboard Implementation
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '@store/authStore';
import { UserRole } from '@types/index';

interface UseAuthReturn {
  user: typeof useAuthStore extends { getState: () => infer T } ? T['user'] : any;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  canAccess: (roles: UserRole[]) => boolean;
}

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

  // Login handler with navigation
  const login = useCallback(
    async (email: string, password: string) => {
      const success = await storeLogin(email, password);
      if (success) {
        navigate('/dashboard');
      }
      return success;
    },
    [storeLogin, navigate]
  );

  // Logout handler with navigation
  const logout = useCallback(async () => {
    await storeLogout();
    navigate('/login');
  }, [storeLogout, navigate]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    hasRole,
    canAccess,
  };
};

export default useAuth;
