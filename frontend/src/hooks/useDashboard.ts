import { useCallback } from 'react';
import { pollWhileActive } from '@lib/activity';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { dashboardService } from '@services/dashboardService';

export interface DashboardMetrics {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  totalClasses: number;
  outstandingFees: number;
  totalCollected: number;
  attendanceRate: number;
  averageGrade: number;
  classroomsInUse: number;
  totalStaff: number;
  totalEnrollments: number;
}

export interface FinancialSummary {
  totalRevenue: number;
  thisMonthCollected: number;
  thisMonthTarget: number;
  outstandingBalance: number;
  overdueAmount: number;
  collectionRate: number;
  trend: number;
  pendingFees: number;
  partiallyPaid: number;
}

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor?: string;
    backgroundColor?: string | string[];
    fill?: boolean;
  }>;
}

export interface SystemHealth {
  databaseStatus: 'healthy' | 'warning' | 'error';
  lastBackup: string;
  apiResponseTime: number;
  storageUsage: number;
  activeUsers: number;
}

export interface DashboardAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  actionUrl?: string;
  dismissible: boolean;
}

export interface AtRiskStudent {
  id: string;
  name: string;
  rollNumber: string;
  className: string;
  riskFactors: string[];
  attendanceRate: number;
  averageGrade: number;
  lastActivity: string;
  severity: 'high' | 'medium' | 'low';
}

export interface DashboardYearInfo {
  name: string | null;
  isActive: boolean;
  activeYear: string | null;
  previousYear: string | null;
  years: string[];
  /** Active students still sitting in an older year's classes. */
  pendingCarryForward: { fromYear: string; students: number } | null;
}

export interface DashboardActivity {
  id: string;
  kind: 'student' | 'payment' | 'announcement';
  title: string;
  sub: string;
  at: string;
}

export interface CompleteDashboard {
  academicYear?: DashboardYearInfo;
  /** % change vs the previous academic year (null = no previous year data). */
  trends?: { students: number | null; teachers: number | null; classes: number | null };
  recentActivity?: DashboardActivity[];
  metrics: DashboardMetrics;
  alerts: DashboardAlert[];
  financialSummary: FinancialSummary;
  atRiskStudents: AtRiskStudent[];
  systemHealth: SystemHealth;
  charts: {
    academicPerformance: ChartData;
    attendanceTrend: ChartData;
    feeCollection: ChartData;
    studentDistribution: ChartData;
  };
  timestamp: string;
}

/**
 * Principal overview for one academic year ('' = the school's active year).
 * Backed by React Query so live sync (a new year, promotions, role changes)
 * refetches it automatically, like every other screen.
 */
export const useDashboard = (academicYear: string = '') => {
  const query = useQuery({
    queryKey: ['admin-dashboard', academicYear],
    // Cache-buster so the service worker never serves a stale cached response.
    queryFn: () => dashboardService.getCompleteDashboard(`${Date.now()}`, academicYear || undefined),
    staleTime: 0,
    refetchInterval: pollWhileActive(300_000),
    placeholderData: keepPreviousData,
  });

  const { refetch } = query;
  const refreshDashboard = useCallback(async () => {
    await refetch({ throwOnError: true });
  }, [refetch]);

  return {
    dashboard: (query.data ?? null) as CompleteDashboard | null,
    loading: query.isFetching,
    error: query.error ? (query.error instanceof Error ? query.error.message : 'Failed to load dashboard') : null,
    refreshDashboard,
  };
};
