import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '@middleware/authMiddleware';
import { StudentService } from '@services/studentService';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import knex from 'knex';
import knexConfig from '../../knexfile';

const router = Router();
const env = (process.env.NODE_ENV || "development") as keyof typeof knexConfig;
const db = knex(knexConfig[env] || knexConfig.development);
const studentService = new StudentService(db);

/**
 * POST /api/v1/students
 * Create a new student
 * @requires admin, principal, teacher
 */
router.post('/', authenticate, authorize('principal', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { first_name, last_name, date_of_birth, gender, email, phone, address, city, state, postal_code, country, enrollment_date, status } = req.body;
    const createdBy = req.auth?.userId ?? null;

    // Validate required fields
    if (!first_name || !last_name || !enrollment_date) {
      throw new AppError('Missing required fields: first_name, last_name, enrollment_date', 400, 'VALIDATION_ERROR');
    }

    // Validate date_of_birth format if provided
    if (date_of_birth) {
      const dob = new Date(date_of_birth);
      if (isNaN(dob.getTime())) {
        throw new AppError('Invalid date_of_birth format', 400, 'VALIDATION_ERROR');
      }

      // Calculate age
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate()) ? age - 1 : age;

      if (actualAge < 3 || actualAge > 30) {
        throw new AppError('Student age must be between 3 and 30 years', 400, 'VALIDATION_ERROR');
      }
    }

    // Validate email uniqueness if provided
    if (email) {
      const existingStudent = await db('students').where('email', email).first();
      if (existingStudent) {
        throw new AppError('Email already registered as a student', 409, 'CONFLICT');
      }
    }

    // Generate unique student ID (STU-YYYY-XXXXX format)
    const year = new Date().getFullYear();
    const count = await db('students').where(db.raw(`student_id LIKE '${year}%'`)).count('* as count').first();
    const studentId = `STU-${year}-${String(count.count + 1).padStart(5, '0')}`;

    // Create student
    const [inserted] = await db('students').insert({
      user_id: null, // Can be linked later to user account
      student_id: studentId,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: email ? email.toLowerCase() : null,
      date_of_birth: date_of_birth || null,
      gender: gender || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      state: state || null,
      postal_code: postal_code || null,
      country: country || null,
      enrollment_date: enrollment_date,
      status: status || 'active',
      created_at: new Date(),
      updated_at: new Date(),
      created_by: createdBy,
    }).returning('*');

    res.status(201).json({
      message: 'Student created successfully',
      student: inserted,
    });

    logger.info(`Student created: ${inserted.student_id} (${first_name} ${last_name})`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students
 * List all students with pagination and filtering
 * @requires admin, principal, teacher
 */
router.get('/', authenticate, authorize('principal', 'teacher'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const search = req.query.search as string;

    let query = db('students').select('id', 'student_id', 'first_name', 'last_name', 'email', 'status', 'enrollment_date', 'created_at');

    // Apply filters
    if (status) {
      query = query.where('status', status);
    }

    if (search) {
      query = query.where((builder) => {
        builder
          .whereRaw(`CONCAT(first_name, ' ', last_name) ILIKE ?`, [`%${search}%`])
          .orWhere('student_id', 'ilike', `%${search}%`)
          .orWhere('email', 'ilike', `%${search}%`);
      });
    }

    // Get total count
    const totalQuery = query.clone().count('* as count').first();
    const total = await totalQuery;

    // Get paginated results
    const students = await query
      .limit(limit)
      .offset(offset)
      .orderBy('created_at', 'desc');

    res.json({
      data: students,
      pagination: {
        page,
        limit,
        total: total.count,
        total_pages: Math.ceil(total.count / limit),
      },
    });

    logger.info(`Listed students: page ${page}, limit ${limit}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId
 * Get student by ID
 * @requires authenticated user (authorized if not their own record)
 */
router.get('/:studentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = req.auth;

    const student = await db('students')
      .select('id', 'student_id', 'first_name', 'last_name', 'email', 'date_of_birth', 'gender', 'phone', 'address', 'city', 'state', 'postal_code', 'country', 'enrollment_date', 'status', 'created_at', 'updated_at')
      .where('student_id', studentId)
      .orWhere('id', studentId)
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check authorization: students can view their own record, others need principal/teacher
    if (currentUser.role === 'student' && student.user_id !== currentUser?.userId && currentUser.role !== 'principal') {
      throw new AppError('Insufficient permissions to view this student record', 403, 'AUTHORIZATION_ERROR');
    }

    res.json(student);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/students/:studentId
 * Update student information
 * @requires admin, principal, teacher, or student (self)
 */
router.put('/:studentId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = req.auth;
    const { first_name, last_name, gender, email, phone, address, city, state, postal_code, country, status } = req.body;

    // Get student
    const student = await db('students')
      .select('*')
      .where('student_id', studentId)
      .orWhere('id', studentId)
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Check authorization
    const isOwner = student.user_id === currentUser?.userId;
    const isAuthorized = ['principal', 'teacher'].includes(currentUser.role);

    if (!isOwner && !isAuthorized) {
      throw new AppError('Insufficient permissions to update this student', 403, 'AUTHORIZATION_ERROR');
    }

    // Students can only update certain fields, principal/teacher can update all
    const updateData: any = {};

    if (first_name && isAuthorized) updateData.first_name = first_name.trim();
    if (last_name && isAuthorized) updateData.last_name = last_name.trim();
    if (gender) updateData.gender = gender;
    if (email) {
      // Check email uniqueness
      const existingStudent = await db('students').where('email', email).whereNot('id', student.id).first();
      if (existingStudent) {
        throw new AppError('Email already registered', 409, 'CONFLICT');
      }
      updateData.email = email.toLowerCase();
    }
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (city) updateData.city = city;
    if (state) updateData.state = state;
    if (postal_code) updateData.postal_code = postal_code;
    if (country) updateData.country = country;
    if (status && isAuthorized) updateData.status = status;

    updateData.updated_at = new Date();
    updateData.updated_by = currentUser?.userId;

    await db('students').where('id', student.id).update(updateData);

    const updatedStudent = await db('students')
      .select('id', 'student_id', 'first_name', 'last_name', 'email', 'date_of_birth', 'gender', 'phone', 'status', 'created_at', 'updated_at')
      .where('id', student.id)
      .first();

    res.json({
      message: 'Student updated successfully',
      student: updatedStudent,
    });

    logger.info(`Student updated: ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/students/:studentId
 * Deactivate student (soft delete)
 * @requires admin, principal
 */
router.delete('/:studentId', authenticate, authorize('principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = req.auth;

    const student = await db('students')
      .select('*')
      .where('student_id', studentId)
      .orWhere('id', studentId)
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    // Soft delete
    await db('students').where('id', student.id).update({
      status: 'inactive',
      updated_at: new Date(),
      updated_by: currentUser?.userId,
    });

    res.json({
      message: 'Student deactivated successfully',
    });

    logger.info(`Student deactivated: ${student.student_id} by ${currentUser.email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/students/:studentId/reactivate
 * Reactivate a deactivated student
 * @requires admin, principal
 */
router.post('/:studentId/reactivate', authenticate, authorize('principal'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const currentUser = req.auth;

    const student = await db('students')
      .select('*')
      .where('student_id', studentId)
      .orWhere('id', studentId)
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    if (student.status !== 'inactive') {
      throw new AppError('Only inactive students can be reactivated', 400, 'VALIDATION_ERROR');
    }

    await db('students').where('id', student.id).update({
      status: 'active',
      updated_at: new Date(),
      updated_by: currentUser?.userId,
    });

    res.json({
      message: 'Student reactivated successfully',
    });

    logger.info(`Student reactivated: ${student.student_id} by ${currentUser.email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId/enrollments
 * Get all enrollments for a student
 */
router.get('/:studentId/enrollments', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;

    const student = await db('students')
      .select('*')
      .where('student_id', studentId)
      .orWhere('id', studentId)
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    const enrollments = await db('enrollments')
      .select('id', 'enrollment_id', 'class_id', 'academic_session_id', 'enrollment_date', 'status', 'roll_number', 'created_at')
      .where('student_id', student.id)
      .orderBy('enrollment_date', 'desc');

    res.json({
      student_id: student.student_id,
      enrollments,
    });

    logger.info(`Retrieved enrollments for student: ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId/grades
 * Get all grades for a student
 */
router.get('/:studentId/grades', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;

    const student = await db('students')
      .select('*')
      .where('student_id', studentId)
      .orWhere('id', studentId)
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    const grades = await db('grades')
      .select('id', 'subject_id', 'class_id', 'marks_obtained', 'total_marks', 'grade', 'status', 'created_at')
      .where('student_id', student.id)
      .orderBy('created_at', 'desc');

    res.json({
      student_id: student.student_id,
      grades,
    });

    logger.info(`Retrieved grades for student: ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/students/:studentId/attendance
 * Get attendance record for a student
 */
router.get('/:studentId/attendance', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { studentId } = req.params;
    const classId = req.query.classId as string;

    const student = await db('students')
      .select('*')
      .where('student_id', studentId)
      .orWhere('id', studentId)
      .first();

    if (!student) {
      throw new AppError('Student not found', 404, 'NOT_FOUND');
    }

    let query = db('attendance')
      .select('id', 'class_id', 'date', 'status', 'remarks', 'created_at')
      .where('student_id', student.id);

    if (classId) {
      query = query.where('class_id', classId);
    }

    const attendance = await query.orderBy('date', 'desc');

    // Calculate attendance percentage
    const total = attendance.length;
    const present = attendance.filter((a: any) => a.status === 'present').length;
    const attendancePercentage = total > 0 ? Math.round((present / total) * 100) : 0;

    res.json({
      student_id: student.student_id,
      total_records: total,
      present,
      attendance_percentage: attendancePercentage,
      records: attendance,
    });

    logger.info(`Retrieved attendance for student: ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

export default router;
