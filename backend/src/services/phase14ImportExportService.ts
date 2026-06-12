/**
 * Phase 14: Data Import/Export and Bulk Operations
 * 
 * Comprehensive import/export service for handling CSV, Excel, and data validation
 * with detailed error reporting and field mapping capabilities.
 */

import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import ExcelJS from 'exceljs';

/**
 * Import/Export Configuration and Types
 */
export interface FieldMapping {
  [csvColumn: string]: string; // Maps CSV column to database field
}

export interface ImportOptions {
  fileType: 'csv' | 'excel';
  fieldMapping: FieldMapping;
  tenantId: string;
  userId: string;
  importType: 'student' | 'grade' | 'attendance';
  duplicateHandling: 'skip' | 'merge' | 'error';
  validateOnly?: boolean;
}

export interface ImportResult {
  importId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: ImportError[];
  warnings: string[];
  summary: {
    created: number;
    updated: number;
    skipped: number;
    duplicates: number;
  };
  startedAt: Date;
  completedAt?: Date;
  fileUrl?: string;
}

export interface ImportError {
  rowNumber: number;
  field: string;
  value: any;
  errorMessage: string;
  suggestion?: string;
}

export interface ValidationRule {
  field: string;
  type: 'required' | 'email' | 'date' | 'numeric' | 'unique' | 'reference';
  message: string;
  options?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
    referenceTable?: string;
    referenceField?: string;
  };
}

export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  fields: string[];
  filters?: {
    tenantId?: string;
    startDate?: Date;
    endDate?: Date;
    classId?: string;
    studentId?: string;
    status?: string;
  };
  includeHeaders?: boolean;
  maskSensitive?: boolean;
}

/**
 * Phase 14: Comprehensive Import/Export Service
 */
export class Phase14ImportExportService {
  private db: Knex;
  private validationRules: Map<string, ValidationRule[]>;

  constructor(db: Knex) {
    this.db = db;
    this.validationRules = new Map();
    this.initializeValidationRules();
  }

  /**
   * Initialize validation rules for different import types
   */
  private initializeValidationRules(): void {
    // Student validation rules
    this.validationRules.set('student', [
      { field: 'first_name', type: 'required', message: 'First name is required' },
      { field: 'last_name', type: 'required', message: 'Last name is required' },
      { field: 'email', type: 'email', message: 'Invalid email format' },
      { field: 'date_of_birth', type: 'date', message: 'Invalid date format (use YYYY-MM-DD)' },
      { field: 'enrollment_date', type: 'required', message: 'Enrollment date is required' },
      { field: 'gender', type: 'required', message: 'Gender is required' },
    ]);

    // Grade validation rules
    this.validationRules.set('grade', [
      { field: 'student_id', type: 'reference', message: 'Student not found', options: { referenceTable: 'students', referenceField: 'student_id' } },
      { field: 'subject_id', type: 'reference', message: 'Subject not found', options: { referenceTable: 'subjects', referenceField: 'subject_id' } },
      { field: 'grade_value', type: 'numeric', message: 'Grade must be numeric', options: { min: 0, max: 100 } },
      { field: 'term', type: 'required', message: 'Term is required' },
    ]);

    // Attendance validation rules
    this.validationRules.set('attendance', [
      { field: 'student_id', type: 'reference', message: 'Student not found', options: { referenceTable: 'students', referenceField: 'student_id' } },
      { field: 'class_id', type: 'reference', message: 'Class not found', options: { referenceTable: 'classes', referenceField: 'class_id' } },
      { field: 'attendance_date', type: 'date', message: 'Invalid attendance date (use YYYY-MM-DD)' },
      { field: 'status', type: 'required', message: 'Attendance status is required' },
    ]);
  }

  /**
   * Parse CSV file content
   */
  async parseCSV(content: string): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
    try {
      const lines = content.trim().split('\n');
      if (lines.length < 2) {
        throw new AppError('CSV file must contain headers and at least one data row', 400, 'VALIDATION_ERROR');
      }

      // Parse header row
      const headers = this.parseCSVLine(lines[0]);
      const rows: Record<string, any>[] = [];

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue; // Skip empty rows

        const values = this.parseCSVLine(lines[i]);
        const row: Record<string, any> = {};

        headers.forEach((header, index) => {
          row[header.toLowerCase().trim()] = values[index]?.trim() || '';
        });

        rows.push(row);
      }

      logger.info(`Parsed CSV: ${headers.length} headers, ${rows.length} rows`);
      return { headers, rows };
    } catch (error) {
      throw new AppError(`Failed to parse CSV: ${(error as Error).message}`, 400, 'PARSE_ERROR');
    }
  }

  /**
   * Parse Excel file content
   */
  async parseExcel(buffer: Buffer): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
    try {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];

      if (!ws) {
        throw new AppError('Excel file contains no sheets', 400, 'PARSE_ERROR');
      }

      const allRows: any[][] = [];
      ws.eachRow((row) => {
        allRows.push((row.values as any[]).slice(1)); // strip 1-based index offset
      });

      if (allRows.length < 2) {
        throw new AppError('Excel sheet contains no data', 400, 'VALIDATION_ERROR');
      }

      const headers = allRows[0].map((v) => String(v ?? ''));
      const rows: Record<string, any>[] = allRows.slice(1).map((rowValues) => {
        const normalized: Record<string, any> = {};
        headers.forEach((h, i) => {
          normalized[h.toLowerCase().trim()] = rowValues[i] ?? '';
        });
        return normalized;
      });

      logger.info(`Parsed Excel: ${headers.length} headers, ${rows.length} rows`);
      return { headers, rows };
    } catch (error) {
      throw new AppError(`Failed to parse Excel: ${(error as Error).message}`, 400, 'PARSE_ERROR');
    }
  }

  /**
   * Parse CSV line with proper quote handling
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Validate import data against rules
   */
  async validateImportData(
    rows: Record<string, any>[],
    importType: string,
    tenantId: string,
    fieldMapping: FieldMapping
  ): Promise<{ valid: Record<string, any>[]; errors: ImportError[] }> {
    const rules = this.validationRules.get(importType) || [];
    const valid: Record<string, any>[] = [];
    const errors: ImportError[] = [];

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const mappedRow: Record<string, any> = {};
      const rowErrors: ImportError[] = [];

      // Map fields according to fieldMapping
      Object.entries(fieldMapping).forEach(([csvField, dbField]) => {
        mappedRow[dbField] = row[csvField.toLowerCase().trim()];
      });

      // Validate against rules
      for (const rule of rules) {
        const value = mappedRow[rule.field];

        switch (rule.type) {
          case 'required':
            if (!value || value === '') {
              rowErrors.push({
                rowNumber: rowIndex + 2, // +2 for header and 1-based indexing
                field: rule.field,
                value,
                errorMessage: rule.message,
                suggestion: `Please provide a value for ${rule.field}`,
              });
            }
            break;

          case 'email':
            if (value && !this.isValidEmail(value)) {
              rowErrors.push({
                rowNumber: rowIndex + 2,
                field: rule.field,
                value,
                errorMessage: rule.message,
                suggestion: 'Use a valid email format (e.g., user@example.com)',
              });
            }
            break;

          case 'date':
            if (value && !this.isValidDate(value)) {
              rowErrors.push({
                rowNumber: rowIndex + 2,
                field: rule.field,
                value,
                errorMessage: rule.message,
                suggestion: 'Use YYYY-MM-DD format for dates',
              });
            }
            break;

          case 'numeric':
            if (value && isNaN(Number(value))) {
              rowErrors.push({
                rowNumber: rowIndex + 2,
                field: rule.field,
                value,
                errorMessage: rule.message,
                suggestion: `${rule.field} must be a number`,
              });
            } else if (value && rule.options) {
              const numValue = Number(value);
              if (rule.options.min !== undefined && numValue < rule.options.min) {
                rowErrors.push({
                  rowNumber: rowIndex + 2,
                  field: rule.field,
                  value,
                  errorMessage: `${rule.field} must be at least ${rule.options.min}`,
                  suggestion: `Minimum value is ${rule.options.min}`,
                });
              }
              if (rule.options.max !== undefined && numValue > rule.options.max) {
                rowErrors.push({
                  rowNumber: rowIndex + 2,
                  field: rule.field,
                  value,
                  errorMessage: `${rule.field} must not exceed ${rule.options.max}`,
                  suggestion: `Maximum value is ${rule.options.max}`,
                });
              }
            }
            break;

          case 'reference':
            if (value && rule.options?.referenceTable && rule.options?.referenceField) {
              const exists = await this.db(rule.options.referenceTable)
                .where(rule.options.referenceField, value)
                .where('tenant_id', tenantId)
                .first();

              if (!exists) {
                rowErrors.push({
                  rowNumber: rowIndex + 2,
                  field: rule.field,
                  value,
                  errorMessage: rule.message,
                  suggestion: `${value} does not exist in ${rule.options.referenceTable}`,
                });
              }
            }
            break;

          case 'unique':
            if (value) {
              const existing = await this.db(importType + 's')
                .where(rule.field, value)
                .where('tenant_id', tenantId)
                .first();

              if (existing) {
                rowErrors.push({
                  rowNumber: rowIndex + 2,
                  field: rule.field,
                  value,
                  errorMessage: `${rule.field} must be unique`,
                  suggestion: `A record with this ${rule.field} already exists`,
                });
              }
            }
            break;
        }
      }

      if (rowErrors.length === 0) {
        valid.push(mappedRow);
      } else {
        errors.push(...rowErrors);
      }
    }

    logger.info(`Validation complete: ${valid.length} valid rows, ${errors.length} errors`);
    return { valid, errors };
  }

  /**
   * Process import job with detailed tracking
   */
  async processImport(
    importId: string,
    rows: Record<string, any>[],
    options: ImportOptions
  ): Promise<ImportResult> {
    const startTime = new Date();
    let successCount = 0;
    let failureCount = 0;
    let createCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    let duplicateCount = 0;
    const errors: ImportError[] = [];

    try {
      // Update import status
      await this.db('import_jobs').where('id', importId).update({
        status: 'processing',
        started_at: new Date(),
      });

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const result = await this.processImportRow(row, options);

          if (result.success) {
            successCount++;
            if (result.action === 'create') createCount++;
            else if (result.action === 'update') updateCount++;
          } else {
            failureCount++;
            if (result.isDuplicate) duplicateCount++;
            else skipCount++;

            if (result.error) {
              errors.push(result.error);
            }
          }
        } catch (rowError) {
          failureCount++;
          errors.push({
            rowNumber: i + 2,
            field: 'general',
            value: JSON.stringify(row),
            errorMessage: (rowError as Error).message,
          });
        }
      }

      // Update import completion
      const result: ImportResult = {
        importId,
        status: 'completed',
        totalRows: rows.length,
        successfulRows: successCount,
        failedRows: failureCount,
        errors,
        warnings: this.generateWarnings(successCount, failureCount),
        summary: {
          created: createCount,
          updated: updateCount,
          skipped: skipCount,
          duplicates: duplicateCount,
        },
        startedAt: startTime,
        completedAt: new Date(),
      };

      // Save import result
      await this.db('import_jobs').where('id', importId).update({
        status: 'completed',
        completed_at: new Date(),
        result: JSON.stringify(result),
      });

      logger.info(`Import ${importId} completed: ${successCount} success, ${failureCount} failed`);
      return result;
    } catch (error) {
      // Mark as failed
      await this.db('import_jobs').where('id', importId).update({
        status: 'failed',
        error_message: (error as Error).message,
        completed_at: new Date(),
      });

      throw error;
    }
  }

  /**
   * Process individual import row
   */
  private async processImportRow(
    row: Record<string, any>,
    options: ImportOptions
  ): Promise<{ success: boolean; action?: 'create' | 'update' | 'skip'; isDuplicate?: boolean; error?: ImportError }> {
    try {
      switch (options.importType) {
        case 'student':
          return await this.processStudentRow(row, options);
        case 'grade':
          return await this.processGradeRow(row, options);
        case 'attendance':
          return await this.processAttendanceRow(row, options);
        default:
          throw new AppError(`Unknown import type: ${options.importType}`, 400, 'VALIDATION_ERROR');
      }
    } catch (error) {
      return {
        success: false,
        error: {
          rowNumber: 0,
          field: 'general',
          value: row,
          errorMessage: (error as Error).message,
        },
      };
    }
  }

  /**
   * Process student import row
   */
  private async processStudentRow(
    row: Record<string, any>,
    options: ImportOptions
  ): Promise<{ success: boolean; action?: 'create' | 'update'; isDuplicate?: boolean }> {
    const email = row.email;

    // Check for duplicate
    if (email) {
      const existing = await this.db('students').where('email', email).where('tenant_id', options.tenantId).first();

      if (existing) {
        if (options.duplicateHandling === 'error') {
          return { success: false, isDuplicate: true };
        } else if (options.duplicateHandling === 'skip') {
          return { success: false, action: 'skip', isDuplicate: true };
        } else if (options.duplicateHandling === 'merge') {
          // Update existing student
          await this.db('students').where('student_id', existing.student_id).update({
            ...row,
            updated_at: new Date(),
          });
          return { success: true, action: 'update' };
        }
      }
    }

    // Create new student
    if (!options.validateOnly) {
      await this.db('students').insert({
        tenant_id: options.tenantId,
        ...row,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    return { success: true, action: 'create' };
  }

  /**
   * Process grade import row
   */
  private async processGradeRow(
    row: Record<string, any>,
    options: ImportOptions
  ): Promise<{ success: boolean; action?: 'create' | 'update' }> {
    // Verify enrollment
    const enrollment = await this.db('enrollments')
      .where('student_id', row.student_id)
      .where('class_id', row.class_id)
      .where('status', 'active')
      .first();

    if (!enrollment) {
      throw new AppError('Student is not enrolled in this class', 400, 'VALIDATION_ERROR');
    }

    // Create or update grade
    if (!options.validateOnly) {
      const existing = await this.db('grades')
        .where('student_id', row.student_id)
        .where('subject_id', row.subject_id)
        .where('term', row.term)
        .first();

      if (existing) {
        await this.db('grades').where('grade_id', existing.grade_id).update({
          ...row,
          updated_at: new Date(),
        });
        return { success: true, action: 'update' };
      } else {
        await this.db('grades').insert({
          ...row,
          created_at: new Date(),
          updated_at: new Date(),
        });
        return { success: true, action: 'create' };
      }
    }

    return { success: true, action: 'create' };
  }

  /**
   * Process attendance import row
   */
  private async processAttendanceRow(
    row: Record<string, any>,
    options: ImportOptions
  ): Promise<{ success: boolean; action?: 'create' | 'update' }> {
    // Verify student is enrolled in class
    const enrollment = await this.db('enrollments')
      .where('student_id', row.student_id)
      .where('class_id', row.class_id)
      .where('status', 'active')
      .first();

    if (!enrollment) {
      throw new AppError('Student is not enrolled in this class', 400, 'VALIDATION_ERROR');
    }

    // Create or update attendance
    if (!options.validateOnly) {
      const existing = await this.db('attendance')
        .where('student_id', row.student_id)
        .where('attendance_date', row.attendance_date)
        .first();

      if (existing) {
        await this.db('attendance').where('attendance_id', existing.attendance_id).update({
          ...row,
          updated_at: new Date(),
        });
        return { success: true, action: 'update' };
      } else {
        await this.db('attendance').insert({
          ...row,
          created_at: new Date(),
          updated_at: new Date(),
        });
        return { success: true, action: 'create' };
      }
    }

    return { success: true, action: 'create' };
  }

  /**
   * Export data to CSV format
   */
  async exportToCSV(options: ExportOptions): Promise<string> {
    const data = await this.fetchExportData(options);
    const headers = options.fields;
    const csv = [headers.join(',')];

    for (const row of data) {
      const values = headers.map((field) => {
        const value = row[field];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      csv.push(values.join(','));
    }

    return csv.join('\n');
  }

  /**
   * Export data to Excel format
   */
  async exportToExcel(options: ExportOptions): Promise<Buffer> {
    const data = await this.fetchExportData(options);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    if (data.length > 0) {
      ws.addRow(options.fields);
      data.forEach((row) => ws.addRow(options.fields.map((f) => row[f] ?? '')));
    }
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Fetch data for export
   */
  private async fetchExportData(options: ExportOptions): Promise<Record<string, any>[]> {
    let query = this.db(this.getTableName(options));

    if (options.filters?.tenantId) {
      query = query.where('tenant_id', options.filters.tenantId);
    }

    if (options.filters?.startDate) {
      query = query.where('created_at', '>=', options.filters.startDate);
    }

    if (options.filters?.endDate) {
      query = query.where('created_at', '<=', options.filters.endDate);
    }

    const data = await query.select(options.fields);

    if (options.maskSensitive) {
      return this.maskSensitiveData(data);
    }

    return data;
  }

  /**
   * Mask sensitive data in export
   */
  private maskSensitiveData(data: Record<string, any>[]): Record<string, any>[] {
    const sensitiveFields = ['password', 'password_hash', 'secret', 'token', 'ssn'];
    return data.map((row) => {
      const masked = { ...row };
      sensitiveFields.forEach((field) => {
        if (field in masked) {
          masked[field] = '***MASKED***';
        }
      });
      return masked;
    });
  }

  /**
   * Get table name for export
   */
  private getTableName(options: ExportOptions): string {
    if (options.filters?.studentId) return 'grades';
    if (options.filters?.classId) return 'attendance';
    return 'students'; // Default
  }

  /**
   * Utility: Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
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
   * Generate warnings based on import results
   */
  private generateWarnings(successCount: number, failureCount: number): string[] {
    const warnings: string[] = [];

    if (successCount === 0) {
      warnings.push('No records were successfully imported');
    }

    if (failureCount > 0) {
      const failureRate = (failureCount / (successCount + failureCount)) * 100;
      if (failureRate > 10) {
        warnings.push(`High failure rate: ${failureRate.toFixed(1)}% of records failed validation`);
      }
    }

    return warnings;
  }

  /**
   * Get import job details
   */
  async getImportJobDetails(importId: string): Promise<any> {
    const job = await this.db('import_jobs').where('id', importId).first();

    if (!job) {
      throw new AppError('Import job not found', 404, 'NOT_FOUND');
    }

    return {
      ...job,
      result: job.result ? JSON.parse(job.result) : null,
    };
  }

  /**
   * Get import error report
   */
  async getImportErrorReport(importId: string): Promise<any> {
    const job = await this.getImportJobDetails(importId);
    const result = job.result;

    if (!result || result.errors.length === 0) {
      return {
        importId,
        totalErrors: 0,
        errorsByField: {},
        errorsByRow: {},
      };
    }

    const errorsByField: Record<string, number> = {};
    const errorsByRow: Record<number, string[]> = {};

    result.errors.forEach((error: ImportError) => {
      // Group by field
      errorsByField[error.field] = (errorsByField[error.field] || 0) + 1;

      // Group by row
      if (!errorsByRow[error.rowNumber]) {
        errorsByRow[error.rowNumber] = [];
      }
      errorsByRow[error.rowNumber].push(`${error.field}: ${error.errorMessage}`);
    });

    return {
      importId,
      totalErrors: result.errors.length,
      errorsByField,
      errorsByRow,
      sampleErrors: result.errors.slice(0, 10),
    };
  }
}
