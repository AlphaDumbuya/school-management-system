import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, requirePermission, attachUserContext } from '@middleware/authMiddleware';
import { UserRole } from '../types/auth';

const STAFF_READ = [UserRole.PRINCIPAL, UserRole.SUPER_ADMIN, UserRole.TEACHER];
import { db } from '@utils/database';
import { GradeService } from '@services/gradeService';
import { AuditService } from '@services/auditService';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/errorHandler';

const router = Router();
router.use(authenticate);
router.use(attachUserContext);
const gradeService = new GradeService(db);
const auditService = new AuditService(db);

/**
 * POST /api/v1/grades
 * Record a new grade for a student
 */
router.post(
  '/',
  authenticate,
  requirePermission('grade:create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { student_id, subject_id, class_id, academic_session_id, grade_value, remarks } = req.body;
      const userId = (req as any).user.userId;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      // Verify student belongs to this tenant
      const student = await db('students').where({ id: student_id, tenant_id: tenantId }).first();
      if (!student) {
        throw new AppError('Student not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify class belongs to this tenant
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', class_id)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to this tenant
      const sessionCheck = await db('academic_sessions').where({ id: academic_session_id, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
      }

      const grade = await gradeService.recordGrade(
        {
          student_id,
          subject_id,
          class_id,
          academic_session_id,
          grade_value,
          remarks,
        },
        userId
      );

      // Log audit trail
      await auditService.logAudit({
        entity_type: 'grade',
        entity_id: grade.id,
        action: 'create',
        performed_by: userId,
        new_values: grade,
        reason: `Grade recorded: ${grade_value} for student ${student_id}`,
        source: 'api',
      });

      res.status(201).json({
        success: true,
        message: 'Grade recorded successfully',
        data: grade,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/grades
 * Get all grades with filtering
 */
router.get(
  '/',
  authenticate,
  requirePermission('grade:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { student_id, subject_id, class_id, academic_session_id, status, page, limit } = req.query;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      if (student_id) {
        const student = await db('students').where({ id: student_id as string, tenant_id: tenantId }).first();
        if (!student) {
          return res.json({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } });
        }
      }

      if (class_id) {
        const classCheck = await db('classes')
          .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
          .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
          .where('classes.id', class_id as string)
          .where(function () {
            this.where('academic_sessions.tenant_id', tenantId)
              .orWhere(function () {
                this.whereNull('classes.academic_session_id')
                  .where('class_creator.tenant_id', tenantId);
              });
          })
          .first();
        if (!classCheck) {
          return res.json({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } });
        }
      }

      if (academic_session_id) {
        const sessionCheck = await db('academic_sessions').where({ id: academic_session_id as string, tenant_id: tenantId }).first();
        if (!sessionCheck) {
          return res.json({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, total_pages: 0 } });
        }
      }

      // Intercept and inject tenant filtering
      const result = await gradeService.getGrades({
        student_id: student_id as string,
        subject_id: subject_id as string,
        class_id: class_id as string,
        academic_session_id: academic_session_id as string,
        status: status as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });

      // Filter data returned to make sure it belongs to tenant (in case no filters were passed)
      const studentIds = result.data.map((g: any) => g.student_id);
      const validStudents = await db('students').whereIn('id', studentIds).where('tenant_id', tenantId).select('id');
      const validStudentSet = new Set(validStudents.map((s: any) => s.id));
      result.data = result.data.filter((g: any) => validStudentSet.has(g.student_id));

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/grades/:gradeId
 * Get grade by ID
 */
router.get(
  '/:gradeId',
  authenticate,
  // Staff only: a raw grade row by id has no ownership or publication check.
  authorize(STAFF_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gradeId } = req.params;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      const gradeCheck = await db('grades')
        .join('students', 'grades.student_id', 'students.id')
        .where('grades.id', gradeId)
        .where('students.tenant_id', tenantId)
        .first();
      if (!gradeCheck) {
        throw new AppError('Grade not found or access denied', 404, 'NOT_FOUND');
      }

      const grade = await gradeService.getGradeById(gradeId);

      res.json({
        success: true,
        data: grade,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/grades/:gradeId
 * Update a grade
 */
router.put(
  '/:gradeId',
  authenticate,
  requirePermission('grade:update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gradeId } = req.params;
      const { grade_value, remarks, status } = req.body;
      const userId = (req as any).user.userId;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      const gradeCheck = await db('grades')
        .join('students', 'grades.student_id', 'students.id')
        .where('grades.id', gradeId)
        .where('students.tenant_id', tenantId)
        .first();
      if (!gradeCheck) {
        throw new AppError('Grade not found or access denied', 404, 'NOT_FOUND');
      }

      const oldGrade = await gradeService.getGradeById(gradeId);
      const updatedGrade = await gradeService.updateGrade(
        gradeId,
        { grade_value, remarks, status },
        userId
      );

      // Log audit trail
      await auditService.logAudit({
        entity_type: 'grade',
        entity_id: gradeId,
        action: 'update',
        performed_by: userId,
        old_values: oldGrade,
        new_values: updatedGrade,
        reason: 'Grade updated',
        source: 'api',
      });

      res.json({
        success: true,
        message: 'Grade updated successfully',
        data: updatedGrade,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/grades/:gradeId/finalize
 * Finalize a grade
 */
router.post(
  '/:gradeId/finalize',
  authenticate,
  requirePermission('grade:finalize'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gradeId } = req.params;
      const userId = (req as any).user.userId;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      const gradeCheck = await db('grades')
        .join('students', 'grades.student_id', 'students.id')
        .where('grades.id', gradeId)
        .where('students.tenant_id', tenantId)
        .first();
      if (!gradeCheck) {
        throw new AppError('Grade not found or access denied', 404, 'NOT_FOUND');
      }

      const finalizedGrade = await gradeService.finalizeGrade(gradeId, userId);

      // Log audit trail
      await auditService.logAudit({
        entity_type: 'grade',
        entity_id: gradeId,
        action: 'finalize',
        performed_by: userId,
        new_values: finalizedGrade,
        reason: 'Grade finalized',
        source: 'api',
      });

      res.json({
        success: true,
        message: 'Grade finalized successfully',
        data: finalizedGrade,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/grades/:gradeId
 * Delete a grade
 */
router.delete(
  '/:gradeId',
  authenticate,
  requirePermission('grade:delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gradeId } = req.params;
      const userId = (req as any).user.userId;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      const gradeCheck = await db('grades')
        .join('students', 'grades.student_id', 'students.id')
        .where('grades.id', gradeId)
        .where('students.tenant_id', tenantId)
        .first();
      if (!gradeCheck) {
        throw new AppError('Grade not found or access denied', 404, 'NOT_FOUND');
      }

      await gradeService.deleteGrade(gradeId);

      // Log audit trail
      await auditService.logAudit({
        entity_type: 'grade',
        entity_id: gradeId,
        action: 'delete',
        performed_by: userId,
        reason: 'Grade deleted',
        source: 'api',
      });

      res.json({
        success: true,
        message: 'Grade deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/grades/student/:studentId
 * Get all grades for a student
 */
router.get(
  '/student/:studentId',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      const student = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
      if (!student) {
        throw new AppError('Student not found or access denied', 404, 'NOT_FOUND');
      }

      // Staff; the student themself; or a linked parent (same rule as the
      // gradeRoutes handler mounted ahead of this one on /api/v1/grades).
      const role = String(req.user?.role || '');
      if (!STAFF_READ.map(String).includes(role)) {
        let allowed = false;
        if (role === 'student') allowed = String(student.user_id) === String(req.user?.id);
        else if (role === 'parent' || role === 'guardian') {
          allowed = !!(await db('guardians').where({ user_id: req.user?.id, student_id: student.id }).first('id'));
        }
        if (!allowed) throw new AppError('Insufficient permissions', 403, 'AUTHORIZATION_ERROR');
      }

      const grades = await gradeService.getGrades({
        student_id: studentId,
      });

      res.json({
        success: true,
        data: grades.data,
        pagination: grades.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/grades/class/:classId/average
 * Get class average for a subject
 */
router.get(
  '/class/:classId/average',
  authenticate,
  requirePermission('grade:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const { subjectId, academicSessionId } = req.query;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      if (!subjectId || !academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'subjectId and academicSessionId are required',
        });
      }

      // Verify class belongs to this tenant
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', classId)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify session belongs to this tenant
      const sessionCheck = await db('academic_sessions').where({ id: academicSessionId as string, tenant_id: tenantId }).first();
      if (!sessionCheck) {
        throw new AppError('Academic session not found or access denied', 404, 'NOT_FOUND');
      }

      const average = await gradeService.calculateClassAverage(
        classId,
        subjectId as string,
        academicSessionId as string
      );

      res.json({
        success: true,
        data: {
          class_id: classId,
          subject_id: subjectId,
          academic_session_id: academicSessionId,
          average,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/grades/student/:studentId/gpa
 * Get student GPA
 */
router.get(
  '/student/:studentId/gpa',
  authenticate,
  // Staff only: any student's GPA by id, with no ownership check.
  authorize(STAFF_READ),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;
      const { classId, academicSessionId } = req.query;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      if (!classId || !academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'classId and academicSessionId are required',
        });
      }

      // Verify student belongs to tenant
      const student = await db('students').where({ id: studentId, tenant_id: tenantId }).first();
      if (!student) {
        throw new AppError('Student not found or access denied', 404, 'NOT_FOUND');
      }

      // Verify class belongs to tenant
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', classId as string)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      const gpa = await gradeService.calculateStudentGPA(
        studentId,
        classId as string,
        academicSessionId as string
      );

      res.json({
        success: true,
        data: {
          student_id: studentId,
          class_id: classId,
          academic_session_id: academicSessionId,
          gpa,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/grades/class/:classId/top-students
 * Get top performing students
 */
router.get(
  '/class/:classId/top-students',
  authenticate,
  requirePermission('grade:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const { academicSessionId, limit } = req.query;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
      }

      // Verify class belongs to tenant
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', classId)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      const topStudents = await gradeService.getTopStudentsInClass(
        classId,
        academicSessionId as string,
        limit ? parseInt(limit as string) : 10
      );

      res.json({
        success: true,
        data: topStudents,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/grades/class/:classId/report
 * Get class grade report
 */
router.get(
  '/class/:classId/report',
  authenticate,
  requirePermission('grade:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { classId } = req.params;
      const { academicSessionId } = req.query;
      const tenantId = req.user?.tenant_id;

      if (!tenantId) {
        throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
      }

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
      }

      // Verify class belongs to tenant
      const classCheck = await db('classes')
        .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
        .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
        .where('classes.id', classId)
        .where(function () {
          this.where('academic_sessions.tenant_id', tenantId)
            .orWhere(function () {
              this.whereNull('classes.academic_session_id')
                .where('class_creator.tenant_id', tenantId);
            });
        })
        .first();
      if (!classCheck) {
        throw new AppError('Class not found or access denied', 404, 'NOT_FOUND');
      }

      const report = await gradeService.generateClassGradeReport(
        classId,
        academicSessionId as string
      );

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
