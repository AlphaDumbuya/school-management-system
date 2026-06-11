/**
 * Validation types for import/export operations
 */

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'email' | 'date' | 'enum';
  required: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enumValues?: any[];
  customValidator?: (value: any) => boolean | string;
}

export interface ImportError {
  rowNumber: number;
  field?: string;
  message: string;
  value?: any;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
  warnings: string[];
  data: any[];
  importId?: string;
  timestamp?: string;
}

export interface BulkOperationResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  duplicates: number;
  skipped: number;
  errors: ImportError[];
  warnings: string[];
}

export interface DataExportOptions {
  format: 'csv' | 'excel' | 'json' | 'pdf';
  includeHeaders: boolean;
  delimiter?: string;
  encoding?: string;
}
