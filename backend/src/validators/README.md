# Data Import Validators

This directory contains comprehensive validators for bulk data import operations across the School Management System.

## Overview

The validators provide field-level validation, business rule enforcement, and data transformation for importing students, grades, and attendance records.

## Validators

### 1. StudentImportValidator
Validates student data with 14 fields including name, email, date of birth, and contact information.

**Features:**
- Name format validation (letters, spaces, hyphens, apostrophes)
- Email format validation
- Date of birth range (5-30 years old)
- Class assignment validation (24 valid classes)
- Phone number validation (10-15 digits)
- Duplicate detection by email
- Enrollment conflict checking
- Data normalization

**Usage:**
```typescript
import { StudentImportValidator } from './studentImportValidator';

// Get validation rules
const rules = StudentImportValidator.getValidationRules();

// Validate a single student
const student = {
  firstName: 'Ahmed',
  lastName: 'Hassan',
  email: 'ahmed@example.com',
  dateOfBirth: '2010-01-15',
  class: '10-A',
  phone: '0123456789'
};

const validation = StudentImportValidator.validateStudent(student);
if (!validation.valid) {
  console.log('Errors:', validation.errors);
}

// Transform and normalize data
const transformed = StudentImportValidator.transformStudentData(rawData);

// Check for enrollment conflicts
const conflicts = StudentImportValidator.checkEnrollmentConflicts(
  student,
  existingStudents
);
```

**Validation Rules:**
- firstName: 2-50 chars, letters/spaces/hyphens/apostrophes only
- lastName: 2-50 chars, letters/spaces/hyphens/apostrophes only
- email: Valid email format (required, unique)
- dateOfBirth: YYYY-MM-DD format, age 5-30 (required)
- class: One of 24 valid classes (required)
- phone: 10-15 digits (optional)
- gender: Male, Female, Other (optional)
- address: Max 255 chars (optional)
- city: Max 50 chars (optional)
- state: Max 50 chars (optional)
- zipCode: Max 10 chars (optional)
- parentName: Max 100 chars (optional)
- parentEmail: Valid email format (optional)
- parentPhone: 10-15 digits (optional)

### 2. GradeImportValidator
Validates grade data with 9 fields including marks, subject, and date.

**Features:**
- Subject validation (15 valid subjects)
- Marks range validation (0-100)
- Max marks validation (> 0)
- Date validation (no future dates)
- Automatic grade letter calculation (A+ to F)
- Percentage calculation
- Cross-field validation (marks ≤ maxMarks)
- Duplicate detection by (studentEmail, subject, date)
- Student enrollment verification

**Usage:**
```typescript
import { GradeImportValidator } from './gradeImportValidator';

// Get validation rules
const rules = GradeImportValidator.getValidationRules();

// Validate a grade
const grade = {
  studentEmail: 'ahmed@example.com',
  subject: 'Mathematics',
  marks: 92,
  maxMarks: 100,
  date: '2026-07-01'
};

const validation = GradeImportValidator.validateGrade(grade);

// Verify student enrollment
const isEnrolled = GradeImportValidator.verifyStudentEnrollment(
  'ahmed@example.com',
  enrolledStudents
);

// Calculate grade letter
const gradeLetter = GradeImportValidator.calculateGradeLetter(92, 100); // 'A+'

// Transform data
const transformed = GradeImportValidator.transformGradeData(rawGrade);
```

**Validation Rules:**
- studentEmail: Valid email format (required)
- subject: One of 15 subjects (required)
- marks: 0-100, ≤ maxMarks (required)
- maxMarks: > 0 (required)
- date: YYYY-MM-DD format, not future (required)
- class: One of 24 valid classes (optional)
- examType: Unit Test, Mid-term, Final, Quiz, Assignment, Project (optional)
- grade: A+, A, B+, B, C+, C, D, F (optional)
- remarks: Max 500 chars (optional)

**Subjects:**
Mathematics, English, Science, Social Studies, History, Geography, Physics, Chemistry, Biology, Computer Science, Physical Education, Art, Music, Economics, Business Studies

### 3. AttendanceImportValidator
Validates attendance data with 8 fields including date, status, and class.

**Features:**
- Status validation (present, absent, late, leave, sick)
- Class validation (24 valid classes)
- Date range validation (max 1 year old, not future)
- Period validation (1-8)
- Subject validation (15 valid subjects)
- Duplicate detection by (studentEmail, class, date)
- Student enrollment in class verification
- Attendance statistics calculation
- Attendance percentage calculation

**Usage:**
```typescript
import { AttendanceImportValidator } from './attendanceImportValidator';

// Get validation rules
const rules = AttendanceImportValidator.getValidationRules();

// Validate attendance
const attendance = {
  studentEmail: 'ahmed@example.com',
  class: '10-A',
  date: '2026-07-01',
  status: 'present'
};

const validation = AttendanceImportValidator.validateAttendance(attendance);

// Verify student in class
const isEnrolled = AttendanceImportValidator.verifyStudentInClass(
  'ahmed@example.com',
  '10-A',
  enrolledStudents
);

// Calculate attendance percentage
const percentage = AttendanceImportValidator.calculateAttendancePercentage(
  attendanceRecords,
  'ahmed@example.com',
  '2026-01-01',
  '2026-07-01'
);

// Get class statistics
const stats = AttendanceImportValidator.getClassAttendanceStats(
  records,
  '10-A'
);

// Transform data
const transformed = AttendanceImportValidator.transformAttendanceData(rawData);
```

**Validation Rules:**
- studentEmail: Valid email format (required)
- class: One of 24 valid classes (required)
- date: YYYY-MM-DD format, not future, not older than 1 year (required)
- status: present, absent, late, leave, sick (required)
- subject: One of 15 subjects (optional)
- period: 1-8 (optional)
- reason: Max 255 chars (optional)
- checkedBy: Max 100 chars (optional)

## Bulk Operation Service

The `BulkOperationService` orchestrates bulk import operations using these validators.

**Usage:**
```typescript
import BulkOperationService from '../services/bulkOperationService';

// Import students
const result = await BulkOperationService.importStudents(data, {
  skipDuplicates: true,
  duplicateStrategy: 'keep-first',
  validateEnrollment: false
});

// Generate report
const report = BulkOperationService.generateBulkOperationReport(result);
console.log(report);
```

## Validation Types

### ValidationRule Interface
```typescript
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
```

### ImportError Interface
```typescript
interface ImportError {
  rowNumber: number;
  field?: string;
  message: string;
  value?: any;
}
```

### BulkOperationResult Interface
```typescript
interface BulkOperationResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  duplicates: number;
  skipped: number;
  errors: ImportError[];
  warnings: string[];
}
```

## Error Handling

All validators provide detailed error messages with:
- Row number identification (for CSV/Excel imports)
- Field name specification
- Human-readable error messages
- Original value display for debugging

**Example Error:**
```json
{
  "rowNumber": 2,
  "field": "dateOfBirth",
  "message": "Student age must be between 5 and 30 years",
  "value": "1950-01-01"
}
```

## Duplicate Detection

### Student Duplicates
Detected by: **email**

### Grade Duplicates
Detected by: **studentEmail, subject, date** (composite key)

### Attendance Duplicates
Detected by: **studentEmail, class, date** (composite key)

## Merge Strategies

### keep-first
Keeps the first occurrence of duplicate records.

### keep-last
Keeps the most recent occurrence of duplicate records.

### merge
Intelligently combines non-conflicting fields from all duplicates.

## Testing

Each validator includes:
- Static validation methods for easy testing
- Transformation functions for data normalization
- Business logic validators
- Enrollment verification methods

**Example Test:**
```typescript
import { StudentImportValidator } from './studentImportValidator';

describe('StudentImportValidator', () => {
  it('should validate a valid student record', () => {
    const student = {
      firstName: 'Ahmed',
      lastName: 'Hassan',
      email: 'ahmed@example.com',
      dateOfBirth: '2010-01-15',
      class: '10-A',
      phone: '0123456789'
    };

    const result = StudentImportValidator.validateStudent(student);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid email', () => {
    const student = {
      firstName: 'Ahmed',
      lastName: 'Hassan',
      email: 'invalid-email',
      dateOfBirth: '2010-01-15',
      class: '10-A'
    };

    const result = StudentImportValidator.validateStudent(student);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
```

## Integration

These validators are used by:
- `BulkOperationService` - Orchestration of bulk operations
- `importExportRoutes` - API endpoints for import/export
- Frontend components (via API)
- Testing suites

## Performance

- **Validation**: O(n) where n = number of fields
- **Duplicate Detection**: O(n) with Set-based lookups
- **Memory Usage**: Optimized for large imports (1000+ records)
- **File Processing**: Stream-based parsing for large files

## Future Enhancements

1. Custom validator registration
2. Async validators (for database checks)
3. Conditional field validation
4. Field-level transformation hooks
5. Validation rule inheritance
6. Custom error messages per field

## Related Files

- `backend/src/types/validation.ts` - Type definitions
- `backend/src/services/bulkOperationService.ts` - Bulk operation orchestration
- `backend/src/services/importExportService.ts` - Import/export functionality
- `backend/src/routes/importExportRoutes.ts` - API endpoints
