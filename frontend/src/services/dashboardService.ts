import { apiClient } from '@lib/apiClient';
import { CompleteDashboard } from '@hooks/useDashboard';

class DashboardService {
  /**
   * Get complete principal dashboard with all data
   * Falls back to individual endpoint calls if complete endpoint not available
   */
  async getCompleteDashboard(): Promise<CompleteDashboard> {
    try {
      // Try the complete endpoint first
      const response = await apiClient.get<CompleteDashboard>('/api/v1/dashboards/admin/complete');
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error(response.error || 'Failed to load dashboard');
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

      const [metrics, alerts, financialSummary, atRiskStudents, systemHealth, academicChart, attendanceChart, feeChart, distributionChart] = await Promise.all([
        safeCall(this.getMetrics(), null),
        safeCall(this.getAlerts(), []),
        safeCall(this.getFinancialSummary(), null),
        safeCall(this.getStudentsAtRisk(10), []),
        safeCall(this.getSystemHealth(), null),
        safeCall(this.getAcademicPerformanceChart(), { labels: [], datasets: [] }),
        safeCall(this.getAttendanceTrendChart(), { labels: [], datasets: [] }),
        safeCall(this.getFeeCollectionChart(), { labels: [], datasets: [] }),
        safeCall(this.getStudentDistributionChart(), { labels: [], datasets: [] }),
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

  /**
   * Get principal dashboard metrics (KPIs)
   */
  async getMetrics() {
    const response = await apiClient.get('/api/v1/dashboards/admin/metrics');
    return response.data;
  }

  /**
   * Get financial summary
   */
  async getFinancialSummary() {
    const response = await apiClient.get('/api/v1/dashboards/admin/financial-summary');
    return response.data;
  }

  /**
   * Get dashboard alerts
   */
  async getAlerts() {
    const response = await apiClient.get('/api/v1/dashboards/admin/alerts');
    return response.data;
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(limit: number = 20) {
    const response = await apiClient.get('/api/v1/dashboards/admin/recent-activities', {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get students at risk
   */
  async getStudentsAtRisk(limit: number = 10) {
    const response = await apiClient.get('/api/v1/dashboards/admin/students-at-risk', {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    const response = await apiClient.get('/api/v1/dashboards/admin/system-health');
    return response.data;
  }

  /**
   * Get academic performance chart data
   */
  async getAcademicPerformanceChart() {
    const response = await apiClient.get('/api/v1/dashboards/admin/chart/academic-performance');
    return response.data;
  }

  /**
   * Get attendance trend chart data
   */
  async getAttendanceTrendChart() {
    const response = await apiClient.get('/api/v1/dashboards/admin/chart/attendance-trend');
    return response.data;
  }

  /**
   * Get fee collection chart data
   */
  async getFeeCollectionChart() {
    const response = await apiClient.get('/api/v1/dashboards/admin/chart/fee-collection');
    return response.data;
  }

  /**
   * Get student distribution chart data
   */
  async getStudentDistributionChart() {
    const response = await apiClient.get('/api/v1/dashboards/admin/chart/student-distribution');
    return response.data;
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals() {
    const response = await apiClient.get('/api/v1/dashboards/admin/pending-approvals');
    return response.data;
  }
}

export const dashboardService = new DashboardService();
