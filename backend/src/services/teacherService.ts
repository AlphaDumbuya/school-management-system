import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

export interface TeacherData {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  qualifications?: string[];
  specialization?: string;
  experience_years?: number;
  office_location?: string;
  hire_date: string;
  status?: string;
}

export interface CreateTeacherRequest extends TeacherData {
  tenant_id: string;
}

export interface UpdateTeacherRequest extends Partial<TeacherData> {
  tenant_id?: string;
}

export class TeacherService {
  constructor(private db: Knex) {}

  /**
   * Create a new teacher
   */
  async createTeacher(data: CreateTeacherRequest): Promise<any> {
    const {
      tenant_id,
      first_name,
      last_name,
      email,
      phone,
      qualifications,
      specialization,
      experience_years,
      office_location,
      hire_date,
      status,
    } = data;

    // Validate required fields
    if (!tenant_id || !first_name || !last_name || !hire_date) {
      throw new AppError('Missing required teacher fields', 400, 'VALIDATION_ERROR');
    }

    // Check if teacher email already exists in tenant (if provided)
    if (email) {
      const existingTeacher = await this.db('teachers')
        .join('users', 'teachers.user_id', 'users.user_id')
        .where('teachers.tenant_id', tenant_id)
        .where('users.email', email)
        .first();

      if (existingTeacher) {
        throw new AppError('Teacher email already exists in this school', 409, 'CONFLICT');
      }
    }

    // Validate experience years
    if (experience_years !== undefined && (experience_years < 0 || experience_years > 60)) {
      throw new AppError('Experience years must be between 0 and 60', 400, 'VALIDATION_ERROR');
    }

    // Create teacher
    const [teacherId] = await this.db('teachers').insert({
      tenant_id,
      first_name,
      last_name,
      email,
      phone,
      qualifications: qualifications || null,
      specialization,
      experience_years: experience_years || 0,
      office_location,
      hire_date,
      status: status || 'active',
      created_at: new Date(),
      updated_at: new Date(),
    });

    const teacher = await this.getTeacherById(String(teacherId));
    logger.info(`Teacher created: ${first_name} ${last_name} (${teacherId})`);

    return teacher;
  }

  /**
   * Get teacher by ID
   */
  async getTeacherById(teacherId: string): Promise<any> {
    const teacher = await this.db('teachers')
      .select(
        'teacher_id',
        'tenant_id',
        'first_name',
        'last_name',
        'email',
        'phone',
        'qualifications',
        'specialization',
        'experience_years',
        'office_location',
        'hire_date',
        'status',
        'created_at',
        'updated_at'
      )
      .where('teacher_id', teacherId)
      .first();

    if (!teacher) {
      throw new AppError('Teacher not found', 404, 'NOT_FOUND');
    }

    return teacher;
  }

  /**
   * Get teachers by tenant with pagination
   */
  async getTeachersByTenant(
    tenantId: string,
    filters?: {
      page?: number;
      limit?: number;
      status?: string;
      specialization?: string;
      search?: string;
    }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 10, 100);
    const offset = (page - 1) * limit;

    let query = this.db('teachers').where('tenant_id', tenantId);

    // Apply filters
    if (filters?.status) {
      query = query.where('status', filters.status);
    }

    if (filters?.specialization) {
      query = query.where('specialization', filters.specialization);
    }

    if (filters?.search) {
      query = query.where((builder) => {
        builder
          .whereRaw('CONCAT(first_name, \' \', last_name) ILIKE ?', [`%${filters.search}%`])
          .orWhere('email', 'ilike', `%${filters.search}%`)
          .orWhere('specialization', 'ilike', `%${filters.search}%`);
      });
    }

    // Get total count
    const totalQuery = query.clone().count('* as count').first();
    const total = await totalQuery;

    // Get paginated results
    const teachers = await query
      .select(
        'teacher_id',
        'tenant_id',
        'first_name',
        'last_name',
        'email',
        'specialization',
        'experience_years',
        'status',
        'hire_date',
        'created_at'
      )
      .limit(limit)
      .offset(offset)
      .orderBy('created_at', 'desc');

    const countVal = total ? Number((total as any).count) : 0;

    return {
      data: teachers,
      pagination: {
        page,
        limit,
        total: countVal,
        total_pages: Math.ceil(countVal / limit),
      },
    };
  }

  /**
   * Update teacher
   */
  async updateTeacher(teacherId: string, data: UpdateTeacherRequest): Promise<any> {
    const teacher = await this.getTeacherById(teacherId);

    const updateData: any = {};
    const allowedFields = ['first_name', 'last_name', 'email', 'phone', 'qualifications', 'specialization', 'experience_years', 'office_location', 'status'];

    allowedFields.forEach((field) => {
      if (field in data && data[field as keyof UpdateTeacherRequest] !== undefined) {
        updateData[field] = data[field as keyof UpdateTeacherRequest];
      }
    });

    // Validate email uniqueness if updating email
    if (updateData.email && updateData.email !== teacher.email) {
      const existing = await this.db('teachers')
        .where('tenant_id', teacher.tenant_id)
        .where('email', updateData.email)
        .whereNot('teacher_id', teacherId)
        .first();

      if (existing) {
        throw new AppError('Email already exists for another teacher', 409, 'CONFLICT');
      }
    }

    updateData.updated_at = new Date();

    await this.db('teachers').where('teacher_id', teacherId).update(updateData);

    const updatedTeacher = await this.getTeacherById(teacherId);
    logger.info(`Teacher updated: ${teacherId}`);

    return updatedTeacher;
  }

  /**
   * Delete teacher (soft delete)
   */
  async deleteTeacher(teacherId: string): Promise<void> {
    const teacher = await this.getTeacherById(teacherId);

    await this.db('teachers').where('teacher_id', teacherId).update({
      status: 'inactive',
      updated_at: new Date(),
    });

    logger.info(`Teacher deactivated: ${teacherId}`);
  }

  /**
   * Get teacher assignments (classes and subjects)
   */
  async getTeacherAssignments(teacherId: string): Promise<any> {
    const teacher = await this.getTeacherById(teacherId);

    const assignments = await this.db('teacher_assignments')
      .select(
        'id as assignment_id',
        'teacher_id',
        'subject_id',
        'class_id',
        'start_date',
        'end_date',
        'created_at'
      )
      .where('teacher_id', teacherId)
      .where((builder) => {
        builder.where('end_date', '>=', new Date()).orWhereNull('end_date');
      })
      .orderBy('start_date', 'desc');

    return assignments;
  }

  /**
   * Assign teacher to class and subject
   */
  async assignTeacher(teacherId: string, classId: string, subjectId: string, startDate: string): Promise<any> {
    const teacher = await this.getTeacherById(teacherId);

    // Check if already assigned
    const existing = await this.db('teacher_assignments')
      .where('teacher_id', teacherId)
      .where('class_id', classId)
      .where('subject_id', subjectId)
      .where((builder) => {
        builder.where('end_date', '>=', new Date()).orWhereNull('end_date');
      })
      .first();

    if (existing) {
      throw new AppError('Teacher already assigned to this class and subject', 409, 'CONFLICT');
    }

    const [assignmentId] = await this.db('teacher_assignments').insert({
      teacher_id: teacherId,
      class_id: classId,
      subject_id: subjectId,
      start_date: startDate,
      created_at: new Date(),
    });

    logger.info(`Teacher assigned: ${teacherId} to class ${classId}`);

    return { assignment_id: assignmentId };
  }

  /**
   * Get teacher by email
   */
  async getTeacherByEmail(tenantId: string, email: string): Promise<any> {
    const teacher = await this.db('teachers')
      .where('tenant_id', tenantId)
      .where('email', email)
      .first();

    if (!teacher) {
      throw new AppError('Teacher not found', 404, 'NOT_FOUND');
    }

    return teacher;
  }

  /**
   * Get teachers by specialization
   */
  async getTeachersBySpecialization(tenantId: string, specialization: string): Promise<any> {
    const teachers = await this.db('teachers')
      .where('tenant_id', tenantId)
      .where('specialization', specialization)
      .where('status', 'active')
      .select('teacher_id', 'first_name', 'last_name', 'email', 'experience_years')
      .orderBy('experience_years', 'desc');

    return teachers;
  }
}
