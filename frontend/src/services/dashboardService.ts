import { apiClient } from '@lib/apiClient';
import { CompleteDashboard } from '@hooks/useDashboard';

class DashboardService {
  /**
   * Get complete admin dashboard with all data
   */
  async getCompleteDashboard(): Promise<CompleteDashboard> {
    const response = await apiClient.get<CompleteDashboard>('/dashboards/admin/complete');
    if (response.success && response.data) {
      return response.data;
    }
    throw new Error(response.error || 'Failed to load dashboard');
  }

  /**
   * Get admin dashboard metrics (KPIs)
   */
  async getMetrics() {
    const response = await apiClient.get('/dashboards/admin/metrics');
    return response.data;
  }

  /**
   * Get financial summary
   */
  async getFinancialSummary() {
    const response = await apiClient.get('/dashboards/admin/financial-summary');
    return response.data;
  }

  /**
   * Get dashboard alerts
   */
  async getAlerts() {
    const response = await apiClient.get('/dashboards/admin/alerts');
    return response.data;
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(limit: number = 20) {
    const response = await apiClient.get('/dashboards/admin/recent-activities', {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get students at risk
   */
  async getStudentsAtRisk(limit: number = 10) {
    const response = await apiClient.get('/dashboards/admin/students-at-risk', {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    const response = await apiClient.get('/dashboards/admin/system-health');
    return response.data;
  }

  /**
   * Get academic performance chart data
   */
  async getAcademicPerformanceChart() {
    const response = await apiClient.get('/dashboards/admin/chart/academic-performance');
    return response.data;
  }

  /**
   * Get attendance trend chart data
   */
  async getAttendanceTrendChart() {
    const response = await apiClient.get('/dashboards/admin/chart/attendance-trend');
    return response.data;
  }

  /**
   * Get fee collection chart data
   */
  async getFeeCollectionChart() {
    const response = await apiClient.get('/dashboards/admin/chart/fee-collection');
    return response.data;
  }

  /**
   * Get student distribution chart data
   */
  async getStudentDistributionChart() {
    const response = await apiClient.get('/dashboards/admin/chart/student-distribution');
    return response.data;
  }

  /**
   * Get pending approvals
   */
  async getPendingApprovals() {
    const response = await apiClient.get('/dashboards/admin/pending-approvals');
    return response.data;
  }
}

export const dashboardService = new DashboardService();
