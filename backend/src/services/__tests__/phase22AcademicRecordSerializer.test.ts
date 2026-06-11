/**
 * Phase 22 - Academic Record Serializer Tests
 * Comprehensive unit tests for serialization functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import AcademicRecordSerializer from '../phase22AcademicRecordSerializer';

describe('AcademicRecordSerializer', () => {
  const mockRecord = {
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
      {
        subjectId: 'eng',
        subject: 'English',
        marks: 78,
        maxMarks: 100,
        grade: 'B',
        gradePoints: 3.0,
      },
    ],
    gpa: 3.5,
    attendance: 92,
    createdAt: '2026-06-09T10:30:00Z',
    updatedAt: '2026-06-09T10:30:00Z',
  };

  describe('serializeRecord', () => {
    it('should serialize single record to JSON', () => {
      const result = AcademicRecordSerializer.serializeRecord(mockRecord);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      const parsed = JSON.parse(result);
      expect(parsed.studentId).toBe('stu-001');
      expect(parsed.gpa).toBe(3.5);
    });

    it('should pretty print by default', () => {
      const result = AcademicRecordSerializer.serializeRecord(mockRecord);

      // Pretty printed JSON should contain newlines
      expect(result).toContain('\n');
    });

    it('should not pretty print when disabled', () => {
      const result = AcademicRecordSerializer.serializeRecord(mockRecord, {
        prettyPrint: false,
      });

      // Compact JSON should not contain newlines (except in strings)
      expect(result.split('\n').length).toBe(1);
    });

    it('should use custom indent', () => {
      const result = AcademicRecordSerializer.serializeRecord(mockRecord, {
        indent: 4,
      });

      // Should have 4-space indentation
      expect(result).toContain('    ');
    });

    it('should exclude specified fields', () => {
      const result = AcademicRecordSerializer.serializeRecord(mockRecord, {
        excludeFields: ['gpa', 'comments'],
      });

      const parsed = JSON.parse(result);
      expect(parsed.gpa).toBeUndefined();
    });

    it('should format dates correctly', () => {
      const result = AcademicRecordSerializer.serializeRecord(mockRecord, {
        dateFormat: 'iso',
      });

      const parsed = JSON.parse(result);
      expect(parsed.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('serializeRecords', () => {
    it('should serialize multiple records', () => {
      const records = [mockRecord, { ...mockRecord, studentId: 'stu-002' }];

      const result = AcademicRecordSerializer.serializeRecords(records);

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const result = AcademicRecordSerializer.serializeRecords([]);

      const parsed = JSON.parse(result);
      expect(parsed).toEqual([]);
    });

    it('should apply date range filter', () => {
      const records = [
        { ...mockRecord, createdAt: '2026-01-01T00:00:00Z' },
        { ...mockRecord, createdAt: '2026-06-15T00:00:00Z', studentId: 'stu-002' },
        { ...mockRecord, createdAt: '2026-12-31T00:00:00Z', studentId: 'stu-003' },
      ];

      const result = AcademicRecordSerializer.serializeRecords(records, {
        filterByDateRange: {
          start: new Date('2026-06-01'),
          end: new Date('2026-06-30'),
        },
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].studentId).toBe('stu-002');
    });

    it('should filter by class', () => {
      const records = [
        mockRecord,
        { ...mockRecord, studentId: 'stu-002', classId: 'cls-002' },
      ];

      const result = AcademicRecordSerializer.serializeRecords(records, {
        filterByClass: 'cls-001',
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].classId).toBe('cls-001');
    });

    it('should filter by student', () => {
      const records = [
        mockRecord,
        { ...mockRecord, studentId: 'stu-002' },
      ];

      const result = AcademicRecordSerializer.serializeRecords(records, {
        filterByStudent: 'stu-001',
      });

      const parsed = JSON.parse(result);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].studentId).toBe('stu-001');
    });
  });

  describe('serializeToCSV', () => {
    it('should export records to CSV format', () => {
      const records = [mockRecord];

      const result = AcademicRecordSerializer.serializeToCSV(records);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('Student ID');
      expect(result).toContain('stu-001');
    });

    it('should include CSV headers', () => {
      const result = AcademicRecordSerializer.serializeToCSV([mockRecord]);

      const lines = result.split('\n');
      const headers = lines[0];

      expect(headers).toContain('Student ID');
      expect(headers).toContain('Class ID');
      expect(headers).toContain('Grade');
      expect(headers).toContain('Attendance');
    });

    it('should escape CSV special characters', () => {
      const record = {
        ...mockRecord,
        comments: 'Good work, excellent "performance"',
      };

      const result = AcademicRecordSerializer.serializeToCSV([record]);

      // Commas and quotes should be escaped
      expect(result).toContain('"');
    });

    it('should handle multiple grades per record', () => {
      const result = AcademicRecordSerializer.serializeToCSV([mockRecord]);

      const lines = result.split('\n');
      // Should have header + 2 grade rows
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle empty array', () => {
      const result = AcademicRecordSerializer.serializeToCSV([]);

      expect(result).toBe('');
    });

    it('should apply filters to CSV export', () => {
      const records = [
        mockRecord,
        { ...mockRecord, studentId: 'stu-002', classId: 'cls-002' },
      ];

      const result = AcademicRecordSerializer.serializeToCSV(records, {
        filterByClass: 'cls-001',
      });

      expect(result).toContain('stu-001');
      expect(result).not.toContain('stu-002');
    });
  });

  describe('serializeCompact', () => {
    it('should compress records to compact format', () => {
      const records = [mockRecord];

      const result = AcademicRecordSerializer.serializeCompact(records);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      const parsed = JSON.parse(result);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it('should reduce payload size significantly', () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        ...mockRecord,
        studentId: `stu-${i}`,
      }));

      const fullJson = JSON.stringify(records);
      const compact = AcademicRecordSerializer.serializeCompact(records);

      expect(compact.length).toBeLessThan(fullJson.length * 0.7); // < 70% of original
    });

    it('should use abbreviated keys', () => {
      const records = [mockRecord];
      const compact = AcademicRecordSerializer.serializeCompact(records);

      expect(compact).toContain('"sid"');
      expect(compact).toContain('"cid"');
      expect(compact).not.toContain('studentId');
    });
  });

  describe('deserializeCompact', () => {
    it('should decompress compact format', () => {
      const records = [mockRecord];
      const compact = AcademicRecordSerializer.serializeCompact(records);

      const result = AcademicRecordSerializer.deserializeCompact(compact);

      expect(result).toHaveLength(1);
      expect(result[0].studentId).toBe('stu-001');
    });

    it('should maintain data integrity through round-trip', () => {
      const original = [mockRecord];
      const compact = AcademicRecordSerializer.serializeCompact(original);
      const decompressed = AcademicRecordSerializer.deserializeCompact(compact);

      expect(decompressed[0].studentId).toBe(original[0].studentId);
      expect(decompressed[0].gpa).toBe(original[0].gpa);
      expect(decompressed[0].attendance).toBe(original[0].attendance);
    });

    it('should handle empty array', () => {
      const compact = AcademicRecordSerializer.serializeCompact([]);
      const result = AcademicRecordSerializer.deserializeCompact(compact);

      expect(result).toHaveLength(0);
    });
  });

  describe('getStatistics', () => {
    it('should calculate statistics for records', () => {
      const records = [
        { ...mockRecord, gpa: 3.5, attendance: 92 },
        { ...mockRecord, studentId: 'stu-002', gpa: 3.8, attendance: 95 },
      ];

      const stats = AcademicRecordSerializer.getStatistics(records);

      expect(stats.totalRecords).toBe(2);
      expect(stats.averageGPA).toBeCloseTo(3.65, 1);
      expect(stats.averageAttendance).toBeCloseTo(93.5, 1);
    });

    it('should handle empty array', () => {
      const stats = AcademicRecordSerializer.getStatistics([]);

      expect(stats.totalRecords).toBe(0);
      expect(stats.averageGPA).toBe(0);
      expect(stats.averageAttendance).toBe(0);
    });

    it('should calculate class distribution', () => {
      const records = [
        mockRecord,
        { ...mockRecord, studentId: 'stu-002', classId: 'cls-002' },
        { ...mockRecord, studentId: 'stu-003', classId: 'cls-001' },
      ];

      const stats = AcademicRecordSerializer.getStatistics(records);

      expect(stats.classDistribution['cls-001']).toBe(2);
      expect(stats.classDistribution['cls-002']).toBe(1);
    });

    it('should calculate total grades', () => {
      const records = [
        { ...mockRecord, grades: [mockRecord.grades[0], mockRecord.grades[1]] },
        { ...mockRecord, studentId: 'stu-002', grades: [mockRecord.grades[0]] },
      ];

      const stats = AcademicRecordSerializer.getStatistics(records);

      expect(stats.totalGrades).toBe(3);
    });

    it('should track date range', () => {
      const records = [
        { ...mockRecord, createdAt: '2026-01-01T00:00:00Z' },
        { ...mockRecord, studentId: 'stu-002', createdAt: '2026-12-31T23:59:59Z' },
      ];

      const stats = AcademicRecordSerializer.getStatistics(records);

      expect(stats.dateRange.earliest).toContain('2026-01-01');
      expect(stats.dateRange.latest).toContain('2026-12-31');
    });
  });

  describe('Edge Cases', () => {
    it('should handle records with no grades', () => {
      const record = {
        ...mockRecord,
        grades: [],
      };

      const csv = AcademicRecordSerializer.serializeToCSV([record]);

      expect(csv).toBeDefined();
      expect(csv.length).toBeGreaterThan(0);
    });

    it('should handle very large numbers', () => {
      const record = {
        ...mockRecord,
        gpa: 9999.9999,
      };

      const result = AcademicRecordSerializer.serializeRecord(record);

      const parsed = JSON.parse(result);
      expect(parsed.gpa).toBeCloseTo(9999.9999, 3);
    });

    it('should handle special characters in comments', () => {
      const record = {
        ...mockRecord,
        comments: 'Special chars: !@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~',
      };

      const csv = AcademicRecordSerializer.serializeToCSV([record]);

      expect(csv).toBeDefined();
      expect(csv.length).toBeGreaterThan(0);
    });

    it('should handle null optional fields', () => {
      const record = {
        ...mockRecord,
        comments: null,
        behaviorRating: undefined,
      };

      const result = AcademicRecordSerializer.serializeRecord(record);

      expect(result).toBeDefined();
      const parsed = JSON.parse(result);
      expect(parsed.comments).toBeNull();
    });
  });

  describe('Performance', () => {
    it('should serialize record in < 10ms', () => {
      const start = performance.now();
      AcademicRecordSerializer.serializeRecord(mockRecord);
      const end = performance.now();

      expect(end - start).toBeLessThan(10);
    });

    it('should serialize 1000 records to JSON in < 100ms', () => {
      const records = Array.from({ length: 1000 }, (_, i) => ({
        ...mockRecord,
        studentId: `stu-${i}`,
      }));

      const start = performance.now();
      AcademicRecordSerializer.serializeRecords(records);
      const end = performance.now();

      expect(end - start).toBeLessThan(100);
    });

    it('should export 1000 records to CSV in < 500ms', () => {
      const records = Array.from({ length: 1000 }, (_, i) => ({
        ...mockRecord,
        studentId: `stu-${i}`,
      }));

      const start = performance.now();
      AcademicRecordSerializer.serializeToCSV(records);
      const end = performance.now();

      expect(end - start).toBeLessThan(500);
    });

    it('should compact 1000 records in < 50ms', () => {
      const records = Array.from({ length: 1000 }, (_, i) => ({
        ...mockRecord,
        studentId: `stu-${i}`,
      }));

      const start = performance.now();
      AcademicRecordSerializer.serializeCompact(records);
      const end = performance.now();

      expect(end - start).toBeLessThan(50);
    });
  });

  describe('Data Integrity', () => {
    it('should preserve all record fields', () => {
      const record = {
        ...mockRecord,
        behaviorRating: 'Excellent',
        comments: 'Outstanding performance',
      };

      const result = AcademicRecordSerializer.serializeRecord(record);
      const parsed = JSON.parse(result);

      expect(parsed.studentId).toBe(record.studentId);
      expect(parsed.classId).toBe(record.classId);
      expect(parsed.behaviorRating).toBe(record.behaviorRating);
      expect(parsed.comments).toBe(record.comments);
    });

    it('should preserve nested structures', () => {
      const result = AcademicRecordSerializer.serializeRecord(mockRecord);
      const parsed = JSON.parse(result);

      expect(parsed.grades).toBeDefined();
      expect(parsed.grades).toHaveLength(mockRecord.grades.length);
      expect(parsed.grades[0].subjectId).toBe(mockRecord.grades[0].subjectId);
      expect(parsed.grades[0].marks).toBe(mockRecord.grades[0].marks);
    });
  });
});
