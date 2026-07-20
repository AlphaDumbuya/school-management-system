import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '@middleware/authMiddleware';
import { checkSubscriptionLimit } from '@middleware/subscriptionGuard';
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
router.post('/', authenticate, attachUserContext, authorize('principal', 'super_admin', 'teacher', 'admissions_officer'), checkSubscriptionLimit('students'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { first_name, last_name, date_of_birth, gender, email, phone, address, city, state, postal_code, country, enrollment_date, status, photo_url, religion, nationality, place_of_birth, guardian_name, guardian_phone, guardian_relationship, guardian_occupation, emergency_contact, previous_school, medical_conditions, class_id } = req.body;
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

    // Generate unique student ID (STU-YYYY-XXXXX format) using MAX to prevent duplicates
    const year = new Date().getFullYear();
    const maxResult = await db.raw(
      "SELECT COALESCE(MAX(CAST(SPLIT_PART(student_id, '-', 3) AS INTEGER)), 0) as max_num FROM students WHERE student_id LIKE ?",
      [`STU-${year}-%`]
    );
    const nextNum = (Number(maxResult.rows?.[0]?.max_num) || 0) + 1;
    const studentId = `STU-${year}-${String(nextNum).padStart(5, '0')}`;

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
      photo_url: photo_url || null,
      religion: religion || null,
      nationality: nationality || null,
      place_of_birth: place_of_birth || null,
      guardian_name: guardian_name || null,
      guardian_phone: guardian_phone || null,
      guardian_relationship: guardian_relationship || null,
      guardian_occupation: guardian_occupation || null,
      emergency_contact: emergency_contact || null,
      previous_school: previous_school || null,
      medical_conditions: medical_conditions || null,
      status: status || 'active',
      created_at: new Date(),
      updated_at: new Date(),
    }).returning('*');

    // If class_id provided, enroll student in that class
    if (class_id && inserted.id) {
      await db('enrollments').insert({
        student_id: inserted.id,
        class_id: class_id,
        enrollment_date: enrollment_date || new Date().toISOString().split('T')[0],
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }).catch(() => { /* ignore if enrollment fails */ });
    }

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
router.get('/', authenticate, authorize('principal', 'super_admin', 'teacher', 'admissions_officer'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const search = req.query.search as string;

    let query = db('students')
      .select(
        'students.*',
        'classes.name as class_name',
        'classes.level as class_level'
      )
      .leftJoin('enrollments', function () {
        this.on('students.id', '=', 'enrollments.student_id')
          .andOnIn('enrollments.status', ['enrolled', 'active']);
      })
      .leftJoin('classes', 'enrollments.class_id', 'classes.id');

    // Apply filters
    if (status) {
      query = query.where('students.status', status);
    }

    if (search) {
      const term = `%${search.trim()}%`;
      query = query.where(function () {
        this.where('students.first_name', 'ilike', term)
          .orWhere('students.last_name', 'ilike', term)
          .orWhere('students.student_id', 'ilike', term)
          .orWhere('students.email', 'ilike', term);
      });
    }

    // Separate count query
    let countQuery = db('students').count('students.id as count');
    if (status) countQuery = countQuery.where('students.status', status);
    if (search) {
      const term = `%${search.trim()}%`;
      countQuery = countQuery.where(function () {
        this.where('students.first_name', 'ilike', term)
          .orWhere('students.last_name', 'ilike', term)
          .orWhere('students.student_id', 'ilike', term)
          .orWhere('students.email', 'ilike', term);
      });
    }

    const totalResult = await countQuery.first();
    const total = Number(totalResult?.count ?? 0);

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
        total,
        total_pages: Math.ceil(total / limit),
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
      .select(
        'students.*',
        'classes.name as class_name',
        'classes.level as class_level'
      )
      .leftJoin('enrollments', function () {
        this.on('students.id', '=', 'enrollments.student_id')
          .andOnIn('enrollments.status', ['enrolled', 'active']);
      })
      .leftJoin('classes', 'enrollments.class_id', 'classes.id')
      .where('students.student_id', studentId)
      .orWhere('students.id', studentId)
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
    const { first_name, last_name, gender, email, phone, address, city, state, postal_code, country, status, date_of_birth, enrollment_date, photo_url, religion, nationality, place_of_birth, guardian_name, guardian_phone, guardian_relationship, guardian_occupation, emergency_contact, previous_school, medical_conditions } = req.body;

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

    const updateData: any = {};

    if (first_name) updateData.first_name = first_name.trim();
    if (last_name) updateData.last_name = last_name.trim();
    if (gender !== undefined) updateData.gender = gender || null;
    if (email !== undefined) updateData.email = email ? email.toLowerCase() : null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (address !== undefined) updateData.address = address || null;
    if (city !== undefined) updateData.city = city || null;
    if (state !== undefined) updateData.state = state || null;
    if (postal_code !== undefined) updateData.postal_code = postal_code || null;
    if (country !== undefined) updateData.country = country || null;
    if (status && isAuthorized) updateData.status = status;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth || null;
    if (enrollment_date !== undefined) updateData.enrollment_date = enrollment_date || null;
    if (photo_url !== undefined) updateData.photo_url = photo_url || null;
    if (religion !== undefined) updateData.religion = religion || null;
    if (nationality !== undefined) updateData.nationality = nationality || null;
    if (place_of_birth !== undefined) updateData.place_of_birth = place_of_birth || null;
    if (guardian_name !== undefined) updateData.guardian_name = guardian_name || null;
    if (guardian_phone !== undefined) updateData.guardian_phone = guardian_phone || null;
    if (guardian_relationship !== undefined) updateData.guardian_relationship = guardian_relationship || null;
    if (guardian_occupation !== undefined) updateData.guardian_occupation = guardian_occupation || null;
    if (emergency_contact !== undefined) updateData.emergency_contact = emergency_contact || null;
    if (previous_school !== undefined) updateData.previous_school = previous_school || null;
    if (medical_conditions !== undefined) updateData.medical_conditions = medical_conditions || null;

    updateData.updated_at = new Date();

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
router.delete('/:studentId', authenticate, authorize('principal', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
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
 * DELETE /api/v1/students/:studentId/permanent
 * Permanently delete a student record
 */
router.delete('/:studentId/permanent', authenticate, authorize('principal', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
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

    // Check for linked records
    const enrollments = await db('enrollments').where('student_id', student.id).count('* as count').first();
    if (Number(enrollments?.count ?? 0) > 0) {
      throw new AppError('Cannot permanently delete a student with enrollment history. Use deactivate instead.', 400, 'HAS_ENROLLMENTS');
    }

    await db('students').where('id', student.id).del();

    res.json({ message: 'Student permanently deleted' });
    logger.info(`Student permanently deleted: ${student.student_id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/students/:studentId/reactivate
 * Reactivate a deactivated student
 * @requires admin, principal
 */
router.post('/:studentId/reactivate', authenticate, authorize('principal', 'super_admin'), async (req: Request, res: Response, next: NextFunction) => {
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
