/**
 * Phase 22 - Serialization Routes Integration Tests
 * Comprehensive integration tests for API endpoints
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

describe('Phase 22 Serialization API Routes', () => {
  let app: Express;
  let authToken: string;

  const mockAcademicRecord = {
    studentId: 'student-001',
    classId: 'class-001',
    academicYear: '2026',
    term: 'Q1',
    grades: [
      {
        subjectId: 'math-001',
        subject: 'Mathematics',
        marks: 85,
        maxMarks: 100,
        grade: 'A',
        gradePoints: 4.0,
      },
      {
        subjectId: 'eng-001',
        subject: 'English',
        marks: 78,
        maxMarks: 100,
        grade: 'B',
        gradePoints: 3.0,
      },
    ],
    gpa: 3.5,
    attendance: 92,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    // Setup app and mock authentication
    // In real implementation, this would setup test database and create test user
    authToken = 'Bearer mock-jwt-token';
  });

  afterEach(async () => {
    // Cleanup
  });

  describe('POST /api/v1/data/parse/record', () => {
    it('should parse valid academic record', async () => {
      const response = await request(app)
        .post('/api/v1/data/parse/record')
        .set('Authorization', authToken)
        .send({
          jsonString: JSON.stringify(mockAcademicRecord),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.studentId).toBe('student-001');
      expect(response.body.errors).toHaveLength(0);
    });

    it('should reject missing jsonString parameter', async () => {
      const response = await request(app)
        .post('/api/v1/data/parse/record')
        .set('Authorization', authToken)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle invalid JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/data/parse/record')
        .set('Authorization', authToken)
        .send({
          jsonString: '{invalid json}',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/data/parse/record')
        .send({
          jsonString: JSON.stringify(mockAcademicRecord),
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/data/parse/records', () => {
    it('should parse array of records', async () => {
      const records = [
        mockAcademicRecord,
        { ...mockAcademicRecord, studentId: 'student-002' },
      ];

      const response = await request(app)
        .post('/api/v1/data/parse/records')
        .set('Authorization', authToken)
        .send({
          jsonString: JSON.stringify(records),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.recordCount).toBe(2);
    });

    it('should handle empty array', async () => {
      const response = await request(app)
        .post('/api/v1/data/parse/records')
        .set('Authorization', authToken)
        .send({
          jsonString: JSON.stringify([]),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
    });

    it('should batch process large arrays', async () => {
      const records = Array.from({ length: 100 }, (_, i) => ({
        ...mockAcademicRecord,
        studentId: `student-${i}`,
      }));

      const response = await request(app)
        .post('/api/v1/data/parse/records')
        .set('Authorization', authToken)
        .send({
          jsonString: JSON.stringify(records),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(100);
    });
  });

  describe('POST /api/v1/data/validate', () => {
    it('should validate JSON without parsing', async () => {
      const response = await request(app)
        .post('/api/v1/data/validate')
        .set('Authorization', authToken)
        .send({
          jsonString: JSON.stringify([mockAcademicRecord]),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.recordCount).toBe(1);
      expect(response.body.errorCount).toBe(0);
    });

    it('should report validation errors', async () => {
      const invalidRecord = {
        classId: 'class-001',
        attendance: 150, // Invalid: > 100
      };

      const response = await request(app)
        .post('/api/v1/data/validate')
        .set('Authorization', authToken)
        .send({
          jsonString: JSON.stringify([invalidRecord]),
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCount).toBeGreaterThan(0);
    });

    it('should require jsonString parameter', async () => {
      const response = await request(app)
        .post('/api/v1/data/validate')
        .set('Authorization', authToken)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/data/serialize/record', () => {
    it('should serialize single record to JSON', async () => {
      const response = await request(app)
        .post('/api/v1/data/serialize/record')
        .set('Authorization', authToken)
        .send({
          record: mockAcademicRecord,
          options: { prettyPrint: true },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.format).toBe('json');
      expect(typeof response.body.data).toBe('string');

      const parsed = JSON.parse(response.body.data);
      expect(parsed.studentId).toBe('student-001');
    });

    it('should support serialization options', async () => {
      const response = await request(app)
        .post('/api/v1/data/serialize/record')
        .set('Authorization', authToken)
        .send({
          record: mockAcademicRecord,
          options: {
            prettyPrint: false,
            excludeFields: ['gpa'],
          },
        });

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.body.data);
      expect(parsed.gpa).toBeUndefined();
    });

    it('should require record parameter', async () => {
      const response = await request(app)
        .post('/api/v1/data/serialize/record')
        .set('Authorization', authToken)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/data/serialize/records', () => {
    it('should serialize multiple records', async () => {
      const records = [
        mockAcademicRecord,
        { ...mockAcademicRecord, studentId: 'student-002' },
      ];

      const response = await request(app)
        .post('/api/v1/data/serialize/records')
        .set('Authorization', authToken)
        .send({
          records,
          options: { prettyPrint: true },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.statistics).toBeDefined();
      expect(response.body.statistics.totalRecords).toBe(2);
    });

    it('should support filtering options', async () => {
      const records = [
        { ...mockAcademicRecord, classId: 'class-001' },
        { ...mockAcademicRecord, studentId: 'student-002', classId: 'class-002' },
      ];

      const response = await request(app)
        .post('/api/v1/data/serialize/records')
        .set('Authorization', authToken)
        .send({
          records,
          options: {
            filterByClass: 'class-001',
          },
        });

      expect(response.status).toBe(200);
      const parsed = JSON.parse(response.body.data);
      expect(parsed).toHaveLength(1);
    });

    it('should include statistics in response', async () => {
      const response = await request(app)
        .post('/api/v1/data/serialize/records')
        .set('Authorization', authToken)
        .send({
          records: [mockAcademicRecord],
        });

      expect(response.status).toBe(200);
      expect(response.body.statistics).toBeDefined();
      expect(response.body.statistics.averageGPA).toBe(mockAcademicRecord.gpa);
      expect(response.body.statistics.averageAttendance).toBe(
        mockAcademicRecord.attendance
      );
    });
  });

  describe('POST /api/v1/data/serialize/csv', () => {
    it('should export records to CSV', async () => {
      const response = await request(app)
        .post('/api/v1/data/serialize/csv')
        .set('Authorization', authToken)
        .send({
          records: [mockAcademicRecord],
        });

      expect(response.status).toBe(200);
      expect(response.type).toBe('text/csv');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.text).toContain('Student ID');
      expect(response.text).toContain('student-001');
    });

    it('should support CSV filtering', async () => {
      const records = [
        { ...mockAcademicRecord, studentId: 'student-001' },
        { ...mockAcademicRecord, studentId: 'student-002' },
      ];

      const response = await request(app)
        .post('/api/v1/data/serialize/csv')
        .set('Authorization', authToken)
        .send({
          records,
          options: {
            filterByStudent: 'student-001',
          },
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('student-001');
      expect(response.text).not.toContain('student-002');
    });

    it('should require records parameter', async () => {
      const response = await request(app)
        .post('/api/v1/data/serialize/csv')
        .set('Authorization', authToken)
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/v1/data/serialize/compact', () => {
    it('should serialize to compact format', async () => {
      const response = await request(app)
        .post('/api/v1/data/serialize/compact')
        .set('Authorization', authToken)
        .send({
          records: [mockAcademicRecord],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.format).toBe('compact');
      expect(response.body.compressionRatio).toBeDefined();
    });

    it('should achieve significant compression', async () => {
      const response = await request(app)
        .post('/api/v1/data/serialize/compact')
        .set('Authorization', authToken)
        .send({
          records: [mockAcademicRecord],
        });

      expect(response.status).toBe(200);
      // Compact format should be significantly smaller
      const ratio = parseInt(response.body.compressionRatio);
      expect(ratio).toBeLessThan(100);
      expect(ratio).toBeGreaterThan(30);
    });
  });

  describe('POST /api/v1/data/deserialize/compact', () => {
    it('should deserialize compact format', async () => {
      // First, create compact format
      const compactResponse = await request(app)
        .post('/api/v1/data/serialize/compact')
        .set('Authorization', authToken)
        .send({
          records: [mockAcademicRecord],
        });

      const compact = JSON.parse(compactResponse.body.data);

      // Now deserialize
      const response = await request(app)
        .post('/api/v1/data/deserialize/compact')
        .set('Authorization', authToken)
        .send({
          compactJson: compact,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].studentId).toBe('student-001');
    });

    it('should maintain data integrity', async () => {
      // Compact and decompress
      const compactResponse = await request(app)
        .post('/api/v1/data/serialize/compact')
        .set('Authorization', authToken)
        .send({
          records: [mockAcademicRecord],
        });

      const compact = JSON.parse(compactResponse.body.data);

      const decompResponse = await request(app)
        .post('/api/v1/data/deserialize/compact')
        .set('Authorization', authToken)
        .send({
          compactJson: compact,
        });

      expect(decompResponse.status).toBe(200);
      expect(decompResponse.body.data[0].gpa).toBe(mockAcademicRecord.gpa);
      expect(decompResponse.body.data[0].attendance).toBe(
        mockAcademicRecord.attendance
      );
    });
  });

  describe('POST /api/v1/data/statistics', () => {
    it('should calculate statistics', async () => {
      const records = [
        { ...mockAcademicRecord, gpa: 3.8, attendance: 95 },
        { ...mockAcademicRecord, studentId: 'student-002', gpa: 3.5, attendance: 90 },
      ];

      const response = await request(app)
        .post('/api/v1/data/statistics')
        .set('Authorization', authToken)
        .send({ records });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRecords).toBe(2);
      expect(response.body.data.averageGPA).toBeCloseTo(3.65, 1);
      expect(response.body.data.averageAttendance).toBeCloseTo(92.5, 1);
    });

    it('should calculate class distribution', async () => {
      const records = [
        mockAcademicRecord,
        { ...mockAcademicRecord, studentId: 'student-002', classId: 'class-002' },
      ];

      const response = await request(app)
        .post('/api/v1/data/statistics')
        .set('Authorization', authToken)
        .send({ records });

      expect(response.status).toBe(200);
      expect(response.body.data.classDistribution['class-001']).toBe(1);
      expect(response.body.data.classDistribution['class-002']).toBe(1);
    });

    it('should handle empty array', async () => {
      const response = await request(app)
        .post('/api/v1/data/statistics')
        .set('Authorization', authToken)
        .send({ records: [] });

      expect(response.status).toBe(200);
      expect(response.body.data.totalRecords).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/v1/data/parse/record')
        .set('Authorization', authToken)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle server errors gracefully', async () => {
      const response = await request(app)
        .post('/api/v1/data/parse/record')
        .set('Authorization', authToken)
        .send({
          jsonString: null, // Invalid
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without authorization header', async () => {
      const response = await request(app)
        .post('/api/v1/data/parse/record')
        .send({
          jsonString: JSON.stringify(mockAcademicRecord),
        });

      expect(response.status).toBe(401);
    });

    it('should reject invalid tokens', async () => {
      const response = await request(app)
        .post('/api/v1/data/parse/record')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          jsonString: JSON.stringify(mockAcademicRecord),
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Performance', () => {
    it('should parse request in < 1 second', async () => {
      const start = performance.now();

      await request(app)
        .post('/api/v1/data/parse/record')
        .set('Authorization', authToken)
        .send({
          jsonString: JSON.stringify(mockAcademicRecord),
        });

      const end = performance.now();
      expect(end - start).toBeLessThan(1000);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app)
          .post('/api/v1/data/parse/record')
          .set('Authorization', authToken)
          .send({
            jsonString: JSON.stringify(mockAcademicRecord),
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
