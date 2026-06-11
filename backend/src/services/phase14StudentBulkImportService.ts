/**
 * Phase 14.2: Student Bulk Import Service
 * 
 * Specialized service for bulk importing student data with:
 * - Duplicate detection and merging
 * - Comprehensive validation
 * - Enrollment verification
 * - Guardian management
 * - Import summary reports
 */

import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface StudentImportRow {
  first_name: string;
  last_name: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  enrollment_date: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  parent_name?: string;
  parent_email?: string;
  parent_phone?: string;
  student_id?: string;
  [key: string]: any;
}

export interface StudentImportOptions {
  tenantId: string;
  userId: string;
  duplicateHandling: 'skip' | 'merge' | 'error';
  autoEnroll?: {
    classId?: string;
    academicSessionId?: string;
  };
  validateOnly?: boolean;
  sendNotifications?: boolean;
}

export interface StudentImportSummary {
  totalStudents: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  duplicatesDetected: number;
  enrollmentsFailed: number;
  warnings: string[];
  errors: Array<{
    rowNumber: number;
    firstName: string;
    lastName: string;
    email?: string;
    reason: string;
    suggestion?: string;
  }>;
  duplicates: Array<{
    rowNumber: number;
    name: string;
    matchField: string;
    matchValue: string;
    existingRecordId?: string;
    decision: 'skipped' | 'merged' | 'rejected';
  }>;
}

/**
 * Phase 14.2: Student Bulk Import Service
 */
export class Phase14StudentBulkImportService {
  private db: Knex;

  constructor(db: Knex) {
    this.db = db;
  }

  /**
   * Import students in bulk with duplicate detection
   */
  async importStudents(
    students: StudentImportRow[],
    importJobId: string,
    options: StudentImportOptions
  ): Promise<StudentImportSummary> {
    const summary: StudentImportSummary = {
      totalStudents: students.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      duplicatesDetected: 0,
      enrollmentsFailed: 0,
      warnings: [],
      errors: [],
      duplicates: [],
    };

    // Process each student
    for (let i = 0; i < students.length; i++) {
      try {
        const student = students[i];
        const rowNumber = i + 2; // +2 for header and 1-based indexing

        // Validate required fields
        const validation = this.validateStudentData(student);
        if (validation.errors.length > 0) {
          summary.errors.push({
            rowNumber,
            firstName: student.first_name || 'N/A',
            lastName: student.last_name || 'N/A',
            email: student.email,
            reason: validation.errors.join('; '),
          });
          summary.errors++;
          continue;
        }

        // Check for duplicates
        const duplicateCheck = await this.detectDuplicate(student, options.tenantId);

        if (duplicateCheck.isDuplicate) {
          summary.duplicatesDetected++;

          if (options.duplicateHandling === 'error') {
            summary.errors.push({
              rowNumber,
              firstName: student.first_name,
              lastName: student.last_name,
              email: student.email,
              reason: `Duplicate student found: ${duplicateCheck.matchField} matches existing record`,
              suggestion: `Use 'merge' mode to update or 'skip' to ignore`,
            });
            summary.errors++;
            summary.duplicates.push({
              rowNumber,
              name: `${student.first_name} ${student.last_name}`,
              matchField: duplicateCheck.matchField,
              matchValue: duplicateCheck.matchValue,
              existingRecordId: duplicateCheck.existingStudentId,
              decision: 'rejected',
            });
            continue;
          }

          if (options.duplicateHandling === 'skip') {
            summary.skipped++;
            summary.duplicates.push({
              rowNumber,
              name: `${student.first_name} ${student.last_name}`,
              matchField: duplicateCheck.matchField,
              matchValue: duplicateCheck.matchValue,
              existingRecordId: duplicateCheck.existingStudentId,
              decision: 'skipped',
            });

            // Log duplicate skip
            await this.db('import_duplicates').insert({
              import_job_id: importJobId,
              row_number: rowNumber,
              matching_record_id: duplicateCheck.existingStudentId,
              matching_table: 'students',
              match_field: duplicateCheck.matchField,
              handling_decision: 'skip',
              matched_record_data: duplicateCheck.existingRecord,
            });

            continue;
          }

          if (options.duplicateHandling === 'merge') {
            // Update existing student
            if (!options.validateOnly) {
              const updateResult = await this.updateExistingStudent(
                duplicateCheck.existingStudentId!,
                student,
                options.userId
              );

              if (updateResult.success) {
                summary.updated++;
                summary.duplicates.push({
                  rowNumber,
                  name: `${student.first_name} ${student.last_name}`,
                  matchField: duplicateCheck.matchField,
                  matchValue: duplicateCheck.matchValue,
                  existingRecordId: duplicateCheck.existingStudentId,
                  decision: 'merged',
                });

                // Log duplicate merge
                await this.db('import_duplicates').insert({
                  import_job_id: importJobId,
                  row_number: rowNumber,
                  matching_record_id: duplicateCheck.existingStudentId,
                  matching_table: 'students',
                  match_field: duplicateCheck.matchField,
                  handling_decision: 'merge',
                  matched_record_data: duplicateCheck.existingRecord,
                });
              } else {
                summary.errors++;
                summary.errors.push({
                  rowNumber,
                  firstName: student.first_name,
                  lastName: student.last_name,
                  email: student.email,
                  reason: `Failed to merge: ${updateResult.error}`,
                });
              }
            } else {
              summary.updated++;
            }
            continue;
          }
        }

        // Create new student
        if (!options.validateOnly) {
          const createResult = await this.createNewStudent(student, options.tenantId, options.userId);

          if (createResult.success) {
            summary.created++;

            // Handle auto-enrollment if specified
            if (options.autoEnroll?.classId && options.autoEnroll?.academicSessionId) {
              const enrollmentResult = await this.autoEnrollStudent(
                createResult.studentId!,
                options.autoEnroll.classId,
                options.autoEnroll.academicSessionId,
                options.userId
              );

              if (!enrollmentResult.success) {
                summary.enrollmentsFailed++;
                summary.warnings.push(
                  `Student ${student.first_name} ${student.last_name} created but enrollment failed: ${enrollmentResult.error}`
                );
              }
            }

            // Send notification if requested
            if (options.sendNotifications && student.email) {
              await this.sendStudentCreatedNotification(createResult.studentId!, student, options.tenantId);
            }
          } else {
            summary.errors++;
            summary.errors.push({
              rowNumber,
              firstName: student.first_name,
              lastName: student.last_name,
              email: student.email,
              reason: `Failed to create: ${createResult.error}`,
            });
          }
        } else {
          summary.created++;
        }
      } catch (error) {
        summary.errors++;
        logger.error(`Error processing student row ${i}:`, error);
      }
    }

    // Generate warnings
    if (summary.duplicatesDetected > 0) {
      summary.warnings.push(`Detected ${summary.duplicatesDetected} duplicate records`);
    }

    if (summary.enrollmentsFailed > 0) {
      summary.warnings.push(`${summary.enrollmentsFailed} students failed to enroll in class`);
    }

    if (summary.errors.length > 0 && summary.errors.length / summary.totalStudents > 0.1) {
      summary.warnings.push(`High error rate: ${((summary.errors.length / summary.totalStudents) * 100).toFixed(1)}% of records failed`);
    }

    logger.info(`Student import completed: ${summary.created} created, ${summary.updated} updated, ${summary.skipped} skipped, ${summary.errors.length} errors`);

    return summary;
  }

  /**
   * Validate student data
   */
  private validateStudentData(student: StudentImportRow): { errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!student.first_name || student.first_name.trim() === '') {
      errors.push('First name is required');
    }

    if (!student.last_name || student.last_name.trim() === '') {
      errors.push('Last name is required');
    }

    if (!student.enrollment_date) {
      errors.push('Enrollment date is required');
    } else if (!this.isValidDate(student.enrollment_date)) {
      errors.push('Invalid enrollment date format (use YYYY-MM-DD)');
    }

    // Conditional validation
    if (student.email && !this.isValidEmail(student.email)) {
      errors.push('Invalid email format');
    }

    if (student.date_of_birth && !this.isValidDate(student.date_of_birth)) {
      errors.push('Invalid date of birth format (use YYYY-MM-DD)');
    }

    if (student.date_of_birth) {
      const age = this.calculateAge(new Date(student.date_of_birth));
      if (age < 3 || age > 30) {
        errors.push(`Student age must be between 3 and 30 (calculated age: ${age})`);
      }
    }

    if (student.gender && !['M', 'F', 'Other', 'Prefer not to say'].includes(student.gender)) {
      errors.push('Invalid gender value');
    }

    // Validate phone format if provided
    if (student.parent_phone && !this.isValidPhone(student.parent_phone)) {
      errors.push('Invalid parent phone format');
    }

    return { errors };
  }

  /**
   * Detect duplicate students
   */
  private async detectDuplicate(
    student: StudentImportRow,
    tenantId: string
  ): Promise<{
    isDuplicate: boolean;
    matchField?: string;
    matchValue?: string;
    existingStudentId?: string;
    existingRecord?: any;
  }> {
    // Check by email if provided
    if (student.email) {
      const existing = await this.db('students')
        .where('tenant_id', tenantId)
        .where('email', student.email)
        .first();

      if (existing) {
        return {
          isDuplicate: true,
          matchField: 'email',
          matchValue: student.email,
          existingStudentId: existing.student_id,
          existingRecord: existing,
        };
      }
    }

    // Check by name and date of birth if both provided
    if (student.first_name && student.last_name && student.date_of_birth) {
      const existing = await this.db('students')
        .where('tenant_id', tenantId)
        .where('first_name', student.first_name)
        .where('last_name', student.last_name)
        .where('date_of_birth', student.date_of_birth)
        .first();

      if (existing) {
        return {
          isDuplicate: true,
          matchField: 'name_and_dob',
          matchValue: `${student.first_name} ${student.last_name} (${student.date_of_birth})`,
          existingStudentId: existing.student_id,
          existingRecord: existing,
        };
      }
    }

    // Check by student_id if provided
    if (student.student_id) {
      const existing = await this.db('students')
        .where('tenant_id', tenantId)
        .where('student_id', student.student_id)
        .first();

      if (existing) {
        return {
          isDuplicate: true,
          matchField: 'student_id',
          matchValue: student.student_id,
          existingStudentId: existing.student_id,
          existingRecord: existing,
        };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * Create new student record
   */
  private async createNewStudent(
    student: StudentImportRow,
    tenantId: string,
    userId: string
  ): Promise<{ success: boolean; studentId?: string; error?: string }> {
    try {
      // Build guardian data if provided
      const guardians = [];
      if (student.parent_name || student.parent_email || student.parent_phone) {
        guardians.push({
          name: student.parent_name || '',
          email: student.parent_email || '',
          phone: student.parent_phone || '',
          relationship: 'Parent/Guardian',
        });
      }

      // Build contact info
      const contactInfo = {
        phone: student.phone || '',
        address: student.address || '',
        city: student.city || '',
        state: student.state || '',
        postal_code: student.postal_code || '',
      };

      const studentId = student.student_id || `STU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create student record
      await this.db('students').insert({
        student_id: studentId,
        tenant_id: tenantId,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email || null,
        date_of_birth: student.date_of_birth || null,
        gender: student.gender || null,
        contact_info: Object.keys(contactInfo).length > 0 ? JSON.stringify(contactInfo) : null,
        guardians: guardians.length > 0 ? JSON.stringify(guardians) : null,
        enrollment_date: student.enrollment_date,
        status: 'active',
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      logger.info(`Student created: ${student.first_name} ${student.last_name} (${studentId})`);

      return { success: true, studentId };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Update existing student record
   */
  private async updateExistingStudent(
    studentId: string,
    student: StudentImportRow,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Prepare update data
      const updateData: any = {
        first_name: student.first_name,
        last_name: student.last_name,
        updated_by: userId,
        updated_at: new Date(),
      };

      if (student.email) updateData.email = student.email;
      if (student.date_of_birth) updateData.date_of_birth = student.date_of_birth;
      if (student.gender) updateData.gender = student.gender;
      if (student.enrollment_date) updateData.enrollment_date = student.enrollment_date;

      // Update contact info if provided
      const contactInfo: any = {};
      if (student.phone) contactInfo.phone = student.phone;
      if (student.address) contactInfo.address = student.address;
      if (student.city) contactInfo.city = student.city;
      if (student.state) contactInfo.state = student.state;
      if (student.postal_code) contactInfo.postal_code = student.postal_code;

      if (Object.keys(contactInfo).length > 0) {
        updateData.contact_info = JSON.stringify(contactInfo);
      }

      // Update guardian info if provided
      const guardians = [];
      if (student.parent_name || student.parent_email || student.parent_phone) {
        guardians.push({
          name: student.parent_name || '',
          email: student.parent_email || '',
          phone: student.parent_phone || '',
          relationship: 'Parent/Guardian',
        });
        updateData.guardians = JSON.stringify(guardians);
      }

      await this.db('students').where('student_id', studentId).update(updateData);

      logger.info(`Student updated: ${studentId}`);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Auto-enroll student in class
   */
  private async autoEnrollStudent(
    studentId: string,
    classId: string,
    academicSessionId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if already enrolled
      const existing = await this.db('enrollments')
        .where('student_id', studentId)
        .where('class_id', classId)
        .where('academic_session_id', academicSessionId)
        .first();

      if (existing) {
        return { success: true }; // Already enrolled
      }

      // Create enrollment
      await this.db('enrollments').insert({
        enrollment_id: uuidv4(),
        student_id: studentId,
        class_id: classId,
        academic_session_id: academicSessionId,
        enrollment_date: new Date(),
        status: 'active',
        created_by: userId,
        created_at: new Date(),
        updated_at: new Date(),
      });

      logger.info(`Student ${studentId} enrolled in class ${classId}`);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Send student created notification (stub for integration)
   */
  private async sendStudentCreatedNotification(
    studentId: string,
    student: StudentImportRow,
    tenantId: string
  ): Promise<void> {
    // TODO: Integrate with notification service
    logger.info(`Notification queued for new student: ${studentId}`);
  }

  /**
   * Utility: Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Utility: Validate phone format
   */
  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
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
   * Utility: Calculate age
   */
  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Get import summary report
   */
  async getImportSummaryReport(importJobId: string, tenantId: string): Promise<any> {
    const job = await this.db('import_jobs').where('id', importJobId).where('tenant_id', tenantId).first();

    if (!job) {
      throw new AppError('Import job not found', 404, 'NOT_FOUND');
    }

    const result = job.result ? JSON.parse(job.result) : null;
    const duplicates = await this.db('import_duplicates').where('import_job_id', importJobId);
    const errors = await this.db('import_validation_errors').where('import_job_id', importJobId);

    return {
      importJobId,
      fileName: job.file_name,
      status: job.status,
      completedAt: job.completed_at,
      summary: result?.summary || {},
      statistics: {
        totalRecords: job.total_rows,
        successRate: job.total_rows > 0 ? ((job.successful_rows / job.total_rows) * 100).toFixed(2) + '%' : '0%',
        duplicatesDetected: duplicates.length,
        validationErrors: errors.length,
      },
      duplicatesSummary: duplicates.map((d: any) => ({
        rowNumber: d.row_number,
        decision: d.handling_decision,
        matchField: d.match_field,
      })),
      errorSummary: errors.slice(0, 20),
    };
  }
}
