
/**
 * Phase 14.4: Attendance Bulk Import Service
 * 
 * Specialized service for bulk importing attendance data with:
 * - Class and student enrollment verification
 * - Attendance status validation
 * - Attendance threshold checking
 * - Attendance rate calculations
 * - Import summary reports
 */

import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface AttendanceImportRow {
  student_id: string;
  class_id: string;
  attendance_date: string;
  status: string;
  remarks?: string;
  marked_by?: string;
  time_in?: string;
  time_out?: string;
}

export interface AttendanceImportOptions {
  tenantId: string;
  userId: string;
  validateOnly?: boolean;
  calculateAttendanceRate?: boolean;
  markAbsentNotifications?: boolean;
}

export interface AttendanceImportSummary {
  totalRecords: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  enrollmentVerificationFailed: number;
  statusValidationFailed: number;
  attendanceRatesUpdated: number;
  warnings: string[];
  errors: Array<{
    rowNumber: number;
    studentId: string;
    classId: string;
    date: string;
    reason: string;
    suggestion?: string;
  }>;
  enrollmentIssues: Array<{
    rowNumber: number;
    studentId: string;
    classId: string;
    reason: string;
  }>;
  statusIssues: Array<{
    rowNumber: number;
    status: string;
    validStatuses: string[];
  }>;
}

/**
 * Phase 14.4: Attendance Bulk Import Service
 */
export class Phase14AttendanceBulkImportService {
  private db: Knex;
  private validStatuses = ['present', 'absent', 'late', 'excused', 'half-day'];

  constructor(db: Knex) {
    this.db = db;
  }

  /**
   * Import attendance records in bulk
   */
  async importAttendance(
    records: AttendanceImportRow[],
    importJobId: string,
    options: AttendanceImportOptions
  ): Promise<AttendanceImportSummary> {
    const summary: AttendanceImportSummary = {
      totalRecords: records.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      enrollmentVerificationFailed: 0,
      statusValidationFailed: 0,
      attendanceRatesUpdated: 0,
      warnings: [],
      errors: [],
      enrollmentIssues: [],
      statusIssues: [],
    };

    const processedStudentDates = new Set<string>();

    // Process each attendance record
    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i];
        const rowNumber = i + 2;

        // Validate required fields
        const validation = this.validateAttendanceData(record);
        if (validation.errors.length > 0) {
          summary.errors.push({
            rowNumber,
            studentId: record.student_id,
            classId: record.class_id,
            date: record.attendance_date,
            reason: validation.errors.join('; '),
          });
          summary.errors++;
          continue;
        }

        // Validate status
        const statusValidation = this.validateStatus(record.status);
        if (!statusValidation.valid) {
          summary.statusValidationFailed++;
          summary.statusIssues.push({
            rowNumber,
            status: record.status,
            validStatuses: this.validStatuses,
          });

          summary.errors.push({
            rowNumber,
            studentId: record.student_id,
            classId: record.class_id,
            date: record.attendance_date,
            reason: `Invalid attendance status: ${record.status}`,
            suggestion: `Use one of: ${this.validStatuses.join(', ')}`,
          });
          summary.errors++;
          continue;
        }

        // Verify enrollment
        const enrollmentCheck = await this.verifyEnrollment(
          record.student_id,
          record.class_id,
          options.tenantId
        );

        if (!enrollmentCheck.isEnrolled) {
          summary.enrollmentVerificationFailed++;
          summary.enrollmentIssues.push({
            rowNumber,
            studentId: record.student_id,
            classId: record.class_id,
            reason: enrollmentCheck.reason,
          });

          summary.errors.push({
            rowNumber,
            studentId: record.student_id,
            classId: record.class_id,
            date: record.attendance_date,
            reason: `Student not enrolled: ${enrollmentCheck.reason}`,
            suggestion: 'Verify student enrollment in class',
          });
          summary.errors++;
          continue;
        }

        // Create or update attendance record
        if (!options.validateOnly) {
          const createResult = await this.createOrUpdateAttendance(
            record,
            options.tenantId,
            options.userId
          );

          if (createResult.success) {
            if (createResult.action === 'create') {
              summary.created++;
            } else {
              summary.updated++;
            }

            // Track for attendance rate calculation
            processedStudentDates.add(`${record.student_id}:${record.attendance_date}`);
          } else {
            summary.errors++;
            summary.errors.push({
              rowNumber,
              studentId: record.student_id,
              classId: record.class_id,
              date: record.attendance_date,
              reason: `Failed to save attendance: ${createResult.error}`,
            });
          }
        } else {
          summary.created++;
          processedStudentDates.add(`${record.student_id}:${record.attendance_date}`);
        }
      } catch (error) {
        summary.errors++;
        logger.error(`Error processing attendance row ${i}:`, error);
      }
    }

    // Calculate attendance rates for affected students if requested
    if (options.calculateAttendanceRate && processedStudentDates.size > 0) {
      const affectedStudents = new Set<string>();
      processedStudentDates.forEach((pair) => {
        const studentId = pair.split(':')[0];
        affectedStudents.add(studentId);
      });

      for (const studentId of affectedStudents) {
        try {
          await this.recalculateAttendanceRate(studentId);
          summary.attendanceRatesUpdated++;
        } catch (error) {
          summary.warnings.push(
            `Failed to calculate attendance rate for student ${studentId}: ${(error as Error).message}`
          );
        }
      }
    }

    // Generate warnings
    if (summary.enrollmentVerificationFailed > 0) {
      summary.warnings.push(
        `${summary.enrollmentVerificationFailed} records failed enrollment verification`
      );
    }

    if (summary.statusValidationFailed > 0) {
      summary.warnings.push(`${summary.statusValidationFailed} records had invalid status values`);
    }

    if (summary.errors.length > 0 && summary.errors.length / summary.totalRecords > 0.1) {
      summary.warnings.push(
        `High error rate: ${((summary.errors.length / summary.totalRecords) * 100).toFixed(1)}% of records failed`
      );
    }

    logger.info(
      `Attendance import completed: ${summary.created} created, ${summary.updated} updated, ${summary.errors.length} errors`
    );

    return summary;
  }

  /**
   * Validate attendance data
   */
  private validateAttendanceData(record: AttendanceImportRow): { errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!record.student_id || record.student_id.trim() === '') {
      errors.push('Student ID is required');
    }

    if (!record.class_id || record.class_id.trim() === '') {
      errors.push('Class ID is required');
    }

    if (!record.attendance_date || record.attendance_date.trim() === '') {
      errors.push('Attendance date is required');
    } else if (!this.isValidDate(record.attendance_date)) {
      errors.push('Invalid attendance date format (use YYYY-MM-DD)');
    }

    if (!record.status || record.status.trim() === '') {
      errors.push('Attendance status is required');
    }

    // Validate time format if provided
    if (record.time_in && !this.isValidTime(record.time_in)) {
      errors.push('Invalid time_in format (use HH:MM)');
    }

    if (record.time_out && !this.isValidTime(record.time_out)) {
      errors.push('Invalid time_out format (use HH:MM)');
    }

    return { errors };
  }

  /**
   * Validate attendance status
   */
  private validateStatus(status: string): { valid: boolean; reason?: string } {
    if (!status || status.trim() === '') {
      return { valid: false, reason: 'Status is required' };
    }

    const normalizedStatus = status.toLowerCase().trim();
    if (!this.validStatuses.includes(normalizedStatus)) {
      return {
        valid: false,
        reason: `Invalid status. Valid values: ${this.validStatuses.join(', ')}`,
      };
    }

    return { valid: true };
  }

  /**
   * Verify student enrollment in class
   */
  private async verifyEnrollment(
    studentId: string,
    classId: string,
    tenantId: string
  ): Promise<{ isEnrolled: boolean; reason?: string }> {
    // Check current enrollment
    const enrollment = await this.db('enrollments')
      .join('students', 'enrollments.student_id', 'students.student_id')
      .where('enrollments.student_id', studentId)
      .where('enrollments.class_id', classId)
      .where('students.tenant_id', tenantId)
      .where('enrollments.status', 'active')
      .first();

    if (!enrollment) {
      // Check if student and class exist
      const student = await this.db('students')
        .where('student_id', studentId)
        .where('tenant_id', tenantId)
        .first();

      if (!student) {
        return { isEnrolled: false, reason: 'Student not found' };
      }

      const classRecord = await this.db('classes')
        .where('class_id', classId)
        .where('tenant_id', tenantId)
        .first();

      if (!classRecord) {
        return { isEnrolled: false, reason: 'Class not found' };
      }

      return {
        isEnrolled: false,
        reason: 'Student is not actively enrolled in this class',
      };
    }

    return { isEnrolled: true };
  }

  /**
   * Create or update attendance record
   */
  private async createOrUpdateAttendance(
    record: AttendanceImportRow,
    tenantId: string,
    userId: string
  ): Promise<{ success: boolean; action?: 'create' | 'update'; error?: string }> {
    try {
      // Check if attendance record already exists
      const existing = await this.db('attendance')
        .where('student_id', record.student_id)
        .where('attendance_date', record.attendance_date)
        .where('class_id', record.class_id)
        .first();

      const statusValue = record.status.toLowerCase().trim();

      if (existing) {
        // Update existing record
        await this.db('attendance').where('attendance_id', existing.attendance_id).update({
          status: statusValue,
          remarks: record.remarks || null,
          marked_by: record.marked_by || null,
          time_in: record.time_in || null,
          time_out: record.time_out || null,
          updated_by: userId,
          updated_at: new Date(),
        });

        logger.info(
          `Attendance updated: student=${record.student_id}, class=${record.class_id}, date=${record.attendance_date}`
        );

        return { success: true, action: 'update' };
      } else {
        // Create new record
        const attendanceId = uuidv4();

        await this.db('attendance').insert({
          attendance_id: attendanceId,
          student_id: record.student_id,
          class_id: record.class_id,
          attendance_date: record.attendance_date,
          status: statusValue,
          remarks: record.remarks || null,
          marked_by: record.marked_by || null,
          time_in: record.time_in || null,
          time_out: record.time_out || null,
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date(),
        });

        logger.info(
          `Attendance created: student=${record.student_id}, class=${record.class_id}, date=${record.attendance_date}`
        );

        return { success: true, action: 'create' };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Recalculate attendance rate for student
   */
  private async recalculateAttendanceRate(studentId: string): Promise<void> {
    try {
      // Get all attendance records for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const records = await this.db('attendance')
        .where('student_id', studentId)
        .where('attendance_date', '>=', thirtyDaysAgo)
        .select('status');

      if (records.length === 0) {
        return;
      }

      // Calculate attendance rate
      const presentCount = records.filter((r) => r.status === 'present').length;
      const lateCount = records.filter((r) => r.status === 'late').length;
      const halfDayCount = records.filter((r) => r.status === 'half-day').length;

      const attendanceRate = ((presentCount + lateCount * 0.5 + halfDayCount * 0.75) / records.length) * 100;

      // Store in student record
      await this.db('students').where('student_id', studentId).update({
        attendance_rate: parseFloat(attendanceRate.toFixed(2)),
        updated_at: new Date(),
      });

      logger.info(
        `Attendance rate updated for student ${studentId}: ${attendanceRate.toFixed(2)}%`
      );
    } catch (error) {
      logger.error(`Failed to recalculate attendance rate for student ${studentId}:`, error);
      throw error;
    }
  }

  /**
   * Utility: Validate date format
   */
  private isValidDate(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Utility: Validate time format
   */
  private isValidTime(timeString: string): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(timeString);
  }

  /**
   * Get import summary report
   */
  async getImportSummaryReport(importJobId: string, tenantId: string): Promise<any> {
    const job = await this.db('import_jobs')
      .where('id', importJobId)
      .where('tenant_id', tenantId)
      .first();

    if (!job) {
      throw new AppError('Import job not found', 404, 'NOT_FOUND');
    }

    const result = job.result ? JSON.parse(job.result) : null;
    const errors = await this.db('import_validation_errors').where('import_job_id', importJobId);

    return {
      importJobId,
      fileName: job.file_name,
      status: job.status,
      completedAt: job.completed_at,
      summary: result?.summary || {},
      statistics: {
        totalRecords: job.total_rows,
        successRate:
          job.total_rows > 0
            ? ((job.successful_rows / job.total_rows) * 100).toFixed(2) + '%'
            : '0%',
        enrollmentIssues: result?.enrollmentVerificationFailed || 0,
        statusIssues: result?.statusValidationFailed || 0,
        validationErrors: errors.length,
        attendanceRatesUpdated: result?.attendanceRatesUpdated || 0,
      },
      enrollmentIssuesSummary: result?.enrollmentIssues?.slice(0, 10) || [],
      statusIssuesSummary: result?.statusIssues?.slice(0, 10) || [],
      errorSummary: errors.slice(0, 20),
    };
  }

  /**
   * Pre-verify attendances before import
   */
  async preVerifyAttendances(
    records: AttendanceImportRow[],
    tenantId: string
  ): Promise<{
    enrollmentVerified: number;
    enrollmentFailed: number;
    statusErrors: number;
    issues: Array<{
      rowNumber: number;
      studentId: string;
      classId: string;
      reason: string;
    }>;
  }> {
    const issues: Array<{
      rowNumber: number;
      studentId: string;
      classId: string;
      reason: string;
    }> = [];
    let verified = 0;
    let enrollmentFailed = 0;
    let statusErrors = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const rowNumber = i + 2;

      // Check status
      const statusCheck = this.validateStatus(record.status);
      if (!statusCheck.valid) {
        statusErrors++;
        issues.push({
          rowNumber,
          studentId: record.student_id,
          classId: record.class_id,
          reason: `Invalid status: ${statusCheck.reason}`,
        });
        continue;
      }

      // Check enrollment
      const enrollmentCheck = await this.verifyEnrollment(
        record.student_id,
        record.class_id,
        tenantId
      );

      if (enrollmentCheck.isEnrolled) {
        verified++;
      } else {
        enrollmentFailed++;
        issues.push({
          rowNumber,
          studentId: record.student_id,
          classId: record.class_id,
          reason: enrollmentCheck.reason || 'Not enrolled',
        });
      }
    }

    return { enrollmentVerified: verified, enrollmentFailed, statusErrors, issues };
  }
}
