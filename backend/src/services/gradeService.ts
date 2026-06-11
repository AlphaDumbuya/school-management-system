import { Knex } from 'knex';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

export interface GradeData {
  student_id: string;
  subject_id: string;
  class_id: string;
  academic_session_id: string;
  grade_value: number;
  remarks?: string;
}

export interface GradeUpdate {
  grade_value?: number;
  remarks?: string;
  status?: string;
}

export class GradeService {
  constructor(private db: Knex) {}

  /**
   * Record a grade for a student
   */
  async recordGrade(data: GradeData, userId: string): Promise<any> {
    const { student_id, subject_id, class_id, academic_session_id, grade_value, remarks } = data;

    // Validate required fields
    if (!student_id || !subject_id || !class_id || !academic_session_id || grade_value === undefined) {
      throw new AppError('Missing required grade fields', 400, 'VALIDATION_ERROR');
    }

    // Validate grade value (0-100)
    if (grade_value < 0 || grade_value > 100) {
      throw new AppError('Grade value must be between 0 and 100', 400, 'VALIDATION_ERROR');
    }

    // Check if student exists
    const student = await this.db('students').where('id', student_id).first();
    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check if student is enrolled in class
    const enrollment = await this.db('enrollments')
      .where('student_id', student_id)
      .where('class_id', class_id)
      .where('academic_session_id', academic_session_id)
      .where('status', 'active')
      .first();

    if (!enrollment) {
      throw new AppError('Student is not enrolled in this class', 400, 'INVALID_STATE');
    }

    // Check if grade already exists (prevent duplicates)
    const existingGrade = await this.db('grades')
      .where('student_id', student_id)
      .where('subject_id', subject_id)
      .where('class_id', class_id)
      .where('academic_session_id', academic_session_id)
      .where('status', '!=', 'deleted')
      .first();

    if (existingGrade) {
      throw new AppError('Grade already exists for this student-subject combination', 409, 'CONFLICT');
    }

    // Create grade
    const [gradeId] = await this.db('grades').insert({
      student_id,
      subject_id,
      class_id,
      academic_session_id,
      grade_value,
      remarks,
      recorded_by: userId,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
    });

    logger.info(`Grade recorded: ${gradeId} (Student: ${student_id}, Subject: ${subject_id}, Grade: ${grade_value})`);

    return this.getGradeById(gradeId);
  }

  /**
   * Get grade by ID
   */
  async getGradeById(gradeId: string): Promise<any> {
    const grade = await this.db('grades')
      .select('*')
      .where('id', gradeId)
      .first();

    if (!grade) {
      throw new AppError('Grade not found', 404, 'NOT_FOUND');
    }

    return grade;
  }

  /**
   * Get all grades with filtering
   */
  async getGrades(filters?: {
    student_id?: string;
    subject_id?: string;
    class_id?: string;
    academic_session_id?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 20, 100);
    const offset = (page - 1) * limit;

    let query = this.db('grades');

    if (filters?.student_id) {
      query = query.where('student_id', filters.student_id);
    }

    if (filters?.subject_id) {
      query = query.where('subject_id', filters.subject_id);
    }

    if (filters?.class_id) {
      query = query.where('class_id', filters.class_id);
    }

    if (filters?.academic_session_id) {
      query = query.where('academic_session_id', filters.academic_session_id);
    }

    if (filters?.status) {
      query = query.where('status', filters.status);
    }

    const countResult = await query.clone().count('* as count').first();
    const total = countResult.count;

    const grades = await query
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      data: grades,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Update a grade
   */
  async updateGrade(gradeId: string, data: GradeUpdate, userId: string): Promise<any> {
    const grade = await this.getGradeById(gradeId);

    if (grade.status === 'finalized') {
      throw new AppError('Cannot update finalized grade', 400, 'INVALID_STATE');
    }

    const updateData: any = { updated_at: new Date() };

    if (data.grade_value !== undefined) {
      if (data.grade_value < 0 || data.grade_value > 100) {
        throw new AppError('Grade value must be between 0 and 100', 400, 'VALIDATION_ERROR');
      }
      updateData.grade_value = data.grade_value;
    }

    if (data.remarks !== undefined) {
      updateData.remarks = data.remarks;
    }

    await this.db('grades').where('id', gradeId).update(updateData);

    logger.info(`Grade updated: ${gradeId}`);

    return this.getGradeById(gradeId);
  }

  /**
   * Finalize a grade
   */
  async finalizeGrade(gradeId: string, userId: string): Promise<any> {
    const grade = await this.getGradeById(gradeId);

    if (grade.status === 'finalized') {
      throw new AppError('Grade already finalized', 400, 'INVALID_STATE');
    }

    await this.db('grades').where('id', gradeId).update({
      status: 'finalized',
      finalized_by: userId,
      finalized_at: new Date(),
      updated_at: new Date(),
    });

    logger.info(`Grade finalized: ${gradeId}`);

    return this.getGradeById(gradeId);
  }

  /**
   * Calculate class average for a subject
   */
  async calculateClassAverage(classId: string, subjectId: string, academicSessionId: string): Promise<number> {
    const result = await this.db('grades')
      .where('class_id', classId)
      .where('subject_id', subjectId)
      .where('academic_session_id', academicSessionId)
      .where('status', 'finalized')
      .avg('grade_value')
      .first();

    return result.avg ? parseFloat(result.avg.toFixed(2)) : 0;
  }

  /**
   * Calculate student GPA
   */
  async calculateStudentGPA(
    studentId: string,
    classId: string,
    academicSessionId: string
  ): Promise<number> {
    const grades = await this.db('grades')
      .where('student_id', studentId)
      .where('class_id', classId)
      .where('academic_session_id', academicSessionId)
      .where('status', 'finalized')
      .select('grade_value');

    if (grades.length === 0) return 0;

    const average = grades.reduce((sum, g) => sum + g.grade_value, 0) / grades.length;
    const gpa = (average / 25).toFixed(2); // Convert to 4.0 scale

    return parseFloat(gpa);
  }

  /**
   * Get student's grades for a subject
   */
  async getStudentSubjectGrades(studentId: string, subjectId: string): Promise<any[]> {
    return this.db('grades')
      .where('student_id', studentId)
      .where('subject_id', subjectId)
      .where('status', 'finalized')
      .orderBy('created_at', 'desc');
  }

  /**
   * Get class grades for a subject
   */
  async getClassSubjectGrades(classId: string, subjectId: string, academicSessionId: string): Promise<any[]> {
    return this.db('grades')
      .select('grades.*', 'students.first_name', 'students.last_name', 'students.student_id')
      .innerJoin('students', 'grades.student_id', 'students.id')
      .where('grades.class_id', classId)
      .where('grades.subject_id', subjectId)
      .where('grades.academic_session_id', academicSessionId)
      .where('grades.status', 'finalized')
      .orderBy('students.first_name', 'asc');
  }

  /**
   * Get top performing students in class
   */
  async getTopStudentsInClass(
    classId: string,
    academicSessionId: string,
    limit: number = 10
  ): Promise<any[]> {
    return this.db('grades')
      .select(
        'students.id',
        'students.first_name',
        'students.last_name',
        'students.student_id',
        this.db.raw('AVG(grades.grade_value) as average_grade')
      )
      .innerJoin('students', 'grades.student_id', 'students.id')
      .where('grades.class_id', classId)
      .where('grades.academic_session_id', academicSessionId)
      .where('grades.status', 'finalized')
      .groupBy('students.id', 'students.first_name', 'students.last_name', 'students.student_id')
      .orderBy('average_grade', 'desc')
      .limit(limit);
  }

  /**
   * Generate grade report for class
   */
  async generateClassGradeReport(
    classId: string,
    academicSessionId: string
  ): Promise<any> {
    const grades = await this.db('grades')
      .select(
        'grades.*',
        'students.first_name',
        'students.last_name',
        'students.student_id',
        'subjects.name as subject_name'
      )
      .innerJoin('students', 'grades.student_id', 'students.id')
      .innerJoin('subjects', 'grades.subject_id', 'subjects.id')
      .where('grades.class_id', classId)
      .where('grades.academic_session_id', academicSessionId)
      .where('grades.status', 'finalized');

    // Calculate statistics
    const statistics = {
      total_students: new Set(grades.map(g => g.student_id)).size,
      total_grades: grades.length,
      average_grade: grades.length > 0 
        ? (grades.reduce((sum, g) => sum + g.grade_value, 0) / grades.length).toFixed(2)
        : 0,
      highest_grade: grades.length > 0 ? Math.max(...grades.map(g => g.grade_value)) : 0,
      lowest_grade: grades.length > 0 ? Math.min(...grades.map(g => g.grade_value)) : 0,
    };

    return {
      class_id: classId,
      academic_session_id: academicSessionId,
      grades,
      statistics,
      generated_at: new Date(),
    };
  }

  /**
   * Delete a grade (soft delete)
   */
  async deleteGrade(gradeId: string): Promise<void> {
    const grade = await this.getGradeById(gradeId);

    if (grade.status === 'finalized') {
      throw new AppError('Cannot delete finalized grade', 400, 'INVALID_STATE');
    }

    await this.db('grades').where('id', gradeId).update({
      status: 'deleted',
      updated_at: new Date(),
    });

    logger.info(`Grade deleted: ${gradeId}`);
  }
}
