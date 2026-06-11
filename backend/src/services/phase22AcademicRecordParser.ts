import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 22.1: Academic Record Parser
 * 
 * Provides JSON parsing for academic records with:
 * - Schema validation
 * - Error reporting with line numbers
 * - Type safety and conversion
 * - Detailed error messages
 */

export interface ParseError {
  line: number;
  column: number;
  path: string;
  message: string;
  value?: any;
  expected?: string;
  actual?: string;
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  errors: ParseError[];
  warnings: ParseError[];
  lineCount: number;
}

export interface AcademicRecord {
  studentId: string;
  classId: string;
  academicYear: string;
  term: string;
  grades: Array<{
    subjectId: string;
    subject: string;
    marks: number;
    maxMarks: number;
    grade: string;
    gradePoints: number;
  }>;
  gpa: number;
  attendance: number;
  behaviorRating?: string;
  comments?: string;
  createdAt: string;
  updatedAt: string;
}

export class AcademicRecordParser {
  /**
   * Parses JSON string to academic record
   * @param jsonString - JSON string to parse
   * @returns Parse result with data or errors
   */
  static parseRecord(jsonString: string): ParseResult<AcademicRecord> {
    const errors: ParseError[] = [];
    const warnings: ParseError[] = [];
    let data: AcademicRecord | undefined;

    try {
      // Parse JSON
      const parsedData = JSON.parse(jsonString);
      const lineCount = jsonString.split('\n').length;

      // Validate structure
      const validationResult = this.validateRecordSchema(parsedData);
      
      if (validationResult.errors.length > 0) {
        return {
          success: false,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          lineCount,
        };
      }

      data = this.convertToAcademicRecord(parsedData);

      return {
        success: true,
        data,
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        lineCount,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        const match = (error.message).match(/line (\d+)/);
        const line = match ? parseInt(match[1]) : 1;
        
        errors.push({
          line,
          column: 0,
          path: '$',
          message: `JSON Syntax Error: ${error.message}`,
          actual: 'invalid json',
          expected: 'valid json',
        });
      } else {
        errors.push({
          line: 1,
          column: 0,
          path: '$',
          message: `Parse Error: ${(error as Error).message}`,
        });
      }

      return {
        success: false,
        errors,
        warnings,
        lineCount: jsonString.split('\n').length,
      };
    }
  }

  /**
   * Parses array of academic records
   * @param jsonString - JSON array string
   * @returns Array of parse results
   */
  static parseRecords(jsonString: string): ParseResult<AcademicRecord[]> {
    const errors: ParseError[] = [];
    const warnings: ParseError[] = [];
    let data: AcademicRecord[] | undefined;
    const lineCount = jsonString.split('\n').length;

    try {
      const parsedData = JSON.parse(jsonString);

      if (!Array.isArray(parsedData)) {
        errors.push({
          line: 1,
          column: 0,
          path: '$',
          message: 'Expected array of records',
          actual: typeof parsedData,
          expected: 'array',
        });

        return {
          success: false,
          errors,
          warnings,
          lineCount,
        };
      }

      data = [];
      for (let i = 0; i < parsedData.length; i++) {
        const record = parsedData[i];
        const validationResult = this.validateRecordSchema(record, `$[${i}]`);

        if (validationResult.errors.length > 0) {
          errors.push(...validationResult.errors);
        }

        if (validationResult.warnings.length > 0) {
          warnings.push(...validationResult.warnings);
        }

        if (validationResult.errors.length === 0) {
          try {
            data.push(this.convertToAcademicRecord(record));
          } catch (error) {
            errors.push({
              line: i + 1,
              column: 0,
              path: `$[${i}]`,
              message: `Failed to convert record: ${(error as Error).message}`,
            });
          }
        }
      }

      return {
        success: errors.length === 0,
        data: errors.length === 0 ? data : undefined,
        errors,
        warnings,
        lineCount,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        errors.push({
          line: 1,
          column: 0,
          path: '$',
          message: `JSON Syntax Error: ${error.message}`,
        });
      }

      return {
        success: false,
        errors,
        warnings,
        lineCount,
      };
    }
  }

  /**
   * Validates record schema
   * @param record - Record to validate
   * @param path - JSON path for error reporting
   */
  private static validateRecordSchema(
    record: any,
    path: string = '$'
  ): { errors: ParseError[]; warnings: ParseError[] } {
    const errors: ParseError[] = [];
    const warnings: ParseError[] = [];

    // Check required fields
    const requiredFields = [
      'studentId',
      'classId',
      'academicYear',
      'term',
      'grades',
      'gpa',
      'attendance',
    ];

    for (const field of requiredFields) {
      if (!(field in record)) {
        errors.push({
          line: 0,
          column: 0,
          path: `${path}.${field}`,
          message: `Missing required field: ${field}`,
          expected: field,
        });
      }
    }

    // Validate field types
    if (typeof record.studentId !== 'string') {
      errors.push({
        line: 0,
        column: 0,
        path: `${path}.studentId`,
        message: 'studentId must be string',
        actual: typeof record.studentId,
        expected: 'string',
      });
    }

    if (typeof record.classId !== 'string') {
      errors.push({
        line: 0,
        column: 0,
        path: `${path}.classId`,
        message: 'classId must be string',
        actual: typeof record.classId,
        expected: 'string',
      });
    }

    if (typeof record.academicYear !== 'string') {
      errors.push({
        line: 0,
        column: 0,
        path: `${path}.academicYear`,
        message: 'academicYear must be string (format: YYYY-YYYY)',
        actual: typeof record.academicYear,
        expected: 'string',
      });
    }

    if (typeof record.term !== 'string') {
      errors.push({
        line: 0,
        column: 0,
        path: `${path}.term`,
        message: 'term must be string',
        actual: typeof record.term,
        expected: 'string',
      });
    }

    if (!Array.isArray(record.grades)) {
      errors.push({
        line: 0,
        column: 0,
        path: `${path}.grades`,
        message: 'grades must be array',
        actual: typeof record.grades,
        expected: 'array',
      });
    } else {
      for (let i = 0; i < record.grades.length; i++) {
        const grade = record.grades[i];
        const gradePath = `${path}.grades[${i}]`;

        if (typeof grade.subjectId !== 'string') {
          errors.push({
            line: 0,
            column: 0,
            path: `${gradePath}.subjectId`,
            message: 'subjectId must be string',
          });
        }

        if (typeof grade.marks !== 'number' || grade.marks < 0 || grade.marks > 100) {
          errors.push({
            line: 0,
            column: 0,
            path: `${gradePath}.marks`,
            message: 'marks must be number between 0-100',
            actual: grade.marks,
            expected: '0-100',
          });
        }

        if (typeof grade.maxMarks !== 'number' || grade.maxMarks <= 0) {
          errors.push({
            line: 0,
            column: 0,
            path: `${gradePath}.maxMarks`,
            message: 'maxMarks must be positive number',
          });
        }
      }
    }

    if (typeof record.gpa !== 'number' || record.gpa < 0 || record.gpa > 4) {
      errors.push({
        line: 0,
        column: 0,
        path: `${path}.gpa`,
        message: 'gpa must be number between 0-4',
        actual: record.gpa,
        expected: '0-4',
      });
    }

    if (typeof record.attendance !== 'number' || record.attendance < 0 || record.attendance > 100) {
      errors.push({
        line: 0,
        column: 0,
        path: `${path}.attendance`,
        message: 'attendance must be percentage between 0-100',
        actual: record.attendance,
        expected: '0-100',
      });
    }

    return { errors, warnings };
  }

  /**
   * Converts parsed object to AcademicRecord
   * @param data - Parsed data
   * @returns Converted academic record
   */
  private static convertToAcademicRecord(data: any): AcademicRecord {
    return {
      studentId: String(data.studentId),
      classId: String(data.classId),
      academicYear: String(data.academicYear),
      term: String(data.term),
      grades: (data.grades || []).map((g: any) => ({
        subjectId: String(g.subjectId),
        subject: String(g.subject || ''),
        marks: Number(g.marks),
        maxMarks: Number(g.maxMarks),
        grade: String(g.grade || ''),
        gradePoints: Number(g.gradePoints || 0),
      })),
      gpa: Number(data.gpa),
      attendance: Number(data.attendance),
      behaviorRating: data.behaviorRating ? String(data.behaviorRating) : undefined,
      comments: data.comments ? String(data.comments) : undefined,
      createdAt: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  /**
   * Validates record is valid academic record
   * @param record - Record to validate
   */
  static isValidRecord(record: any): boolean {
    const result = this.validateRecordSchema(record);
    return result.errors.length === 0;
  }

  /**
   * Gets formatted error message
   * @param error - Parse error
   */
  static formatError(error: ParseError): string {
    if (error.line > 0) {
      return `[Line ${error.line}:${error.column}] ${error.path}: ${error.message}`;
    }
    return `${error.path}: ${error.message}`;
  }

  /**
   * Gets all errors formatted
   * @param result - Parse result
   */
  static formatErrors(result: ParseResult<any>): string {
    if (result.errors.length === 0) {
      return 'No errors';
    }

    return result.errors
      .map((e) => this.formatError(e))
      .join('\n');
  }
}

export default AcademicRecordParser;
