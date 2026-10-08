import express, { Router, Request, Response } from 'express';
import dashboardService from '@services/dashboardService';
import yearDashboardService from '@services/yearDashboardService';
import teacherDashboardService from '@services/teacherDashboardService';
import studentDashboardService from '@services/studentDashboardService';
import parentDashboardService from '@services/parentDashboardService';
import { logger } from '@utils/logger';
import { authenticate, attachUserContext } from '@middleware/authMiddleware';

const router: Router = express.Router();
router.use(authenticate);
router.use(attachUserContext);

// ============================================================================
// ADMIN DASHBOARD ROUTES
// ============================================================================

/**
 * GET /api/v1/dashboards/admin/metrics
 * Get comprehensive principal dashboard metrics (KPIs)
 * Role: principal, super_admin
 */
router.get('/dashboards/admin/metrics', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    // Check authorization
    if (!['principal', 'super_admin'].includes(req.user?.role || '')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admin/principals can access dashboard metrics',
      });
    }

    const metrics = await dashboardService.getAdminDashboardMetrics(tenantId);
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
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    if (!['principal', 'super_admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const approvals = await dashboardService.getPendingApprovals(tenantId);
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
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    if (!['principal', 'super_admin', 'accountant'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const summary = await dashboardService.getFinancialSummary(tenantId);
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
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    if (!['principal', 'super_admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const alerts = await dashboardService.getDashboardAlerts(tenantId);
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
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    if (!['principal', 'super_admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const activities = await dashboardService.getRecentActivities(tenantId, limit);

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
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    if (!['principal', 'super_admin', 'teacher'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const limit = parseInt(req.query.limit as string) || 10;
    const atRiskStudents = await dashboardService.getStudentsAtRisk(tenantId, limit);

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
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    if (!['principal', 'super_admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const health = await dashboardService.getSystemHealth(tenantId);
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
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    if (!['principal', 'super_admin', 'teacher'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chartData = await dashboardService.getAcademicPerformanceChart(tenantId);
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
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    if (!['principal', 'super_admin', 'teacher'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chartData = await dashboardService.getAttendanceTrendChart(tenantId);
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
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    if (!['principal', 'super_admin', 'accountant'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chartData = await dashboardService.getFeeCollectionChart(tenantId);
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
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    if (!['principal', 'super_admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const chartData = await dashboardService.getStudentDistributionChart(tenantId);
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
 * Combines metrics, alerts, financial summary, charts, and system health
 */
router.get('/dashboards/admin/complete', authenticate, async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    if (!['principal', 'super_admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Year-scoped overview: ?academic_year=YYYY/YYYY (default: the active year).
    const requestedYear = typeof req.query.academic_year === 'string' ? req.query.academic_year.trim() : undefined;
    const data = await yearDashboardService.getDashboard(tenantId, requestedYear || undefined);
    res.set('Cache-Control', 'no-store');
    res.json({ success: true, data, timestamp: new Date().toISOString() });
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

    const requestedYear = typeof req.query.academic_year === 'string' ? req.query.academic_year.trim() : undefined;
    const data = await teacherDashboardService.getDashboard(req.user.id, req.user.tenant_id, requestedYear || undefined);
    res.json({ success: true, data });
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
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    // ?academic_year= → that year (default = the school's active year).
    const year = typeof req.query.academic_year === 'string' ? req.query.academic_year : undefined;
    const data = await studentDashboardService.getDashboard(req.user!.id, tenantId, year);
    res.json({ success: true, data });
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
    if (!['parent', 'guardian'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    // ?academic_year (default = the school's active year).
    const data = await parentDashboardService.getDashboard(req.user!.id, tenantId, (req.query.academic_year as string) || null);
    res.json({ success: true, data });
  } catch (error) {
    logger.error(`Error fetching parent dashboard: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch parent dashboard',
    });
  }
});

/**
 * GET /api/v1/dashboards/parent/child/:studentId
 * Detailed per-child view (grades/attendance/schedule/fees) for a parent's
 * own child. Access is enforced against the parent's linked children.
 */
router.get('/dashboards/parent/child/:studentId', authenticate, async (req: Request, res: Response) => {
  try {
    if (!['parent', 'guardian'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    const data = await parentDashboardService.getChildDetail(req.user!.id, tenantId, req.params.studentId, (req.query.academic_year as string) || null);
    res.json({ success: true, data });
  } catch (error: any) {
    const msg = error?.message || 'Failed to fetch child details';
    if (msg.includes('only view your own')) {
      return res.status(403).json({ error: 'Forbidden', message: msg });
    }
    logger.error(`Error fetching parent child detail: ${error}`);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch child details' });
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
    // Accountants own this dashboard; principals/super_admins may also view it.
    if (!['accountant', 'principal', 'super_admin'].includes(req.user?.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context is required' });
    }

    // Tenant scoping is REQUIRED — these service methods now take tenantId; a
    // missing one previously produced an all-zeros (broken) dashboard.
    const [financialSummary, alerts, chartData] = await Promise.all([
      dashboardService.getFinancialSummary(tenantId),
      dashboardService.getDashboardAlerts(tenantId),
      dashboardService.getFeeCollectionChart(tenantId),
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
    // Admissions officers and principals may view this dashboard.
    if (!['admissions_officer', 'principal', 'super_admin'].includes(req.user?.role as string)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    // One intake year (default: the active year; ?academic_year=all for every year).
    const { admissionPipelineService } = await import('../services/admissions/admissionPipelineService.js');
    res.json({ success: true, data: await admissionPipelineService.overview(tenantId, req.query.academic_year as string) });
  } catch (error) {
    logger.error(`Error fetching admissions dashboard: ${error}`);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch admissions dashboard',
    });
  }
});

export default router;
