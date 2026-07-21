/**
 * Dashboard Store (Zustand)
 * Manages dashboard state and caching
 * Phase 11: Frontend Dashboard Implementation
 */

import { create } from 'zustand';
import {
  CompleteDashboard,
  DashboardMetrics,
  FinancialSummary,
  DashboardAlert,
  StudentAtRisk,
  SystemHealth,
  ChartData,
} from '@appTypes/index';
import dashboardService from '@services/dashboardService';

interface DashboardCache {
  data: CompleteDashboard | null;
  lastFetched: number | null;
  isStale: boolean;
}

interface DashboardStore {
  // State
  dashboard: CompleteDashboard | null;
  metrics: DashboardMetrics | null;
  financialSummary: FinancialSummary | null;
  alerts: DashboardAlert[];
  atRiskStudents: StudentAtRisk[];
  systemHealth: SystemHealth | null;
  charts: {
    academic: ChartData | null;
    attendance: ChartData | null;
    feeCollection: ChartData | null;
    studentDistribution: ChartData | null;
  };

  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;

  // Cache
  cache: DashboardCache;
  cacheExpireTime: number; // milliseconds

  // Actions
  fetchCompleteDashboard: () => Promise<void>;
  fetchMetrics: () => Promise<void>;
  fetchFinancialSummary: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchAtRiskStudents: () => Promise<void>;
  fetchSystemHealth: () => Promise<void>;
  fetchCharts: () => Promise<void>;
  refreshAll: () => Promise<void>;

  // Cache actions
  invalidateCache: () => void;
  isCacheValid: () => boolean;

  // State management
  setError: (error: string | null) => void;
  clearDashboard: () => void;
}

const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5 minutes

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  // Initial state
  dashboard: null,
  metrics: null,
  financialSummary: null,
  alerts: [],
  atRiskStudents: [],
  systemHealth: null,
  charts: {
    academic: null,
    attendance: null,
    feeCollection: null,
    studentDistribution: null,
  },

  isLoading: false,
  error: null,
  lastUpdated: null,

  cache: {
    data: null,
    lastFetched: null,
    isStale: true,
  },
  cacheExpireTime: CACHE_EXPIRE_TIME,

  // Fetch complete dashboard
  fetchCompleteDashboard: async () => {
    const { isCacheValid, cache, cacheExpireTime } = get();

    // Check cache
    if (isCacheValid() && cache.data) {
      set({
        dashboard: cache.data,
        metrics: cache.data.metrics,
        financialSummary: cache.data.financialSummary,
        alerts: cache.data.alerts,
        atRiskStudents: cache.data.atRiskStudents,
        systemHealth: cache.data.systemHealth,
        charts: cache.data.charts,
      });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await dashboardService.getCompleteDashboard();

      if (response) {
        set({
          dashboard: response,
          metrics: response.metrics,
          financialSummary: response.financialSummary,
          alerts: response.alerts,
          atRiskStudents: response.atRiskStudents,
          systemHealth: response.systemHealth,
          charts: response.charts,
          lastUpdated: Date.now(),
          cache: {
            data: response,
            lastFetched: Date.now(),
            isStale: false,
          },
        });
      } else {
        set({ error: 'Failed to fetch dashboard' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch dashboard' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch metrics only
  fetchMetrics: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await dashboardService.getMetrics();

      if (response) {
        set({ metrics: response, lastUpdated: Date.now() });
      } else {
        set({ error: 'Failed to fetch metrics' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch metrics' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch financial summary only
  fetchFinancialSummary: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await dashboardService.getFinancialSummary();

      if (response) {
        set({ financialSummary: response, lastUpdated: Date.now() });
      } else {
        set({ error: 'Failed to fetch financial summary' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch financial summary' });
    } finally {
      set({ isLoading: false });
    }
  },

  // Fetch alerts only
  fetchAlerts: async () => {
    try {
      const response = await dashboardService.getAlerts();

      if (response) {
        set({ alerts: response });
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  },

  // Fetch at-risk students only
  fetchAtRiskStudents: async () => {
    try {
      const response = await dashboardService.getStudentsAtRisk(10);

      if (response) {
        set({ atRiskStudents: response });
      }
    } catch (error) {
      console.error('Failed to fetch at-risk students:', error);
    }
  },

  // Fetch system health only
  fetchSystemHealth: async () => {
    try {
      const response = await dashboardService.getSystemHealth();

      if (response) {
        set({ systemHealth: response });
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    }
  },

  // Fetch all charts
  fetchCharts: async () => {
    try {
      const [academic, attendance, feeCollection, distribution] = await Promise.all([
        dashboardService.getAcademicPerformanceChart(),
        dashboardService.getAttendanceTrendChart(),
        dashboardService.getFeeCollectionChart(),
        dashboardService.getStudentDistributionChart(),
      ]);

      set({
        charts: {
          academic: academic || null,
          attendance: attendance || null,
          feeCollection: feeCollection || null,
          studentDistribution: distribution || null,
        },
      });
    } catch (error) {
      console.error('Failed to fetch charts:', error);
    }
  },

  // Refresh all data
  refreshAll: async () => {
    const { invalidateCache } = get();
    invalidateCache();
    await get().fetchCompleteDashboard();
  },

  // Check if cache is valid
  isCacheValid: () => {
    const { cache, cacheExpireTime } = get();
    if (!cache.lastFetched || !cache.data) return false;
    return Date.now() - cache.lastFetched < cacheExpireTime;
  },

  // Invalidate cache
  invalidateCache: () => {
    set({
      cache: {
        data: null,
        lastFetched: null,
        isStale: true,
      },
    });
  },

  // Set error
  setError: (error) => set({ error }),

  // Clear dashboard
  clearDashboard: () => {
    set({
      dashboard: null,
      metrics: null,
      financialSummary: null,
      alerts: [],
      atRiskStudents: [],
      systemHealth: null,
      charts: {
        academic: null,
        attendance: null,
        feeCollection: null,
        studentDistribution: null,
      },
      lastUpdated: null,
      cache: {
        data: null,
        lastFetched: null,
        isStale: true,
      },
    });
  },
}));

export default useDashboardStore;
