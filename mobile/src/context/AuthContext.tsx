import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { logger } from '@utils/logger';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'principal' | 'teacher' | 'student' | 'parent' | 'accountant' | 'admissions' | 'guest';
  avatar?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isSignedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Auth Provider Component
 * Manages authentication state for the mobile app
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from secure storage
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('authToken');
        const storedUser = await SecureStore.getItemAsync('user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          logger.info('Auth state restored from secure storage');
        }
      } catch (error) {
        logger.error('Error restoring auth state:', error);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrap();
  }, []);

  // Login function
  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();

      // Store token and user in secure storage
      await SecureStore.setItemAsync('authToken', data.accessToken);
      await SecureStore.setItemAsync('user', JSON.stringify(data.user));

      setToken(data.accessToken);
      setUser(data.user);

      logger.info('User logged in:', email);
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      setIsLoading(true);

      // Call logout endpoint
      if (token) {
        await fetch(`${API_URL}/api/v1/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }

      // Clear secure storage
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('user');

      setToken(null);
      setUser(null);

      logger.info('User logged out');
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Register function
  const register = useCallback(async (data: any) => {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      const responseData = await response.json();

      // Store token and user
      await SecureStore.setItemAsync('authToken', responseData.accessToken);
      await SecureStore.setItemAsync('user', JSON.stringify(responseData.user));

      setToken(responseData.accessToken);
      setUser(responseData.user);

      logger.info('User registered:', data.email);
    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh token function
  const refreshToken = useCallback(async () => {
    try {
      if (!token) return;

      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      // Update token
      await SecureStore.setItemAsync('authToken', data.accessToken);
      setToken(data.accessToken);

      logger.info('Token refreshed');
    } catch (error) {
      logger.error('Token refresh error:', error);
      // If refresh fails, logout user
      await logout();
    }
  }, [token, logout]);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isSignedIn: !!token,
    login,
    logout,
    register,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
