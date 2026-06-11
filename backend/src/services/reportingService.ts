import { Knex } from 'knex';
import { logger } from '@utils/logger';
import { AuditService } from './auditService';

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  classId?: string;
  studentId?: string;
  teacherId?: string;
  format?: 'json' | 'csv' | 'pdf';
  includeMetrics?: boolean;
}

export interface GradeReport {
  reportId: string;
  classId: string;
  className: string;
  studentCount: number;
  averageGPA: number;
  highestGPA: number;
  lowestGPA: number;
  distribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
  generatedAt: string;
  generatedBy: string;
}

export interface AttendanceReport {
  reportId: string;
  classId: string;
  className: string;
  studentCount: number;
  averageAttendance: number;
  absentDays: number;
  lateDays: number;
  excellentAttendance: number;
  poorAttendance: number;
  generatedAt: string;
  generatedBy: string;
}

export interface PerformanceReport {
  reportId: string;
  studentId: string;
  studentName: string;
  enrolledClasses: number;
  averageGPA: number;
  attendancePercentage: number;
  improvementTrend: string;
  strengths: string[];
  areasForImprovement: string[];
  generatedAt: string;
}

export interface ClassPerformanceReport {
  reportId: string;
  classId: string;
  className: string;
  totalEnrolled: number;
  averageGPA: number;
  averageAttendance: number;
  topPerformers: Array<{ studentId: string; name: string; gpa: number }>;
  needsSupport: Array<{ studentId: string; name: string; gpa: number }>;
  generatedAt: string;
}

export interface ScheduleUtilizationReport {
  reportId: string;
  academicPeriod: string;
  totalScheduledClasses: number;
  averageClassSize: number;
  roomUtilization: number;
  peakHours: string[];
  conflicts: number;
  generatedAt: string;
}

export class ReportingService {
  private auditService: AuditService;

  constructor(private db: Knex) {
    this.auditService = new AuditService(db);
  }

  /**
   * Generate grade report for a class
   */
  async generateGradeReport(
    classId: string,
    filters: ReportFilters,
    userId: string
  ): Promise<GradeReport> {
    try {
      logger.info(`Generating grade report for class ${classId}`);

      // Get class information
      const classData = await this.db('classes')
        .where('id', classId)
        .first();

      if (!classData) {
        throw new Error(`Class ${classId} not found`);
      }

      // Get students in class
      const students = await this.db('enrollments')
        .where('class_id', classId)
        .select('student_id');

      const studentIds = students.map((s) => s.student_id);

      if (studentIds.length === 0) {
        return {
          reportId: `grade-${classId}-${Date.now()}`,
          classId,
          className: classData.name,
          studentCount: 0,
          averageGPA: 0,
          highestGPA: 0,
          lowestGPA: 0,
          distribution: { A: 0, B: 0, C: 0, D: 0, F: 0 },
          generatedAt: new Date().toISOString(),
          generatedBy: userId,
        };
      }

      // Get grades for students
      let query = this.db('grades').whereIn('student_id', studentIds);

      if (filters.startDate) {
        query = query.where('recorded_at', '>=', new Date(filters.startDate));
      }

      if (filters.endDate) {
        query = query.where('recorded_at', '<=', new Date(filters.endDate));
      }

      const grades = await query.select('score', 'student_id');

      // Calculate GPA for each student
      const studentGPAs: { [key: string]: number[] } = {};
      grades.forEach((grade) => {
        if (!studentGPAs[grade.student_id]) {
          studentGPAs[grade.student_id] = [];
        }
        studentGPAs[grade.student_id].push(grade.score);
      });

      const studentAverages = Object.values(studentGPAs).map((scores) =>
        scores.reduce((a, b) => a + b, 0) / scores.length
      );

      // Calculate letter grade distribution
      const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
      studentAverages.forEach((avg) => {
        if (avg >= 90) distribution.A++;
        else if (avg >= 80) distribution.B++;
        else if (avg >= 70) distribution.C++;
        else if (avg >= 60) distribution.D++;
        else distribution.F++;
      });

      // Create report
      const report: GradeReport = {
        reportId: `grade-${classId}-${Date.now()}`,
        classId,
        className: classData.name,
        studentCount: studentIds.length,
        averageGPA:
          studentAverages.length > 0
            ? studentAverages.reduce((a, b) => a + b, 0) /
              studentAverages.length
            : 0,
        highestGPA: Math.max(...studentAverages, 0),
        lowestGPA: Math.min(...studentAverages, 100),
        distribution,
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
      };

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'report',
        entityId: report.reportId,
        action: 'generate',
        performedBy: userId,
        details: {
          type: 'grade_report',
          classId,
          studentCount: report.studentCount,
        },
        timestamp: new Date(),
      });

      return report;
    } catch (error) {
      logger.error(`Error generating grade report: ${error}`);
      throw error;
    }
  }

  /**
   * Generate attendance report for a class
   */
  async generateAttendanceReport(
    classId: string,
    filters: ReportFilters,
    userId: string
  ): Promise<AttendanceReport> {
    try {
      logger.info(`Generating attendance report for class ${classId}`);

      // Get class information
      const classData = await this.db('classes')
        .where('id', classId)
        .first();

      if (!classData) {
        throw new Error(`Class ${classId} not found`);
      }

      // Get students in class
      const students = await this.db('enrollments')
        .where('class_id', classId)
        .select('student_id');

      const studentIds = students.map((s) => s.student_id);

      if (studentIds.length === 0) {
        return {
          reportId: `attendance-${classId}-${Date.now()}`,
          classId,
          className: classData.name,
          studentCount: 0,
          averageAttendance: 0,
          absentDays: 0,
          lateDays: 0,
          excellentAttendance: 0,
          poorAttendance: 0,
          generatedAt: new Date().toISOString(),
          generatedBy: userId,
        };
      }

      // Get attendance records
      let query = this.db('attendance').whereIn('student_id', studentIds);

      if (filters.startDate) {
        query = query.where('date', '>=', new Date(filters.startDate));
      }

      if (filters.endDate) {
        query = query.where('date', '<=', new Date(filters.endDate));
      }

      const records = await query.select('status', 'student_id');

      // Calculate statistics
      const studentAttendance: { [key: string]: { present: number; absent: number; late: number } } = {};

      records.forEach((record) => {
        if (!studentAttendance[record.student_id]) {
          studentAttendance[record.student_id] = { present: 0, absent: 0, late: 0 };
        }

        if (record.status === 'present') {
          studentAttendance[record.student_id].present++;
        } else if (record.status === 'absent') {
          studentAttendance[record.student_id].absent++;
        } else if (record.status === 'late') {
          studentAttendance[record.student_id].late++;
        }
      });

      // Calculate percentages
      const percentages: number[] = [];
      let excellentCount = 0;
      let poorCount = 0;
      let totalAbsent = 0;
      let totalLate = 0;

      Object.values(studentAttendance).forEach((attendance) => {
        const total =
          attendance.present + attendance.absent + attendance.late;
        const percentage = (attendance.present / total) * 100;
        percentages.push(percentage);

        if (percentage >= 95) excellentCount++;
        if (percentage < 75) poorCount++;

        totalAbsent += attendance.absent;
        totalLate += attendance.late;
      });

      // Create report
      const report: AttendanceReport = {
        reportId: `attendance-${classId}-${Date.now()}`,
        classId,
        className: classData.name,
        studentCount: studentIds.length,
        averageAttendance:
          percentages.length > 0
            ? percentages.reduce((a, b) => a + b, 0) / percentages.length
            : 0,
        absentDays: totalAbsent,
        lateDays: totalLate,
        excellentAttendance: excellentCount,
        poorAttendance: poorCount,
        generatedAt: new Date().toISOString(),
        generatedBy: userId,
      };

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'report',
        entityId: report.reportId,
        action: 'generate',
        performedBy: userId,
        details: {
          type: 'attendance_report',
          classId,
          studentCount: report.studentCount,
        },
        timestamp: new Date(),
      });

      return report;
    } catch (error) {
      logger.error(`Error generating attendance report: ${error}`);
      throw error;
    }
  }

  /**
   * Generate performance report for a student
   */
  async generateStudentPerformanceReport(
    studentId: string,
    userId: string
  ): Promise<PerformanceReport> {
    try {
      logger.info(`Generating performance report for student ${studentId}`);

      // Get student information
      const student = await this.db('users')
        .where('id', studentId)
        .where('role', 'student')
        .first();

      if (!student) {
        throw new Error(`Student ${studentId} not found`);
      }

      // Get enrolled classes
      const enrollments = await this.db('enrollments')
        .where('student_id', studentId)
        .select('class_id');

      // Get grades
      const grades = await this.db('grades')
        .where('student_id', studentId)
        .select('score', 'recorded_at');

      const classCount = enrollments.length;
      const averageGPA =
        grades.length > 0
          ? grades.reduce((sum, g) => sum + g.score, 0) / grades.length
          : 0;

      // Get attendance
      const attendance = await this.db('attendance')
        .where('student_id', studentId)
        .select('status');

      const totalRecords =
        attendance.filter((a) => a.status !== 'absent').length +
        attendance.filter((a) => a.status === 'absent').length;

      const attendancePercentage =
        totalRecords > 0
          ? (attendance.filter((a) => a.status !== 'absent').length /
              totalRecords) *
            100
          : 0;

      // Determine trend
      let improvementTrend = 'stable';
      if (grades.length >= 5) {
        const recent = grades.slice(-5).map((g) => g.score);
        const older = grades.slice(-10, -5).map((g) => g.score);
        const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
        const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

        if (recentAvg > olderAvg + 5) improvementTrend = 'improving';
        else if (recentAvg < olderAvg - 5) improvementTrend = 'declining';
      }

      // Determine strengths and areas for improvement
      const strengths: string[] = [];
      const areasForImprovement: string[] = [];

      if (averageGPA >= 90) strengths.push('Outstanding academic performance');
      if (averageGPA >= 80 && averageGPA < 90)
        strengths.push('Strong academic performance');
      if (attendancePercentage >= 95) strengths.push('Excellent attendance');
      if (attendancePercentage >= 85 && attendancePercentage < 95)
        strengths.push('Good attendance record');

      if (averageGPA < 70)
        areasForImprovement.push('Academic performance needs improvement');
      if (attendancePercentage < 80)
        areasForImprovement.push('Attendance consistency needed');
      if (improvementTrend === 'declining')
        areasForImprovement.push('Performance trending downward');

      // Create report
      const report: PerformanceReport = {
        reportId: `performance-${studentId}-${Date.now()}`,
        studentId,
        studentName: student.name,
        enrolledClasses: classCount,
        averageGPA,
        attendancePercentage,
        improvementTrend,
        strengths,
        areasForImprovement,
        generatedAt: new Date().toISOString(),
      };

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'report',
        entityId: report.reportId,
        action: 'generate',
        performedBy: userId,
        details: {
          type: 'performance_report',
          studentId,
          averageGPA: report.averageGPA,
        },
        timestamp: new Date(),
      });

      return report;
    } catch (error) {
      logger.error(`Error generating performance report: ${error}`);
      throw error;
    }
  }

  /**
   * Generate class performance summary
   */
  async generateClassPerformanceReport(
    classId: string,
    userId: string
  ): Promise<ClassPerformanceReport> {
    try {
      logger.info(`Generating class performance report for class ${classId}`);

      // Get class info
      const classData = await this.db('classes')
        .where('id', classId)
        .first();

      if (!classData) {
        throw new Error(`Class ${classId} not found`);
      }

      // Get enrolled students
      const enrollments = await this.db('enrollments')
        .where('class_id', classId)
        .select('student_id');

      const studentIds = enrollments.map((e) => e.student_id);

      if (studentIds.length === 0) {
        return {
          reportId: `class-perf-${classId}-${Date.now()}`,
          classId,
          className: classData.name,
          totalEnrolled: 0,
          averageGPA: 0,
          averageAttendance: 0,
          topPerformers: [],
          needsSupport: [],
          generatedAt: new Date().toISOString(),
        };
      }

      // Get student GPAs
      const studentGrades = await this.db('grades')
        .whereIn('student_id', studentIds)
        .select('student_id', 'score');

      const studentGPAMap: { [key: string]: number[] } = {};
      studentGrades.forEach((grade) => {
        if (!studentGPAMap[grade.student_id]) {
          studentGPAMap[grade.student_id] = [];
        }
        studentGPAMap[grade.student_id].push(grade.score);
      });

      const studentAverages = Object.entries(studentGPAMap)
        .map(([studentId, scores]) => ({
          studentId,
          gpa: scores.reduce((a, b) => a + b, 0) / scores.length,
        }))
        .sort((a, b) => b.gpa - a.gpa);

      // Get student names
      const students = await this.db('users')
        .whereIn('id', studentIds)
        .select('id', 'name');

      const studentNameMap = Object.fromEntries(
        students.map((s) => [s.id, s.name])
      );

      // Get attendance
      const attendance = await this.db('attendance')
        .whereIn('student_id', studentIds)
        .select('student_id', 'status');

      const studentAttendanceMap: {
        [key: string]: { present: number; total: number };
      } = {};
      attendance.forEach((record) => {
        if (!studentAttendanceMap[record.student_id]) {
          studentAttendanceMap[record.student_id] = { present: 0, total: 0 };
        }
        studentAttendanceMap[record.student_id].total++;
        if (record.status === 'present') {
          studentAttendanceMap[record.student_id].present++;
        }
      });

      const attendancePercentages = Object.values(
        studentAttendanceMap
      ).map((a) => (a.present / a.total) * 100);

      // Create report
      const report: ClassPerformanceReport = {
        reportId: `class-perf-${classId}-${Date.now()}`,
        classId,
        className: classData.name,
        totalEnrolled: studentIds.length,
        averageGPA:
          studentAverages.length > 0
            ? studentAverages.reduce((sum, s) => sum + s.gpa, 0) /
              studentAverages.length
            : 0,
        averageAttendance:
          attendancePercentages.length > 0
            ? attendancePercentages.reduce((a, b) => a + b, 0) /
              attendancePercentages.length
            : 0,
        topPerformers: studentAverages
          .slice(0, 3)
          .map((s) => ({
            studentId: s.studentId,
            name: studentNameMap[s.studentId] || 'Unknown',
            gpa: s.gpa,
          })),
        needsSupport: studentAverages
          .slice(-3)
          .reverse()
          .map((s) => ({
            studentId: s.studentId,
            name: studentNameMap[s.studentId] || 'Unknown',
            gpa: s.gpa,
          })),
        generatedAt: new Date().toISOString(),
      };

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'report',
        entityId: report.reportId,
        action: 'generate',
        performedBy: userId,
        details: {
          type: 'class_performance_report',
          classId,
          studentCount: report.totalEnrolled,
        },
        timestamp: new Date(),
      });

      return report;
    } catch (error) {
      logger.error(`Error generating class performance report: ${error}`);
      throw error;
    }
  }

  /**
   * Generate schedule utilization report
   */
  async generateScheduleUtilizationReport(
    academicPeriod: string,
    userId: string
  ): Promise<ScheduleUtilizationReport> {
    try {
      logger.info(
        `Generating schedule utilization report for period ${academicPeriod}`
      );

      // Get all schedules for period
      const schedules = await this.db('schedules')
        .where('academic_period', academicPeriod)
        .select('*');

      if (schedules.length === 0) {
        return {
          reportId: `schedule-util-${academicPeriod}-${Date.now()}`,
          academicPeriod,
          totalScheduledClasses: 0,
          averageClassSize: 0,
          roomUtilization: 0,
          peakHours: [],
          conflicts: 0,
          generatedAt: new Date().toISOString(),
        };
      }

      // Get enrollments for class sizes
      const classIds = schedules.map((s) => s.class_id);
      const enrollments = await this.db('enrollments')
        .whereIn('class_id', classIds)
        .select('class_id');

      const classSizeMap: { [key: string]: number } = {};
      enrollments.forEach((e) => {
        classSizeMap[e.class_id] = (classSizeMap[e.class_id] || 0) + 1;
      });

      const classSizes = Object.values(classSizeMap);
      const averageClassSize =
        classSizes.length > 0
          ? classSizes.reduce((a, b) => a + b, 0) / classSizes.length
          : 0;

      // Calculate peak hours
      const hourCount: { [key: string]: number } = {};
      schedules.forEach((schedule) => {
        const hour = schedule.start_time.split(':')[0];
        hourCount[hour] = (hourCount[hour] || 0) + 1;
      });

      const peakHours = Object.entries(hourCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((h) => `${h[0]}:00`);

      // Check for conflicts
      let conflictCount = 0;
      for (let i = 0; i < schedules.length; i++) {
        for (let j = i + 1; j < schedules.length; j++) {
          const s1 = schedules[i];
          const s2 = schedules[j];

          // Check if same class at same time
          if (
            s1.class_id === s2.class_id &&
            s1.start_time === s2.start_time &&
            s1.day_of_week === s2.day_of_week
          ) {
            conflictCount++;
          }

          // Check if same teacher at same time
          if (
            s1.teacher_id === s2.teacher_id &&
            s1.start_time === s2.start_time &&
            s1.day_of_week === s2.day_of_week
          ) {
            conflictCount++;
          }
        }
      }

      // Calculate room utilization
      const roomUtilization =
        ((schedules.length * averageClassSize) / (100 * 40)) * 100; // Assuming 100 available slots, 40 room capacity

      // Create report
      const report: ScheduleUtilizationReport = {
        reportId: `schedule-util-${academicPeriod}-${Date.now()}`,
        academicPeriod,
        totalScheduledClasses: schedules.length,
        averageClassSize,
        roomUtilization: Math.min(roomUtilization, 100),
        peakHours,
        conflicts: conflictCount,
        generatedAt: new Date().toISOString(),
      };

      // Log to audit
      await this.auditService.logAudit({
        entityType: 'report',
        entityId: report.reportId,
        action: 'generate',
        performedBy: userId,
        details: {
          type: 'schedule_utilization_report',
          academicPeriod,
          totalSchedules: report.totalScheduledClasses,
        },
        timestamp: new Date(),
      });

      return report;
    } catch (error) {
      logger.error(
        `Error generating schedule utilization report: ${error}`
      );
      throw error;
    }
  }

  /**
   * Get report history
   */
  async getReportHistory(
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      logger.info(`Fetching report history: limit=${limit}, offset=${offset}`);

      const reports = await this.db('audit_logs')
        .where('entity_type', 'report')
        .where('action', 'generate')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .offset(offset)
        .select('*');

      return reports;
    } catch (error) {
      logger.error(`Error fetching report history: ${error}`);
      throw error;
    }
  }
}
