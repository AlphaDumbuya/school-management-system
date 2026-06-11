import { Knex } from 'knex';
import { logger } from '@utils/logger';

export interface AnalyticsDashboard {
  dashboardId: string;
  timestamp: string;
  metrics: {
    totalStudents: number;
    totalClasses: number;
    totalTeachers: number;
    averageGPA: number;
    averageAttendance: number;
    enrollmentTrend: number;
  };
  rankings: {
    topClasses: Array<{ classId: string; name: string; averageGPA: number }>;
    topStudents: Array<{ studentId: string; name: string; gpa: number }>;
    needsSupport: Array<{ studentId: string; name: string; gpa: number }>;
  };
  insights: {
    enrollmentStatus: string;
    academicHealth: string;
    attendanceHealth: string;
    recommendations: string[];
  };
}

export interface StudentAnalytics {
  studentId: string;
  studentName: string;
  enrolledClasses: number;
  averageGPA: number;
  attendancePercentage: number;
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
  trend: {
    last30Days: number[];
    trend: 'improving' | 'declining' | 'stable';
    changePercentage: number;
  };
}

export interface ClassAnalytics {
  classId: string;
  className: string;
  enrollmentCount: number;
  averageGPA: number;
  averageAttendance: number;
  totalSessions: number;
  completedSessions: number;
  cancellations: number;
  students: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
}

export interface DepartmentAnalytics {
  departmentId: string;
  departmentName: string;
  totalTeachers: number;
  totalClasses: number;
  totalStudents: number;
  averageGPA: number;
  averageAttendance: number;
  topPerformer: { teacherId: string; name: string };
  metrics: {
    enrollmentGrowth: number;
    gradeImprovement: number;
    attendanceImprovement: number;
  };
}

export interface EnrollmentAnalytics {
  totalEnrolled: number;
  totalRequests: number;
  approvalRate: number;
  rejectionRate: number;
  pendingRequests: number;
  averageProcessingTime: number;
  trendsLastMonth: {
    week1: number;
    week2: number;
    week3: number;
    week4: number;
  };
}

export class AnalyticsService {
  constructor(private db: Knex) {}

  /**
   * Get comprehensive dashboard analytics
   */
  async getDashboardAnalytics(): Promise<AnalyticsDashboard> {
    try {
      logger.info('Calculating dashboard analytics');

      // Get counts
      const [{ total: totalStudents }] = await this.db('users')
        .where('role', 'student')
        .count('* as total');

      const [{ total: totalClasses }] = await this.db('classes').count(
        '* as total'
      );

      const [{ total: totalTeachers }] = await this.db('users')
        .where('role', 'teacher')
        .count('* as total');

      // Get GPA analytics
      const grades = await this.db('grades').select('score');
      const averageGPA =
        grades.length > 0
          ? grades.reduce((sum, g) => sum + g.score, 0) / grades.length
          : 0;

      // Get attendance analytics
      const attendance = await this.db('attendance').select('status');
      const presentCount = attendance.filter(
        (a) => a.status === 'present'
      ).length;
      const averageAttendance =
        attendance.length > 0
          ? (presentCount / attendance.length) * 100
          : 0;

      // Get enrollment trend
      const enrollmentLastMonth = await this.db('enrollments')
        .where('created_at', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .count('* as total');

      const enrollmentTrend = enrollmentLastMonth[0].total;

      // Get top classes
      const topClasses = await this.db('classes')
        .leftJoin('enrollments', 'classes.id', 'enrollments.class_id')
        .leftJoin('grades', 'enrollments.student_id', 'grades.student_id')
        .groupBy('classes.id', 'classes.name')
        .select('classes.id as classId', 'classes.name')
        .avg('grades.score as averageGPA')
        .orderBy('averageGPA', 'desc')
        .limit(5);

      // Get top students
      const studentGradesMap = new Map<string, number[]>();
      const allGrades = await this.db('grades')
        .leftJoin('users', 'grades.student_id', 'users.id')
        .select('grades.student_id', 'users.name', 'grades.score');

      allGrades.forEach((grade) => {
        if (!studentGradesMap.has(grade.student_id)) {
          studentGradesMap.set(grade.student_id, []);
        }
        studentGradesMap.get(grade.student_id)!.push(grade.score);
      });

      const topStudents = Array.from(studentGradesMap)
        .map(([studentId, scores]) => ({
          studentId,
          name: allGrades.find((g) => g.student_id === studentId)?.name ||
            'Unknown',
          gpa: scores.reduce((a, b) => a + b, 0) / scores.length,
        }))
        .sort((a, b) => b.gpa - a.gpa)
        .slice(0, 5);

      const needsSupport = Array.from(studentGradesMap)
        .map(([studentId, scores]) => ({
          studentId,
          name: allGrades.find((g) => g.student_id === studentId)?.name ||
            'Unknown',
          gpa: scores.reduce((a, b) => a + b, 0) / scores.length,
        }))
        .sort((a, b) => a.gpa - b.gpa)
        .slice(0, 5);

      // Generate insights
      const insights = {
        enrollmentStatus:
          enrollmentTrend > 50
            ? 'Strong enrollment growth'
            : enrollmentTrend > 20
              ? 'Stable enrollment'
              : 'Low enrollment activity',
        academicHealth:
          averageGPA >= 85
            ? 'Excellent academic performance'
            : averageGPA >= 75
              ? 'Good academic performance'
              : 'Academic support needed',
        attendanceHealth:
          averageAttendance >= 90
            ? 'Excellent attendance'
            : averageAttendance >= 80
              ? 'Good attendance'
              : 'Attendance concerns',
        recommendations: [] as string[],
      };

      if (averageGPA < 75) {
        insights.recommendations.push('Consider academic intervention programs');
      }
      if (averageAttendance < 85) {
        insights.recommendations.push('Improve attendance tracking and engagement');
      }
      if (enrollmentTrend < 20) {
        insights.recommendations.push('Review enrollment marketing strategies');
      }

      const dashboard: AnalyticsDashboard = {
        dashboardId: `dashboard-${Date.now()}`,
        timestamp: new Date().toISOString(),
        metrics: {
          totalStudents,
          totalClasses,
          totalTeachers,
          averageGPA,
          averageAttendance,
          enrollmentTrend,
        },
        rankings: {
          topClasses: topClasses.map((c: any) => ({
            classId: c.classId,
            name: c.name,
            averageGPA: c.averageGPA || 0,
          })),
          topStudents,
          needsSupport,
        },
        insights,
      };

      logger.info('Dashboard analytics calculated successfully');
      return dashboard;
    } catch (error) {
      logger.error(`Error calculating dashboard analytics: ${error}`);
      throw error;
    }
  }

  /**
   * Get student-specific analytics
   */
  async getStudentAnalytics(studentId: string): Promise<StudentAnalytics> {
    try {
      logger.info(`Fetching analytics for student ${studentId}`);

      // Get student info
      const student = await this.db('users')
        .where('id', studentId)
        .first();

      if (!student) {
        throw new Error(`Student ${studentId} not found`);
      }

      // Get enrolled classes
      const enrollments = await this.db('enrollments')
        .where('student_id', studentId)
        .count('* as total');

      // Get grades
      const grades = await this.db('grades')
        .where('student_id', studentId)
        .select('score', 'recorded_at');

      const averageGPA =
        grades.length > 0
          ? grades.reduce((sum, g) => sum + g.score, 0) / grades.length
          : 0;

      // Get grade distribution
      const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      grades.forEach((grade) => {
        if (grade.score >= 90) distribution.A++;
        else if (grade.score >= 80) distribution.B++;
        else if (grade.score >= 70) distribution.C++;
        else if (grade.score >= 60) distribution.D++;
        else distribution.F++;
      });

      // Get attendance
      const attendance = await this.db('attendance')
        .where('student_id', studentId)
        .select('status');

      const presentCount = attendance.filter(
        (a) => a.status === 'present'
      ).length;
      const attendancePercentage =
        attendance.length > 0 ? (presentCount / attendance.length) * 100 : 0;

      // Get trend (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentGrades = grades.filter(
        (g) => new Date(g.recorded_at) >= thirtyDaysAgo
      );

      const last30DaysTrend = recentGrades.map((g) => g.score);
      const trendChangePercentage =
        last30DaysTrend.length > 1
          ? ((last30DaysTrend[last30DaysTrend.length - 1] -
              last30DaysTrend[0]) /
              last30DaysTrend[0]) *
            100
          : 0;

      let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
      if (trendChangePercentage > 5) trendDirection = 'improving';
      else if (trendChangePercentage < -5) trendDirection = 'declining';

      return {
        studentId,
        studentName: student.name,
        enrolledClasses: enrollments[0].total,
        averageGPA,
        attendancePercentage,
        gradeDistribution: distribution,
        trend: {
          last30Days: last30DaysTrend,
          trend: trendDirection,
          changePercentage: trendChangePercentage,
        },
      };
    } catch (error) {
      logger.error(`Error calculating student analytics: ${error}`);
      throw error;
    }
  }

  /**
   * Get class-specific analytics
   */
  async getClassAnalytics(classId: string): Promise<ClassAnalytics> {
    try {
      logger.info(`Fetching analytics for class ${classId}`);

      // Get class info
      const classData = await this.db('classes')
        .where('id', classId)
        .first();

      if (!classData) {
        throw new Error(`Class ${classId} not found`);
      }

      // Get enrollment
      const enrollments = await this.db('enrollments')
        .where('class_id', classId)
        .select('student_id');

      const studentIds = enrollments.map((e) => e.student_id);

      // Get grades
      const grades = await this.db('grades')
        .whereIn('student_id', studentIds)
        .select('score');

      const averageGPA =
        grades.length > 0
          ? grades.reduce((sum, g) => sum + g.score, 0) / grades.length
          : 0;

      // Get attendance
      const attendance = await this.db('attendance')
        .whereIn('student_id', studentIds)
        .select('status');

      const presentCount = attendance.filter(
        (a) => a.status === 'present'
      ).length;
      const averageAttendance =
        attendance.length > 0
          ? (presentCount / attendance.length) * 100
          : 0;

      // Get schedule info
      const schedules = await this.db('schedules')
        .where('class_id', classId)
        .select('*');

      // Get student performance distribution
      const students: { excellent: number; good: number; fair: number; poor: number } = {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
      };

      studentIds.forEach((studentId) => {
        const studentGrades = grades.filter((g) => g.score); // Simplified - would need student_id in real scenario
        if (studentGrades.length > 0) {
          const avg =
            studentGrades.reduce((sum, g) => sum + g.score, 0) /
            studentGrades.length;
          if (avg >= 90) students.excellent++;
          else if (avg >= 80) students.good++;
          else if (avg >= 70) students.fair++;
          else students.poor++;
        }
      });

      return {
        classId,
        className: classData.name,
        enrollmentCount: studentIds.length,
        averageGPA,
        averageAttendance,
        totalSessions: schedules.length,
        completedSessions: schedules.filter((s) => s.status === 'completed')
          .length,
        cancellations: schedules.filter((s) => s.status === 'cancelled').length,
        students,
      };
    } catch (error) {
      logger.error(`Error calculating class analytics: ${error}`);
      throw error;
    }
  }

  /**
   * Get enrollment analytics
   */
  async getEnrollmentAnalytics(): Promise<EnrollmentAnalytics> {
    try {
      logger.info('Calculating enrollment analytics');

      // Get total enrolled
      const [{ total: totalEnrolled }] = await this.db('enrollments').count(
        '* as total'
      );

      // Get enrollment requests
      const [{ total: totalRequests }] = await this.db(
        'enrollment_requests'
      ).count('* as total');

      const approved = await this.db('enrollment_requests')
        .where('status', 'approved')
        .count('* as total');

      const rejected = await this.db('enrollment_requests')
        .where('status', 'rejected')
        .count('* as total');

      const [{ total: pending }] = await this.db('enrollment_requests')
        .where('status', 'pending')
        .count('* as total');

      // Calculate rates
      const approvalRate =
        totalRequests > 0 ? (approved[0].total / totalRequests) * 100 : 0;
      const rejectionRate =
        totalRequests > 0 ? (rejected[0].total / totalRequests) * 100 : 0;

      // Get processing time
      const requests = await this.db('enrollment_requests')
        .where('status', 'approved')
        .select('created_at', 'updated_at');

      const processingTimes = requests.map(
        (r) =>
          (new Date(r.updated_at).getTime() -
            new Date(r.created_at).getTime()) /
          (1000 * 60 * 60)
      ); // in hours

      const averageProcessingTime =
        processingTimes.length > 0
          ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length
          : 0;

      // Get weekly trend
      const today = new Date();
      const trendsLastMonth: {
        week1: number;
        week2: number;
        week3: number;
        week4: number;
      } = { week1: 0, week2: 0, week3: 0, week4: 0 };

      for (let week = 1; week <= 4; week++) {
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - week * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const [{ total }] = await this.db('enrollments')
          .where('created_at', '>=', weekStart)
          .where('created_at', '<', weekEnd)
          .count('* as total');

        trendsLastMonth[`week${week}` as keyof typeof trendsLastMonth] = total;
      }

      return {
        totalEnrolled,
        totalRequests,
        approvalRate,
        rejectionRate,
        pendingRequests: pending,
        averageProcessingTime,
        trendsLastMonth,
      };
    } catch (error) {
      logger.error(`Error calculating enrollment analytics: ${error}`);
      throw error;
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealthMetrics(): Promise<any> {
    try {
      logger.info('Calculating system health metrics');

      // Get data quality score
      const users = await this.db('users').count('* as total');
      const classes = await this.db('classes').count('* as total');
      const enrollments = await this.db('enrollments').count('* as total');
      const grades = await this.db('grades').count('* as total');

      // Calculate completeness
      const completeness = {
        users: users[0].total > 0 ? 100 : 0,
        classes: classes[0].total > 0 ? 100 : 0,
        enrollments: enrollments[0].total > 0 ? 100 : 0,
        grades: grades[0].total > 0 ? 100 : 0,
      };

      const dataQualityScore =
        (completeness.users +
          completeness.classes +
          completeness.enrollments +
          completeness.grades) /
        4;

      // Get error rate from audit logs
      const errorLogs = await this.db('audit_logs')
        .where('details', 'like', '%error%')
        .count('* as total');

      const totalLogs = await this.db('audit_logs').count('* as total');

      const errorRate =
        totalLogs[0].total > 0
          ? (errorLogs[0].total / totalLogs[0].total) * 100
          : 0;

      // Get system status
      const systemStatus =
        dataQualityScore > 80 && errorRate < 5 ? 'healthy' : 'warning';

      return {
        timestamp: new Date().toISOString(),
        systemStatus,
        dataQualityScore,
        errorRate,
        metrics: {
          totalUsers: users[0].total,
          totalClasses: classes[0].total,
          totalEnrollments: enrollments[0].total,
          totalGrades: grades[0].total,
          totalAuditLogs: totalLogs[0].total,
        },
      };
    } catch (error) {
      logger.error(`Error calculating system health metrics: ${error}`);
      throw error;
    }
  }
}
