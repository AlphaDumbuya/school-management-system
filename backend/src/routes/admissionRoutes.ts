/**
 * Admission Routes
 * API endpoints for the admissions workflow
 */

import express, { Request, Response } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware';
import * as admissionApplicationService from '../services/admissionApplicationService';
import * as applicationDocumentService from '../services/applicationDocumentService';
import * as applicationInterviewService from '../services/applicationInterviewService';
import * as admissionStatisticsService from '../services/admissionStatisticsService';
import { db } from '../utils/database';
import {
  CreateApplicationDTO,
  UpdateApplicationDTO,
  UpdateApplicationStatusDTO,
  ScheduleInterviewDTO,
  UpdateInterviewDTO,
  ApplicationListQuery,
  DocumentType,
  VerificationStatus
} from '../types/admission';

const router = express.Router();

// All routes require authentication
router.use(authenticate);
router.use(attachUserContext);

/**
 * @route   POST /api/v1/admissions/applications
 * @desc    Create a new admission application
 * @access  Admissions Officer, Principal
 */
router.post(
  '/applications',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const data: CreateApplicationDTO = req.body;

      if (data.grade_id) {
        const gradeCheck = await db('classes')
          .leftJoin('academic_sessions', 'classes.academic_session_id', 'academic_sessions.id')
          .leftJoin('users as class_creator', 'classes.created_by', 'class_creator.id')
          .where('classes.id', data.grade_id)
          .where(function () {
            this.where('academic_sessions.tenant_id', tenantId)
              .orWhere(function () {
                this.whereNull('classes.academic_session_id')
                  .where('class_creator.tenant_id', tenantId);
              });
          })
          .first();
        if (!gradeCheck) {
          res.status(400).json({ success: false, message: 'Grade/Class not found or access denied' });
          return;
        }
      }

      const application = await admissionApplicationService.createApplication(
        { ...data, tenant_id: tenantId },
        req.user?.id
      );
      
      res.status(201).json({
        success: true,
        data: application,
        message: 'Application created successfully'
      });
    } catch (error: any) {
      console.error('Error creating application:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create application',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/admissions/applications
 * @desc    List admission applications with filters
 * @access  Admissions Officer, Principal
 */
router.get(
  '/applications',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const query: ApplicationListQuery = {
        status: req.query.status as any,
        grade_id: req.query.grade_id as string,
        assigned_to: req.query.assigned_to as string,
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined
      };
      
      const result = await admissionApplicationService.listApplications(query, tenantId);
      
      res.json({
        success: true,
        data: result.applications,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          pages: Math.ceil(result.total / result.limit)
        }
      });
    } catch (error: any) {
      console.error('Error listing applications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to list applications',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/admissions/applications/:id
 * @desc    Get application by ID
 * @access  Admissions Officer, Principal
 */
router.get(
  '/applications/:id',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const { id } = req.params;
      const application = await admissionApplicationService.getApplicationById(id, tenantId);
      
      if (!application) {
        res.status(404).json({
          success: false,
          message: 'Application not found'
        });
        return;
      }
      
      // Get related data
      const documents = await applicationDocumentService.getApplicationDocuments(id);
      const interviews = await applicationInterviewService.getApplicationInterviews(id);
      const timeline = await admissionApplicationService.getApplicationTimeline(id);
      
      res.json({
        success: true,
        data: {
          ...application,
          documents,
          interviews,
          timeline
        }
      });
    } catch (error: any) {
      console.error('Error getting application:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get application',
        error: error.message
      });
    }
  }
);

/**
 * @route   PATCH /api/v1/admissions/applications/:id
 * @desc    Update application details
 * @access  Admissions Officer, Principal
 */
router.patch(
  '/applications/:id',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const { id } = req.params;
      const data: UpdateApplicationDTO = req.body;
      
      const application = await admissionApplicationService.updateApplication(
        id,
        data,
        req.user?.id,
        tenantId
      );
      
      if (!application) {
        res.status(404).json({
          success: false,
          message: 'Application not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: application,
        message: 'Application updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating application:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update application',
        error: error.message
      });
    }
  }
);

/**
 * @route   PATCH /api/v1/admissions/applications/:id/status
 * @desc    Update application status
 * @access  Admissions Officer, Principal
 */
router.patch(
  '/applications/:id/status',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const { id } = req.params;
      const data: UpdateApplicationStatusDTO = req.body;
      
      const application = await admissionApplicationService.updateApplicationStatus(
        id,
        data,
        req.user?.id,
        tenantId
      );
      
      if (!application) {
        res.status(404).json({
          success: false,
          message: 'Application not found'
        });
        return;
      }
      
      res.json({
        success: true,
        data: application,
        message: 'Application status updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating application status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update application status',
        error: error.message
      });
    }
  }
);

/**
 * @route   DELETE /api/v1/admissions/applications/:id
 * @desc    Delete an application
 * @access  Principal
 */
router.delete(
  '/applications/:id',
  authorize(['principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const { id } = req.params;
      const deleted = await admissionApplicationService.deleteApplication(id, tenantId);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Application not found'
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Application deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting application:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete application',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/v1/admissions/applications/:id/documents
 * @desc    Upload document for an application
 * @access  Admissions Officer, Principal
 */
router.post(
  '/applications/:id/documents',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const { id } = req.params;

      const app = await admissionApplicationService.getApplicationById(id, tenantId);
      if (!app) {
        res.status(404).json({ success: false, message: 'Application not found or access denied' });
        return;
      }

      const { document_type, file_name, file_data, mime_type, file_size } = req.body;
      
      // In a real implementation, this would handle multipart/form-data
      // For now, accepting base64 encoded file
      const fileBuffer = Buffer.from(file_data, 'base64');
      
      const document = await applicationDocumentService.uploadDocument(
        id,
        document_type as DocumentType,
        {
          name: file_name,
          data: fileBuffer,
          mimetype: mime_type,
          size: file_size
        },
        req.user?.id
      );
      
      res.status(201).json({
        success: true,
        data: document,
        message: 'Document uploaded successfully'
      });
    } catch (error: any) {
      console.error('Error uploading document:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload document',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/admissions/applications/:id/documents
 * @desc    Get all documents for an application
 * @access  Admissions Officer, Principal
 */
router.get(
  '/applications/:id/documents',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const { id } = req.params;

      const app = await admissionApplicationService.getApplicationById(id, tenantId);
      if (!app) {
        res.status(404).json({ success: false, message: 'Application not found or access denied' });
        return;
      }

      const documents = await applicationDocumentService.getApplicationDocuments(id);
      
      res.json({
        success: true,
        data: documents
      });
    } catch (error: any) {
      console.error('Error getting documents:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get documents',
        error: error.message
      });
    }
  }
);

/**
 * @route   PATCH /api/v1/admissions/documents/:id/verify
 * @desc    Verify a document
 * @access  Admissions Officer, Principal
 */
router.patch(
  '/documents/:id/verify',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const { id } = req.params;
      const { status, notes } = req.body;

      // The service scopes by tenant (via the parent application's tenant_id),
      // so a document from another school returns null → 404.
      const document = await applicationDocumentService.verifyDocument(
        id,
        status as VerificationStatus,
        notes,
        req.user?.id,
        tenantId,
      );
      
      if (!document) {
        res.status(404).json({
          success: false,
          message: 'Document not found or access denied'
        });
        return;
      }
      
      res.json({
        success: true,
        data: document,
        message: 'Document verification updated'
      });
    } catch (error: any) {
      console.error('Error verifying document:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify document',
        error: error.message
      });
    }
  }
);

/**
 * @route   DELETE /api/v1/admissions/documents/:id
 * @desc    Delete a document
 * @access  Admissions Officer, Principal
 */
router.delete(
  '/documents/:id',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const { id } = req.params;

      // Tenant-scoped in the service (via parent application's tenant_id).
      const deleted = await applicationDocumentService.deleteDocument(id, tenantId);
      
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Document not found or access denied'
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting document:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete document',
        error: error.message
      });
    }
  }
);

/**
 * @route   POST /api/v1/admissions/applications/:id/interview
 * @desc    Schedule an interview
 * @access  Admissions Officer, Principal
 */
router.post(
  '/applications/:id/interview',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const { id } = req.params;

      const app = await admissionApplicationService.getApplicationById(id, tenantId);
      if (!app) {
        res.status(404).json({ success: false, message: 'Application not found or access denied' });
        return;
      }

      const data: ScheduleInterviewDTO = req.body;
      
      const interview = await applicationInterviewService.scheduleInterview(
        id,
        data,
        req.user?.id
      );
      
      res.status(201).json({
        success: true,
        data: interview,
        message: 'Interview scheduled successfully'
      });
    } catch (error: any) {
      console.error('Error scheduling interview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to schedule interview',
        error: error.message
      });
    }
  }
);

/**
 * @route   PATCH /api/v1/admissions/interviews/:id
 * @desc    Update interview details
 * @access  Admissions Officer, Principal
 */
router.patch(
  '/interviews/:id',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const { id } = req.params;
      const data: UpdateInterviewDTO = req.body;

      // The service scopes by tenant (via the parent application's tenant_id),
      // so an interview from another school returns null → 404.
      const interview = await applicationInterviewService.updateInterview(id, data, tenantId);
      
      if (!interview) {
        res.status(404).json({
          success: false,
          message: 'Interview not found or access denied'
        });
        return;
      }
      
      res.json({
        success: true,
        data: interview,
        message: 'Interview updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating interview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update interview',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/admissions/interviews
 * @desc    Get all interviews (with filters)
 * @access  Admissions Officer, Principal
 */
router.get(
  '/interviews',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const interviews = await applicationInterviewService.getUpcomingInterviews(days, tenantId);
      
      res.json({
        success: true,
        data: interviews
      });
    } catch (error: any) {
      console.error('Error getting interviews:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get interviews',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/admissions/statistics
 * @desc    Get admission statistics
 * @access  Admissions Officer, Principal
 */
router.get(
  '/statistics',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const academicYear = req.query.academic_year as string | undefined;
      const statistics = await admissionStatisticsService.getAdmissionStatistics(academicYear, tenantId);
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error: any) {
      console.error('Error getting statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get statistics',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/admissions/pipeline
 * @desc    Get application pipeline metrics
 * @access  Admissions Officer, Principal
 */
router.get(
  '/pipeline',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const metrics = await admissionStatisticsService.getPipelineMetrics(tenantId);
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error: any) {
      console.error('Error getting pipeline metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pipeline metrics',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/v1/admissions/actionable
 * @desc    Get applications requiring action
 * @access  Admissions Officer, Principal
 */
router.get(
  '/actionable',
  authorize(['admissions_officer', 'principal']),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const tenantId = req.user?.tenant_id;
      if (!tenantId) {
        res.status(400).json({ success: false, message: 'Tenant context is required' });
        return;
      }

      const actionable = await admissionStatisticsService.getActionableApplications(tenantId);
      
      res.json({
        success: true,
        data: actionable
      });
    } catch (error: any) {
      console.error('Error getting actionable applications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get actionable applications',
        error: error.message
      });
    }
  }
);

export default router;
