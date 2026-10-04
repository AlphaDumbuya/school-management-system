/**
 * Discipline & Conduct API Routes
 * Phase 2.3 - Discipline & Conduct Management Module
 * 30+ endpoints for complete discipline management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware.js';
import { requirePlanFeature } from '../middleware/subscriptionGuard.js';
import { validate } from '../middleware/validate.js';
import {
  recordInfractionSchema,
  updateInfractionSchema,
  resolveInfractionSchema,
  assignActionSchema,
  updateActionStatusSchema,
  cancelActionSchema,
  scheduleDetentionSchema,
  rescheduleDetentionSchema,
  submitAppealSchema,
  approveAppealSchema,
  rejectAppealSchema,
  escalateAppealSchema,
  createNoteSchema,
  updateNoteSchema,
  generateReportSchema,
} from '../validators/disciplineValidators.js';
import { logger } from '../utils/logger.js';
import disciplineService from '../services/disciplineService.js';
import infractionService from '../services/infractionService.js';
import detentionService from '../services/detentionService.js';
import appealService from '../services/appealService.js';
import conductReportService from '../services/conductReportService.js';
import behavioralNoteService from '../services/behavioralNoteService.js';
import disciplineAnalyticsService from '../services/disciplineAnalyticsService.js';
import { resolveYearScope } from '../utils/academicYear.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  resolveDisciplineStudent, teacherTeachesOrTaught, resolveForWrite,
  assertWritableDate, assertRecordWritable, resolveInfractionType,
} from '../utils/disciplineScope.js';

const router = Router();

/**
 * Discipline is staff-only. Students, parents and finance staff have no
 * discipline screens; without this, any logged-in account could list the
 * whole school's infractions and notes. Admissions officers may READ (the
 * Student Profiles conduct tab) but never write.
 */
const staffOnly = (req: Request, _res: Response, next: NextFunction) => {
  const role = req.user?.role;
  if (role === 'principal' || role === 'teacher' || role === 'super_admin') return next();
  if (role === 'admissions_officer' && req.method === 'GET') return next();
  return next(new AppError('Discipline records are available to school staff only', 403, 'FORBIDDEN'));
};

/**
 * For /…/:studentId routes: accept students.id, users.id or an admission
 * number, rewrite the param to users.id (what discipline tables store), and
 * keep teachers to students who are or were in their classes.
 */
const studentParam = async (req: Request, _res: Response, next: NextFunction) => {
  // '/notes/:studentId' is declared before '/notes/summary/:studentId', so
  // "summary" lands here: hand it on to the summary route.
  if (req.params.studentId === 'summary') return next('route');
  try {
    const tenantId = req.user!.tenant_id;
    const student = await resolveDisciplineStudent(tenantId, req.params.studentId);
    if (!student) throw new AppError('Student not found', 404, 'NOT_FOUND');
    if (req.user!.role === 'teacher' && !(await teacherTeachesOrTaught(req.user!.id, tenantId, student.studentId))) {
      throw new AppError('You can only view conduct for students in your classes', 403, 'FORBIDDEN');
    }
    req.params.studentId = student.userId;
    next();
  } catch (error) { next(error); }
};

/** Teachers don't see colleagues' confidential records. */
const hideConfidential = (req: Request, rows: any[]) =>
  req.user?.role === 'teacher'
    ? rows.filter((r) => !r?.is_confidential || String(r.recorded_by) === String(req.user!.id))
    : rows;

// Apply authentication + tenant context to all routes, then gate the whole
// module behind the 'discipline' plan feature (paid plans only).
router.use(authenticate);
router.use(attachUserContext);
router.use(requirePlanFeature('discipline'));
router.use(staffOnly);

// ==================== INFRACTION MANAGEMENT ====================

/**
 * POST /api/v1/discipline/infractions
 * Record new infraction
 */
router.post(
  '/infractions',
  authorize(['principal', 'teacher', 'super_admin']),
  validate(recordInfractionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenant_id;
      // Who it's about (stored by users.id), the class it's filed under
      // (teachers: only their own current students), a real tenant type, and a
      // date that's not in the future or in a past academic year.
      const { student, classId } = await resolveForWrite(req, req.body.student_id);
      await assertWritableDate(tenantId, req.body.incident_date, 'incident date');
      const infractionTypeId = await resolveInfractionType(tenantId, String(req.body.infraction_type_id), req.user!.id);
      const infraction = await infractionService.recordInfraction(tenantId, {
        student_id: student.userId,
        infraction_type_id: infractionTypeId,
        incident_date: req.body.incident_date,
        incident_description: req.body.incident_description,
        incident_location: req.body.incident_location,
        notes: req.body.notes,
        is_confidential: !!req.body.is_confidential,
        evidence_type: req.body.evidence_type,
        evidence_urls: req.body.evidence_urls,
        // Severity overrides are a principal decision.
        severity_override: req.user!.role === 'teacher' ? undefined : req.body.severity_override,
        class_id: classId ?? undefined,
        recorded_by: req.user!.id,
      } as any);

      res.status(201).json({ infraction });
    } catch (error) {
      logger.error('Error recording infraction:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/infractions
 * List all infractions (school-wide, tenant-isolated)
 */
router.get(
  '/infractions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await infractionService.listAllInfractions(
        req.user.tenant_id,
        {
          search: req.query.search as string,
          status: req.query.status as string,
          severity: req.query.severity as string,
          // Teachers only see infractions they recorded.
          recordedBy: req.user.role === 'teacher' ? req.user.id : undefined,
          yearScope: await resolveYearScope(req.user.tenant_id, req.query.academic_year),
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        }
      );

      res.json(result);
    } catch (error) {
      logger.error('Error listing all infractions:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/infractions/:studentId
 * Get infractions for student
 */
router.get(
  '/infractions/:studentId',
  studentParam,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result: any = await infractionService.getStudentInfractions(
        req.params.studentId,
        req.user.tenant_id,
        {
          status: req.query.status as string,
          severity: req.query.severity as string,
          date_from: req.query.date_from ? new Date(req.query.date_from as string) : undefined,
          date_to: req.query.date_to ? new Date(req.query.date_to as string) : undefined,
          yearScope: await resolveYearScope(req.user!.tenant_id, req.query.academic_year),
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        } as any
      );

      if (Array.isArray(result?.data)) result.data = hideConfidential(req, result.data);
      res.json(result);
    } catch (error) {
      logger.error('Error getting infractions:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/infractions/:studentId/:infractionId
 * Get single infraction
 */
router.get(
  '/infractions/:studentId/:infractionId',
  studentParam,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const infraction: any = await infractionService.getInfraction(
        req.params.infractionId,
        req.user!.tenant_id
      );
      // The id must belong to THIS student, and teachers don't see a
      // colleague's confidential record.
      if (String(infraction?.student_id) !== String(req.params.studentId) || hideConfidential(req, [infraction]).length === 0) {
        throw new AppError('Infraction not found', 404, 'NOT_FOUND');
      }

      res.json({ infraction });
    } catch (error) {
      logger.error('Error getting infraction:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/v1/discipline/infractions/:infractionId
 * Update infraction
 */
router.put(
  '/infractions/:infractionId',
  authorize(['principal', 'super_admin']),
  validate(updateInfractionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing: any = await infractionService.getInfraction(req.params.infractionId, req.user!.tenant_id);
      await assertRecordWritable(req.user!.tenant_id, existing?.class_id, existing?.incident_date);
      // Only the incident's own fields may change (body is passthrough).
      const allowed = ['incident_description', 'incident_location', 'severity_override', 'notes', 'is_confidential', 'status'];
      const body = Object.fromEntries(Object.entries(req.body ?? {}).filter(([k]) => allowed.includes(k)));
      const infraction = await infractionService.updateInfraction(
        req.params.infractionId,
        req.user!.tenant_id,
        body,
        req.user!.id
      );

      res.json({ infraction });
    } catch (error) {
      logger.error('Error updating infraction:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/infractions/:infractionId/acknowledge
 * Acknowledge infraction
 */
router.post(
  '/infractions/:infractionId/acknowledge',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing: any = await infractionService.getInfraction(req.params.infractionId, req.user!.tenant_id);
      await assertRecordWritable(req.user!.tenant_id, existing?.class_id, existing?.incident_date);
      const infraction = await infractionService.acknowledgeInfraction(
        req.params.infractionId,
        req.user.tenant_id,
        req.user.id
      );

      res.json({ infraction });
    } catch (error) {
      logger.error('Error acknowledging infraction:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/infractions/:infractionId/resolve
 * Resolve infraction
 */
router.post(
  '/infractions/:infractionId/resolve',
  authorize(['principal', 'super_admin']),
  validate(resolveInfractionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing: any = await infractionService.getInfraction(req.params.infractionId, req.user!.tenant_id);
      await assertRecordWritable(req.user!.tenant_id, existing?.class_id, existing?.incident_date);
      const infraction = await infractionService.resolveInfraction(
        req.params.infractionId,
        req.user.tenant_id,
        req.user.id,
        req.body.resolution_notes
      );

      res.json({ infraction });
    } catch (error) {
      logger.error('Error resolving infraction:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/classes/:classId/infractions
 * Get infractions by class
 */
router.get(
  '/classes/:classId/infractions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await infractionService.getClassInfractions(
        req.params.classId,
        req.user.tenant_id,
        {
          status: req.query.status as string,
          date_from: req.query.date_from ? new Date(req.query.date_from as string) : undefined,
          date_to: req.query.date_to ? new Date(req.query.date_to as string) : undefined,
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        }
      );

      res.json(result);
    } catch (error) {
      logger.error('Error getting class infractions:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/repeat-offenders
 * Get repeat offenders
 */
router.get(
  '/repeat-offenders',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const offenders = await infractionService.getRepeatOffenders(
        req.user.tenant_id,
        req.query.class_id as string,
        parseInt(req.query.limit as string) || 10
      );

      res.json({ repeat_offenders: offenders });
    } catch (error) {
      logger.error('Error getting repeat offenders:', error);
      next(error);
    }
  }
);

// ==================== DISCIPLINE ACTIONS ====================

/**
 * POST /api/v1/discipline/actions
 * Assign discipline action
 */
router.post(
  '/actions',
  authorize(['principal', 'super_admin']),
  validate(assignActionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const action = await disciplineService.assignDisciplineAction(req.user.tenant_id, {
        ...req.body,
        assigned_by: req.user.id,
      });

      res.status(201).json({ action });
    } catch (error) {
      logger.error('Error assigning action:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/actions
 * List all discipline actions (school-wide, tenant-isolated)
 */
router.get(
  '/actions',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await disciplineService.listAllActions(
        req.user.tenant_id,
        {
          search: req.query.search as string,
          status: req.query.status as string,
          action_type: req.query.action_type as string,
          yearScope: await resolveYearScope(req.user.tenant_id, req.query.academic_year),
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        }
      );

      res.json(result);
    } catch (error) {
      logger.error('Error listing all actions:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/actions/:studentId
 * Get student actions
 */
router.get(
  '/actions/:studentId',
  studentParam,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await disciplineService.getStudentActions(
        req.params.studentId,
        req.user.tenant_id,
        {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
          filters: {
            status: req.query.status as string,
            action_type: req.query.action_type as string,
          },
          yearScope: await resolveYearScope(req.user!.tenant_id, req.query.academic_year),
        } as any
      );

      res.json(result);
    } catch (error) {
      logger.error('Error getting actions:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/v1/discipline/actions/:actionId/status
 * Update action status
 */
router.put(
  '/actions/:actionId/status',
  authorize(['principal', 'super_admin']),
  validate(updateActionStatusSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const action = await disciplineService.updateActionStatus(
        req.params.actionId,
        req.user.tenant_id,
        req.body.status,
        req.user.id,
        req.body.notes
      );

      res.json({ action });
    } catch (error) {
      logger.error('Error updating action status:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/actions/:actionId/cancel
 * Cancel action
 */
router.post(
  '/actions/:actionId/cancel',
  authorize(['principal', 'super_admin']),
  validate(cancelActionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const action = await disciplineService.cancelAction(
        req.params.actionId,
        req.user.tenant_id,
        req.user.id,
        req.body.reason
      );

      res.json({ action });
    } catch (error) {
      logger.error('Error cancelling action:', error);
      next(error);
    }
  }
);

// ==================== DETENTION ====================

/**
 * POST /api/v1/discipline/detentions
 * Schedule detention
 */
router.post(
  '/detentions',
  authorize(['principal', 'super_admin']),
  validate(scheduleDetentionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detention = await detentionService.scheduleDetention(req.user.tenant_id, req.body);

      res.status(201).json({ detention });
    } catch (error) {
      logger.error('Error scheduling detention:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/detentions/:studentId
 * Get student detentions
 */
router.get(
  '/detentions/:studentId',
  studentParam,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await detentionService.getStudentDetentions(
        req.params.studentId,
        req.user.tenant_id,
        {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
          filters: {
            status: req.query.status as string,
            date_from: req.query.date_from ? new Date(req.query.date_from as string) : undefined,
            date_to: req.query.date_to ? new Date(req.query.date_to as string) : undefined,
          },
        }
      );

      res.json(result);
    } catch (error) {
      logger.error('Error getting detentions:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/detentions/:detentionId/attend
 * Mark detention attended
 */
router.post(
  '/detentions/:detentionId/attend',
  authorize(['principal', 'teacher', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detention = await detentionService.markAttended(
        req.params.detentionId,
        req.user.tenant_id,
        req.body.supervisor_notes
      );

      res.json({ detention });
    } catch (error) {
      logger.error('Error marking attended:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/detentions/:detentionId/absent
 * Mark detention absent
 */
router.post(
  '/detentions/:detentionId/absent',
  authorize(['principal', 'teacher', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detention = await detentionService.markAbsent(
        req.params.detentionId,
        req.user.tenant_id,
        req.user.id,
        req.body.reason
      );

      res.json({ detention });
    } catch (error) {
      logger.error('Error marking absent:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/detentions/:detentionId/reschedule
 * Reschedule detention
 */
router.post(
  '/detentions/:detentionId/reschedule',
  authorize(['principal', 'super_admin']),
  validate(rescheduleDetentionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const detention = await detentionService.rescheduleDetention(
        req.params.detentionId,
        req.user.tenant_id,
        new Date(req.body.new_date),
        req.user.id,
        req.body.reason
      );

      res.json({ detention });
    } catch (error) {
      logger.error('Error rescheduling detention:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/detention-calendar
 * Get detention calendar
 */
router.get(
  '/detention-calendar',
  authorize(['principal', 'teacher', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const calendar = await detentionService.getDetentionCalendar(
        req.user.tenant_id,
        new Date(req.query.start_date as string),
        new Date(req.query.end_date as string),
        req.query.location as string
      );

      res.json({ calendar });
    } catch (error) {
      logger.error('Error getting detention calendar:', error);
      next(error);
    }
  }
);

// ==================== APPEALS ====================

/**
 * POST /api/v1/discipline/appeals
 * Submit appeal
 */
router.post(
  '/appeals',
  authorize(['principal', 'super_admin', 'teacher']),
  validate(submitAppealSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appeal = await appealService.submitAppeal(req.user.tenant_id, {
        ...req.body,
        submitted_by: req.user.id,
      });

      res.status(201).json({ appeal });
    } catch (error) {
      logger.error('Error submitting appeal:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/appeals/pending
 * Get pending appeals
 */
router.get(
  '/appeals/pending',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appeals = await appealService.getPendingAppeals(
        req.user.tenant_id,
        parseInt(req.query.limit as string) || 10
      );

      res.json({ pending_appeals: appeals });
    } catch (error) {
      logger.error('Error getting pending appeals:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/appeals
 * List all discipline appeals (school-wide, tenant-isolated)
 */
router.get(
  '/appeals',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await appealService.listAllAppeals(
        req.user.tenant_id,
        {
          search: req.query.search as string,
          status: req.query.status as string,
          yearScope: await resolveYearScope(req.user.tenant_id, req.query.academic_year),
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        }
      );

      res.json(result);
    } catch (error) {
      logger.error('Error listing all appeals:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/appeals/:studentId
 * Get student appeals
 */
router.get(
  '/appeals/:studentId',
  studentParam,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await appealService.getStudentAppeals(
        req.params.studentId,
        req.user.tenant_id,
        {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
          filters: {
            status: req.query.status as string,
          },
        }
      );

      res.json(result);
    } catch (error) {
      logger.error('Error getting appeals:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/appeals/:appealId/review
 * Review appeal
 */
router.post(
  '/appeals/:appealId/review',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appeal = await appealService.reviewAppeal(
        req.params.appealId,
        req.user.tenant_id,
        req.user.id
      );

      res.json({ appeal });
    } catch (error) {
      logger.error('Error reviewing appeal:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/appeals/:appealId/approve
 * Approve appeal
 */
router.post(
  '/appeals/:appealId/approve',
  authorize(['principal', 'super_admin']),
  validate(approveAppealSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appeal = await appealService.approveAppeal(
        req.params.appealId,
        req.user.tenant_id,
        req.user.id,
        req.body.decision_notes,
        req.body.modified_action
      );

      res.json({ appeal });
    } catch (error) {
      logger.error('Error approving appeal:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/appeals/:appealId/reject
 * Reject appeal
 */
router.post(
  '/appeals/:appealId/reject',
  authorize(['principal', 'super_admin']),
  validate(rejectAppealSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appeal = await appealService.rejectAppeal(
        req.params.appealId,
        req.user.tenant_id,
        req.user.id,
        req.body.decision_notes
      );

      res.json({ appeal });
    } catch (error) {
      logger.error('Error rejecting appeal:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/appeals/:appealId/escalate
 * Escalate appeal
 */
router.post(
  '/appeals/:appealId/escalate',
  authorize(['principal', 'super_admin']),
  validate(escalateAppealSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const appeal = await appealService.escalateAppeal(
        req.params.appealId,
        req.user.tenant_id,
        req.user.id,
        req.body.reason
      );

      res.json({ appeal });
    } catch (error) {
      logger.error('Error escalating appeal:', error);
      next(error);
    }
  }
);

// ==================== BEHAVIORAL NOTES ====================

/**
 * POST /api/v1/discipline/notes
 * Create behavioral note
 */
router.post(
  '/notes',
  authorize(['principal', 'teacher', 'super_admin']),
  validate(createNoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenant_id;
      // Same rules as infractions: stored by users.id, filed under the
      // student's current class, teachers only for their own students.
      const { student, classId } = await resolveForWrite(req, req.body.student_id);
      await assertWritableDate(tenantId, req.body.note_date, 'note date');
      const note = await behavioralNoteService.createNote(tenantId, {
        student_id: student.userId,
        note_type: req.body.note_type,
        content: req.body.content,
        category: req.body.category,
        rating: req.body.rating,
        note_date: req.body.note_date,
        is_confidential: !!req.body.is_confidential,
        // A confidential note is never shared with the student.
        is_shared_with_student: !req.body.is_confidential && !!req.body.is_shared_with_student,
        class_id: classId ?? undefined,
        recorded_by: req.user!.id,
      } as any);

      res.status(201).json({ note });
    } catch (error) {
      logger.error('Error creating note:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/notes
 * List all behavioral notes (school-wide, tenant-isolated)
 */
router.get(
  '/notes',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await behavioralNoteService.listAllNotes(
        req.user.tenant_id,
        {
          search: req.query.search as string,
          note_type: req.query.note_type as string,
          // Teachers only see notes they recorded.
          recordedBy: req.user.role === 'teacher' ? req.user.id : undefined,
          yearScope: await resolveYearScope(req.user.tenant_id, req.query.academic_year),
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        }
      );

      res.json(result);
    } catch (error) {
      logger.error('Error listing all notes:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/notes/:studentId
 * Get student notes
 */
router.get(
  '/notes/:studentId',
  studentParam,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await behavioralNoteService.getStudentNotes(
        req.params.studentId,
        req.user.tenant_id,
        {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
          filters: {
            status: req.query.note_type as string,
          },
        }
      );

      res.json(result);
    } catch (error) {
      logger.error('Error getting notes:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/notes/summary/:studentId
 * Get note summary
 */
router.get(
  '/notes/summary/:studentId',
  studentParam,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await behavioralNoteService.getStudentNoteSummary(
        req.params.studentId,
        req.user.tenant_id
      );

      res.json({ summary });
    } catch (error) {
      logger.error('Error getting note summary:', error);
      next(error);
    }
  }
);

/**
 * PUT /api/v1/discipline/notes/:noteId
 * Update note
 */
router.put(
  '/notes/:noteId',
  authorize(['principal', 'teacher', 'super_admin']),
  validate(updateNoteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user!.tenant_id;
      const existing: any = await behavioralNoteService.getNote(req.params.noteId, tenantId);
      // Teachers may only edit notes they wrote (the list only shows theirs,
      // but the id is guessable).
      if (req.user!.role === 'teacher' && String(existing.recorded_by) !== String(req.user!.id)) {
        throw new AppError('You can only edit notes you recorded', 403, 'FORBIDDEN');
      }
      await assertRecordWritable(tenantId, existing.class_id, existing.note_date);
      const note = await behavioralNoteService.updateNote(
        req.params.noteId,
        tenantId,
        req.body,
        req.user!.id
      );

      res.json({ note });
    } catch (error) {
      logger.error('Error updating note:', error);
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/discipline/notes/:noteId
 * Delete note (soft delete)
 */
router.delete(
  '/notes/:noteId',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing: any = await behavioralNoteService.getNote(req.params.noteId, req.user!.tenant_id);
      await assertRecordWritable(req.user!.tenant_id, existing.class_id, existing.note_date);
      await behavioralNoteService.deleteNote(req.params.noteId, req.user!.tenant_id, req.user!.id);

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting note:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/notes/:noteId/share
 * Share note with student
 */
router.post(
  '/notes/:noteId/share',
  authorize(['principal', 'teacher']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing: any = await behavioralNoteService.getNote(req.params.noteId, req.user!.tenant_id);
      if (req.user!.role === 'teacher' && String(existing.recorded_by) !== String(req.user!.id)) {
        throw new AppError('You can only share notes you recorded', 403, 'FORBIDDEN');
      }
      await assertRecordWritable(req.user!.tenant_id, existing.class_id, existing.note_date);
      const note = await behavioralNoteService.shareWithStudent(
        req.params.noteId,
        req.user!.tenant_id,
        req.user!.id
      );

      res.json({ note });
    } catch (error) {
      logger.error('Error sharing note:', error);
      next(error);
    }
  }
);

// ==================== CONDUCT REPORTS ====================

/**
 * POST /api/v1/discipline/reports/generate
 * Generate conduct report
 */
router.post(
  '/reports/generate',
  authorize(['principal', 'super_admin']),
  validate(generateReportSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await conductReportService.generateReport(
        req.user.tenant_id,
        req.body.student_id,
        req.body.report_period,
        req.body.start_date ? new Date(req.body.start_date) : undefined,
        req.body.end_date ? new Date(req.body.end_date) : undefined,
        req.user.id
      );

      res.status(201).json({ report });
    } catch (error) {
      logger.error('Error generating report:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/reports
 * List all conduct reports (school-wide, tenant-isolated)
 */
router.get(
  '/reports',
  authorize(['principal', 'teacher', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await conductReportService.listAllReports(req.user.tenant_id, {
        search: req.query.search as string,
        report_period: req.query.report_period as string,
        shared: req.query.shared as string,
        yearScope: await resolveYearScope((req as any).user.tenant_id, req.query.academic_year),
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      });

      res.json(result);
    } catch (error) {
      logger.error('Error listing all conduct reports:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/reports/:studentId
 * Get student reports
 */
router.get(
  '/reports/:studentId',
  studentParam,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reports = await conductReportService.getStudentReports(
        req.params.studentId,
        req.user.tenant_id
      );

      res.json({ reports });
    } catch (error) {
      logger.error('Error getting reports:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/reports/:reportId/share
 * Share report with parents
 */
router.post(
  '/reports/:reportId/share',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await conductReportService.shareWithParents(
        req.params.reportId,
        req.user.tenant_id,
        req.user.id
      );

      res.json({ report });
    } catch (error) {
      logger.error('Error sharing report:', error);
      next(error);
    }
  }
);

/**
 * POST /api/v1/discipline/reports/:reportId/acknowledge
 * Acknowledge report
 */
router.post(
  '/reports/:reportId/acknowledge',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await conductReportService.acknowledgeReceipt(
        req.params.reportId,
        req.user.tenant_id,
        req.user.id
      );

      res.json({ report });
    } catch (error) {
      logger.error('Error acknowledging report:', error);
      next(error);
    }
  }
);

// ==================== ANALYTICS ====================

/**
 * GET /api/v1/discipline/analytics/dashboard
 * Get dashboard summary
 */
router.get(
  '/analytics/dashboard',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await disciplineAnalyticsService.getDashboardSummary(req.user.tenant_id);

      res.json(summary);
    } catch (error) {
      logger.error('Error getting analytics:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/analytics/trends
 * Get infraction trends
 */
router.get(
  '/analytics/trends',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const trends = await disciplineAnalyticsService.getInfractionTrends(
        req.user.tenant_id,
        parseInt(req.query.days as string) || 30
      );

      res.json(trends);
    } catch (error) {
      logger.error('Error getting trends:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/analytics/high-risk
 * Get high-risk students
 */
router.get(
  '/analytics/high-risk',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const students = await disciplineAnalyticsService.getHighRiskStudents(
        req.user.tenant_id,
        parseInt(req.query.limit as string) || 10
      );

      res.json({ high_risk_students: students });
    } catch (error) {
      logger.error('Error getting high-risk students:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/analytics/report
 * Get comprehensive report
 */
router.get(
  '/analytics/report',
  authorize(['principal', 'super_admin']),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await disciplineAnalyticsService.generateComprehensiveReport(req.user.tenant_id);

      res.json(report);
    } catch (error) {
      logger.error('Error generating comprehensive report:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/statistics/student/:studentId
 * Get student discipline statistics
 */
router.get(
  '/statistics/student/:studentId',
  studentParam,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await disciplineService.getStudentStats(
        req.params.studentId,
        req.user!.tenant_id,
        await resolveYearScope(req.user!.tenant_id, req.query.academic_year),
      );

      res.json(stats);
    } catch (error) {
      logger.error('Error getting student stats:', error);
      next(error);
    }
  }
);

/**
 * GET /api/v1/discipline/statistics/class/:classId
 * Get class discipline statistics
 */
router.get(
  '/statistics/class/:classId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await disciplineService.getClassStats(
        req.params.classId,
        req.user.tenant_id
      );

      res.json(stats);
    } catch (error) {
      logger.error('Error getting class stats:', error);
      next(error);
    }
  }
);

export default router;
