import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware';
import { UserRole } from '../types/auth';
import { Phase15SchoolConfigService } from '../services/phase15SchoolConfigService';
import { Phase15GradingConfigService } from '../services/phase15GradingConfigService';
import { SubscriptionService } from '../services/subscriptionService';
import { AppError } from '../middleware/errorHandler';
import { db } from '../utils/database';

const router = Router();
const schoolConfigService = new Phase15SchoolConfigService(db);
const gradingConfigService = new Phase15GradingConfigService(db);

/**
 * Helper to ensure user context and tenant ID is available on the request.
 */
const getTenantId = (req: Request): string => {
  const tenantId = req.user?.tenant_id || (req.auth as any)?.tenantId;
  if (!tenantId) {
    throw new AppError('Tenant ID context is missing', 400, 'TENANT_CONTEXT_MISSING');
  }
  return tenantId;
};

// ============================================================================
// SCHOOL INFO ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/school-config/info
 * Get general school profile details
 */
router.get('/info', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const info = await schoolConfigService.getSchoolInfo(tenantId);
    res.json({ success: true, data: info });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/school-config/info
 * Update school profile details
 */
router.put('/info', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth!.userId;
    const updated = await schoolConfigService.updateSchoolInfo(tenantId, { ...req.body, tenant_id: tenantId }, userId);
    res.json({ success: true, message: 'School information updated successfully', data: updated });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// SETTINGS ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/school-config/settings
 * List all configuration settings (key-value format)
 */
router.get('/settings', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const rawSettings = await schoolConfigService.getAllSettings(tenantId);
    
    // Map settings to a simple key-value dictionary for frontend ease
    const settingsDict: Record<string, any> = {};
    Object.entries(rawSettings).forEach(([key, item]) => {
      settingsDict[key] = item.value;
    });

    res.json({ success: true, data: settingsDict });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/school-config/settings
 * Set or update school configurations in bulk
 */
router.post('/settings', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth!.userId;
    const updates = req.body; // Expects dictionary: { [key]: value }

    for (const [key, value] of Object.entries(updates)) {
      let dataType: 'string' | 'number' | 'boolean' | 'json' = 'string';
      if (typeof value === 'boolean') dataType = 'boolean';
      if (typeof value === 'number') dataType = 'number';
      if (typeof value === 'object' && value !== null) dataType = 'json';

      await schoolConfigService.setSetting(
        tenantId,
        key,
        value,
        dataType,
        true, // public default
        userId
      );
    }

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// GRADING CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/school-config/grading-scales
 * List active grading scales
 */
router.get('/grading-scales', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const scales = await gradingConfigService.getGradeScales(tenantId);
    res.json({ success: true, data: scales });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/school-config/grading-scales
 * Create or update a grading scale
 */
router.post('/grading-scales', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth!.userId;
    const scaleData = req.body;

    let result;
    if (scaleData.scale_id) {
      result = await gradingConfigService.updateGradeScale(tenantId, scaleData.scale_id, scaleData, userId);
    } else {
      result = await gradingConfigService.createGradeScale(tenantId, scaleData, userId);
    }

    res.json({ success: true, message: 'Grading scale saved successfully', data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/school-config/grading-scales/:scaleId
 * Delete a grading scale
 */
router.delete('/grading-scales/:scaleId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { scaleId } = req.params;
    await gradingConfigService.deleteGradeScale(tenantId, scaleId);
    res.json({ success: true, message: 'Grading scale deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// SUBSCRIPTION & BILLING ENDPOINTS
// ============================================================================

/**
 * GET /api/v1/school-config/subscription/active
 * Get active subscription details and statistics usage (for current tenant limits checking)
 */
router.get('/subscription/active', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const subscription = await SubscriptionService.getActiveSubscription(tenantId);
    
    // Fetch limits usage counts
    const studentsLimit = await SubscriptionService.checkLimit(tenantId, 'students');
    const staffLimit = await SubscriptionService.checkLimit(tenantId, 'staff');

    res.json({
      success: true,
      data: {
        subscription,
        usage: {
          students: { current: studentsLimit.current, max: studentsLimit.max },
          staff: { current: staffLimit.current, max: staffLimit.max },
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/school-config/subscription/change-plan
 * Upgrade or change active subscription plan
 */
router.post('/subscription/change-plan', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth!.userId;
    const { plan_type, billing_cycle } = req.body;

    if (!plan_type || !billing_cycle) {
      throw new AppError('Plan type and billing cycle are required', 400, 'VALIDATION_ERROR');
    }

    const updated = await SubscriptionService.changePlan(tenantId, plan_type, billing_cycle, userId);
    res.json({ success: true, message: `Successfully subscribed to ${plan_type.toUpperCase()}`, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/school-config/subscription/billing
 * Get subscription billing and payment history
 */
router.get('/subscription/billing', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const history = await SubscriptionService.getBillingHistory(tenantId);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

export default router;
