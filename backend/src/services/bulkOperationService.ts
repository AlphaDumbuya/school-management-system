import { ImportResult, BulkOperationResult, ImportError } from '../types/validation';
import { StudentImportValidator } from '../validators/studentImportValidator';
import { GradeImportValidator } from '../validators/gradeImportValidator';
import { AttendanceImportValidator } from '../validators/attendanceImportValidator';
import { ImportExportService } from './importExportService';

/**
 * Bulk Operation Service
 * Handles bulk import/export operations for students, grades, and attendance
 */
export class BulkOperationService {
  private importExportService: typeof ImportExportService;

  constructor() {
    this.importExportService = ImportExportService;
  }

  /**
   * Bulk import students
   */
  async importStudents(
    data: any[],
    options: {
      skipDuplicates?: boolean;
      duplicateStrategy?: 'keep-first' | 'keep-last' | 'merge';
      validateEnrollment?: boolean;
      existingStudents?: any[];
    } = {}
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      totalProcessed: data.length,
      successful: 0,
      failed: 0,
      duplicates: 0,
      skipped: 0,
      errors: [],
      warnings: [],
    };

    const validatedData: any[] = [];
    const duplicateData = new Map<string, any[]>();

    // Phase 1: Validation
    data.forEach((student, index) => {
      const validation = StudentImportValidator.validateStudent(student);
      if (!validation.valid) {
        result.failed++;
        validation.errors.forEach(err => {
          result.errors.push({
            rowNumber: index + 2,
            field: 'student',
            message: err,
            value: student,
          });
        });
      } else {
        const transformed = StudentImportValidator.transformStudentData(student);
        validatedData.push({ ...transformed, _originalIndex: index });
      }
    });

    // Phase 2: Duplicate Detection
    const uniqueFields = StudentImportValidator.getUniqueFields();
    validatedData.forEach(student => {
      const key = uniqueFields.map(f => student[f]).join('|');
      if (!duplicateData.has(key)) {
        duplicateData.set(key, []);
      }
      duplicateData.get(key)!.push(student);
    });

    // Phase 3: Duplicate Handling
    const processedData: any[] = [];
    duplicateData.forEach((students, key) => {
      if (students.length > 1) {
        result.duplicates += students.length - 1;
        if (options.skipDuplicates) {
          result.skipped += students.length - 1;
          result.warnings.push(`Skipped ${students.length - 1} duplicate record(s) for ${key}`);
          processedData.push(students[0]);
        } else if (options.duplicateStrategy) {
          const merged = this.mergeDuplicates(students, options.duplicateStrategy);
          processedData.push(merged);
        } else {
          processedData.push(...students);
        }
      } else {
        processedData.push(students[0]);
      }
    });

    // Phase 4: Enrollment Verification (if needed)
    if (options.validateEnrollment && options.existingStudents) {
      const finalData: any[] = [];
      processedData.forEach((student, index) => {
        const conflicts = StudentImportValidator.checkEnrollmentConflicts(
          student,
          options.existingStudents || []
        );
        if (conflicts.length > 0) {
          result.failed++;
          result.skipped++;
          conflicts.forEach(conflict => {
            result.errors.push({
              rowNumber: student._originalIndex + 2,
              field: 'enrollment',
              message: conflict,
              value: student.email,
            });
          });
        } else {
          finalData.push(student);
          result.successful++;
        }
      });
      return {
        ...result,
        successful: finalData.length,
      };
    }

    result.successful = processedData.length;
    return result;
  }

  /**
   * Bulk import grades
   */
  async importGrades(
    data: any[],
    options: {
      skipDuplicates?: boolean;
      duplicateStrategy?: 'keep-first' | 'keep-last' | 'merge';
      validateEnrollment?: boolean;
      enrolledStudents?: any[];
    } = {}
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      totalProcessed: data.length,
      successful: 0,
      failed: 0,
      duplicates: 0,
      skipped: 0,
      errors: [],
      warnings: [],
    };

    const validatedData: any[] = [];
    const duplicateData = new Map<string, any[]>();

    // Phase 1: Validation
    data.forEach((grade, index) => {
      const validation = GradeImportValidator.validateGrade(grade);
      if (!validation.valid) {
        result.failed++;
        validation.errors.forEach(err => {
          result.errors.push({
            rowNumber: index + 2,
            field: 'grade',
            message: err,
            value: grade,
          });
        });
      } else {
        const transformed = GradeImportValidator.transformGradeData(grade);
        validatedData.push({ ...transformed, _originalIndex: index });
      }
    });

    // Phase 2: Enrollment Verification (if needed)
    let enrolledData = validatedData;
    if (options.validateEnrollment && options.enrolledStudents) {
      enrolledData = validatedData.filter(grade => {
        const isEnrolled = GradeImportValidator.verifyStudentEnrollment(
          grade.studentEmail,
          options.enrolledStudents || []
        );
        if (!isEnrolled) {
          result.failed++;
          result.skipped++;
          result.errors.push({
            rowNumber: grade._originalIndex + 2,
            field: 'studentEmail',
            message: `Student ${grade.studentEmail} not found in enrollment`,
            value: grade.studentEmail,
          });
        }
        return isEnrolled;
      });
    }

    // Phase 3: Duplicate Detection
    const uniqueFields = GradeImportValidator.getUniqueFields();
    enrolledData.forEach(grade => {
      const key = uniqueFields.map(f => grade[f]).join('|');
      if (!duplicateData.has(key)) {
        duplicateData.set(key, []);
      }
      duplicateData.get(key)!.push(grade);
    });

    // Phase 4: Duplicate Handling
    const processedData: any[] = [];
    duplicateData.forEach((grades, key) => {
      if (grades.length > 1) {
        result.duplicates += grades.length - 1;
        if (options.skipDuplicates) {
          result.skipped += grades.length - 1;
          result.warnings.push(`Skipped ${grades.length - 1} duplicate grade record(s) for ${key}`);
          processedData.push(grades[0]);
        } else if (options.duplicateStrategy) {
          const merged = this.mergeDuplicates(grades, options.duplicateStrategy);
          processedData.push(merged);
        } else {
          processedData.push(...grades);
        }
      } else {
        processedData.push(grades[0]);
      }
    });

    result.successful = processedData.length;
    return result;
  }

  /**
   * Bulk import attendance
   */
  async importAttendance(
    data: any[],
    options: {
      skipDuplicates?: boolean;
      duplicateStrategy?: 'keep-first' | 'keep-last' | 'merge';
      validateEnrollment?: boolean;
      enrolledStudents?: any[];
    } = {}
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      totalProcessed: data.length,
      successful: 0,
      failed: 0,
      duplicates: 0,
      skipped: 0,
      errors: [],
      warnings: [],
    };

    const validatedData: any[] = [];
    const duplicateData = new Map<string, any[]>();

    // Phase 1: Validation
    data.forEach((attendance, index) => {
      const validation = AttendanceImportValidator.validateAttendance(attendance);
      if (!validation.valid) {
        result.failed++;
        validation.errors.forEach(err => {
          result.errors.push({
            rowNumber: index + 2,
            field: 'attendance',
            message: err,
            value: attendance,
          });
        });
      } else {
        const transformed = AttendanceImportValidator.transformAttendanceData(attendance);
        validatedData.push({ ...transformed, _originalIndex: index });
      }
    });

    // Phase 2: Enrollment Verification (if needed)
    let enrolledData = validatedData;
    if (options.validateEnrollment && options.enrolledStudents) {
      enrolledData = validatedData.filter(att => {
        const isEnrolled = AttendanceImportValidator.verifyStudentInClass(
          att.studentEmail,
          att.class,
          options.enrolledStudents || []
        );
        if (!isEnrolled) {
          result.failed++;
          result.skipped++;
          result.errors.push({
            rowNumber: att._originalIndex + 2,
            field: 'studentEmail',
            message: `Student ${att.studentEmail} not enrolled in class ${att.class}`,
            value: att.studentEmail,
          });
        }
        return isEnrolled;
      });
    }

    // Phase 3: Duplicate Detection
    const uniqueFields = AttendanceImportValidator.getUniqueFields();
    enrolledData.forEach(att => {
      const key = uniqueFields.map(f => att[f]).join('|');
      if (!duplicateData.has(key)) {
        duplicateData.set(key, []);
      }
      duplicateData.get(key)!.push(att);
    });

    // Phase 4: Duplicate Handling
    const processedData: any[] = [];
    duplicateData.forEach((records, key) => {
      if (records.length > 1) {
        result.duplicates += records.length - 1;
        if (options.skipDuplicates) {
          result.skipped += records.length - 1;
          result.warnings.push(`Skipped ${records.length - 1} duplicate attendance record(s) for ${key}`);
          processedData.push(records[0]);
        } else if (options.duplicateStrategy) {
          const merged = this.mergeDuplicates(records, options.duplicateStrategy);
          processedData.push(merged);
        } else {
          processedData.push(...records);
        }
      } else {
        processedData.push(records[0]);
      }
    });

    result.successful = processedData.length;
    return result;
  }

  /**
   * Merge duplicate records
   */
  private mergeDuplicates(records: any[], strategy: 'keep-first' | 'keep-last' | 'merge'): any {
    if (strategy === 'keep-first') {
      return records[0];
    } else if (strategy === 'keep-last') {
      return records[records.length - 1];
    } else if (strategy === 'merge') {
      const merged = { ...records[0] };
      records.slice(1).forEach(record => {
        Object.keys(record).forEach(key => {
          if (record[key] && !merged[key]) {
            merged[key] = record[key];
          }
        });
      });
      return merged;
    }
    return records[0];
  }

  /**
   * Generate bulk operation report
   */
  generateBulkOperationReport(result: BulkOperationResult): string {
    const lines = [
      '=== BULK OPERATION REPORT ===',
      `Total Processed: ${result.totalProcessed}`,
      `Successful: ${result.successful}`,
      `Failed: ${result.failed}`,
      `Duplicates Found: ${result.duplicates}`,
      `Skipped: ${result.skipped}`,
      `Success Rate: ${((result.successful / result.totalProcessed) * 100).toFixed(1)}%`,
      '',
    ];

    if (result.warnings.length > 0) {
      lines.push('WARNINGS:');
      result.warnings.forEach(w => lines.push(`  - ${w}`));
      lines.push('');
    }

    if (result.errors.length > 0) {
      lines.push('ERRORS (First 20):');
      result.errors.slice(0, 20).forEach(err => {
        const fieldStr = err.field ? ` [${err.field}]` : '';
        lines.push(`  Row ${err.rowNumber}${fieldStr}: ${err.message}`);
      });
      if (result.errors.length > 20) {
        lines.push(`  ... and ${result.errors.length - 20} more errors`);
      }
    }

    return lines.join('\n');
  }
}

export default new BulkOperationService();
