import { useState, useCallback } from 'react';
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
    backgroundColor?: string;
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

export interface CompleteDashboard {
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

export const useDashboard = () => {
  const [dashboard, setDashboard] = useState<CompleteDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await dashboardService.getCompleteDashboard();
      setDashboard(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(errorMessage);
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    dashboard,
    loading,
    error,
    refreshDashboard,
  };
};
