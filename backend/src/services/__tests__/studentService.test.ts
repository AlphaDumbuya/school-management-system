import { assertDestructiveAllowed } from '../../utils/dbSafety';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { StudentService } from '../studentService';
import knex from 'knex';
import knexConfig from '../../../knexfile';

let db: any;
let studentService: StudentService;

beforeAll(async () => {
  // Connect to test database
  db = knex(knexConfig.development);
  studentService = new StudentService(db);

  // Run migrations
  await db.migrate.latest();
});

afterAll(async () => {
  // Clean up
  await db.destroy();
});

beforeEach(async () => {
  // Clear students table before each test
  assertDestructiveAllowed('delete every student');
  await db('students').del();
});

describe('StudentService', () => {
  describe('createStudent', () => {
    it('should create a new student with required fields', async () => {
      const studentData = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2010-05-15',
        gender: 'Male',
        email: 'john@example.com',
        phone_number: '+1234567890',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        postal_code: '10001',
        country: 'USA',
        enrollment_date: '2024-06-01',
        status: 'active',
      };

      const student = await studentService.createStudent(studentData);

      expect(student).toBeDefined();
      expect(student.first_name).toBe('John');
      expect(student.last_name).toBe('Doe');
      expect(student.email).toBe('john@example.com');
      expect(student.student_id).toBeDefined();
      expect(student.student_id).toMatch(/^STU-\d{4}-\d{5}$/);
    });

    it('should throw error if required fields are missing', async () => {
      const incompleteData = {
        first_name: 'John',
        // missing last_name and enrollment_date
      };

      try {
        await studentService.createStudent(incompleteData as any);
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should throw error if email already exists', async () => {
      const studentData1 = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        enrollment_date: '2024-06-01',
      };

      const studentData2 = {
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'john@example.com', // Same email
        enrollment_date: '2024-06-01',
      };

      await studentService.createStudent(studentData1);

      try {
        await studentService.createStudent(studentData2);
        expect.fail('Should have thrown an error for duplicate email');
      } catch (error: any) {
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('CONFLICT');
      }
    });

    it('should throw error if date of birth is invalid age', async () => {
      const studentData = {
        first_name: 'Baby',
        last_name: 'Born',
        date_of_birth: new Date().toISOString().split('T')[0], // Today's date (age 0)
        enrollment_date: '2024-06-01',
      };

      try {
        await studentService.createStudent(studentData);
        expect.fail('Should have thrown an error for invalid age');
      } catch (error: any) {
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should generate unique student IDs', async () => {
      const studentData1 = {
        first_name: 'John',
        last_name: 'Doe',
        enrollment_date: '2024-06-01',
      };

      const studentData2 = {
        first_name: 'Jane',
        last_name: 'Smith',
        enrollment_date: '2024-06-01',
      };

      const student1 = await studentService.createStudent(studentData1);
      const student2 = await studentService.createStudent(studentData2);

      expect(student1.student_id).not.toBe(student2.student_id);
      expect(student1.student_id).toMatch(/^STU-\d{4}-\d{5}$/);
      expect(student2.student_id).toMatch(/^STU-\d{4}-\d{5}$/);
    });
  });

  describe('getStudentById', () => {
    it('should retrieve student by ID', async () => {
      const studentData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        enrollment_date: '2024-06-01',
      };

      const createdStudent = await studentService.createStudent(studentData);
      const retrievedStudent = await studentService.getStudentById(createdStudent.id);

      expect(retrievedStudent).toBeDefined();
      expect(retrievedStudent.first_name).toBe('John');
      expect(retrievedStudent.id).toBe(createdStudent.id);
    });

    it('should throw error if student not found', async () => {
      try {
        await studentService.getStudentById('nonexistent-id');
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('listStudents', () => {
    it('should list students with pagination', async () => {
      // Create multiple students
      for (let i = 0; i < 5; i++) {
        await studentService.createStudent({
          first_name: `Student${i}`,
          last_name: `Test${i}`,
          enrollment_date: '2024-06-01',
          status: 'active',
        });
      }

      const result = await studentService.listStudents({
        page: 1,
        limit: 2,
      });

      expect(result.data.length).toBe(2);
      expect(result.pagination.total).toBe(5);
      expect(result.pagination.total_pages).toBe(3);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter students by status', async () => {
      await studentService.createStudent({
        first_name: 'Active',
        last_name: 'Student',
        enrollment_date: '2024-06-01',
        status: 'active',
      });

      await studentService.createStudent({
        first_name: 'Inactive',
        last_name: 'Student',
        enrollment_date: '2024-06-01',
        status: 'inactive',
      });

      const result = await studentService.listStudents({
        status: 'active',
      });

      expect(result.data.length).toBe(1);
      expect(result.data[0].status).toBe('active');
    });

    it('should search students by name or email', async () => {
      await studentService.createStudent({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        enrollment_date: '2024-06-01',
      });

      await studentService.createStudent({
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        enrollment_date: '2024-06-01',
      });

      const result = await studentService.listStudents({
        search: 'john',
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((s: any) => s.first_name === 'John')).toBe(true);
    });
  });

  describe('updateStudent', () => {
    it('should update student information', async () => {
      const originalData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        enrollment_date: '2024-06-01',
      };

      const createdStudent = await studentService.createStudent(originalData);

      const updatedStudent = await studentService.updateStudent(createdStudent.id, {
        first_name: 'Jonathan',
        gender: 'Male',
      });

      expect(updatedStudent.first_name).toBe('Jonathan');
      expect(updatedStudent.email).toBe('john@example.com'); // Unchanged
    });

    it('should throw error when updating to duplicate email', async () => {
      const student1 = await studentService.createStudent({
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        enrollment_date: '2024-06-01',
      });

      const student2 = await studentService.createStudent({
        first_name: 'Jane',
        last_name: 'Smith',
        email: 'jane@example.com',
        enrollment_date: '2024-06-01',
      });

      try {
        await studentService.updateStudent(student2.id, {
          email: 'john@example.com', // Already used by student1
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('CONFLICT');
      }
    });

    it('should throw error if student not found', async () => {
      try {
        await studentService.updateStudent('nonexistent-id', {
          first_name: 'Updated',
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('deleteStudent', () => {
    it('should soft delete student', async () => {
      const studentData = {
        first_name: 'John',
        last_name: 'Doe',
        enrollment_date: '2024-06-01',
        status: 'active',
      };

      const createdStudent = await studentService.createStudent(studentData);
      await studentService.deleteStudent(createdStudent.id);

      const deletedStudent = await studentService.getStudentById(createdStudent.id);
      expect(deletedStudent.status).toBe('inactive');
    });
  });

  describe('validateStudentData', () => {
    it('should validate required fields', () => {
      const validData = {
        first_name: 'John',
        last_name: 'Doe',
        enrollment_date: '2024-06-01',
      };

      const result = studentService.validateStudentData(validData);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalidData = {
        first_name: 'John',
        last_name: 'Doe',
        email: 'invalid-email',
        enrollment_date: '2024-06-01',
      };

      const result = studentService.validateStudentData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid email format');
    });

    it('should reject invalid phone number format', () => {
      const invalidData = {
        first_name: 'John',
        last_name: 'Doe',
        phone_number: 'invalid',
        enrollment_date: '2024-06-01',
      };

      const result = studentService.validateStudentData(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid phone number format');
    });
  });

  describe('generateStudentId', () => {
    it('should generate unique student IDs in correct format', async () => {
      const id1 = await studentService.generateStudentId();
      const id2 = await studentService.generateStudentId();

      expect(id1).toMatch(/^STU-\d{4}-\d{5}$/);
      expect(id2).toMatch(/^STU-\d{4}-\d{5}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('getStudentEnrollments', () => {
    it('should retrieve all enrollments for a student', async () => {
      const studentData = {
        first_name: 'John',
        last_name: 'Doe',
        enrollment_date: '2024-06-01',
      };

      const createdStudent = await studentService.createStudent(studentData);
      const enrollments = await studentService.getStudentEnrollments(createdStudent.id);

      expect(Array.isArray(enrollments)).toBe(true);
    });
  });
});
