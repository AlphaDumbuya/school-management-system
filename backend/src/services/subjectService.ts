import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

export interface SubjectData {
  code: string;
  name: string;
  description?: string;
  credits?: number;
}

export interface CreateSubjectRequest extends SubjectData {
  tenant_id: string;
}

export interface UpdateSubjectRequest extends Partial<SubjectData> {
  tenant_id?: string;
}

export class SubjectService {
  constructor(private db: Knex) {}

  /**
   * Create a new subject
   */
  async createSubject(data: CreateSubjectRequest): Promise<any> {
    const { tenant_id, code, name, description, credits } = data;

    // Validate required fields
    if (!tenant_id || !code || !name) {
      throw new AppError('Missing required subject fields', 400, 'VALIDATION_ERROR');
    }

    // Check if subject code already exists in tenant
    const existing = await this.db('subjects')
      .where('tenant_id', tenant_id)
      .where('code', code.toUpperCase())
      .first();

    if (existing) {
      throw new AppError('Subject code already exists in this school', 409, 'CONFLICT');
    }

    // Validate credits if provided
    if (credits !== undefined && (credits < 0 || credits > 10)) {
      throw new AppError('Subject credits must be between 0 and 10', 400, 'VALIDATION_ERROR');
    }

    // Create subject
    const [subjectId] = await this.db('subjects').insert({
      tenant_id,
      code: code.toUpperCase(),
      name,
      description,
      credits: credits || 0,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const subject = await this.getSubjectById(subjectId);
    logger.info(`Subject created: ${code} - ${name} (${subjectId})`);

    return subject;
  }

  /**
   * Get subject by ID
   */
  async getSubjectById(subjectId: string): Promise<any> {
    const subject = await this.db('subjects')
      .select('subject_id', 'tenant_id', 'code', 'name', 'description', 'credits', 'created_at', 'updated_at')
      .where('subject_id', subjectId)
      .first();

    if (!subject) {
      throw new AppError('Subject not found', 404, 'NOT_FOUND');
    }

    return subject;
  }

  /**
   * Get subjects by tenant with pagination
   */
  async getSubjectsByTenant(
    tenantId: string,
    filters?: {
      page?: number;
      limit?: number;
      search?: string;
    }
  ): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 10, 100);
    const offset = (page - 1) * limit;

    let query = this.db('subjects').where('tenant_id', tenantId);

    // Apply search filter
    if (filters?.search) {
      query = query.where((builder) => {
        builder
          .where('code', 'ilike', `%${filters.search}%`)
          .orWhere('name', 'ilike', `%${filters.search}%`);
      });
    }

    // Get total count
    const totalQuery = query.clone().count('* as count').first();
    const total = await totalQuery;

    // Get paginated results
    const subjects = await query
      .select('subject_id', 'tenant_id', 'code', 'name', 'credits', 'created_at')
      .limit(limit)
      .offset(offset)
      .orderBy('code');

    return {
      data: subjects,
      pagination: {
        page,
        limit,
        total: total.count,
        total_pages: Math.ceil(total.count / limit),
      },
    };
  }

  /**
   * Update subject
   */
  async updateSubject(subjectId: string, data: UpdateSubjectRequest): Promise<any> {
    const subject = await this.getSubjectById(subjectId);

    const updateData: any = {};
    const allowedFields = ['code', 'name', 'description', 'credits'];

    allowedFields.forEach((field) => {
      if (field in data && data[field as keyof UpdateSubjectRequest] !== undefined) {
        let value = data[field as keyof UpdateSubjectRequest];
        if (field === 'code' && value) {
          value = (value as string).toUpperCase();
        }
        updateData[field] = value;
      }
    });

    // Validate code uniqueness if updating
    if (updateData.code && updateData.code !== subject.code) {
      const existing = await this.db('subjects')
        .where('tenant_id', subject.tenant_id)
        .where('code', updateData.code)
        .whereNot('subject_id', subjectId)
        .first();

      if (existing) {
        throw new AppError('Subject code already exists for another subject', 409, 'CONFLICT');
      }
    }

    // Validate credits if updating
    if (updateData.credits !== undefined && (updateData.credits < 0 || updateData.credits > 10)) {
      throw new AppError('Subject credits must be between 0 and 10', 400, 'VALIDATION_ERROR');
    }

    updateData.updated_at = new Date();

    await this.db('subjects').where('subject_id', subjectId).update(updateData);

    const updatedSubject = await this.getSubjectById(subjectId);
    logger.info(`Subject updated: ${subjectId}`);

    return updatedSubject;
  }

  /**
   * Delete subject
   */
  async deleteSubject(subjectId: string): Promise<void> {
    const subject = await this.getSubjectById(subjectId);

    // Check if subject is assigned to any classes
    const assignedClasses = await this.db('class_subjects')
      .where('subject_id', subjectId)
      .count('* as count')
      .first();

    if (assignedClasses.count > 0) {
      throw new AppError('Cannot delete subject that is assigned to classes', 400, 'VALIDATION_ERROR');
    }

    // Check if subject has grades
    const grades = await this.db('grades').where('subject_id', subjectId).count('* as count').first();

    if (grades.count > 0) {
      throw new AppError('Cannot delete subject that has grade records', 400, 'VALIDATION_ERROR');
    }

    await this.db('subjects').where('subject_id', subjectId).delete();

    logger.info(`Subject deleted: ${subjectId}`);
  }

  /**
   * Get subject by code
   */
  async getSubjectByCode(tenantId: string, code: string): Promise<any> {
    const subject = await this.db('subjects')
      .where('tenant_id', tenantId)
      .where('code', code.toUpperCase())
      .first();

    if (!subject) {
      throw new AppError('Subject not found', 404, 'NOT_FOUND');
    }

    return subject;
  }

  /**
   * Get classes offering a subject
   */
  async getClassesForSubject(subjectId: string): Promise<any> {
    const subject = await this.getSubjectById(subjectId);

    const classes = await this.db('class_subjects')
      .join('classes', 'class_subjects.class_id', 'classes.class_id')
      .select('classes.class_id', 'classes.name', 'classes.level', 'classes.capacity')
      .where('class_subjects.subject_id', subjectId)
      .orderBy('classes.name');

    return classes;
  }

  /**
   * Get teachers for a subject
   */
  async getTeachersForSubject(subjectId: string, classId?: string): Promise<any> {
    let query = this.db('teacher_assignments')
      .join('teachers', 'teacher_assignments.teacher_id', 'teachers.teacher_id')
      .select(
        'teachers.teacher_id',
        'teachers.first_name',
        'teachers.last_name',
        'teachers.specialization',
        'teacher_assignments.class_id'
      )
      .where('teacher_assignments.subject_id', subjectId)
      .where((builder) => {
        builder.where('teacher_assignments.end_date', '>=', new Date()).orWhereNull('teacher_assignments.end_date');
      });

    if (classId) {
      query = query.where('teacher_assignments.class_id', classId);
    }

    return query.orderBy('teachers.first_name');
  }

  /**
   * Bulk create subjects
   */
  async bulkCreateSubjects(tenantId: string, subjects: Omit<SubjectData, 'tenant_id'>[]): Promise<any[]> {
    const createdSubjects: any[] = [];

    for (const subjectData of subjects) {
      try {
        const created = await this.createSubject({
          tenant_id: tenantId,
          ...subjectData,
        });
        createdSubjects.push(created);
      } catch (error: any) {
        logger.warn(`Failed to create subject ${subjectData.code}: ${error.message}`);
      }
    }

    return createdSubjects;
  }
}
