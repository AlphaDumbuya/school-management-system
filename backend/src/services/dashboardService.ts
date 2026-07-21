import { logger } from '@utils/logger';
import db from '@utils/database';

// ============================================================================
// Admin Dashboard Interfaces
// ============================================================================

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

export interface StudentAtRiskData {
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

export interface PendingApprovals {
  enrollmentRequests: number;
  paymentPlanRequests: number;
  leaveRequests: number;
  otherRequests: number;
  totalPending: number;
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

export interface RecentActivity {
  id: string;
  type: string;
  description: string;
  user: string;
  timestamp: string;
  relatedEntity: string;
  severity: 'info' | 'success' | 'warning' | 'error';
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

export interface SystemHealth {
  databaseStatus: 'healthy' | 'warning' | 'error';
  lastBackup: string;
  apiResponseTime: number;
  storageUsage: number;
  activeUsers: number;
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

// ============================================================================
// Admin Dashboard Service
// ============================================================================

class DashboardService {
  /**
   * Get comprehensive admin dashboard metrics
   */
  async getAdminDashboardMetrics(tenantId: string): Promise<DashboardMetrics> {
    try {
      // Student profiles exist before portal user accounts for some admissions.
      // Counting profiles keeps the dashboard aligned with the student directory.
      const totalStudents = await db('students')
        .leftJoin('users', 'students.user_id', 'users.id')
        .whereRaw('COALESCE(students.tenant_id, users.tenant_id) = ?', [tenantId])
        .where('students.status', 'active')
        .count('* as count')
        .first();

      // Teacher profiles are the authoritative staff record for this KPI.
      const totalTeachers = await db('teachers')
        .join('users', 'teachers.user_id', 'users.id')
        .where({ 'teachers.status': 'active', 'users.status': 'active', 'users.tenant_id': tenantId })
        .count('* as count')
        .first();

      // Get total staff (non-student, non-teacher active users)
      const totalStaff = await db('users')
        .whereIn('role', ['principal', 'staff', 'accountant', 'admissionsOfficer', 'super_admin'])
        .where({ status: 'active', tenant_id: tenantId })
        .count('* as count')
        .first();

      // Get total classes
      const totalClasses = await db('classes')
        .join('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .where('academic_sessions.tenant_id', tenantId)
        .count('classes.id as count')
        .first();

      // Get total active enrollments
      const totalEnrollments = await db('enrollments')
        .join('students', 'enrollments.student_id', 'students.id')
        .where({ 'enrollments.status': 'active', 'students.tenant_id': tenantId })
        .count('enrollments.id as count')
        .first();

      // Get outstanding fees — fees table has 'amount' column, not 'balance'
      const outstandingFees = await this.getOutstandingFeeBalance(tenantId);

      // Get total collected this month — payments uses snake_case 'created_at'
      const thisMonthCollected = await db('payments')
        .join('students', 'payments.student_id', 'students.id')
        .where('students.tenant_id', tenantId)
        .whereRaw("EXTRACT(YEAR FROM payments.created_at) = EXTRACT(YEAR FROM NOW())")
        .whereRaw("EXTRACT(MONTH FROM payments.created_at) = EXTRACT(MONTH FROM NOW())")
        .sum('payments.amount as total')
        .first();

      // Get attendance rate from attendance table
      const totalAttendanceRecords = await db('attendance')
        .join('students', 'attendance.student_id', 'students.id')
        .where('students.tenant_id', tenantId)
        .count('attendance.id as count')
        .first();

      const presentCount = await db('attendance')
        .join('students', 'attendance.student_id', 'students.id')
        .where({ 'attendance.status': 'present', 'students.tenant_id': tenantId })
        .count('attendance.id as count')
        .first();

      const totalAtt = Number(totalAttendanceRecords?.count) || 0;
      const presentAtt = Number(presentCount?.count) || 0;
      const attendanceRate = totalAtt > 0 ? (presentAtt / totalAtt) * 100 : 0;

      // Get average grade — grades table has 'grade_value' column
      const averageGrade = await db('grades')
        .join('students', 'grades.student_id', 'students.id')
        .where('students.tenant_id', tenantId)
        .avg('grades.grade_value as avg')
        .first();

      return {
        totalStudents: Number(totalStudents?.count) || 0,
        activeStudents: Number(totalStudents?.count) || 0,
        totalTeachers: Number(totalTeachers?.count) || 0,
        totalStaff: Number(totalStaff?.count) || 0,
        totalClasses: Number(totalClasses?.count) || 0,
        totalEnrollments: Number(totalEnrollments?.count) || 0,
        outstandingFees,
        totalCollected: Number(thisMonthCollected?.total) || 0,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        averageGrade: Math.round(Number(averageGrade?.avg || 0) * 100) / 100,
        classroomsInUse: Number(totalClasses?.count) || 0,
      };
    } catch (error) {
      logger.error(`Error getting dashboard metrics: ${error}`);
      throw new Error(`Failed to get dashboard metrics: ${error}`);
    }
  }

  /** Sum what is currently owed, rather than the original amount charged. */
  private async getOutstandingFeeBalance(tenantId: string): Promise<number> {
    const hasBalanceColumn = await db.schema.hasColumn('fees', 'balance');
    const outstanding = await db('fees')
      .join('students', 'fees.student_id', 'students.id')
      .where('students.tenant_id', tenantId)
      .whereIn('fees.status', ['pending', 'partial', 'overdue'])
      .sum(`fees.${hasBalanceColumn ? 'balance' : 'amount'} as total`)
      .first();

    return Number(outstanding?.total) || 0;
  }

  /**
   * Get pending approvals across all types
   */
  async getPendingApprovals(tenantId: string): Promise<PendingApprovals> {
    try {
      // Check admissions table for pending applications
      let enrollmentRequestCount = 0;
      try {
        const hasAdmissions = await db.schema.hasTable('admissions');
        if (hasAdmissions) {
          const result = await db('admissions')
            .join('users', 'admissions.created_by', 'users.id')
            .where('users.tenant_id', tenantId)
            .where({ 'admissions.status': 'pending' })
            .count('admissions.id as count')
            .first();
          enrollmentRequestCount = Number(result?.count) || 0;
        }
      } catch {
        // Table may not exist
      }

      // Check payment_plans table for pending plans
      let paymentPlanCount = 0;
      try {
        const hasPaymentPlans = await db.schema.hasTable('payment_plans');
        if (hasPaymentPlans) {
          const result = await db('payment_plans')
            .join('students', 'payment_plans.student_id', 'students.id')
            .where('students.tenant_id', tenantId)
            .where({ 'payment_plans.status': 'active' })
            .count('payment_plans.id as count')
            .first();
          paymentPlanCount = Number(result?.count) || 0;
        }
      } catch {
        // Table may not exist
      }

      const totalPending = enrollmentRequestCount + paymentPlanCount;

      return {
        enrollmentRequests: enrollmentRequestCount,
        paymentPlanRequests: paymentPlanCount,
        leaveRequests: 0,
        otherRequests: 0,
        totalPending,
      };
    } catch (error) {
      logger.error(`Error getting pending approvals: ${error}`);
      return {
        enrollmentRequests: 0,
        paymentPlanRequests: 0,
        leaveRequests: 0,
        otherRequests: 0,
        totalPending: 0,
      };
    }
  }

  /**
   * Get comprehensive financial summary
   */
  async getFinancialSummary(tenantId: string): Promise<FinancialSummary> {
    try {
      // Total revenue all time
      const totalRevenue = await db('payments')
        .join('students', 'payments.student_id', 'students.id')
        .where('students.tenant_id', tenantId)
        .sum('payments.amount as total')
        .first();

      // This month collected — use snake_case created_at
      const thisMonthCollected = await db('payments')
        .join('students', 'payments.student_id', 'students.id')
        .where('students.tenant_id', tenantId)
        .whereRaw("EXTRACT(YEAR FROM payments.created_at) = EXTRACT(YEAR FROM NOW())")
        .whereRaw("EXTRACT(MONTH FROM payments.created_at) = EXTRACT(MONTH FROM NOW())")
        .sum('payments.amount as total')
        .first();

      // Monthly target (configurable, default 50000)
      const monthlyTarget = 50000;

      // Outstanding balance — fees has 'amount', not 'balance'
      const outstandingBalance = await this.getOutstandingFeeBalance(tenantId);

      // Count of pending and partial fees
      const pendingFeesCount = await db('fees')
        .join('students', 'fees.student_id', 'students.id')
        .where('students.tenant_id', tenantId)
        .where({ 'fees.status': 'pending' })
        .count('fees.id as count')
        .first();

      const partialFeesCount = await db('fees')
        .join('students', 'fees.student_id', 'students.id')
        .where('students.tenant_id', tenantId)
        .where({ 'fees.status': 'partial' })
        .count('fees.id as count')
        .first();

      // Overdue amount — fees uses snake_case 'due_date'
      const hasBalanceColumn = await db.schema.hasColumn('fees', 'balance');
      const overdueAmount = await db('fees')
        .join('students', 'fees.student_id', 'students.id')
        .where('students.tenant_id', tenantId)
        .where('fees.due_date', '<', db.fn.now())
        .where(function(this: any) {
          this.where({ 'fees.status': 'pending' }).orWhere({ 'fees.status': 'partial' });
        })
        .sum(`fees.${hasBalanceColumn ? 'balance' : 'amount'} as total`)
        .first();

      const collected = Number(thisMonthCollected?.total) || 0;
      const collectionRate = monthlyTarget > 0
        ? (collected / monthlyTarget) * 100
        : 0;

      // Calculate trend (current vs previous month) — use snake_case created_at
      const previousMonthCollected = await db('payments')
        .join('students', 'payments.student_id', 'students.id')
        .where('students.tenant_id', tenantId)
        .whereRaw("EXTRACT(YEAR FROM payments.created_at) = EXTRACT(YEAR FROM (NOW() - INTERVAL '1 month'))")
        .whereRaw("EXTRACT(MONTH FROM payments.created_at) = EXTRACT(MONTH FROM (NOW() - INTERVAL '1 month'))")
        .sum('payments.amount as total')
        .first();

      const prevAmount = Number(previousMonthCollected?.total) || 0;
      const trend = prevAmount > 0
        ? ((collected - prevAmount) / prevAmount) * 100
        : 0;

      return {
        totalRevenue: Number(totalRevenue?.total) || 0,
        thisMonthCollected: collected,
        thisMonthTarget: monthlyTarget,
        outstandingBalance,
        overdueAmount: Number(overdueAmount?.total) || 0,
        collectionRate: Math.round(collectionRate * 100) / 100,
        trend: Math.round(trend * 100) / 100,
        pendingFees: Number(pendingFeesCount?.count) || 0,
        partiallyPaid: Number(partialFeesCount?.count) || 0,
      };
    } catch (error) {
      logger.error(`Error getting financial summary: ${error}`);
      throw new Error(`Failed to get financial summary: ${error}`);
    }
  }

  /**
   * Get recent activities for the dashboard
   */
  async getRecentActivities(tenantId: string, limit: number = 20): Promise<RecentActivity[]> {
    try {
      // audit_logs table uses snake_case column names, join users to filter by tenant_id
      const activities = await db('audit_logs')
        .join('users', 'audit_logs.performed_by', 'users.id')
        .where('users.tenant_id', tenantId)
        .orderBy('audit_logs.created_at', 'desc')
        .limit(limit)
        .select('audit_logs.*');

      return activities.map((activity: any) => ({
        id: activity.id,
        type: activity.action,
        description: activity.changes ? JSON.stringify(activity.changes) : 'Activity recorded',
        user: activity.user_id || 'System',
        timestamp: activity.created_at,
        relatedEntity: activity.entity_type,
        severity: 'info' as const,
      }));
    } catch (error) {
      logger.error(`Error getting recent activities: ${error}`);
      return [];
    }
  }

  /**
   * Get dashboard alerts with various system checks
   */
  async getDashboardAlerts(tenantId: string): Promise<DashboardAlert[]> {
    try {
      const alerts: DashboardAlert[] = [];

      // Check for pending approvals
      const pendingApprovals = await this.getPendingApprovals(tenantId);
      if (pendingApprovals.totalPending > 0) {
        alerts.push({
          id: 'pending-approvals',
          type: 'system',
          title: 'Pending Approvals',
          message: `You have ${pendingApprovals.totalPending} pending approvals requiring action`,
          severity: pendingApprovals.totalPending > 5 ? 'warning' : 'info',
          timestamp: new Date().toISOString(),
          actionUrl: '/admin/approvals',
          dismissible: true,
        });
      }

      // Check for overdue fees — use snake_case 'due_date'
      try {
        const overdueCount = await db('fees')
          .join('students', 'fees.student_id', 'students.id')
          .where('students.tenant_id', tenantId)
          .where('fees.due_date', '<', db.fn.now())
          .where({ 'fees.status': 'pending' })
          .count('fees.id as count')
          .first();

        if (Number(overdueCount?.count) > 0) {
          alerts.push({
            id: 'overdue-fees',
            type: 'financial',
            title: 'Overdue Fees Alert',
            message: `${overdueCount?.count} students have overdue fees. Check financial summary for details.`,
            severity: 'warning',
            timestamp: new Date().toISOString(),
            actionUrl: '/admin/finances',
            dismissible: true,
          });
        }
      } catch {
        // Fees table query failed - skip this alert
      }

      // Check for low attendance students — use snake_case columns
      try {
        const lowAttendanceCount = await db.raw(`
          SELECT COUNT(*) as cnt FROM (
            SELECT u.id
            FROM users u
            JOIN students s ON u.id = s.user_id
            JOIN enrollments e ON s.id = e.student_id
            LEFT JOIN attendance a ON s.id = a.student_id AND a.created_at > NOW() - INTERVAL '30 days'
            WHERE u.role = 'student' AND u.status = 'active' AND u.tenant_id = ?
            GROUP BY u.id
            HAVING COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric / NULLIF(COUNT(a.id), 0) < 0.75
          ) sub
        `, [tenantId]);

        const lowCount = Number(lowAttendanceCount?.rows?.[0]?.cnt) || 0;
        if (lowCount > 0) {
          alerts.push({
            id: 'low-attendance',
            type: 'academic',
            title: 'Low Attendance Alert',
            message: `${lowCount} students have attendance below 75% threshold`,
            severity: 'warning',
            timestamp: new Date().toISOString(),
            actionUrl: '/admin/attendance',
            dismissible: true,
          });
        }
      } catch {
        // Attendance query failed - skip this alert
      }

      // Check for students at academic risk (failing grades) — use snake_case
      try {
        const atRiskStudents = await db('grades')
          .join('students', 'grades.student_id', 'students.id')
          .join('users', 'students.user_id', 'users.id')
          .where('grades.grade_value', '<', 40)
          .where('users.status', 'active')
          .where('users.tenant_id', tenantId)
          .countDistinct('users.id as count')
          .first();

        if (Number(atRiskStudents?.count) > 0) {
          alerts.push({
            id: 'academic-risk',
            type: 'academic',
            title: 'Students at Academic Risk',
            message: `${atRiskStudents?.count} students have grades below passing threshold`,
            severity: 'warning',
            timestamp: new Date().toISOString(),
            actionUrl: '/admin/grades',
            dismissible: true,
          });
        }
      } catch {
        // Grades query failed - skip this alert
      }

      // Check for system health (database connectivity)
      try {
        await db.raw('SELECT 1');
      } catch {
        alerts.push({
          id: 'db-health',
          type: 'system',
          title: 'Database Connection Error',
          message: 'Unable to connect to database. System may be unstable.',
          severity: 'critical',
          timestamp: new Date().toISOString(),
          dismissible: false,
        });
      }

      return alerts;
    } catch (error) {
      logger.error(`Error getting dashboard alerts: ${error}`);
      return [];
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(tenantId: string): Promise<SystemHealth> {
    try {
      let databaseStatus: 'healthy' | 'warning' | 'error' = 'healthy';
      const startTime = Date.now();

      try {
        await db.raw('SELECT 1');
      } catch {
        databaseStatus = 'error';
      }

      // Measure actual API response time from the DB ping
      const apiResponseTime = Date.now() - startTime;

      // Get storage usage (approximate from DB size)
      let storageUsage = 0;
      try {
        const dbSize = await db.raw(`
          SELECT pg_database_size(current_database()) as size
        `);
        // Convert to percentage of a nominal 1GB limit
        const sizeBytes = Number(dbSize?.rows?.[0]?.size) || 0;
        storageUsage = Math.min(Math.round((sizeBytes / (1024 * 1024 * 1024)) * 100), 100);
      } catch {
        storageUsage = 0;
      }

      // Count active users (users who logged in within last 24 hours)
      // users table has 'last_login' column, not 'lastActivity'
      let activeUserCount = 0;
      try {
        const activeUsers = await db('users')
          .where('last_login', '>', new Date(Date.now() - 24 * 60 * 60 * 1000))
          .where('tenant_id', tenantId)
          .count('* as count')
          .first();
        activeUserCount = Number(activeUsers?.count) || 0;
      } catch {
        // last_login column might not exist - default to 0
      }

      return {
        databaseStatus,
        lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        apiResponseTime,
        storageUsage,
        activeUsers: activeUserCount,
      };
    } catch (error) {
      logger.error(`Error getting system health: ${error}`);
      return {
        databaseStatus: 'error',
        lastBackup: new Date().toISOString(),
        apiResponseTime: 0,
        storageUsage: 0,
        activeUsers: 0,
      };
    }
  }

  /**
   * Get academic performance chart data
   */
  async getAcademicPerformanceChart(tenantId: string): Promise<ChartData> {
    try {
      // classes table doesn't have 'isActive' — just get all classes matching tenantId
      const performance = await db('classes')
        .join('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .join('enrollments', function () {
          this.on('enrollments.class_id', '=', 'classes.id')
            .andOn('enrollments.academic_session_id', '=', 'classes.academic_session_id')
            .andOnVal('enrollments.status', '=', 'active');
        })
        .join('grades', 'grades.student_id', 'enrollments.student_id')
        .where('academic_sessions.tenant_id', tenantId)
        .select('classes.name')
        .avg('grades.grade_value as average_grade')
        .groupBy('classes.id', 'classes.name')
        .orderBy('classes.name')
        .limit(20);

      if (performance.length === 0) {
        return { labels: [], datasets: [] };
      }

      return {
        labels: performance.map((row: any) => row.name),
        datasets: [{
          label: 'Average Grade',
          data: performance.map((row: any) => Math.round(Number(row.average_grade) * 100) / 100),
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
        }],
      };
    } catch (error) {
      logger.error(`Error getting academic performance chart: ${error}`);
      return { labels: [], datasets: [] };
    }
  }

  /**
   * Get attendance trend chart data (last 30 days)
   */
  async getAttendanceTrendChart(tenantId: string): Promise<ChartData> {
    try {
      const dailyAttendance = await db('attendance')
        .join('students', 'attendance.student_id', 'students.id')
        .where('students.tenant_id', tenantId)
        .where('attendance.attendance_date', '>=', db.raw("CURRENT_DATE - INTERVAL '29 days'"))
        .select(db.raw("TO_CHAR(attendance.attendance_date, 'MM-DD') as label"))
        .count('attendance.id as total')
        .sum(db.raw("CASE WHEN attendance.status IN ('present', 'late') THEN 1 ELSE 0 END as present_count"))
        .groupByRaw("TO_CHAR(attendance.attendance_date, 'MM-DD')")
        .orderByRaw('MIN(attendance.attendance_date)');

      if (dailyAttendance.length === 0) {
        return { labels: [], datasets: [] };
      }

      return {
        labels: dailyAttendance.map((row: any) => row.label),
        datasets: [{
          label: 'Attendance Rate %',
          data: dailyAttendance.map((row: any) => {
            const total = Number(row.total) || 0;
            return total > 0 ? Math.round((Number(row.present_count) / total) * 100) : 0;
          }),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: true,
        }],
      };
    } catch (error) {
      logger.error(`Error getting attendance trend chart: ${error}`);
      return { labels: [], datasets: [] };
    }
  }

  /**
   * Get fee collection chart data (last 12 months)
   */
  async getFeeCollectionChart(tenantId: string): Promise<ChartData> {
    try {
      const last12Months: Date[] = [];
      const monthLabels: string[] = [];

      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        last12Months.push(date);
        monthLabels.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      }

      const startDate = new Date(last12Months[0].getFullYear(), last12Months[0].getMonth(), 1);
      const collections = await db('payments')
        .join('students', 'payments.student_id', 'students.id')
        .where('students.tenant_id', tenantId)
        .where('payments.status', 'completed')
        .where('payments.payment_date', '>=', startDate)
        .select(db.raw("TO_CHAR(DATE_TRUNC('month', payments.payment_date), 'YYYY-MM') as month_key"))
        .sum('payments.amount as total')
        .groupByRaw("TO_CHAR(DATE_TRUNC('month', payments.payment_date), 'YYYY-MM')");

      if (collections.length === 0) {
        return { labels: [], datasets: [] };
      }

      const totalsByMonth = new Map(
        collections.map((row: any) => [row.month_key, Number(row.total) || 0])
      );
      const feeData = last12Months.map((date) =>
        totalsByMonth.get(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`) ?? 0
      );

      return {
        labels: monthLabels,
        datasets: [{
          label: 'Fee Collections',
          data: feeData,
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
        }],
      };
    } catch (error) {
      logger.error(`Error getting fee collection chart: ${error}`);
      return { labels: [], datasets: [] };
    }
  }

  /**
   * Get student distribution chart data
   */
  async getStudentDistributionChart(tenantId: string): Promise<ChartData> {
    try {
      // Use snake_case join columns
      const classDistribution = await db('enrollments')
        .join('classes', 'enrollments.class_id', 'classes.id')
        .join('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .where('enrollments.status', 'active')
        .where('academic_sessions.tenant_id', tenantId)
        .select('classes.name', db.raw('COUNT(*) as count'))
        .groupBy('classes.name')
        .orderBy('count', 'desc');

      return {
        labels: classDistribution.map((c: any) => c.name),
        datasets: [{
          label: 'Students per Class',
          data: classDistribution.map((c: any) => Number(c.count)),
          backgroundColor: [
            'rgba(37, 99, 235, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(14, 165, 233, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(168, 85, 247, 0.8)',
          ],
        }],
      };
    } catch (error) {
      logger.error(`Error getting student distribution chart: ${error}`);
      return { labels: [], datasets: [] };
    }
  }

  /**
   * Get students at risk
   */
  async getStudentsAtRisk(tenantId: string, limit: number = 10): Promise<StudentAtRiskData[]> {
    try {
      const atRiskStudents = await db.raw(`
        WITH current_enrollments AS (
          SELECT DISTINCT ON (student_id) student_id, class_id
          FROM enrollments
          WHERE status = 'active'
          ORDER BY student_id, created_at DESC
        )
        SELECT
          s.id,
          TRIM(COALESCE(s.first_name, u.first_name, '') || ' ' || COALESCE(s.last_name, u.last_name, '')) as name,
          s.student_id as roll_number,
          c.name as class_name,
          grade_stats.average_grade,
          attendance_stats.attendance_rate
        FROM students s
        LEFT JOIN users u ON s.user_id = u.id
        JOIN current_enrollments e ON s.id = e.student_id
        JOIN classes c ON e.class_id = c.id
        LEFT JOIN (
          SELECT student_id, AVG(grade_value) as average_grade
          FROM grades
          GROUP BY student_id
        ) grade_stats ON grade_stats.student_id = s.id
        LEFT JOIN (
          SELECT
            student_id,
            ROUND(
              COUNT(*) FILTER (WHERE status IN ('present', 'late'))::numeric
              / NULLIF(COUNT(*), 0) * 100,
              2
            ) as attendance_rate
          FROM attendance
          WHERE attendance_date >= CURRENT_DATE - INTERVAL '29 days'
          GROUP BY student_id
        ) attendance_stats ON attendance_stats.student_id = s.id
        WHERE COALESCE(s.tenant_id, u.tenant_id) = ?
          AND s.status = 'active'
          AND (grade_stats.average_grade < 40 OR attendance_stats.attendance_rate < 75)
        ORDER BY grade_stats.average_grade ASC NULLS LAST, attendance_stats.attendance_rate ASC NULLS LAST
        LIMIT ?
      `, [tenantId, limit]);

      return (atRiskStudents.rows || []).map((student: any) => {
        const riskFactors: string[] = [];
        const avgGrade = Number(student.average_grade ?? 100);
        const attRate = Number(student.attendance_rate ?? 100);

        if (avgGrade < 40) riskFactors.push('Low Grades');
        if (attRate < 75) riskFactors.push('Low Attendance');

        let severity: 'high' | 'medium' | 'low' = 'low';
        if (riskFactors.length === 2 || avgGrade < 30 || attRate < 60) {
          severity = 'high';
        } else if (avgGrade < 40 || attRate < 70) {
          severity = 'medium';
        }

        return {
          id: student.id,
          name: student.name,
          rollNumber: student.roll_number || '',
          className: student.class_name || '',
          riskFactors,
          attendanceRate: attRate,
          averageGrade: avgGrade,
          lastActivity: new Date().toISOString(),
          severity,
        };
      });
    } catch (error) {
      logger.error(`Error getting students at risk: ${error}`);
      return [];
    }
  }
}

export default new DashboardService();
