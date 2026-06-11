import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';

interface ImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
  warnings: string[];
  data: any[];
}

interface ImportError {
  rowNumber: number;
  field?: string;
  message: string;
  value?: any;
}

interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'email' | 'date' | 'enum';
  required: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enumValues?: any[];
  customValidator?: (value: any) => boolean | string;
}

/**
 * Service for handling data import and export operations
 * Supports CSV, Excel, and other formats
 */
export class ImportExportService {
  /**
   * Parse CSV file into array of objects
   */
  parseCSV(filePath: string): any[] {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
    });
    return records;
  }

  /**
   * Parse Excel file into array of objects
   */
  parseExcel(filePath: string, sheetName?: string): any[] {
    const workbook = XLSX.readFile(filePath);
    const sheet = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheet];
    const records = XLSX.utils.sheet_to_json(worksheet);
    return records;
  }

  /**
   * Parse uploaded file (CSV or Excel)
   */
  parseUploadedFile(filePath: string): any[] {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === '.csv') {
      return this.parseCSV(filePath);
    } else if (['.xlsx', '.xls'].includes(extension)) {
      return this.parseExcel(filePath);
    } else {
      throw new Error(`Unsupported file format: ${extension}`);
    }
  }

  /**
   * Validate data against rules
   */
  validateData(data: any[], validationRules: ValidationRule[]): ImportError[] {
    const errors: ImportError[] = [];

    data.forEach((row, rowIndex) => {
      const rowNumber = rowIndex + 2; // +2 because of 1-based indexing and header row

      validationRules.forEach((rule) => {
        const value = row[rule.field];

        // Check required
        if (rule.required && (value === null || value === undefined || value === '')) {
          errors.push({
            rowNumber,
            field: rule.field,
            message: `${rule.field} is required`,
            value,
          });
          return;
        }

        // Skip further validation if field is empty and not required
        if (!rule.required && (value === null || value === undefined || value === '')) {
          return;
        }

        // Type validation
        switch (rule.type) {
          case 'email':
            if (!this.isValidEmail(value)) {
              errors.push({
                rowNumber,
                field: rule.field,
                message: `${rule.field} must be a valid email address`,
                value,
              });
            }
            break;

          case 'number':
            if (isNaN(Number(value))) {
              errors.push({
                rowNumber,
                field: rule.field,
                message: `${rule.field} must be a number`,
                value,
              });
            }
            break;

          case 'date':
            if (!this.isValidDate(value)) {
              errors.push({
                rowNumber,
                field: rule.field,
                message: `${rule.field} must be a valid date (YYYY-MM-DD)`,
                value,
              });
            }
            break;

          case 'enum':
            if (rule.enumValues && !rule.enumValues.includes(value)) {
              errors.push({
                rowNumber,
                field: rule.field,
                message: `${rule.field} must be one of: ${rule.enumValues.join(', ')}`,
                value,
              });
            }
            break;

          case 'string':
            if (typeof value !== 'string' && !Number.isNaN(value)) {
              errors.push({
                rowNumber,
                field: rule.field,
                message: `${rule.field} must be a string`,
                value,
              });
            }

            if (rule.minLength && value.length < rule.minLength) {
              errors.push({
                rowNumber,
                field: rule.field,
                message: `${rule.field} must be at least ${rule.minLength} characters long`,
                value,
              });
            }

            if (rule.maxLength && value.length > rule.maxLength) {
              errors.push({
                rowNumber,
                field: rule.field,
                message: `${rule.field} must be at most ${rule.maxLength} characters long`,
                value,
              });
            }

            if (rule.pattern && !rule.pattern.test(String(value))) {
              errors.push({
                rowNumber,
                field: rule.field,
                message: `${rule.field} has invalid format`,
                value,
              });
            }
            break;
        }

        // Custom validator
        if (rule.customValidator) {
          const result = rule.customValidator(value);
          if (result !== true) {
            errors.push({
              rowNumber,
              field: rule.field,
              message: typeof result === 'string' ? result : `${rule.field} validation failed`,
              value,
            });
          }
        }
      });
    });

    return errors;
  }

  /**
   * Export data to CSV format
   */
  exportToCSV(data: any[], filePath: string): void {
    const csvContent = stringify(data, {
      header: true,
    });

    fs.writeFileSync(filePath, csvContent);
  }

  /**
   * Export data to Excel format
   */
  exportToExcel(data: any[], filePath: string, sheetName = 'Data'): void {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filePath);
  }

  /**
   * Detect duplicates in imported data
   */
  detectDuplicates(data: any[], uniqueFields: string[]): any[] {
    const seen = new Set<string>();
    const duplicates: any[] = [];

    data.forEach((row) => {
      const key = uniqueFields.map((field) => row[field]).join('|');

      if (seen.has(key)) {
        duplicates.push(row);
      } else {
        seen.add(key);
      }
    });

    return duplicates;
  }

  /**
   * Merge duplicate records based on strategy
   */
  mergeDuplicates(
    data: any[],
    uniqueFields: string[],
    strategy: 'keep-first' | 'keep-last' | 'merge'
  ): any[] {
    const grouped = new Map<string, any[]>();

    data.forEach((row) => {
      const key = uniqueFields.map((field) => row[field]).join('|');
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(row);
    });

    const result: any[] = [];

    grouped.forEach((rows) => {
      if (rows.length === 1) {
        result.push(rows[0]);
      } else if (strategy === 'keep-first') {
        result.push(rows[0]);
      } else if (strategy === 'keep-last') {
        result.push(rows[rows.length - 1]);
      } else if (strategy === 'merge') {
        const merged = { ...rows[0] };
        rows.slice(1).forEach((row) => {
          Object.keys(row).forEach((key) => {
            if (row[key] && !merged[key]) {
              merged[key] = row[key];
            }
          });
        });
        result.push(merged);
      }
    });

    return result;
  }

  /**
   * Private helper methods
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidDate(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Generate import summary report
   */
  generateImportReport(result: ImportResult): string {
    const lines = [
      '=== IMPORT SUMMARY REPORT ===',
      `Total Records Processed: ${result.success + result.failed}`,
      `Successful: ${result.success}`,
      `Failed: ${result.failed}`,
      `Success Rate: ${((result.success / (result.success + result.failed)) * 100).toFixed(1)}%`,
      '',
    ];

    if (result.warnings.length > 0) {
      lines.push('WARNINGS:');
      result.warnings.forEach((w) => lines.push(`  - ${w}`));
      lines.push('');
    }

    if (result.errors.length > 0) {
      lines.push('ERRORS:');
      result.errors.forEach((err) => {
        const fieldStr = err.field ? ` [${err.field}]` : '';
        lines.push(`  Row ${err.rowNumber}${fieldStr}: ${err.message}`);
        if (err.value !== undefined) {
          lines.push(`    Value: ${JSON.stringify(err.value)}`);
        }
      });
    }

    return lines.join('\n');
  }

  /**
   * Export import report to file
   */
  exportImportReport(result: ImportResult, filePath: string): void {
    const report = this.generateImportReport(result);
    fs.writeFileSync(filePath, report);
  }
}

export default new ImportExportService();
