import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

export interface ClassData {
  name: string;
  level: string;
  capacity: number;
  academic_session_id: string;
  class_teacher_id?: string;
  room_number?: string;
  description?: string;
}

export interface CreateClassRequest extends ClassData {
  tenant_id: string;
}

export interface UpdateClassRequest extends Partial<ClassData> {
  tenant_id?: string;
}

export class ClassService {
  constructor(private db: Knex) {}

  /**
   * Create a new class
   */
  async createClass(data: CreateClassRequest): Promise<any> {
    const { tenant_id, name, level, capacity, academic_session_id, class_teacher_id, room_number, description } = data;

    // Validate required fields
    if (!tenant_id || !name || !level || !capacity || !academic_session_id) {
      throw new AppError('Missing required class fields', 400, 'VALIDATION_ERROR');
    }

    // Validate capacity
    if (capacity < 1 || capacity > 200) {
      throw new AppError('Class capacity must be between 1 and 200', 400, 'VALIDATION_ERROR');
    }

    // Check if class name already exists in tenant and session
    const existing = await this.db('classes')
      .where('tenant_id', tenant_id)
      .where('academic_session_id', academic_session_id)
      .where('name', name)
      .first();

    if (existing) {
      throw new AppError('Class name already exists in this academic session', 409, 'CONFLICT');
    }

    // Verify academic session exists
    const session = await this.db('academic_sessions')
      .where('academic_session_id', academic_session_id)
      .first();

    if (!session) {
      throw new AppError('Academic session not found', 404, 'NOT_FOUND');
    }

    // Verify class teacher if provided
    if (class_teacher_id) {
      const teacher = await this.db('teachers').where('teacher_id', class_teacher_id).first();
      if (!teacher) {
        throw new AppError('Class teacher not found', 404, 'NOT_FOUND');
      }
    }

    // Create class
    const [classId] = await this.db('classes').insert({
      tenant_id,
      name,
      level,
      capacity,
      academic_session_id,
      class_teacher_id: class_teacher_id || null,
      room_number,
      description,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const classData = await this.getClassById(classId);
    logger.info(`Class created: ${name} (${classId})`);

    return classData;
  }

  /**
   * Get class by ID
   */
  async getClassById(classId: string): Promise<any> {
    const classData = await this.db('classes')
      .select(
        'class_id',
        'tenant_id',
        'name',
        'level',
        'capacity',
        'academic_session_id',
        'class_teacher_id',
        'room_number',
        'description',
        'created_at',
        'updated_at'
      )
      .where('class_id', classId)
      .first();

    if (!classData) {
      throw new AppError('Class not found', 404, 'NOT_FOUND');
    }

    return classData;
  }

  /**
   * Get classes by tenant with pagination
   */
  async getClassesByTenant(
    tenantId: string,
    filters?: {
      page?: number;
      limit?: number;
      academic_session_id?: string;
      level?: string;
      search?: string;
    }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 10, 100);
    const offset = (page - 1) * limit;

    let query = this.db('classes').where('tenant_id', tenantId);

    // Apply filters
    if (filters?.academic_session_id) {
      query = query.where('academic_session_id', filters.academic_session_id);
    }

    if (filters?.level) {
      query = query.where('level', filters.level);
    }

    if (filters?.search) {
      query = query.where('name', 'ilike', `%${filters.search}%`);
    }

    // Get total count
    const totalQuery = query.clone().count('* as count').first();
    const total = await totalQuery;

    // Get paginated results
    const classes = await query
      .select(
        'class_id',
        'tenant_id',
        'name',
        'level',
        'capacity',
        'academic_session_id',
        'class_teacher_id',
        'room_number',
        'created_at'
      )
      .limit(limit)
      .offset(offset)
      .orderBy('created_at', 'desc');

    return {
      data: classes,
      pagination: {
        page,
        limit,
        total: total.count,
        total_pages: Math.ceil(total.count / limit),
      },
    };
  }

  /**
   * Update class
   */
  async updateClass(classId: string, data: UpdateClassRequest): Promise<any> {
    const classData = await this.getClassById(classId);

    const updateData: any = {};
    const allowedFields = ['name', 'level', 'capacity', 'class_teacher_id', 'room_number', 'description'];

    allowedFields.forEach((field) => {
      if (field in data && data[field as keyof UpdateClassRequest] !== undefined) {
        updateData[field] = data[field as keyof UpdateClassRequest];
      }
    });

    // Validate capacity if updating
    if (updateData.capacity && (updateData.capacity < 1 || updateData.capacity > 200)) {
      throw new AppError('Class capacity must be between 1 and 200', 400, 'VALIDATION_ERROR');
    }

    // Verify new class teacher if provided
    if (updateData.class_teacher_id) {
      const teacher = await this.db('teachers').where('teacher_id', updateData.class_teacher_id).first();
      if (!teacher) {
        throw new AppError('Class teacher not found', 404, 'NOT_FOUND');
      }
    }

    updateData.updated_at = new Date();

    await this.db('classes').where('class_id', classId).update(updateData);

    const updatedClass = await this.getClassById(classId);
    logger.info(`Class updated: ${classId}`);

    return updatedClass;
  }

  /**
   * Get class subjects
   */
  async getClassSubjects(classId: string): Promise<any> {
    const classData = await this.getClassById(classId);

    const subjects = await this.db('class_subjects')
      .join('subjects', 'class_subjects.subject_id', 'subjects.subject_id')
      .select('subjects.subject_id', 'subjects.code', 'subjects.name', 'subjects.credits')
      .where('class_subjects.class_id', classId)
      .orderBy('subjects.name');

    return subjects;
  }

  /**
   * Add subject to class
   */
  async addSubjectToClass(classId: string, subjectId: string): Promise<void> {
    const classData = await this.getClassById(classId);

    // Check if subject already added
    const existing = await this.db('class_subjects')
      .where('class_id', classId)
      .where('subject_id', subjectId)
      .first();

    if (existing) {
      throw new AppError('Subject already added to this class', 409, 'CONFLICT');
    }

    await this.db('class_subjects').insert({
      class_id: classId,
      subject_id: subjectId,
      created_at: new Date(),
    });

    logger.info(`Subject added to class: ${classId}`);
  }

  /**
   * Get class enrollment statistics
   */
  async getClassStats(classId: string): Promise<any> {
    const classData = await this.getClassById(classId);

    // Get enrollment count
    const enrollmentCount = await this.db('enrollments')
      .where('class_id', classId)
      .where('status', 'active')
      .count('* as count')
      .first();

    // Get average GPA
    const gpaStats = await this.db('students')
      .join('enrollments', 'students.student_id', 'enrollments.student_id')
      .where('enrollments.class_id', classId)
      .where('enrollments.status', 'active')
      .avg('students.gpa')
      .first();

    return {
      class_id: classId,
      class_name: classData.name,
      capacity: classData.capacity,
      current_enrollment: enrollmentCount.count,
      available_capacity: classData.capacity - enrollmentCount.count,
      capacity_percentage: ((enrollmentCount.count / classData.capacity) * 100).toFixed(2),
      average_gpa: gpaStats.avg ? parseFloat(gpaStats.avg).toFixed(2) : '0.00',
    };
  }

  /**
   * Get class students
   */
  async getClassStudents(classId: string, academicSessionId?: string): Promise<any> {
    let query = this.db('enrollments')
      .join('students', 'enrollments.student_id', 'students.student_id')
      .select(
        'students.student_id',
        'students.first_name',
        'students.last_name',
        'students.email',
        'students.gpa',
        'enrollments.enrollment_date'
      )
      .where('enrollments.class_id', classId)
      .where('enrollments.status', 'active');

    if (academicSessionId) {
      query = query.where('enrollments.academic_session_id', academicSessionId);
    }

    return query.orderBy('students.first_name');
  }

  /**
   * Remove subject from class
   */
  async removeSubjectFromClass(classId: string, subjectId: string): Promise<void> {
    await this.db('class_subjects')
      .where('class_id', classId)
      .where('subject_id', subjectId)
      .delete();

    logger.info(`Subject removed from class: ${classId}`);
  }
}
