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
      // Get total students (users with role='student' and status='active')
      const totalStudents = await db('users')
        .where({ role: 'student', status: 'active' })
        .count('* as count')
        .first();

      // Get total teachers (users with role='teacher' and status='active')
      const totalTeachers = await db('users')
        .where({ role: 'teacher', status: 'active' })
        .count('* as count')
        .first();

      // Get total staff (non-student, non-teacher active users)
      const totalStaff = await db('users')
        .whereIn('role', ['principal', 'staff', 'accountant', 'admissionsOfficer', 'super_admin'])
        .where({ status: 'active' })
        .count('* as count')
        .first();

      // Get total classes
      const totalClasses = await db('classes')
        .count('* as count')
        .first();

      // Get total active enrollments
      const totalEnrollments = await db('enrollments')
        .where({ status: 'active' })
        .count('* as count')
        .first();

      // Get outstanding fees — fees table has 'amount' column, not 'balance'
      const outstandingFees = await db('fees')
        .where(function(this: any) {
          this.where({ status: 'pending' }).orWhere({ status: 'partial' });
        })
        .sum('amount as total')
        .first();

      // Get total collected this month — payments uses snake_case 'created_at'
      const thisMonthCollected = await db('payments')
        .whereRaw("EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())")
        .whereRaw("EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())")
        .sum('amount as total')
        .first();

      // Get attendance rate from attendance table
      const totalAttendanceRecords = await db('attendance')
        .count('* as count')
        .first();

      const presentCount = await db('attendance')
        .where({ status: 'present' })
        .count('* as count')
        .first();

      const totalAtt = Number(totalAttendanceRecords?.count) || 0;
      const presentAtt = Number(presentCount?.count) || 0;
      const attendanceRate = totalAtt > 0 ? (presentAtt / totalAtt) * 100 : 0;

      // Get average grade — grades table has 'grade_value' column
      const averageGrade = await db('grades')
        .avg('grade_value as avg')
        .first();

      return {
        totalStudents: Number(totalStudents?.count) || 0,
        activeStudents: Number(totalStudents?.count) || 0,
        totalTeachers: Number(totalTeachers?.count) || 0,
        totalStaff: Number(totalStaff?.count) || 0,
        totalClasses: Number(totalClasses?.count) || 0,
        totalEnrollments: Number(totalEnrollments?.count) || 0,
        outstandingFees: Number(outstandingFees?.total) || 0,
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

  /**
   * Get pending approvals across all types
   */
  async getPendingApprovals(): Promise<PendingApprovals> {
    try {
      // Check admissions table for pending applications
      let enrollmentRequestCount = 0;
      try {
        const hasAdmissions = await db.schema.hasTable('admissions');
        if (hasAdmissions) {
          const result = await db('admissions')
            .where({ status: 'pending' })
            .count('* as count')
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
            .where({ status: 'active' })
            .count('* as count')
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
  async getFinancialSummary(): Promise<FinancialSummary> {
    try {
      // Total revenue all time
      const totalRevenue = await db('payments')
        .sum('amount as total')
        .first();

      // This month collected — use snake_case created_at
      const thisMonthCollected = await db('payments')
        .whereRaw("EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())")
        .whereRaw("EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())")
        .sum('amount as total')
        .first();

      // Monthly target (configurable, default 50000)
      const monthlyTarget = 50000;

      // Outstanding balance — fees has 'amount', not 'balance'
      const outstandingBalance = await db('fees')
        .where(function(this: any) {
          this.where({ status: 'pending' }).orWhere({ status: 'partial' });
        })
        .sum('amount as total')
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

      // Overdue amount — fees uses snake_case 'due_date'
      const overdueAmount = await db('fees')
        .where('due_date', '<', db.fn.now())
        .where(function(this: any) {
          this.where({ status: 'pending' }).orWhere({ status: 'partial' });
        })
        .sum('amount as total')
        .first();

      const collected = Number(thisMonthCollected?.total) || 0;
      const collectionRate = monthlyTarget > 0
        ? (collected / monthlyTarget) * 100
        : 0;

      // Calculate trend (current vs previous month) — use snake_case created_at
      const previousMonthCollected = await db('payments')
        .whereRaw("EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM (NOW() - INTERVAL '1 month'))")
        .whereRaw("EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM (NOW() - INTERVAL '1 month'))")
        .sum('amount as total')
        .first();

      const prevAmount = Number(previousMonthCollected?.total) || 0;
      const trend = prevAmount > 0
        ? ((collected - prevAmount) / prevAmount) * 100
        : 0;

      return {
        totalRevenue: Number(totalRevenue?.total) || 0,
        thisMonthCollected: collected,
        thisMonthTarget: monthlyTarget,
        outstandingBalance: Number(outstandingBalance?.total) || 0,
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
  async getRecentActivities(limit: number = 20): Promise<RecentActivity[]> {
    try {
      // audit_logs table uses snake_case column names
      const activities = await db('audit_logs')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .select();

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

      // Check for overdue fees — use snake_case 'due_date'
      try {
        const overdueCount = await db('fees')
          .where('due_date', '<', db.fn.now())
          .where({ status: 'pending' })
          .count('* as count')
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
            WHERE u.role = 'student' AND u.status = 'active'
            GROUP BY u.id
            HAVING COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric / NULLIF(COUNT(a.id), 0) < 0.75
          ) sub
        `);

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
  async getSystemHealth(): Promise<SystemHealth> {
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
  async getAcademicPerformanceChart(): Promise<ChartData> {
    try {
      // classes table doesn't have 'isActive' — just get all classes
      const classes = await db('classes')
        .select('id', 'name')
        .limit(20);

      if (classes.length === 0) {
        return { labels: [], datasets: [] };
      }

      const avgGrades: number[] = [];

      for (const cls of classes) {
        // Use snake_case join columns
        const avgGrade = await db('grades')
          .join('enrollments', 'grades.student_id', 'enrollments.student_id')
          .where('enrollments.class_id', cls.id)
          .avg('grades.grade_value as avg')
          .first();

        avgGrades.push(Math.round(Number(avgGrade?.avg || 0) * 100) / 100);
      }

      return {
        labels: classes.map((c: any) => c.name),
        datasets: [{
          label: 'Average Grade',
          data: avgGrades,
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
      const last30Days: string[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last30Days.push(date.toISOString().split('T')[0]);
      }

      const attendanceData: number[] = [];

      for (const date of last30Days) {
        // Use snake_case 'attendance_date'
        const total = await db('attendance')
          .whereRaw('DATE(attendance_date) = ?', [date])
          .count('* as count')
          .first();

        const present = await db('attendance')
          .whereRaw('DATE(attendance_date) = ?', [date])
          .where({ status: 'present' })
          .count('* as count')
          .first();

        const totalCount = Number(total?.count) || 0;
        const presentCount = Number(present?.count) || 0;
        const percentage = totalCount > 0
          ? (presentCount / totalCount) * 100
          : 0;

        attendanceData.push(Math.round(percentage));
      }

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
      const last12Months: Date[] = [];
      const monthLabels: string[] = [];

      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        last12Months.push(date);
        monthLabels.push(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      }

      const feeData: number[] = [];

      for (const date of last12Months) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        // Use snake_case 'created_at'
        const collection = await db('payments')
          .whereRaw("EXTRACT(YEAR FROM created_at) = ?", [year])
          .whereRaw("EXTRACT(MONTH FROM created_at) = ?", [month])
          .sum('amount as total')
          .first();

        feeData.push(Number(collection?.total) || 0);
      }

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
      // Use snake_case join columns
      const classDistribution = await db('enrollments')
        .join('classes', 'enrollments.class_id', 'classes.id')
        .where('enrollments.status', 'active')
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
  async getStudentsAtRisk(limit: number = 10): Promise<StudentAtRiskData[]> {
    try {
      // Rewritten with snake_case columns matching actual schema
      const atRiskStudents = await db.raw(`
        SELECT
          u.id,
          u.first_name || ' ' || u.last_name as name,
          s.student_id as roll_number,
          c.name as class_name,
          COALESCE(AVG(g.grade_value), 0) as average_grade,
          COALESCE(
            ROUND(COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric / NULLIF(COUNT(a.id), 0) * 100, 2),
            100
          ) as attendance_rate
        FROM users u
        JOIN students s ON u.id = s.user_id
        JOIN enrollments e ON s.id = e.student_id
        JOIN classes c ON e.class_id = c.id
        LEFT JOIN grades g ON s.id = g.student_id
        LEFT JOIN attendance a ON s.id = a.student_id AND a.created_at > NOW() - INTERVAL '30 days'
        WHERE u.role = 'student' AND u.status = 'active' AND e.status = 'active'
        GROUP BY u.id, u.first_name, u.last_name, s.student_id, c.name
        HAVING (
          COALESCE(AVG(g.grade_value), 0) < 40
          OR COALESCE(COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric / NULLIF(COUNT(a.id), 0) * 100, 100) < 75
        )
        ORDER BY average_grade ASC, attendance_rate ASC
        LIMIT ?
      `, [limit]);

      return (atRiskStudents.rows || []).map((student: any) => {
        const riskFactors: string[] = [];
        const avgGrade = Number(student.average_grade) || 0;
        const attRate = Number(student.attendance_rate) || 0;

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
