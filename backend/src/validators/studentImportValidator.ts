import { ValidationRule } from '../types/validation';

/**
 * Student Import Validator
 * Defines validation rules for bulk student import operations
 */
export class StudentImportValidator {
  /**
   * Get validation rules for student data
   */
  static getValidationRules(): ValidationRule[] {
    return [
      {
        field: 'firstName',
        type: 'string',
        required: true,
        minLength: 2,
        maxLength: 50,
        customValidator: (value: any) => {
          const str = String(value).trim();
          return /^[a-zA-Z\s'-]+$/.test(str) 
            ? true 
            : 'First name must contain only letters, spaces, hyphens, and apostrophes';
        },
      },
      {
        field: 'lastName',
        type: 'string',
        required: true,
        minLength: 2,
        maxLength: 50,
        customValidator: (value: any) => {
          const str = String(value).trim();
          return /^[a-zA-Z\s'-]+$/.test(str) 
            ? true 
            : 'Last name must contain only letters, spaces, hyphens, and apostrophes';
        },
      },
      {
        field: 'email',
        type: 'email',
        required: true,
        customValidator: (value: any) => {
          const email = String(value).toLowerCase().trim();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(email) ? true : 'Invalid email format';
        },
      },
      {
        field: 'dateOfBirth',
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

          const age = new Date().getFullYear() - date.getFullYear();
          if (age < 5 || age > 30) {
            return 'Student age must be between 5 and 30 years';
          }

          return true;
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
          return validClasses.includes(classStr) ? true : `Invalid class`;
        },
      },
      {
        field: 'phone',
        type: 'string',
        required: false,
        minLength: 10,
        maxLength: 15,
        customValidator: (value: any) => {
          if (!value || value === '') return true;
          const phone = String(value).trim();
          return /^\d{10,15}$/.test(phone.replace(/[\s\-\+\(\)]/g, '')) 
            ? true 
            : 'Phone must contain 10-15 digits';
        },
      },
      {
        field: 'gender',
        type: 'enum',
        required: false,
        enumValues: ['Male', 'Female', 'Other'],
      },
      {
        field: 'address',
        type: 'string',
        required: false,
        maxLength: 255,
      },
      {
        field: 'city',
        type: 'string',
        required: false,
        maxLength: 50,
      },
      {
        field: 'state',
        type: 'string',
        required: false,
        maxLength: 50,
      },
      {
        field: 'zipCode',
        type: 'string',
        required: false,
        maxLength: 10,
      },
      {
        field: 'parentName',
        type: 'string',
        required: false,
        maxLength: 100,
      },
      {
        field: 'parentEmail',
        type: 'email',
        required: false,
      },
      {
        field: 'parentPhone',
        type: 'string',
        required: false,
        minLength: 10,
        maxLength: 15,
      },
    ];
  }

  /**
   * Validate a student record
   */
  static validateStudent(student: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const rules = this.getValidationRules();

    rules.forEach((rule) => {
      const value = student[rule.field];

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

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get unique field combinations for duplicate detection
   */
  static getUniqueFields(): string[] {
    return ['email'];
  }

  /**
   * Check for enrollment conflicts
   */
  static checkEnrollmentConflicts(student: any, existingStudents: any[]): string[] {
    const conflicts: string[] = [];

    const emailConflict = existingStudents.find(
      s => s.email?.toLowerCase() === student.email?.toLowerCase()
    );
    if (emailConflict) {
      conflicts.push(`Student with email ${student.email} already exists`);
    }

    const nameConflict = existingStudents.find(
      s => s.firstName?.toLowerCase() === student.firstName?.toLowerCase() &&
           s.lastName?.toLowerCase() === student.lastName?.toLowerCase() &&
           s.dateOfBirth === student.dateOfBirth
    );
    if (nameConflict) {
      conflicts.push(`Student with same name and DOB already enrolled`);
    }

    return conflicts;
  }

  /**
   * Transform raw import data to student model
   */
  static transformStudentData(rawData: any): any {
    return {
      firstName: String(rawData.firstName).trim(),
      lastName: String(rawData.lastName).trim(),
      email: String(rawData.email).toLowerCase().trim(),
      dateOfBirth: String(rawData.dateOfBirth).trim(),
      class: String(rawData.class).trim().toUpperCase(),
      phone: rawData.phone ? String(rawData.phone).trim() : undefined,
      gender: rawData.gender ? String(rawData.gender).trim() : undefined,
      address: rawData.address ? String(rawData.address).trim() : undefined,
      city: rawData.city ? String(rawData.city).trim() : undefined,
      state: rawData.state ? String(rawData.state).trim() : undefined,
      zipCode: rawData.zipCode ? String(rawData.zipCode).trim() : undefined,
      parentName: rawData.parentName ? String(rawData.parentName).trim() : undefined,
      parentEmail: rawData.parentEmail ? String(rawData.parentEmail).toLowerCase().trim() : undefined,
      parentPhone: rawData.parentPhone ? String(rawData.parentPhone).trim() : undefined,
      importedAt: new Date().toISOString(),
    };
  }
}

export default StudentImportValidator;
