import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware.js';
import { UserRole } from '../types/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { TemplateService, TemplateCreateRequest, TemplateUpdateRequest } from '../services/templateService.js';
import multer from 'multer';

/**
 * Card Template Management Routes
 * Phase 2.1: Identity Management Module
 * 
 * Provides CRUD operations for card templates, approval workflow,
 * logo management, and default template assignment.
 */

const router = Router();

// Initialize service
const templateService = new TemplateService(db);

/**
 * Assert a template belongs to the caller's tenant before any per-template
 * operation. The service methods look templates up by id ALONE, so without this
 * a principal could read/edit/approve/delete another school's template by id
 * (IDOR + cross-tenant write). Throws 404 if it isn't in the caller's tenant.
 */
async function assertTemplateInTenant(req: Request, templateId: string): Promise<void> {
  const tenantId = (req as any).user?.tenant_id;
  if (!tenantId) throw new AppError('Tenant context is required', 400, 'TENANT_REQUIRED');
  if (!templateId || templateId === 'undefined') throw new AppError('Invalid template ID', 400);
  const row = await db('card_templates').where({ id: templateId, tenant_id: tenantId }).first();
  if (!row) throw new AppError('Template not found', 404, 'NOT_FOUND');
}

// Apply auth + user context to all template routes
router.use(authenticate);
router.use(attachUserContext);

// Configure multer for logo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept only PNG and JPEG
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) {
      cb(new Error('Only PNG and JPEG images are allowed'));
      return;
    }
    cb(null, true);
  },
});

/**
 * POST /api/v1/card-templates
 * Create a new card template
 * Requirements: 4.1, 4.2
 */
router.post(
  '/',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user.tenant_id;
      const createdBy = (req as any).user.id;

      const request: TemplateCreateRequest = {
        tenantId,
        name: req.body.name,
        description: req.body.description,
        format: req.body.format,
        backgroundColor: req.body.backgroundColor || req.body.config?.backgroundColor,
        textColor: req.body.textColor || req.body.config?.textColor,
        fontFamily: req.body.fontFamily || req.body.config?.fontFamily,
        fontSize: req.body.fontSize !== undefined ? req.body.fontSize : req.body.config?.fontSize,
        logoPosition: req.body.logoPosition || req.body.config?.logoPosition,
        layoutConfig: req.body.layoutConfig || req.body.config?.layoutConfig,
        logoUrl: req.body.logoUrl || req.body.config?.logoUrl,
        config: req.body.config,
        createdBy,
        // Only a duplicate explicitly requests 'draft'; anything else activates.
        status: req.body.status === 'draft' ? 'draft' : undefined,
      };

      // Validate required fields
      if (!request.name || !request.format || !request.backgroundColor || !request.textColor) {
        throw new AppError('Missing required fields', 400);
      }

      if (!['pvc', 'badge'].includes(request.format)) {
        throw new AppError('Invalid format. Must be "pvc" or "badge"', 400);
      }

      const template = await templateService.createTemplate(request);

      res.status(201).json({
        message: 'Template created successfully',
        template,
      });

      logger.info(`Template ${template.templateId} created`, { createdBy });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/v1/card-templates/:templateId
 * Update an existing template
 * Requirements: 4.1, 4.9
 */
router.put(
  '/:templateId',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId } = req.params;

      if (!templateId || templateId === 'undefined' || !/^[0-9a-fA-F-]{36}$/.test(templateId)) {
        throw new AppError('Invalid or missing template ID', 400);
      }
      await assertTemplateInTenant(req, templateId); // tenant guard

      const updates: TemplateUpdateRequest = {
        name: req.body.name,
        description: req.body.description,
        backgroundColor: req.body.backgroundColor || req.body.config?.backgroundColor,
        textColor: req.body.textColor || req.body.config?.textColor,
        fontFamily: req.body.fontFamily || req.body.config?.fontFamily,
        fontSize: req.body.fontSize !== undefined ? req.body.fontSize : req.body.config?.fontSize,
        logoPosition: req.body.logoPosition || req.body.config?.logoPosition,
        layoutConfig: req.body.layoutConfig || req.body.config?.layoutConfig,
        logoUrl: req.body.logoUrl || req.body.config?.logoUrl,
        config: req.body.config,
      };

      const template = await templateService.updateTemplate(templateId, updates);

      res.json({
        message: 'Template updated successfully',
        template,
      });

      logger.info(`Template ${templateId} updated`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/card-templates/:templateId
 * Get a template by ID
 * Requirements: 4.1
 */
router.get(
  '/:templateId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId } = req.params;
      await assertTemplateInTenant(req, templateId); // tenant guard

      const template = await templateService.getTemplateById(templateId);

      res.json({ template });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/card-templates
 * List all templates for tenant
 * Requirements: 4.1
 */
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user?.tenant_id ?? (req as any).auth?.tenantId;

      if (!tenantId) {
        return res.json({ templates: [], count: 0 });
      }

      try {
        const format = req.query.format as string | undefined;
        const templates = await templateService.getTemplatesByTenant(tenantId, format);
        res.json({ templates, count: templates.length });
      } catch (dbError: any) {
        // Table might not exist or be empty — return empty rather than crash
        logger.warn('Failed to query templates:', dbError.message);
        res.json({ templates: [], count: 0 });
      }
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/card-templates/default/:role
 * Get default template for a role
 * Requirements: 4.6
 */
router.get(
  '/default/:role',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).user?.tenant_id ?? req.auth?.tenantId;
      const { role } = req.params;

      if (!['student', 'teacher', 'staff', 'principal'].includes(role)) {
        throw new AppError('Invalid role', 400);
      }

      const template = await templateService.getDefaultTemplate(tenantId, role as any);

      res.json({ template });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/card-templates/:templateId/set-default
 * Set template as default for roles
 * Requirements: 4.6
 */
router.post(
  '/:templateId/set-default',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId } = req.params;
      let roles = req.body.roles;
      if (!roles && req.body.role) {
        roles = [req.body.role];
      }

      if (!roles || !Array.isArray(roles) || roles.length === 0) {
        throw new AppError('Roles array is required', 400);
      }

      // Validate roles
      const validRoles = ['student', 'teacher', 'staff', 'principal'];
      for (const role of roles) {
        if (!validRoles.includes(role)) {
          throw new AppError(`Invalid role: ${role}`, 400);
        }
      }

      await assertTemplateInTenant(req, templateId); // tenant guard
      await templateService.setDefaultTemplate(templateId, roles);

      res.json({
        message: 'Template set as default successfully',
        templateId,
        roles,
      });

      logger.info(`Template ${templateId} set as default for roles: ${roles.join(', ')}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/card-templates/:templateId/submit-approval
 * Submit template for approval
 * Requirements: 4.7
 */
router.post(
  '/:templateId/submit-approval',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId } = req.params;
      await assertTemplateInTenant(req, templateId); // tenant guard

      await templateService.submitForApproval(templateId);

      res.json({
        message: 'Template submitted for approval',
        templateId,
      });

      logger.info(`Template ${templateId} submitted for approval`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/card-templates/:templateId/approve
 * Approve a template
 * Requirements: 4.7
 */
router.post(
  '/:templateId/approve',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId } = req.params;
      const approverId = (req as any).user.id;
      await assertTemplateInTenant(req, templateId); // tenant guard

      await templateService.approveTemplate(templateId, approverId);

      res.json({
        message: 'Template approved successfully',
        templateId,
      });

      logger.info(`Template ${templateId} approved by ${approverId}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/card-templates/:templateId
 * Delete (archive) a template
 * Requirements: 4.8
 */
router.delete(
  '/:templateId',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId } = req.params;

      if (!templateId || templateId === 'undefined' || !/^[0-9a-fA-F-]{36}$/.test(templateId)) {
        throw new AppError('Invalid or missing template ID', 400);
      }
      await assertTemplateInTenant(req, templateId); // tenant guard

      await templateService.deleteTemplate(templateId);

      res.json({
        message: 'Template archived successfully',
        templateId,
      });

      logger.info(`Template ${templateId} archived`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/card-templates/upload-logo
 * Upload a logo for templates
 * Requirements: 4.4, 4.5
 */
router.post(
  '/upload-logo',
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  upload.single('logo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new AppError('Logo file is required', 400);
      }

      const tenantId = (req as any).user.tenant_id;
      const logoFile = req.file.buffer;
      const filename = req.file.originalname;
      const mimeType = req.file.mimetype;

      const logoUrl = await templateService.uploadLogo(
        tenantId,
        logoFile,
        filename,
        mimeType
      );

      res.status(201).json({
        message: 'Logo uploaded successfully',
        logoUrl,
      });

      logger.info(`Logo uploaded for tenant ${tenantId}`, { filename });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
