import { ValidationRule } from '../types/validation';

/**
 * Grade Import Validator
 * Defines validation rules for bulk grade import operations
 */
export class GradeImportValidator {
  /**
   * Get validation rules for grade data
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
        field: 'subject',
        type: 'string',
        required: true,
        minLength: 2,
        maxLength: 50,
        customValidator: (value: any) => {
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
        field: 'marks',
        type: 'number',
        required: true,
        customValidator: (value: any) => {
          const marks = Number(value);
          if (isNaN(marks)) {
            return 'Marks must be a valid number';
          }
          if (marks < 0 || marks > 100) {
            return 'Marks must be between 0 and 100';
          }
          return true;
        },
      },
      {
        field: 'maxMarks',
        type: 'number',
        required: true,
        customValidator: (value: any) => {
          const maxMarks = Number(value);
          if (isNaN(maxMarks)) {
            return 'Max marks must be a valid number';
          }
          if (maxMarks <= 0) {
            return 'Max marks must be greater than 0';
          }
          return true;
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
          if (date > today) {
            return 'Grade date cannot be in the future';
          }

          return true;
        },
      },
      {
        field: 'class',
        type: 'string',
        required: false,
        customValidator: (value: any) => {
          if (!value || value === '') return true;
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
        field: 'examType',
        type: 'enum',
        required: false,
        enumValues: ['Unit Test', 'Mid-term', 'Final', 'Quiz', 'Assignment', 'Project'],
      },
      {
        field: 'grade',
        type: 'enum',
        required: false,
        enumValues: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D', 'F'],
      },
      {
        field: 'remarks',
        type: 'string',
        required: false,
        maxLength: 500,
      },
    ];
  }

  /**
   * Validate a grade record
   */
  static validateGrade(grade: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const rules = this.getValidationRules();

    rules.forEach((rule) => {
      const value = grade[rule.field];

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
          if (rule.enumValues && !rule.enumValues.includes(value)) {
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

    // Cross-field validation: marks should not exceed maxMarks
    if (grade.marks !== undefined && grade.maxMarks !== undefined) {
      if (Number(grade.marks) > Number(grade.maxMarks)) {
        errors.push('Marks cannot exceed max marks');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for enrollment verification
   */
  static verifyStudentEnrollment(studentEmail: string, enrolledStudents: any[]): boolean {
    return enrolledStudents.some(
      s => s.email?.toLowerCase() === studentEmail?.toLowerCase()
    );
  }

  /**
   * Calculate grade letter from marks percentage
   */
  static calculateGradeLetter(marks: number, maxMarks: number): string {
    const percentage = (marks / maxMarks) * 100;

    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'B+';
    if (percentage >= 75) return 'B';
    if (percentage >= 70) return 'C+';
    if (percentage >= 65) return 'C';
    if (percentage >= 50) return 'D';
    return 'F';
  }

  /**
   * Get unique field combinations for duplicate detection
   */
  static getUniqueFields(): string[] {
    return ['studentEmail', 'subject', 'date'];
  }

  /**
   * Transform raw import data to grade model
   */
  static transformGradeData(rawData: any): any {
    const marks = Number(rawData.marks);
    const maxMarks = Number(rawData.maxMarks);

    return {
      studentEmail: String(rawData.studentEmail).toLowerCase().trim(),
      subject: String(rawData.subject).trim(),
      marks,
      maxMarks,
      percentage: (marks / maxMarks) * 100,
      grade: this.calculateGradeLetter(marks, maxMarks),
      date: String(rawData.date).trim(),
      class: rawData.class ? String(rawData.class).trim().toUpperCase() : undefined,
      examType: rawData.examType ? String(rawData.examType).trim() : undefined,
      remarks: rawData.remarks ? String(rawData.remarks).trim() : undefined,
      importedAt: new Date().toISOString(),
    };
  }
}

export default GradeImportValidator;
