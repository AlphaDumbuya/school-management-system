/**
 * Phase 14.3: Grade Bulk Import Service
 * 
 * Specialized service for bulk importing grade data with:
 * - Enrollment verification
 * - Grade validation and constraints
 * - GPA recalculation
 * - Transcript updates
 * - Import summary reports
 */

import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface GradeImportRow {
  student_id: string;
  class_id: string;
  subject_id: string;
  term: string;
  grade_value: number | string;
  grade_letter?: string;
  comments?: string;
  teacher_id?: string;
  assessment_date?: string;
  weight?: number;
}

export interface GradeImportOptions {
  tenantId: string;
  userId: string;
  academicSessionId: string;
  recalculateGPA?: boolean;
  updateTranscripts?: boolean;
  validateOnly?: boolean;
}

export interface GradeImportSummary {
  totalGrades: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  enrollmentVerificationFailed: number;
  gradeConstraintViolations: number;
  gpasRecalculated: number;
  warnings: string[];
  errors: Array<{
    rowNumber: number;
    studentId: string;
    subjectId: string;
    reason: string;
    suggestion?: string;
  }>;
  enrollmentIssues: Array<{
    rowNumber: number;
    studentId: string;
    classId: string;
    reason: string;
  }>;
  gradeValidationIssues: Array<{
    rowNumber: number;
    studentId: string;
    gradeValue: number;
    constraint: string;
  }>;
}

/**
 * Phase 14.3: Grade Bulk Import Service
 */
export class Phase14GradeBulkImportService {
  private db: Knex;
  private gradeScale: Map<string, number> = new Map();

  constructor(db: Knex) {
    this.db = db;
    this.initializeGradeScale();
  }

  /**
   * Initialize grade scale mapping
   */
  private initializeGradeScale(): void {
    // Standard A-F grading scale
    this.gradeScale.set('A+', 97);
    this.gradeScale.set('A', 93);
    this.gradeScale.set('A-', 90);
    this.gradeScale.set('B+', 87);
    this.gradeScale.set('B', 83);
    this.gradeScale.set('B-', 80);
    this.gradeScale.set('C+', 77);
    this.gradeScale.set('C', 73);
    this.gradeScale.set('C-', 70);
    this.gradeScale.set('D+', 67);
    this.gradeScale.set('D', 63);
    this.gradeScale.set('D-', 60);
    this.gradeScale.set('F', 0);
  }

  /**
   * Import grades in bulk with enrollment verification
   */
  async importGrades(
    grades: GradeImportRow[],
    importJobId: string,
    options: GradeImportOptions
  ): Promise<GradeImportSummary> {
    const summary: GradeImportSummary = {
      totalGrades: grades.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      enrollmentVerificationFailed: 0,
      gradeConstraintViolations: 0,
      gpasRecalculated: 0,
      warnings: [],
      errors: [],
      enrollmentIssues: [],
      gradeValidationIssues: [],
    };

    const processedStudents = new Set<string>();

    // Process each grade record
    for (let i = 0; i < grades.length; i++) {
      try {
        const grade = grades[i];
        const rowNumber = i + 2;

        // Validate required fields
        const validation = this.validateGradeData(grade);
        if (validation.errors.length > 0) {
          summary.errors.push({
            rowNumber,
            studentId: grade.student_id,
            subjectId: grade.subject_id,
            reason: validation.errors.join('; '),
          });
          summary.errors++;
          continue;
        }

        // Verify enrollment
        const enrollmentCheck = await this.verifyEnrollment(
          grade.student_id,
          grade.class_id,
          options.academicSessionId,
          options.tenantId
        );

        if (!enrollmentCheck.isEnrolled) {
          summary.enrollmentVerificationFailed++;
          summary.enrollmentIssues.push({
            rowNumber,
            studentId: grade.student_id,
            classId: grade.class_id,
            reason: enrollmentCheck.reason,
          });

          summary.errors.push({
            rowNumber,
            studentId: grade.student_id,
            subjectId: grade.subject_id,
            reason: `Student not enrolled in class: ${enrollmentCheck.reason}`,
            suggestion: 'Verify enrollment before importing grades',
          });
          summary.errors++;
          continue;
        }

        // Verify subject exists
        const subject = await this.db('subjects')
          .where('subject_id', grade.subject_id)
          .where('tenant_id', options.tenantId)
          .first();

        if (!subject) {
          summary.errors.push({
            rowNumber,
            studentId: grade.student_id,
            subjectId: grade.subject_id,
            reason: 'Subject not found',
            suggestion: `Verify subject ID: ${grade.subject_id}`,
          });
          summary.errors++;
          continue;
        }

        // Validate grade value against constraints
        const gradeValidation = this.validateGradeValue(grade.grade_value);
        if (!gradeValidation.valid) {
          summary.gradeConstraintViolations++;
          summary.gradeValidationIssues.push({
            rowNumber,
            studentId: grade.student_id,
            gradeValue: Number(grade.grade_value),
            constraint: gradeValidation.reason,
          });

          summary.errors.push({
            rowNumber,
            studentId: grade.student_id,
            subjectId: grade.subject_id,
            reason: gradeValidation.reason,
            suggestion: 'Grade value must be between 0-100 or valid letter grade',
          });
          summary.errors++;
          continue;
        }

        // Create or update grade
        if (!options.validateOnly) {
          const createResult = await this.createOrUpdateGrade(
            grade,
            options.tenantId,
            options.userId,
            options.academicSessionId
          );

          if (createResult.success) {
            if (createResult.action === 'create') {
              summary.created++;
            } else {
              summary.updated++;
            }

            // Track for GPA recalculation
            processedStudents.add(grade.student_id);
          } else {
            summary.errors++;
            summary.errors.push({
              rowNumber,
              studentId: grade.student_id,
              subjectId: grade.subject_id,
              reason: `Failed to save grade: ${createResult.error}`,
            });
          }
        } else {
          summary.created++;
          processedStudents.add(grade.student_id);
        }
      } catch (error) {
        summary.errors++;
        logger.error(`Error processing grade row ${i}:`, error);
      }
    }

    // Recalculate GPA for all affected students if requested
    if (options.recalculateGPA && processedStudents.size > 0) {
      for (const studentId of processedStudents) {
        try {
          await this.recalculateStudentGPA(studentId);
          summary.gpasRecalculated++;
        } catch (error) {
          summary.warnings.push(`Failed to recalculate GPA for student ${studentId}: ${(error as Error).message}`);
        }
      }
    }

    // Generate warnings
    if (summary.enrollmentVerificationFailed > 0) {
      summary.warnings.push(`${summary.enrollmentVerificationFailed} grade records failed enrollment verification`);
    }

    if (summary.gradeConstraintViolations > 0) {
      summary.warnings.push(`${summary.gradeConstraintViolations} grade values violated constraints`);
    }

    if (summary.errors.length > 0 && summary.errors.length / summary.totalGrades > 0.1) {
      summary.warnings.push(
        `High error rate: ${((summary.errors.length / summary.totalGrades) * 100).toFixed(1)}% of records failed`
      );
    }

    logger.info(
      `Grade import completed: ${summary.created} created, ${summary.updated} updated, ${summary.errors.length} errors`
    );

    return summary;
  }

  /**
   * Validate grade data
   */
  private validateGradeData(grade: GradeImportRow): { errors: string[] } {
    const errors: string[] = [];

    // Required fields
    if (!grade.student_id || grade.student_id.trim() === '') {
      errors.push('Student ID is required');
    }

    if (!grade.class_id || grade.class_id.trim() === '') {
      errors.push('Class ID is required');
    }

    if (!grade.subject_id || grade.subject_id.trim() === '') {
      errors.push('Subject ID is required');
    }

    if (!grade.term || grade.term.trim() === '') {
      errors.push('Term is required');
    }

    if (grade.grade_value === null || grade.grade_value === undefined || grade.grade_value === '') {
      errors.push('Grade value is required');
    }

    // Validate term format
    if (grade.term && !['Term 1', 'Term 2', 'Term 3', 'Semester 1', 'Semester 2', 'Final'].includes(grade.term)) {
      errors.push(`Invalid term: ${grade.term}`);
    }

    return { errors };
  }

  /**
   * Verify student enrollment in class
   */
  private async verifyEnrollment(
    studentId: string,
    classId: string,
    academicSessionId: string,
    tenantId: string
  ): Promise<{ isEnrolled: boolean; reason?: string }> {
    // Check enrollment
    const enrollment = await this.db('enrollments')
      .join('students', 'enrollments.student_id', 'students.student_id')
      .where('enrollments.student_id', studentId)
      .where('enrollments.class_id', classId)
      .where('enrollments.academic_session_id', academicSessionId)
      .where('enrollments.status', 'active')
      .where('students.tenant_id', tenantId)
      .first();

    if (!enrollment) {
      // Provide detailed reason
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
        reason: 'Student is not enrolled in this class for this academic session',
      };
    }

    return { isEnrolled: true };
  }

  /**
   * Validate grade value
   */
  private validateGradeValue(gradeValue: number | string): { valid: boolean; reason?: string } {
    const numValue = Number(gradeValue);

    // Check if it's a valid number
    if (!isNaN(numValue)) {
      if (numValue < 0 || numValue > 100) {
        return { valid: false, reason: 'Numeric grade must be between 0-100' };
      }
      return { valid: true };
    }

    // Check if it's a valid letter grade
    if (typeof gradeValue === 'string' && this.gradeScale.has(gradeValue.toUpperCase())) {
      return { valid: true };
    }

    return { valid: false, reason: 'Grade must be numeric (0-100) or valid letter grade (A+, A, B+, etc)' };
  }

  /**
   * Create or update grade record
   */
  private async createOrUpdateGrade(
    grade: GradeImportRow,
    tenantId: string,
    userId: string,
    academicSessionId: string
  ): Promise<{ success: boolean; action?: 'create' | 'update'; error?: string }> {
    try {
      // Convert letter grade to numeric if necessary
      let gradeValue = Number(grade.grade_value);
      if (isNaN(gradeValue) && typeof grade.grade_value === 'string') {
        const scaled = this.gradeScale.get(grade.grade_value.toUpperCase());
        gradeValue = scaled || 0;
      }

      // Check if grade already exists
      const existing = await this.db('grades')
        .where('student_id', grade.student_id)
        .where('subject_id', grade.subject_id)
        .where('term', grade.term)
        .where('academic_session_id', academicSessionId)
        .first();

      if (existing) {
        // Update existing grade
        await this.db('grades').where('grade_id', existing.grade_id).update({
          grade_value: gradeValue,
          grade_letter: grade.grade_letter || this.getLetterGrade(gradeValue),
          comments: grade.comments || null,
          teacher_id: grade.teacher_id || null,
          assessment_date: grade.assessment_date || null,
          weight: grade.weight || 1,
          updated_by: userId,
          updated_at: new Date(),
        });

        logger.info(`Grade updated: student=${grade.student_id}, subject=${grade.subject_id}, term=${grade.term}`);

        return { success: true, action: 'update' };
      } else {
        // Create new grade
        const gradeId = uuidv4();

        await this.db('grades').insert({
          grade_id: gradeId,
          student_id: grade.student_id,
          class_id: grade.class_id,
          subject_id: grade.subject_id,
          academic_session_id: academicSessionId,
          term: grade.term,
          grade_value: gradeValue,
          grade_letter: grade.grade_letter || this.getLetterGrade(gradeValue),
          comments: grade.comments || null,
          teacher_id: grade.teacher_id || null,
          assessment_date: grade.assessment_date || null,
          weight: grade.weight || 1,
          status: 'finalized',
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date(),
        });

        logger.info(`Grade created: student=${grade.student_id}, subject=${grade.subject_id}, term=${grade.term}`);

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
   * Convert numeric grade to letter grade
   */
  private getLetterGrade(gradeValue: number): string {
    if (gradeValue >= 97) return 'A+';
    if (gradeValue >= 93) return 'A';
    if (gradeValue >= 90) return 'A-';
    if (gradeValue >= 87) return 'B+';
    if (gradeValue >= 83) return 'B';
    if (gradeValue >= 80) return 'B-';
    if (gradeValue >= 77) return 'C+';
    if (gradeValue >= 73) return 'C';
    if (gradeValue >= 70) return 'C-';
    if (gradeValue >= 67) return 'D+';
    if (gradeValue >= 63) return 'D';
    if (gradeValue >= 60) return 'D-';
    return 'F';
  }

  /**
   * Recalculate student GPA
   */
  private async recalculateStudentGPA(studentId: string): Promise<void> {
    try {
      // Get all finalized grades for student
      const grades = await this.db('grades')
        .where('student_id', studentId)
        .where('status', 'finalized')
        .select('grade_value', 'weight')
        .orderBy('created_at', 'desc')
        .limit(100); // Limit to recent grades

      if (grades.length === 0) {
        // No grades, set GPA to 0
        await this.db('students').where('student_id', studentId).update({
          gpa: 0,
          updated_at: new Date(),
        });
        return;
      }

      // Calculate weighted GPA
      let totalWeight = 0;
      let weightedSum = 0;

      for (const grade of grades) {
        const weight = grade.weight || 1;
        const gpaScale = grade.grade_value / 25; // Convert 0-100 to 0-4 scale
        weightedSum += gpaScale * weight;
        totalWeight += weight;
      }

      const gpa = Math.min(totalWeight > 0 ? weightedSum / totalWeight : 0, 4.0);

      // Update student GPA
      await this.db('students').where('student_id', studentId).update({
        gpa: parseFloat(gpa.toFixed(2)),
        updated_at: new Date(),
      });

      logger.info(`GPA recalculated for student ${studentId}: ${gpa.toFixed(2)}`);
    } catch (error) {
      logger.error(`Failed to recalculate GPA for student ${studentId}:`, error);
      throw error;
    }
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
        enrollmentIssues: result?.enrollmentVerificationFailed || 0,
        validationIssues: errors.length,
        gpasRecalculated: result?.gpasRecalculated || 0,
      },
      enrollmentIssuesSummary: result?.enrollmentIssues?.slice(0, 10) || [],
      validationIssuesSummary: result?.gradeValidationIssues?.slice(0, 10) || [],
      errorSummary: errors.slice(0, 20),
    };
  }

  /**
   * Batch verify enrollments before import
   */
  async preVerifyEnrollments(
    grades: GradeImportRow[],
    academicSessionId: string,
    tenantId: string
  ): Promise<{
    enrollmentVerified: number;
    enrollmentFailed: number;
    issues: Array<{ studentId: string; classId: string; reason: string }>;
  }> {
    const issues: Array<{ studentId: string; classId: string; reason: string }> = [];
    let verified = 0;
    let failed = 0;

    // Create set of unique student-class combinations
    const uniquePairs = new Map<string, string>();
    grades.forEach((g) => {
      uniquePairs.set(`${g.student_id}:${g.class_id}`, g.student_id);
    });

    // Verify each pair
    for (const [pair, _] of uniquePairs) {
      const [studentId, classId] = pair.split(':');
      const check = await this.verifyEnrollment(studentId, classId, academicSessionId, tenantId);

      if (check.isEnrolled) {
        verified++;
      } else {
        failed++;
        issues.push({
          studentId,
          classId,
          reason: check.reason || 'Not enrolled',
        });
      }
    }

    return { enrollmentVerified: verified, enrollmentFailed: failed, issues };
  }
}
