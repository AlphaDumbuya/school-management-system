import express, { Router, Request, Response } from 'express';
import dashboardService from '@services/dashboardService';
import { logger } from '@utils/logger';
import { authenticate } from '@middleware/authMiddleware';

const router: Router = express.Router();

// ============================================================================
// ADMIN DASHBOARD ROUTES
// ============================================================================

/**
 * GET /api/v1/dashboards/admin/metrics
 * Get comprehensive admin dashboard metrics (KPIs)
 * Role: admin, principal
 */
router.get('/dashboards/admin/metrics', authenticate, async (req: Request, res: Response) => {
  try {
    // Check authorization
    if (!['admin', 'principal'].includes(req.user?.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins and principals can access admin dashboard metrics',
      });
    }

    const metrics = await dashboardService.getAdminDashboardMetrics();
    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    logger.error(`Error fetching admin dashboard metrics: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch dashboard metrics',
    });
  }
});

/**
 * GET /api/v1/dashboards/admin/pending-approvals
 * Get pending approvals across all types
 */
router.get('/dashboards/admin/pending-approvals', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['admin', 'principal'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const approvals = await dashboardService.getPendingApprovals();
    res.json({
      success: true,
      data: approvals,
    });
  } catch (error) {
    logger.error(`Error fetching pending approvals: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch pending approvals',
    });
  }
});

/**
 * GET /api/v1/dashboards/admin/financial-summary
 * Get comprehensive financial summary
 */
router.get('/dashboards/admin/financial-summary', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['admin', 'principal', 'accountant'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const summary = await dashboardService.getFinancialSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    logger.error(`Error fetching financial summary: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch financial summary',
    });
  }
});

/**
 * GET /api/v1/dashboards/admin/alerts
 * Get dashboard alerts with system checks
 */
router.get('/dashboards/admin/alerts', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['admin', 'principal'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const alerts = await dashboardService.getDashboardAlerts();
    res.json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    logger.error(`Error fetching dashboard alerts: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch alerts',
    });
  }
});

/**
 * GET /api/v1/dashboards/admin/recent-activities
 * Get recent system activities
 * Query params: limit (default: 20)
 */
router.get('/dashboards/admin/recent-activities', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['admin', 'principal'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const activities = await dashboardService.getRecentActivities(limit);

    res.json({
      success: true,
      data: activities,
      count: activities.length,
    });
  } catch (error) {
    logger.error(`Error fetching recent activities: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch activities',
    });
  }
});

/**
 * GET /api/v1/dashboards/admin/students-at-risk
 * Get students at academic or attendance risk
 * Query params: limit (default: 10)
 */
router.get('/dashboards/admin/students-at-risk', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['admin', 'principal', 'teacher'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const atRiskStudents = await dashboardService.getStudentsAtRisk(limit);

    res.json({
      success: true,
      data: atRiskStudents,
      count: atRiskStudents.length,
    });
  } catch (error) {
    logger.error(`Error fetching students at risk: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch at-risk students',
    });
  }
});

/**
 * GET /api/v1/dashboards/admin/system-health
 * Get system health status
 */
router.get('/dashboards/admin/system-health', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['admin', 'principal'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const health = await dashboardService.getSystemHealth();
    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    logger.error(`Error fetching system health: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch system health',
    });
  }
});

// ============================================================================
// DASHBOARD CHARTS AND ANALYTICS
// ============================================================================

/**
 * GET /api/v1/dashboards/admin/chart/academic-performance
 * Get academic performance chart data by class
 */
router.get('/dashboards/admin/chart/academic-performance', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['admin', 'principal', 'teacher'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chartData = await dashboardService.getAcademicPerformanceChart();
    res.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    logger.error(`Error fetching academic performance chart: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch chart data',
    });
  }
});

/**
 * GET /api/v1/dashboards/admin/chart/attendance-trend
 * Get attendance trend chart data (last 30 days)
 */
router.get('/dashboards/admin/chart/attendance-trend', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['admin', 'principal', 'teacher'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chartData = await dashboardService.getAttendanceTrendChart();
    res.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    logger.error(`Error fetching attendance trend chart: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch chart data',
    });
  }
});

/**
 * GET /api/v1/dashboards/admin/chart/fee-collection
 * Get fee collection chart data (last 12 months)
 */
router.get('/dashboards/admin/chart/fee-collection', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['admin', 'principal', 'accountant'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chartData = await dashboardService.getFeeCollectionChart();
    res.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    logger.error(`Error fetching fee collection chart: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch chart data',
    });
  }
});

/**
 * GET /api/v1/dashboards/admin/chart/student-distribution
 * Get student distribution by class
 */
router.get('/dashboards/admin/chart/student-distribution', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['admin', 'principal'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chartData = await dashboardService.getStudentDistributionChart();
    res.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    logger.error(`Error fetching student distribution chart: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch chart data',
    });
  }
});

// ============================================================================
// COMPREHENSIVE DASHBOARD ENDPOINT
// ============================================================================

/**
 * GET /api/v1/dashboards/admin/complete
 * Get complete admin dashboard with all data at once
 * Combines metrics, alerts, financial summary, and chart data
 */
router.get('/dashboards/admin/complete', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['admin', 'principal'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Fetch all data in parallel
    const [metrics, alerts, financialSummary, atRiskStudents, systemHealth, chartData] = await Promise.all([
      dashboardService.getAdminDashboardMetrics(),
      dashboardService.getDashboardAlerts(),
      dashboardService.getFinancialSummary(),
      dashboardService.getStudentsAtRisk(10),
      dashboardService.getSystemHealth(),
      Promise.all([
        dashboardService.getAcademicPerformanceChart(),
        dashboardService.getAttendanceTrendChart(),
        dashboardService.getFeeCollectionChart(),
        dashboardService.getStudentDistributionChart(),
      ]),
    ]);

    res.json({
      success: true,
      data: {
        metrics,
        alerts,
        financialSummary,
        atRiskStudents,
        systemHealth,
        charts: {
          academicPerformance: chartData[0],
          attendanceTrend: chartData[1],
          feeCollection: chartData[2],
          studentDistribution: chartData[3],
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error fetching complete dashboard: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch complete dashboard',
    });
  }
});

// ============================================================================
// TEACHER DASHBOARD ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/dashboards/teacher
 * Get teacher-specific dashboard
 * Shows class performance, student engagement, attendance
 */
router.get('/dashboards/teacher', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'teacher') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Teacher dashboard would show their assigned classes, students, grades, etc.
    res.json({
      success: true,
      message: 'Teacher dashboard data would be here',
      data: {
        assignedClasses: [],
        studentCount: 0,
        averagePerformance: 0,
        attendanceOverview: {},
      },
    });
  } catch (error) {
    logger.error(`Error fetching teacher dashboard: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch teacher dashboard',
    });
  }
});

// ============================================================================
// STUDENT DASHBOARD ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/dashboards/student
 * Get student-specific dashboard
 * Shows grades, attendance, schedule, announcements
 */
router.get('/dashboards/student', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'student') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Student dashboard would show their grades, schedule, performance, etc.
    res.json({
      success: true,
      message: 'Student dashboard data would be here',
      data: {
        enrolledClasses: [],
        averageGrade: 0,
        attendanceRate: 0,
        upcomingClasses: [],
      },
    });
  } catch (error) {
    logger.error(`Error fetching student dashboard: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch student dashboard',
    });
  }
});

// ============================================================================
// PARENT/GUARDIAN DASHBOARD ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/dashboards/parent
 * Get parent-specific dashboard
 * Shows children's performance, attendance, fee status
 */
router.get('/dashboards/parent', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['parent', 'guardian'].includes(req.user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Parent dashboard would show their children's info, fees, performance
    res.json({
      success: true,
      message: 'Parent dashboard data would be here',
      data: {
        children: [],
        outstandingFees: 0,
        averagePerformance: 0,
      },
    });
  } catch (error) {
    logger.error(`Error fetching parent dashboard: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch parent dashboard',
    });
  }
});

// ============================================================================
// SPECIALIZED DASHBOARDS
// ============================================================================

/**
 * GET /api/v1/dashboards/accountant/overview
 * Get accountant-specific dashboard
 * Shows financial metrics, pending payments, recent transactions
 */
router.get('/dashboards/accountant/overview', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'accountant') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [financialSummary, alerts, chartData] = await Promise.all([
      dashboardService.getFinancialSummary(),
      dashboardService.getDashboardAlerts(),
      dashboardService.getFeeCollectionChart(),
    ]);

    res.json({
      success: true,
      data: {
        financialSummary,
        alerts: alerts.filter(a => a.type === 'financial'),
        feeCollectionChart: chartData,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`Error fetching accountant dashboard: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch accountant dashboard',
    });
  }
});

/**
 * GET /api/v1/dashboards/admissions/overview
 * Get admissions officer dashboard
 * Shows pending applications, enrollment status, analytics
 */
router.get('/dashboards/admissions/overview', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user?.role !== 'admissionsOfficer') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Admissions dashboard would show pending applications, enrollments, etc.
    res.json({
      success: true,
      message: 'Admissions dashboard data would be here',
      data: {
        pendingApplications: 0,
        approvedApplications: 0,
        enrolledStudents: 0,
        capacityStatus: {},
      },
    });
  } catch (error) {
    logger.error(`Error fetching admissions dashboard: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch admissions dashboard',
    });
  }
});

export default router;
