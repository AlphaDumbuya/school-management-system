import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

export interface ImportRow {
  [key: string]: any;
}

export interface ImportOptions {
  fieldMapping?: Record<string, string>;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
}

export interface ImportResult {
  import_id: string;
  total_records: number;
  successful_imports: number;
  failed_imports: number;
  skipped_records: number;
  errors: Array<{ row_number: number; error: string; error_type: string }>;
}

export class BulkImportService {
  constructor(private db: Knex) {}

  /**
   * Start a bulk import job
   */
  async startImportJob(
    fileName: string,
    fileType: string,
    fileSize: number,
    userId: string
  ): Promise<string> {
    const [importId] = await this.db('student_imports').insert({
      file_name: fileName,
      file_type: fileType,
      file_size: fileSize,
      imported_by: userId,
      status: 'pending',
      total_records: 0,
      successful_imports: 0,
      failed_imports: 0,
      skipped_records: 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    logger.info(`Import job created: ${importId} (${fileName})`);
    return importId;
  }

  /**
   * Parse CSV and validate rows
   */
  parseAndValidateCSV(
    csvData: string,
    fieldMapping?: Record<string, string>
  ): {
    rows: ImportRow[];
    errors: Array<{ row_number: number; error: string }>;
  } {
    const rows: ImportRow[] = [];
    const errors: Array<{ row_number: number; error: string }> = [];

    try {
      const lines = csvData.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        throw new AppError('CSV file must have headers and at least one data row', 400, 'VALIDATION_ERROR');
      }

      const headers = this.parseCSVLine(lines[0]);
      const defaultMapping = this.createDefaultFieldMapping(headers);
      const mapping = fieldMapping || defaultMapping;

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = this.parseCSVLine(lines[i]);
          const row: ImportRow = {};

          for (const [csvColumn, fieldName] of Object.entries(mapping)) {
            const columnIndex = headers.indexOf(csvColumn);
            if (columnIndex >= 0 && values[columnIndex]) {
              row[fieldName] = values[columnIndex].trim();
            }
          }

          const validation = this.validateStudentRow(row);
          if (validation.errors.length > 0) {
            validation.errors.forEach((error) => {
              errors.push({ row_number: i + 1, error });
            });
          } else {
            rows.push(row);
          }
        } catch (error) {
          errors.push({
            row_number: i + 1,
            error: `Failed to parse row: ${(error as any).message}`,
          });
        }
      }

      return { rows, errors };
    } catch (error) {
      logger.error('CSV parsing error:', error);
      throw new AppError(`Failed to parse CSV file: ${(error as any).message}`, 400, 'PARSE_ERROR');
    }
  }

  /**
   * Process bulk import
   */
  async processBulkImport(
    importId: string,
    rows: ImportRow[],
    options: ImportOptions = {},
    userId: string
  ): Promise<ImportResult> {
    await this.updateImportStatus(importId, 'in_progress');

    const result: ImportResult = {
      import_id: importId,
      total_records: rows.length,
      successful_imports: 0,
      failed_imports: 0,
      skipped_records: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];

        const existingStudent = await this.db('students')
          .where('email', row.email)
          .first();

        if (existingStudent) {
          if (options.updateExisting) {
            await this.updateStudentFromRow(existingStudent.id, row, importId, userId);
            result.successful_imports++;
          } else if (options.skipDuplicates) {
            result.skipped_records++;
          } else {
            throw new Error('Duplicate student email');
          }
        } else {
          await this.createStudentFromRow(row, importId, userId);
          result.successful_imports++;
        }
      } catch (error) {
        result.failed_imports++;
        result.errors.push({
          row_number: i + 1,
          error: (error as any).message,
          error_type: 'import_error',
        });

        try {
          await this.db('import_errors').insert({
            import_id: importId,
            row_number: i + 1,
            error_message: (error as any).message,
            row_data: rows[i],
            error_type: 'import_error',
            created_at: new Date(),
          });
        } catch (dbError) {
          logger.error('Failed to log import error:', dbError);
        }
      }
    }

    await this.db('student_imports')
      .where('id', importId)
      .update({
        status: 'completed',
        total_records: result.total_records,
        successful_imports: result.successful_imports,
        failed_imports: result.failed_imports,
        skipped_records: result.skipped_records,
        completed_at: new Date(),
        updated_at: new Date(),
      });

    logger.info(
      `Import completed: ${importId} (Success: ${result.successful_imports}, Failed: ${result.failed_imports})`
    );

    return result;
  }

  /**
   * Get import job details
   */
  async getImportJobDetails(importId: string): Promise<any> {
    const importJob = await this.db('student_imports').where('id', importId).first();

    if (!importJob) {
      throw new AppError('Import job not found', 404, 'NOT_FOUND');
    }

    const errors = await this.db('import_errors')
      .where('import_id', importId)
      .orderBy('row_number', 'asc');

    return { ...importJob, errors };
  }

  /**
   * Get import jobs history
   */
  async getImportJobsHistory(filters?: {
    status?: string;
    imported_by?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.db('student_imports');

    if (filters?.status) {
      query = query.where('status', filters.status);
    }

    if (filters?.imported_by) {
      query = query.where('imported_by', filters.imported_by);
    }

    const countResult = await query.clone().count('* as count').first();
    const total = countResult.count;

    const jobs = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      data: jobs,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Create student from import row
   */
  private async createStudentFromRow(row: ImportRow, importId: string, userId: string): Promise<string> {
    const userId_gen = await this.getOrCreateUser(row, userId);
    const [studentId] = await this.db('students').insert({
      user_id: userId_gen,
      student_id: this.generateStudentId(),
      date_of_birth: row.date_of_birth,
      gender: row.gender,
      phone: row.phone,
      address: row.address,
      city: row.city,
      state: row.state,
      postal_code: row.postal_code,
      country: row.country,
      status: 'active',
      enrollment_date: row.enrollment_date || new Date().toISOString().split('T')[0],
      import_id: importId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return studentId;
  }

  /**
   * Update student from import row
   */
  private async updateStudentFromRow(
    studentId: string,
    row: ImportRow,
    importId: string,
    userId: string
  ): Promise<void> {
    const updateData: any = { updated_at: new Date() };

    if (row.phone) updateData.phone = row.phone;
    if (row.address) updateData.address = row.address;
    if (row.city) updateData.city = row.city;
    if (row.state) updateData.state = row.state;
    if (row.postal_code) updateData.postal_code = row.postal_code;
    if (row.country) updateData.country = row.country;

    await this.db('students').where('id', studentId).update(updateData);
  }

  /**
   * Get or create user for student
   */
  private async getOrCreateUser(row: ImportRow, createdBy: string): Promise<string> {
    const existingUser = await this.db('users').where('email', row.email).first();

    if (existingUser) {
      return existingUser.id;
    }

    const [userId] = await this.db('users').insert({
      email: row.email,
      password_hash: 'placeholder',
      first_name: row.first_name,
      last_name: row.last_name,
      role: 'student',
      status: 'active',
      created_by: createdBy,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return userId;
  }

  /**
   * Validate student data row
   */
  private validateStudentRow(row: ImportRow): { errors: string[] } {
    const errors: string[] = [];

    if (!row.first_name) errors.push('first_name is required');
    if (!row.last_name) errors.push('last_name is required');
    if (!row.email) errors.push('email is required');

    if (row.email && !this.isValidEmail(row.email)) {
      errors.push('Invalid email format');
    }

    if (row.date_of_birth && !this.isValidDate(row.date_of_birth)) {
      errors.push('date_of_birth must be in YYYY-MM-DD format');
    }

    if (row.date_of_birth) {
      const dob = new Date(row.date_of_birth);
      const age = new Date().getFullYear() - dob.getFullYear();
      if (age < 3 || age > 30) {
        errors.push('Student age must be between 3 and 30 years');
      }
    }

    return { errors };
  }

  /**
   * Parse CSV line
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result.map((val) => val.trim());
  }

  /**
   * Create default field mapping from headers
   */
  private createDefaultFieldMapping(headers: string[]): Record<string, string> {
    const mapping: Record<string, string> = {};
    const fieldMap: Record<string, string> = {
      'First Name': 'first_name',
      'Last Name': 'last_name',
      Email: 'email',
      'Date of Birth': 'date_of_birth',
      Gender: 'gender',
      Phone: 'phone',
      Address: 'address',
      City: 'city',
      State: 'state',
      'Postal Code': 'postal_code',
      Country: 'country',
      'Enrollment Date': 'enrollment_date',
    };

    for (const header of headers) {
      const trimmedHeader = header.trim();
      if (fieldMap[trimmedHeader]) {
        mapping[trimmedHeader] = fieldMap[trimmedHeader];
      }
    }

    return mapping;
  }

  /**
   * Generate unique student ID
   */
  private generateStudentId(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, '0');
    return `STU-${year}-${random}`;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate date format (YYYY-MM-DD)
   */
  private isValidDate(dateString: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateString)) return false;

    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  /**
   * Update import status
   */
  private async updateImportStatus(importId: string, status: string): Promise<void> {
    await this.db('student_imports')
      .where('id', importId)
      .update({ status, started_at: new Date(), updated_at: new Date() });
  }
}
