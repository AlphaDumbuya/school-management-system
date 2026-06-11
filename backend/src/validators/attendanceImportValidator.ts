import { ValidationRule } from '../types/validation';

/**
 * Attendance Import Validator
 * Defines validation rules for bulk attendance import operations
 */
export class AttendanceImportValidator {
  /**
   * Get validation rules for attendance data
   */
  static getValidationRules(): ValidationRule[] {
    return [
      {
        field: 'studentEmail',
        type: 'email',
        required: true,
        customValidator: (value: any) => {
          const email = String(value).toLowerCase().trim();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email) ? true : 'Invalid student email format';
        },
      },
      {
        field: 'class',
        type: 'string',
        required: true,
        customValidator: (value: any) => {
          const classStr = String(value).trim().toUpperCase();
          const validClasses = [
            '1-A', '1-B', '2-A', '2-B', '3-A', '3-B', '4-A', '4-B', 
            '5-A', '5-B', '6-A', '6-B', '7-A', '7-B', '8-A', '8-B', 
            '9-A', '9-B', '10-A', '10-B', '11-A', '11-B', '12-A', '12-B'
          ];
          return validClasses.includes(classStr) ? true : 'Invalid class';
        },
      },
      {
        field: 'date',
        type: 'date',
        required: true,
        customValidator: (value: any) => {
          const dateStr = String(value).trim();
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          
          if (!dateRegex.test(dateStr)) {
            return 'Date must be in YYYY-MM-DD format';
          }

          const date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            return 'Invalid date value';
          }

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          if (date > today) {
            return 'Attendance date cannot be in the future';
          }

          const yearAgo = new Date(today);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          if (date < yearAgo) {
            return 'Attendance record is too old (older than 1 year)';
          }

          return true;
        },
      },
      {
        field: 'status',
        type: 'enum',
        required: true,
        enumValues: ['present', 'absent', 'late', 'leave', 'sick'],
      },
      {
        field: 'subject',
        type: 'string',
        required: false,
        minLength: 2,
        maxLength: 50,
        customValidator: (value: any) => {
          if (!value || value === '') return true;
          const subject = String(value).trim();
          const validSubjects = [
            'Mathematics', 'English', 'Science', 'Social Studies', 'History',
            'Geography', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
            'Physical Education', 'Art', 'Music', 'Economics', 'Business Studies'
          ];
          return validSubjects.includes(subject) ? true : 'Invalid subject';
        },
      },
      {
        field: 'period',
        type: 'number',
        required: false,
        customValidator: (value: any) => {
          if (!value || value === '') return true;
          const period = Number(value);
          return period >= 1 && period <= 8 ? true : 'Period must be between 1 and 8';
        },
      },
      {
        field: 'reason',
        type: 'string',
        required: false,
        maxLength: 255,
      },
      {
        field: 'checkedBy',
        type: 'string',
        required: false,
        maxLength: 100,
      },
    ];
  }

  /**
   * Validate an attendance record
   */
  static validateAttendance(attendance: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const rules = this.getValidationRules();

    rules.forEach((rule) => {
      const value = attendance[rule.field];

      if (rule.required && (value === null || value === undefined || value === '')) {
        errors.push(`${rule.field} is required`);
        return;
      }

      if (!rule.required && (value === null || value === undefined || value === '')) {
        return;
      }

      switch (rule.type) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(String(value))) {
            errors.push(`${rule.field} must be a valid email`);
          }
          break;

        case 'number':
          if (isNaN(Number(value))) {
            errors.push(`${rule.field} must be a number`);
          }
          break;

        case 'date':
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          if (!dateRegex.test(String(value))) {
            errors.push(`${rule.field} must be in YYYY-MM-DD format`);
          }
          break;

        case 'enum':
          if (rule.enumValues && !rule.enumValues.includes(String(value).toLowerCase())) {
            errors.push(`${rule.field} must be one of: ${rule.enumValues.join(', ')}`);
          }
          break;

        case 'string':
          if (rule.minLength && String(value).length < rule.minLength) {
            errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
          }
          if (rule.maxLength && String(value).length > rule.maxLength) {
            errors.push(`${rule.field} must be at most ${rule.maxLength} characters`);
          }
          break;
      }

      if (rule.customValidator) {
        const result = rule.customValidator(value);
        if (result !== true) {
          errors.push(typeof result === 'string' ? result : `${rule.field} validation failed`);
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for class and student verification
   */
  static verifyStudentInClass(studentEmail: string, classId: string, enrolledStudents: any[]): boolean {
    return enrolledStudents.some(
      s => s.email?.toLowerCase() === studentEmail?.toLowerCase() &&
           s.class?.toUpperCase() === classId?.toUpperCase()
    );
  }

  /**
   * Check for duplicate attendance entries
   */
  static checkDuplicateEntry(
    studentEmail: string,
    date: string,
    period: number | undefined,
    existingRecords: any[]
  ): boolean {
    return existingRecords.some(
      r => r.studentEmail?.toLowerCase() === studentEmail?.toLowerCase() &&
           r.date === date &&
           (period === undefined || r.period === period)
    );
  }

  /**
   * Get unique field combinations for duplicate detection
   */
  static getUniqueFields(): string[] {
    return ['studentEmail', 'class', 'date'];
  }

  /**
   * Calculate attendance percentage
   */
  static calculateAttendancePercentage(
    records: any[],
    studentEmail: string,
    startDate: string,
    endDate: string
  ): number {
    const studentRecords = records.filter(
      r => r.studentEmail?.toLowerCase() === studentEmail?.toLowerCase() &&
           r.date >= startDate &&
           r.date <= endDate
    );

    if (studentRecords.length === 0) return 0;

    const presentDays = studentRecords.filter(
      r => r.status?.toLowerCase() === 'present'
    ).length;

    return (presentDays / studentRecords.length) * 100;
  }

  /**
   * Transform raw import data to attendance model
   */
  static transformAttendanceData(rawData: any): any {
    return {
      studentEmail: String(rawData.studentEmail).toLowerCase().trim(),
      class: String(rawData.class).trim().toUpperCase(),
      date: String(rawData.date).trim(),
      status: String(rawData.status).toLowerCase().trim(),
      subject: rawData.subject ? String(rawData.subject).trim() : undefined,
      period: rawData.period ? Number(rawData.period) : undefined,
      reason: rawData.reason ? String(rawData.reason).trim() : undefined,
      checkedBy: rawData.checkedBy ? String(rawData.checkedBy).trim() : undefined,
      importedAt: new Date().toISOString(),
    };
  }

  /**
   * Get attendance statistics for a class
   */
  static getClassAttendanceStats(records: any[], classId: string): {
    totalDays: number;
    studentCount: number;
    presentCount: number;
    absentCount: number;
    lateCount: number;
    averageAttendance: number;
  } {
    const classRecords = records.filter(
      r => r.class?.toUpperCase() === classId?.toUpperCase()
    );

    const uniqueStudents = new Set(classRecords.map(r => r.studentEmail));
    const uniqueDates = new Set(classRecords.map(r => r.date));

    const presentCount = classRecords.filter(r => r.status?.toLowerCase() === 'present').length;
    const absentCount = classRecords.filter(r => r.status?.toLowerCase() === 'absent').length;
    const lateCount = classRecords.filter(r => r.status?.toLowerCase() === 'late').length;

    return {
      totalDays: uniqueDates.size,
      studentCount: uniqueStudents.size,
      presentCount,
      absentCount,
      lateCount,
      averageAttendance: ((presentCount + lateCount) / classRecords.length) * 100,
    };
  }
}

export default AttendanceImportValidator;
