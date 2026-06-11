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
    backgroundColor?: string;
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
  async getAdminDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      // Get total students
      const totalStudents = await db('users')
        .where({ role: 'student', isActive: true })
        .count('* as count')
        .first();

      // Get total teachers
      const totalTeachers = await db('users')
        .where({ role: 'teacher', isActive: true })
        .count('* as count')
        .first();

      // Get total staff
      const totalStaff = await db('users')
        .where((qb: any) => {
          qb.where({ role: 'admin' })
            .orWhere({ role: 'staff' })
            .orWhere({ role: 'accountant' })
            .orWhere({ role: 'admissionsOfficer' });
        })
        .where({ isActive: true })
        .count('* as count')
        .first();

      // Get total classes
      const totalClasses = await db('classes')
        .where({ isActive: true })
        .count('* as count')
        .first();

      // Get total enrollments
      const totalEnrollments = await db('enrollments')
        .where({ status: 'active' })
        .count('* as count')
        .first();

      // Get outstanding fees
      const outstandingFees = await db('fees')
        .where((qb: any) => {
          qb.where({ status: 'pending' }).orWhere({ status: 'partial' });
        })
        .sum('balance as total')
        .first();

      // Get total collected this month
      const thisMonthCollected = await db('payments')
        .whereRaw("EXTRACT(YEAR FROM \"createdAt\") = EXTRACT(YEAR FROM NOW())")
        .whereRaw("EXTRACT(MONTH FROM \"createdAt\") = EXTRACT(MONTH FROM NOW())")
        .sum('amount as total')
        .first();

      // Get attendance rate
      const totalAttendanceRecords = await db('attendance')
        .count('* as count')
        .first();

      const presentCount = await db('attendance')
        .where({ status: 'present' })
        .count('* as count')
        .first();

      const attendanceRate = totalAttendanceRecords?.count > 0
        ? (presentCount?.count / totalAttendanceRecords.count) * 100
        : 0;

      // Get average grade
      const averageGrade = await db('grades')
        .avg('grade as avg')
        .first();

      return {
        totalStudents: totalStudents?.count || 0,
        activeStudents: totalStudents?.count || 0,
        totalTeachers: totalTeachers?.count || 0,
        totalStaff: totalStaff?.count || 0,
        totalClasses: totalClasses?.count || 0,
        totalEnrollments: totalEnrollments?.count || 0,
        outstandingFees: outstandingFees?.total || 0,
        totalCollected: thisMonthCollected?.total || 0,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        averageGrade: Math.round((averageGrade?.avg || 0) * 100) / 100,
        classroomsInUse: totalClasses?.count || 0,
      };
    } catch (error) {
      logger.error(`Error getting dashboard metrics: ${error}`);
      throw new Error(`Failed to get dashboard metrics: ${error}`);
    }
  }

  /**
   * Get pending approvals across all types
   */
  async getPendingApprovals(): Promise<PendingApprovals> {
    try {
      const enrollmentRequests = await db('enrollmentRequests')
        .where({ status: 'pending' })
        .count('* as count')
        .first();

      const paymentPlanRequests = await db('paymentPlans')
        .where({ status: 'pending' })
        .count('* as count')
        .first();

      const totalPending = (enrollmentRequests?.count || 0) + (paymentPlanRequests?.count || 0);

      return {
        enrollmentRequests: enrollmentRequests?.count || 0,
        paymentPlanRequests: paymentPlanRequests?.count || 0,
        leaveRequests: 0,
        otherRequests: 0,
        totalPending,
      };
    } catch (error) {
      logger.error(`Error getting pending approvals: ${error}`);
      throw new Error(`Failed to get pending approvals: ${error}`);
    }
  }

  /**
   * Get comprehensive financial summary
   */
  async getFinancialSummary(): Promise<FinancialSummary> {
    try {
      // Total revenue all time
      const totalRevenue = await db('payments')
        .sum('amount as total')
        .first();

      // This month collected
      const thisMonthCollected = await db('payments')
        .whereRaw("EXTRACT(YEAR FROM \"createdAt\") = EXTRACT(YEAR FROM NOW())")
        .whereRaw("EXTRACT(MONTH FROM \"createdAt\") = EXTRACT(MONTH FROM NOW())")
        .sum('amount as total')
        .first();

      // Monthly target (configurable, default 50000)
      const monthlyTarget = 50000;

      // Outstanding balance
      const outstandingBalance = await db('fees')
        .where((qb: any) => {
          qb.where({ status: 'pending' }).orWhere({ status: 'partial' });
        })
        .sum('balance as total')
        .first();

      // Count of pending and partial fees
      const pendingFeesCount = await db('fees')
        .where({ status: 'pending' })
        .count('* as count')
        .first();

      const partialFeesCount = await db('fees')
        .where({ status: 'partial' })
        .count('* as count')
        .first();

      // Overdue amount
      const overdueAmount = await db('fees')
        .where('dueDate', '<', db.fn.now())
        .where((qb: any) => {
          qb.where({ status: 'pending' }).orWhere({ status: 'partial' });
        })
        .sum('balance as total')
        .first();

      const collectionRate = monthlyTarget > 0
        ? ((thisMonthCollected?.total || 0) / monthlyTarget) * 100
        : 0;

      // Calculate trend (current vs previous month)
      const previousMonthCollected = await db('payments')
        .whereRaw("EXTRACT(YEAR FROM \"createdAt\") = EXTRACT(YEAR FROM NOW())")
        .whereRaw("EXTRACT(MONTH FROM \"createdAt\") = EXTRACT(MONTH FROM NOW() - INTERVAL '1 month')")
        .sum('amount as total')
        .first();

      const trend = previousMonthCollected?.total > 0
        ? (((thisMonthCollected?.total || 0) - (previousMonthCollected?.total || 0)) / (previousMonthCollected?.total || 1)) * 100
        : 0;

      return {
        totalRevenue: totalRevenue?.total || 0,
        thisMonthCollected: thisMonthCollected?.total || 0,
        thisMonthTarget: monthlyTarget,
        outstandingBalance: outstandingBalance?.total || 0,
        overdueAmount: overdueAmount?.total || 0,
        collectionRate: Math.round(collectionRate * 100) / 100,
        trend: Math.round(trend * 100) / 100,
        pendingFees: pendingFeesCount?.count || 0,
        partiallyPaid: partialFeesCount?.count || 0,
      };
    } catch (error) {
      logger.error(`Error getting financial summary: ${error}`);
      throw new Error(`Failed to get financial summary: ${error}`);
    }
  }

  /**
   * Get recent activities for the dashboard
   */
  async getRecentActivities(limit: number = 20): Promise<RecentActivity[]> {
    try {
      const activities = await db('auditLogs')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .select();

      return activities.map((activity: any) => ({
        id: activity.id,
        type: activity.action,
        description: activity.details,
        user: activity.userId,
        timestamp: activity.createdAt,
        relatedEntity: activity.entityType,
        severity: 'info',
      }));
    } catch (error) {
      logger.error(`Error getting recent activities: ${error}`);
      return [];
    }
  }

  /**
   * Get dashboard alerts with various system checks
   */
  async getDashboardAlerts(): Promise<DashboardAlert[]> {
    try {
      const alerts: DashboardAlert[] = [];

      // Check for pending approvals
      const pendingApprovals = await this.getPendingApprovals();
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

      // Check for overdue fees
      const overdueCount = await db('fees')
        .where('dueDate', '<', db.fn.now())
        .where({ status: 'pending' })
        .count('* as count')
        .first();

      if (overdueCount?.count > 0) {
        alerts.push({
          id: 'overdue-fees',
          type: 'financial',
          title: 'Overdue Fees Alert',
          message: `${overdueCount.count} students have overdue fees. Total outstanding: Check financial summary`,
          severity: 'warning',
          timestamp: new Date().toISOString(),
          actionUrl: '/admin/finances',
          dismissible: true,
        });
      }

      // Check for low attendance students
      const lowAttendanceCount = await db.raw(`
        SELECT COUNT(DISTINCT u.id) as count
        FROM users u
        JOIN enrollments e ON u.id = e.studentId
        LEFT JOIN attendance a ON u.id = a.studentId AND a.createdAt > NOW() - INTERVAL '30 days'
        WHERE u.role = 'student' AND u.isActive = true
        GROUP BY u.id
        HAVING COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) < 0.75
      `);

      if ((lowAttendanceCount?.rows?.length || 0) > 0) {
        alerts.push({
          id: 'low-attendance',
          type: 'academic',
          title: 'Low Attendance Alert',
          message: `${lowAttendanceCount.rows.length} students have attendance below 75% threshold`,
          severity: 'warning',
          timestamp: new Date().toISOString(),
          actionUrl: '/admin/attendance',
          dismissible: true,
        });
      }

      // Check for students at academic risk (failing grades)
      const atRiskStudents = await db('grades')
        .join('users', 'grades.studentId', 'users.id')
        .where('grades.grade', '<', 40)
        .where('users.isActive', true)
        .count('* as count')
        .first();

      if (atRiskStudents?.count > 0) {
        alerts.push({
          id: 'academic-risk',
          type: 'academic',
          title: 'Students at Academic Risk',
          message: `${atRiskStudents.count} students have grades below passing threshold`,
          severity: 'warning',
          timestamp: new Date().toISOString(),
          actionUrl: '/admin/grades',
          dismissible: true,
        });
      }

      // Check for system health (database connectivity)
      try {
        await db.raw('SELECT 1');
        // Database is healthy - no alert needed
      } catch (error) {
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
  async getSystemHealth(): Promise<SystemHealth> {
    try {
      const now = Date.now();
      let databaseStatus: 'healthy' | 'warning' | 'error' = 'healthy';

      try {
        await db.raw('SELECT 1');
      } catch (error) {
        databaseStatus = 'error';
      }

      // Calculate API response time (mock - in real scenario, measure actual response time)
      const apiResponseTime = Math.round(Math.random() * 200) + 50;

      // Get storage usage (mock percentage)
      const storageUsage = Math.round(Math.random() * 60) + 20;

      // Count active users (online in last 5 minutes)
      const activeUsers = await db('users')
        .where('lastActivity', '>', new Date(Date.now() - 5 * 60 * 1000))
        .count('* as count')
        .first();

      return {
        databaseStatus,
        lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        apiResponseTime,
        storageUsage,
        activeUsers: activeUsers?.count || 0,
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
  async getAcademicPerformanceChart(): Promise<ChartData> {
    try {
      const classes = await db('classes')
        .select('id', 'name')
        .where({ isActive: true });

      const datasets = await Promise.all(
        classes.map(async (cls: any) => {
          const avgGrade = await db('grades')
            .join('enrollments', 'grades.studentId', 'enrollments.studentId')
            .where('enrollments.classId', cls.id)
            .avg('grades.grade as avg')
            .first();

          return {
            label: cls.name,
            data: [Math.round((avgGrade?.avg || 0) * 100) / 100],
          };
        })
      );

      return {
        labels: classes.map((c: any) => c.name),
        datasets: [{
          label: 'Average Grade',
          data: datasets.map(d => d.data[0]),
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
  async getAttendanceTrendChart(): Promise<ChartData> {
    try {
      const last30Days = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last30Days.push(date.toISOString().split('T')[0]);
      }

      const attendanceData = await Promise.all(
        last30Days.map(async (date) => {
          const total = await db('attendance')
            .whereRaw(`DATE(createdAt) = '${date}'`)
            .count('* as count')
            .first();

          const present = await db('attendance')
            .whereRaw(`DATE(createdAt) = '${date}'`)
            .where({ status: 'present' })
            .count('* as count')
            .first();

          const percentage = total?.count > 0
            ? ((present?.count || 0) / total.count) * 100
            : 0;

          return Math.round(percentage);
        })
      );

      return {
        labels: last30Days.map(d => d.split('-').slice(1).join('-')),
        datasets: [{
          label: 'Attendance Rate %',
          data: attendanceData,
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
  async getFeeCollectionChart(): Promise<ChartData> {
    try {
      const last12Months = [];
      const monthLabels = [];

      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        last12Months.push(date);
        monthLabels.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      }

      const feeData = await Promise.all(
        last12Months.map(async (date) => {
          const collection = await db('payments')
            .whereRaw("EXTRACT(YEAR FROM \"createdAt\") = EXTRACT(YEAR FROM ?)", [date])
            .whereRaw("EXTRACT(MONTH FROM \"createdAt\") = EXTRACT(MONTH FROM ?)", [date])
            .sum('amount as total')
            .first();

          return collection?.total || 0;
        })
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
  async getStudentDistributionChart(): Promise<ChartData> {
    try {
      const classDistribution = await db('enrollments')
        .join('classes', 'enrollments.classId', 'classes.id')
        .where('enrollments.status', 'active')
        .select('classes.name', db.raw('COUNT(*) as count'))
        .groupBy('classes.name')
        .orderBy('count', 'desc');

      return {
        labels: classDistribution.map((c: any) => c.name),
        datasets: [{
          label: 'Students per Class',
          data: classDistribution.map((c: any) => c.count),
          backgroundColor: [
            'rgba(37, 99, 235, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)',
            'rgba(139, 92, 246, 0.8)',
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
  async getStudentsAtRisk(limit: number = 10): Promise<StudentAtRiskData[]> {
    try {
      // Students with attendance < 75% OR grades < 40
      const atRiskStudents = await db.raw(`
        SELECT DISTINCT
          u.id,
          u.firstName || ' ' || u.lastName as name,
          u.rollNumber,
          c.name as className,
          COALESCE(AVG(g.grade), 0) as averageGrade,
          COALESCE(
            ROUND(COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric / NULLIF(COUNT(a.id), 0) * 100, 2),
            100
          ) as attendanceRate
        FROM users u
        JOIN enrollments e ON u.id = e.studentId
        JOIN classes c ON e.classId = c.id
        LEFT JOIN grades g ON u.id = g.studentId
        LEFT JOIN attendance a ON u.id = a.studentId AND a.createdAt > NOW() - INTERVAL '30 days'
        WHERE u.role = 'student' AND u.isActive = true
        AND (
          COALESCE(AVG(g.grade), 0) < 40
          OR COALESCE(COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric / NULLIF(COUNT(a.id), 0) * 100, 100) < 75
        )
        GROUP BY u.id, u.firstName, u.lastName, u.rollNumber, c.name
        ORDER BY averageGrade ASC, attendanceRate ASC
        LIMIT ?
      `, [limit]);

      return atRiskStudents.rows.map((student: any) => {
        const riskFactors: string[] = [];
        if (student.averageGrade < 40) riskFactors.push('Low Grades');
        if (student.attendanceRate < 75) riskFactors.push('Low Attendance');

        let severity: 'high' | 'medium' | 'low' = 'low';
        if (riskFactors.length === 2 || student.averageGrade < 30 || student.attendanceRate < 60) {
          severity = 'high';
        } else if (student.averageGrade < 40 || student.attendanceRate < 70) {
          severity = 'medium';
        }

        return {
          id: student.id,
          name: student.name,
          rollNumber: student.rollNumber,
          className: student.className,
          riskFactors,
          attendanceRate: student.attendanceRate,
          averageGrade: student.averageGrade,
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
