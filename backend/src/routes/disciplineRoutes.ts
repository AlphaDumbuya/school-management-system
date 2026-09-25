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

const router = Router();

// Apply authentication + tenant context to all routes, then gate the whole
// module behind the 'discipline' plan feature (paid plans only).
router.use(authenticate);
router.use(attachUserContext);
router.use(requirePlanFeature('discipline'));

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
      const infraction = await infractionService.recordInfraction(req.user.tenant_id, {
        ...req.body,
        recorded_by: req.user.id,
      });

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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await infractionService.getStudentInfractions(
        req.params.studentId,
        req.user.tenant_id,
        {
          status: req.query.status as string,
          severity: req.query.severity as string,
          date_from: req.query.date_from ? new Date(req.query.date_from as string) : undefined,
          date_to: req.query.date_to ? new Date(req.query.date_to as string) : undefined,
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || 20,
        }
      );

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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const infraction = await infractionService.getInfraction(
        req.params.infractionId,
        req.user.tenant_id
      );

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
      const infraction = await infractionService.updateInfraction(
        req.params.infractionId,
        req.user.tenant_id,
        req.body,
        req.user.id
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
        }
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
      const note = await behavioralNoteService.createNote(req.user.tenant_id, {
        ...req.body,
        recorded_by: req.user.id,
      });

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
      const note = await behavioralNoteService.updateNote(
        req.params.noteId,
        req.user.tenant_id,
        req.body,
        req.user.id
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
      await behavioralNoteService.deleteNote(req.params.noteId, req.user.tenant_id, req.user.id);

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
      const note = await behavioralNoteService.shareWithStudent(
        req.params.noteId,
        req.user.tenant_id,
        req.user.id
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
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await disciplineService.getStudentStats(
        req.params.studentId,
        req.user.tenant_id
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
