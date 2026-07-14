import { useEffect, useRef, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '@hooks/useAuth';
import { logger } from '@lib/logger';

export interface RealtimeOptions {
  dashboardType: 'admin' | 'teacher' | 'student' | 'parent' | 'accountant' | 'admissions';
  refreshInterval?: number; // milliseconds
  autoConnect?: boolean;
}

export interface RealtimeDashboardState {
  data: any | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdate: string | null;
}

/**
 * Hook for real-time dashboard updates via WebSocket
 * Automatically connects, subscribes, and updates dashboard data
 */
export const useRealtimeDashboard = (options: RealtimeOptions) => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [state, setState] = useState<RealtimeDashboardState>({
    data: null,
    isConnected: false,
    isLoading: true,
    error: null,
    lastUpdate: null,
  });

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    try {
      const token = localStorage.getItem('token');
      // On Vercel (same domain), connect to current origin. Locally use VITE_API_URL.
      const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;

      socketRef.current = io(apiUrl, {
        auth: {
          token,
          userId: user?.id,
          role: user?.role,
        },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket', 'polling'],
      });

      // Connection established
      socketRef.current.on('connect', () => {
        logger.info('WebSocket connected');
        setState((prev) => ({
          ...prev,
          isConnected: true,
          error: null,
        }));
      });

      // Authentication successful
      socketRef.current.on('auth-success', (data) => {
        logger.info('WebSocket authentication successful');
        subscribeToDashboard();
      });

      // Authentication failed
      socketRef.current.on('auth-error', (error) => {
        logger.error('WebSocket authentication failed:', error);
        setState((prev) => ({
          ...prev,
          error: 'Authentication failed',
        }));
      });

      // Dashboard update received
      socketRef.current.on('dashboard-update', (update) => {
        logger.debug('Dashboard update received');
        setState((prev) => ({
          ...prev,
          data: update.data,
          isLoading: false,
          error: null,
          lastUpdate: update.timestamp,
        }));
      });

      // New alert received
      socketRef.current.on('new-alert', (alert) => {
        logger.info('New alert received');
        setState((prev) => ({
          ...prev,
          data: {
            ...prev.data,
            alerts: [alert.alert, ...(prev.data?.alerts || [])],
          },
        }));
      });

      // New notification received
      socketRef.current.on('new-notification', (notification) => {
        logger.info('New notification received');
        // Handle notification separately if needed
      });

      // Error occurred
      socketRef.current.on('error', (error) => {
        logger.error('WebSocket error:', error);
        setState((prev) => ({
          ...prev,
          error: error.message || 'Unknown error',
        }));
      });

      // Connection lost
      socketRef.current.on('disconnect', () => {
        logger.warn('WebSocket disconnected');
        setState((prev) => ({
          ...prev,
          isConnected: false,
        }));
      });

      // Subscription error
      socketRef.current.on('subscription-error', (error) => {
        logger.error('Subscription error:', error);
        setState((prev) => ({
          ...prev,
          error: error.message || 'Subscription failed',
        }));
      });
    } catch (error) {
      logger.error('WebSocket connection error:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [user]);

  /**
   * Subscribe to dashboard updates
   */
  const subscribeToDashboard = useCallback(() => {
    if (!socketRef.current?.connected) {
      logger.warn('Cannot subscribe: socket not connected');
      return;
    }

    socketRef.current.emit('subscribe-dashboard', {
      dashboardType: options.dashboardType,
      refreshInterval: options.refreshInterval || 30000,
    });
  }, [options.dashboardType, options.refreshInterval]);

  /**
   * Unsubscribe from dashboard updates
   */
  const unsubscribeToDashboard = useCallback(() => {
    if (!socketRef.current?.connected) return;

    socketRef.current.emit('unsubscribe-dashboard', {
      dashboardType: options.dashboardType,
    });
  }, [options.dashboardType]);

  /**
   * Request manual refresh
   */
  const requestRefresh = useCallback(() => {
    if (!socketRef.current?.connected) {
      logger.warn('Cannot refresh: socket not connected');
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true }));
    socketRef.current.emit('request-refresh', {
      dashboardType: options.dashboardType,
    });
  }, [options.dashboardType]);

  /**
   * Disconnect WebSocket
   */
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      unsubscribeToDashboard();
      socketRef.current.disconnect();
      socketRef.current = null;
      setState((prev) => ({
        ...prev,
        isConnected: false,
      }));
    }
  }, [unsubscribeToDashboard]);

  /**
   * Setup and cleanup
   */
  useEffect(() => {
    if (!user || !options.autoConnect !== false) return;

    connect();

    return () => {
      disconnect();
    };
  }, [user, options.autoConnect, connect, disconnect]);

  return {
    ...state,
    requestRefresh,
    connect,
    disconnect,
  };
};

/**
 * Hook for managing multiple dashboard subscriptions
 */
export const useMultipleDashboards = (
  dashboardTypes: RealtimeOptions['dashboardType'][]
) => {
  const dashboards = dashboardTypes.map((type) =>
    useRealtimeDashboard({
      dashboardType: type,
      autoConnect: true,
    })
  );

  return dashboards;
};

export default useRealtimeDashboard;
