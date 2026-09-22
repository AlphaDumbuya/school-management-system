import { apiClient } from '@lib/apiClient';
import { CompleteDashboard } from '@hooks/useDashboard';
import { ApiResponse } from '@appTypes/index';

class DashboardService {
  private unwrapResponse<T>(response: ApiResponse<T> | T | undefined): T | undefined {
    if (!response) return undefined;
    if (typeof response === 'object' && response !== null && 'success' in response) {
      return (response as ApiResponse<T>).data ?? undefined;
    }
    return response as T;
  }
  /**
   * Get complete principal dashboard with all data
   * Falls back to individual endpoint calls if complete endpoint not available
   */
  async getCompleteDashboard(cacheBust?: string): Promise<CompleteDashboard> {
    try {
      const params = cacheBust ? { _t: cacheBust } : undefined;
      const response = await apiClient.get<CompleteDashboard>('/api/v1/dashboards/admin/complete', { params });
      const payload = this.unwrapResponse(response);
      if (payload) {
        return payload;
      }
      throw new Error((response as ApiResponse<CompleteDashboard>).error || 'Failed to load dashboard');
    } catch (error) {
      // Fallback to individual endpoint calls
      console.warn('Complete dashboard endpoint not available, using individual endpoints:', error);

      const safeCall = async <T>(promise: Promise<any>, fallback: T): Promise<T> => {
        try {
          const res = await promise;
          return res !== undefined ? res : fallback;
        } catch (e) {
          console.error('Dashboard component load failed:', e);
          return fallback;
        }
      };

      // Pass the cache-buster to every individual endpoint too
      const p = cacheBust ? { _t: cacheBust } : undefined;
      const [metrics, alerts, financialSummary, atRiskStudents, systemHealth, academicChart, attendanceChart, feeChart, distributionChart] = await Promise.all([
        safeCall(this.getMetrics(p), null),
        safeCall(this.getAlerts(p), []),
        safeCall(this.getFinancialSummary(p), null),
        safeCall(this.getStudentsAtRisk(10, p), []),
        safeCall(this.getSystemHealth(p), null),
        safeCall(this.getAcademicPerformanceChart(p), { labels: [], datasets: [] }),
        safeCall(this.getAttendanceTrendChart(p), { labels: [], datasets: [] }),
        safeCall(this.getFeeCollectionChart(p), { labels: [], datasets: [] }),
        safeCall(this.getStudentDistributionChart(p), { labels: [], datasets: [] }),
      ]);

      return {
        metrics: metrics || {
          totalStudents: 0,
          activeStudents: 0,
          totalTeachers: 0,
          totalClasses: 0,
          outstandingFees: 0,
          totalCollected: 0,
          attendanceRate: 0,
          averageGrade: 0,
          classroomsInUse: 0,
          totalStaff: 0,
          totalEnrollments: 0,
        },
        alerts: alerts || [],
        financialSummary: financialSummary || {
          totalRevenue: 0,
          thisMonthCollected: 0,
          thisMonthTarget: 0,
          outstandingBalance: 0,
          overdueAmount: 0,
          collectionRate: 0,
          trend: 0,
          pendingFees: 0,
          partiallyPaid: 0,
        },
        atRiskStudents: atRiskStudents || [],
        systemHealth: systemHealth || {
          databaseStatus: 'error',
          lastBackup: new Date().toISOString(),
          apiResponseTime: 0,
          storageUsage: 0,
          activeUsers: 0,
        },
        charts: {
          academicPerformance: academicChart,
          attendanceTrend: attendanceChart,
          feeCollection: feeChart,
          studentDistribution: distributionChart,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getMetrics(params?: Record<string, string>) {
    const response = await apiClient.get('/api/v1/dashboards/admin/metrics', { params });
    return this.unwrapResponse(response);
  }

  async getFinancialSummary(params?: Record<string, string>) {
    const response = await apiClient.get('/api/v1/dashboards/admin/financial-summary', { params });
    return this.unwrapResponse(response);
  }

  async getAlerts(params?: Record<string, string>) {
    const response = await apiClient.get('/api/v1/dashboards/admin/alerts', { params });
    return this.unwrapResponse(response);
  }

  async getRecentActivities(limit: number = 20) {
    const response = await apiClient.get('/api/v1/dashboards/admin/recent-activities', {
      params: { limit },
    });
    return this.unwrapResponse(response);
  }

  async getStudentsAtRisk(limit: number = 10, params?: Record<string, string>) {
    const response = await apiClient.get('/api/v1/dashboards/admin/students-at-risk', {
      params: { limit, ...params },
    });
    return this.unwrapResponse(response);
  }

  async getSystemHealth(params?: Record<string, string>) {
    const response = await apiClient.get('/api/v1/dashboards/admin/system-health', { params });
    return this.unwrapResponse(response);
  }

  async getAcademicPerformanceChart(params?: Record<string, string>) {
    const response = await apiClient.get('/api/v1/dashboards/admin/chart/academic-performance', { params });
    return this.unwrapResponse(response);
  }

  async getAttendanceTrendChart(params?: Record<string, string>) {
    const response = await apiClient.get('/api/v1/dashboards/admin/chart/attendance-trend', { params });
    return this.unwrapResponse(response);
  }

  async getFeeCollectionChart(params?: Record<string, string>) {
    const response = await apiClient.get('/api/v1/dashboards/admin/chart/fee-collection', { params });
    return this.unwrapResponse(response);
  }

  async getStudentDistributionChart(params?: Record<string, string>) {
    const response = await apiClient.get('/api/v1/dashboards/admin/chart/student-distribution', { params });
    return this.unwrapResponse(response);
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals() {
    const response = await apiClient.get('/api/v1/dashboards/admin/pending-approvals');
    return this.unwrapResponse(response);
  }
}

export const dashboardService = new DashboardService();
