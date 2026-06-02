import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

export interface StudentData {
  first_name: string;
  last_name: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
  contact_info?: Record<string, any>;
  guardians?: Record<string, any>[];
  enrollment_date: string;
  status?: string;
}

export interface CreateStudentRequest extends StudentData {
  tenant_id: string;
}

export interface UpdateStudentRequest extends Partial<StudentData> {
  tenant_id?: string;
}

export class StudentService {
  constructor(private db: Knex) {}

  /**
   * Create a new student
   */
  async createStudent(data: CreateStudentRequest): Promise<any> {
    const { tenant_id, first_name, last_name, email, date_of_birth, gender, contact_info, guardians, enrollment_date, status } = data;

    // Validate required fields
    if (!tenant_id || !first_name || !last_name || !enrollment_date) {
      throw new AppError('Missing required student fields', 400, 'VALIDATION_ERROR');
    }

    // Check if student email already exists in tenant (if provided)
    if (email) {
      const existingStudent = await this.db('students')
        .where('tenant_id', tenant_id)
        .where('email', email)
        .first();

      if (existingStudent) {
        throw new AppError('Student email already exists in this school', 409, 'CONFLICT');
      }
    }

    // Validate date of birth if provided
    if (date_of_birth) {
      const dob = new Date(date_of_birth);
      const age = new Date().getFullYear() - dob.getFullYear();
      if (age < 3 || age > 30) {
        throw new AppError('Student age must be between 3 and 30 years', 400, 'VALIDATION_ERROR');
      }
    }

    // Create student
    const [studentId] = await this.db('students').insert({
      tenant_id,
      first_name,
      last_name,
      email,
      date_of_birth,
      gender,
      contact_info: contact_info || null,
      guardians: guardians || null,
      enrollment_date,
      status: status || 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const student = await this.getStudentById(studentId);
    logger.info(`Student created: ${first_name} ${last_name} (${studentId})`);

    return student;
  }

  /**
   * Get student by ID
   */
  async getStudentById(studentId: string): Promise<any> {
    const student = await this.db('students')
      .select(
        'student_id',
        'tenant_id',
        'first_name',
        'last_name',
        'email',
        'date_of_birth',
        'gender',
        'contact_info',
        'guardians',
        'enrollment_date',
        'status',
        'gpa',
        'created_at',
        'updated_at'
      )
      .where('student_id', studentId)
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    return student;
  }

  /**
   * Get students by tenant with pagination
   */
  async getStudentsByTenant(
    tenantId: string,
    filters?: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
    }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 10, 100);
    const offset = (page - 1) * limit;

    let query = this.db('students').where('tenant_id', tenantId);

    // Apply filters
    if (filters?.status) {
      query = query.where('status', filters.status);
    }

    if (filters?.search) {
      query = query.where((builder) => {
        builder
          .whereRaw('CONCAT(first_name, \' \', last_name) ILIKE ?', [`%${filters.search}%`])
          .orWhere('email', 'ilike', `%${filters.search}%`);
      });
    }

    // Get total count
    const totalQuery = query.clone().count('* as count').first();
    const total = await totalQuery;

    // Get paginated results
    const students = await query
      .select(
        'student_id',
        'tenant_id',
        'first_name',
        'last_name',
        'email',
        'status',
        'gpa',
        'enrollment_date',
        'created_at'
      )
      .limit(limit)
      .offset(offset)
      .orderBy('created_at', 'desc');

    return {
      data: students,
      pagination: {
        page,
        limit,
        total: total.count,
        total_pages: Math.ceil(total.count / limit),
      },
    };
  }

  /**
   * Update student
   */
  async updateStudent(studentId: string, data: UpdateStudentRequest): Promise<any> {
    const student = await this.getStudentById(studentId);

    const updateData: any = {};
    const allowedFields = ['first_name', 'last_name', 'email', 'gender', 'contact_info', 'guardians', 'status'];

    allowedFields.forEach((field) => {
      if (field in data && data[field as keyof UpdateStudentRequest] !== undefined) {
        updateData[field] = data[field as keyof UpdateStudentRequest];
      }
    });

    // Validate email uniqueness if updating email
    if (updateData.email && updateData.email !== student.email) {
      const existing = await this.db('students')
        .where('tenant_id', student.tenant_id)
        .where('email', updateData.email)
        .whereNot('student_id', studentId)
        .first();

      if (existing) {
        throw new AppError('Email already exists for another student', 409, 'CONFLICT');
      }
    }

    updateData.updated_at = new Date();

    await this.db('students').where('student_id', studentId).update(updateData);

    const updatedStudent = await this.getStudentById(studentId);
    logger.info(`Student updated: ${studentId}`);

    return updatedStudent;
  }

  /**
   * Delete student (soft delete)
   */
  async deleteStudent(studentId: string): Promise<void> {
    const student = await this.getStudentById(studentId);

    await this.db('students').where('student_id', studentId).update({
      status: 'inactive',
      updated_at: new Date(),
    });

    logger.info(`Student deactivated: ${studentId}`);
  }

  /**
   * Get student enrollments
   */
  async getStudentEnrollments(studentId: string): Promise<any> {
    const student = await this.getStudentById(studentId);

    const enrollments = await this.db('enrollments')
      .select(
        'enrollment_id',
        'student_id',
        'class_id',
        'academic_session_id',
        'enrollment_date',
        'status',
        'created_at'
      )
      .where('student_id', studentId)
      .where('status', 'active')
      .orderBy('enrollment_date', 'desc');

    return enrollments;
  }

  /**
   * Get student GPA
   */
  async calculateStudentGPA(studentId: string): Promise<number> {
    const student = await this.getStudentById(studentId);

    const result = await this.db('grades')
      .where('student_id', studentId)
      .where('status', 'finalized')
      .avg('grade_value')
      .first();

    const gpa = result.avg ? parseFloat((result.avg / 25).toFixed(2)) : 0; // Assuming grades are out of 100

    // Update student GPA
    await this.db('students').where('student_id', studentId).update({
      gpa: Math.min(gpa, 4.0),
      updated_at: new Date(),
    });

    return gpa;
  }

  /**
   * Get student by email
   */
  async getStudentByEmail(tenantId: string, email: string): Promise<any> {
    const student = await this.db('students')
      .where('tenant_id', tenantId)
      .where('email', email)
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    return student;
  }

  /**
   * Check student enrollment in class
   */
  async isEnrolledInClass(studentId: string, classId: string): Promise<boolean> {
    const enrollment = await this.db('enrollments')
      .where('student_id', studentId)
      .where('class_id', classId)
      .where('status', 'active')
      .first();

    return !!enrollment;
  }
}
