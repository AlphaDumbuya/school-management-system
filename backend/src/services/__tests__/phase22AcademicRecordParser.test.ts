/**
 * Phase 22 - Academic Record Parser Tests
 * Comprehensive unit tests for parsing and validation functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import AcademicRecordParser from '../phase22AcademicRecordParser';

describe('AcademicRecordParser', () => {
  describe('parseRecord', () => {
    it('should parse valid single academic record', () => {
      const jsonString = JSON.stringify({
        studentId: 'stu-001',
        classId: 'cls-001',
        academicYear: '2026',
        term: 'Q1',
        grades: [],
        gpa: 3.8,
        attendance: 92,
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.studentId).toBe('stu-001');
      expect(result.errors).toHaveLength(0);
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = '{invalid json}';

      const result = AcademicRecordParser.parseRecord(invalidJson);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('JSON');
    });

    it('should reject missing required fields', () => {
      const jsonString = JSON.stringify({
        classId: 'cls-001',
        // Missing studentId
        academicYear: '2026',
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === 'studentId')).toBe(true);
    });

    it('should validate grade range (0-100)', () => {
      const jsonString = JSON.stringify({
        studentId: 'stu-001',
        classId: 'cls-001',
        grades: [
          { subjectId: 'math', marks: 150, maxMarks: 100 }, // Invalid: > 100
        ],
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === 'marks')).toBe(true);
    });

    it('should validate attendance percentage', () => {
      const jsonString = JSON.stringify({
        studentId: 'stu-001',
        classId: 'cls-001',
        attendance: 105, // Invalid: > 100
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === 'attendance')).toBe(true);
    });

    it('should provide line number tracking in errors', () => {
      const jsonString = JSON.stringify({
        studentId: 'stu-001',
        classId: 'cls-001',
        attendance: 150,
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.errors[0].lineNumber).toBeGreaterThanOrEqual(1);
    });

    it('should collect warnings without failing', () => {
      const jsonString = JSON.stringify({
        studentId: 'stu-001',
        classId: 'cls-001',
        academicYear: '2026',
        // Missing term - should warn but not error
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('parseRecords', () => {
    it('should parse array of records', () => {
      const jsonString = JSON.stringify([
        {
          studentId: 'stu-001',
          classId: 'cls-001',
          attendance: 92,
        },
        {
          studentId: 'stu-002',
          classId: 'cls-001',
          attendance: 88,
        },
      ]);

      const result = AcademicRecordParser.parseRecords(jsonString);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0].studentId).toBe('stu-001');
      expect(result.data?.[1].studentId).toBe('stu-002');
    });

    it('should handle empty array', () => {
      const jsonString = JSON.stringify([]);

      const result = AcademicRecordParser.parseRecords(jsonString);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });

    it('should batch process large arrays', () => {
      const records = Array.from({ length: 1000 }, (_, i) => ({
        studentId: `stu-${i}`,
        classId: 'cls-001',
        attendance: 90,
      }));
      const jsonString = JSON.stringify(records);

      const result = AcademicRecordParser.parseRecords(jsonString);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1000);
    });

    it('should continue parsing after individual record errors', () => {
      const jsonString = JSON.stringify([
        { studentId: 'stu-001', attendance: 92 }, // Valid
        { classId: 'cls-001', attendance: 200 }, // Invalid attendance
        { studentId: 'stu-003', attendance: 88 }, // Valid
      ]);

      const result = AcademicRecordParser.parseRecords(jsonString);

      // Should have some data despite errors
      expect(result.data?.length).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateRecordSchema', () => {
    it('should validate complete valid record', () => {
      const record = {
        studentId: 'stu-001',
        classId: 'cls-001',
        academicYear: '2026',
        term: 'Q1',
        grades: [
          {
            subjectId: 'math',
            subject: 'Mathematics',
            marks: 85,
            maxMarks: 100,
            grade: 'A',
            gradePoints: 4.0,
          },
        ],
        gpa: 3.8,
        attendance: 92,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const errors = AcademicRecordParser['validateRecordSchema'](record);

      expect(errors).toHaveLength(0);
    });

    it('should detect all missing required fields', () => {
      const record = {};

      const errors = AcademicRecordParser['validateRecordSchema'](record);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.field === 'studentId')).toBe(true);
      expect(errors.some((e) => e.field === 'classId')).toBe(true);
    });

    it('should validate nested grade objects', () => {
      const record = {
        studentId: 'stu-001',
        classId: 'cls-001',
        grades: [
          {
            marks: -10, // Invalid negative
          },
        ],
      };

      const errors = AcademicRecordParser['validateRecordSchema'](record);

      expect(errors.some((e) => e.field.includes('marks'))).toBe(true);
    });
  });

  describe('isValidRecord', () => {
    it('should return true for valid record', () => {
      const record = {
        studentId: 'stu-001',
        classId: 'cls-001',
        attendance: 92,
      };

      const result = AcademicRecordParser.isValidRecord(record);

      expect(result).toBe(true);
    });

    it('should return false for invalid record', () => {
      const record = {
        // Missing required fields
      };

      const result = AcademicRecordParser.isValidRecord(record);

      expect(result).toBe(false);
    });
  });

  describe('formatError', () => {
    it('should format error with all information', () => {
      const error = {
        field: 'attendance',
        message: 'Attendance must be between 0 and 100',
        lineNumber: 5,
        suggestion: 'Check the attendance percentage value',
      };

      const formatted = AcademicRecordParser.formatError(error);

      expect(formatted).toContain('attendance');
      expect(formatted).toContain('5');
      expect(formatted).toContain('Attendance must be between');
    });

    it('should handle errors without optional fields', () => {
      const error = {
        field: 'grade',
        message: 'Invalid grade value',
        lineNumber: 1,
      };

      const formatted = AcademicRecordParser.formatError(error);

      expect(formatted).toBeDefined();
      expect(formatted.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle unicode characters in names', () => {
      const jsonString = JSON.stringify({
        studentId: 'stu-001',
        classId: 'cls-001',
        comments: 'Excellent work! 很好',
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.success).toBe(true);
      expect(result.data?.comments).toContain('很好');
    });

    it('should handle very long values', () => {
      const longComment = 'A'.repeat(10000);
      const jsonString = JSON.stringify({
        studentId: 'stu-001',
        classId: 'cls-001',
        comments: longComment,
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.success).toBe(true);
      expect(result.data?.comments?.length).toBe(10000);
    });

    it('should handle empty strings', () => {
      const jsonString = JSON.stringify({
        studentId: '',
        classId: 'cls-001',
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.field === 'studentId')).toBe(true);
    });

    it('should handle null values', () => {
      const jsonString = JSON.stringify({
        studentId: 'stu-001',
        classId: null,
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.success).toBe(false);
    });

    it('should handle dates in various formats', () => {
      const jsonString = JSON.stringify({
        studentId: 'stu-001',
        classId: 'cls-001',
        createdAt: '2026-06-09T10:30:00Z',
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.success).toBe(true);
    });

    it('should handle floating point precision', () => {
      const jsonString = JSON.stringify({
        studentId: 'stu-001',
        classId: 'cls-001',
        gpa: 3.14159265359,
      });

      const result = AcademicRecordParser.parseRecord(jsonString);

      expect(result.success).toBe(true);
      expect(result.data?.gpa).toBeCloseTo(3.14159265359, 5);
    });
  });

  describe('Performance', () => {
    it('should parse record in < 10ms', () => {
      const jsonString = JSON.stringify({
        studentId: 'stu-001',
        classId: 'cls-001',
        attendance: 92,
      });

      const start = performance.now();
      AcademicRecordParser.parseRecord(jsonString);
      const end = performance.now();

      expect(end - start).toBeLessThan(10);
    });

    it('should parse 1000 records in < 500ms', () => {
      const records = Array.from({ length: 1000 }, (_, i) => ({
        studentId: `stu-${i}`,
        classId: 'cls-001',
        attendance: 90,
      }));
      const jsonString = JSON.stringify(records);

      const start = performance.now();
      AcademicRecordParser.parseRecords(jsonString);
      const end = performance.now();

      expect(end - start).toBeLessThan(500);
    });
  });
});
