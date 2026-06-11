import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requirePermission } from '@middleware/authMiddleware';
import { db } from '@utils/database';
import { GradeService } from '@services/gradeService';
import { AuditService } from '@services/auditService';
import { logger } from '@utils/logger';

const router = Router();
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

      const result = await gradeService.getGrades({
        student_id: student_id as string,
        subject_id: subject_id as string,
        class_id: class_id as string,
        academic_session_id: academic_session_id as string,
        status: status as string,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });

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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { gradeId } = req.params;

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
      const { grade_value, remarks } = req.body;
      const userId = (req as any).user.userId;

      const oldGrade = await gradeService.getGradeById(gradeId);
      const updatedGrade = await gradeService.updateGrade(gradeId, { grade_value, remarks }, userId);

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

      if (!subjectId || !academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'subjectId and academicSessionId are required',
        });
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { studentId } = req.params;
      const { classId, academicSessionId } = req.query;

      if (!classId || !academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'classId and academicSessionId are required',
        });
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

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
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

      if (!academicSessionId) {
        return res.status(400).json({
          success: false,
          error: 'academicSessionId is required',
        });
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
