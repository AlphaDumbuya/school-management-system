import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware';
import { UserRole } from '../types/auth';
import { Phase15SchoolConfigService } from '../services/phase15SchoolConfigService';
import { Phase15GradingConfigService } from '../services/phase15GradingConfigService';
import { SubscriptionService } from '../services/subscriptionService';
import { AppError } from '../middleware/errorHandler';
import { db } from '../utils/database';
import { encryptSecret } from '../utils/encryption';
import { requireVerifiedSchool } from '../middleware/requireVerifiedSchool';

const router = Router();

/** Mask a secret token for display (never return the plaintext). */
function maskToken(token?: string | null): string | null {
  if (!token) return null;
  return '••••••••' + token.slice(-4);
}
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

    // ── Server-side validation for critical settings (client can be bypassed) ──
    const pctKeys = [
      'min_attendance_warning', 'min_attendance_critical',
      'fin_min_percent_new', 'fin_min_percent_continuing', 'fin_min_percent_term', 'fin_late_fee_percent',
    ];
    for (const k of pctKeys) {
      if (k in updates && updates[k] != null && updates[k] !== '') {
        const n = Number(updates[k]);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          throw new AppError(`${k} must be a number between 0 and 100`, 400, 'VALIDATION_ERROR');
        }
      }
    }
    if ('min_attendance_warning' in updates && 'min_attendance_critical' in updates) {
      if (Number(updates.min_attendance_critical) > Number(updates.min_attendance_warning)) {
        throw new AppError('Critical attendance threshold cannot exceed the warning threshold', 400, 'VALIDATION_ERROR');
      }
    }
    if ('academic_year' in updates && updates.academic_year && !/^\d{4}\/\d{4}$/.test(String(updates.academic_year).trim())) {
      throw new AppError('academic_year must be in the format YYYY/YYYY', 400, 'VALIDATION_ERROR');
    }
    if ('id_padding' in updates && updates.id_padding != null && updates.id_padding !== '') {
      const p = Number(updates.id_padding);
      if (!Number.isInteger(p) || p < 1 || p > 10) {
        throw new AppError('id_padding must be an integer between 1 and 10', 400, 'VALIDATION_ERROR');
      }
    }

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

    // Sync to academic_sessions table if academic_year is updated
    if (updates.academic_year) {
      const name = updates.academic_year;
      const startDate = updates.term_1_start || new Date().toISOString().split('T')[0];
      const endDate = (updates.term_count === 2 ? updates.term_2_end : updates.term_3_end) || new Date(Date.now() + 300 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Mark other sessions for this tenant as inactive
      await db('academic_sessions')
        .where('tenant_id', tenantId)
        .update({ is_active: false });

      // Upsert academic session
      const existing = await db('academic_sessions')
        .where('tenant_id', tenantId)
        .where('name', name)
        .first();

      if (existing) {
        await db('academic_sessions')
          .where('id', existing.id)
          .update({
            start_date: startDate,
            end_date: endDate,
            is_active: true,
            updated_at: new Date(),
          });
      } else {
        await db('academic_sessions').insert({
          tenant_id: tenantId,
          name: name,
          start_date: startDate,
          end_date: endDate,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }
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
 * Start a plan change/upgrade.
 *
 * MONEY ROUTING (critical): subscription revenue belongs to the PLATFORM, so
 * this creates a checkout against the PLATFORM's own Monime account and returns
 * a redirect URL. The plan is NOT activated here — it only activates from the
 * Monime webhook (callbackState "subscription:<id>") once payment is confirmed.
 * This closes the previous "free upgrade" hole where clicking a plan activated
 * it and wrote a paid billing row without collecting any money.
 *
 * Up-front (pre-payment) validation still runs so the payer gets immediate
 * feedback on downgrade-over-limit before being sent to pay.
 */
router.post('/subscription/change-plan', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, requireVerifiedSchool, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const userId = req.auth!.userId;
    const { plan_type, billing_cycle } = req.body as {
      plan_type?: 'freetong' | 'combra' | 'bintumani';
      billing_cycle?: 'monthly' | 'yearly';
    };

    if (!plan_type || !billing_cycle) {
      throw new AppError('Plan type and billing cycle are required', 400, 'VALIDATION_ERROR');
    }
    if (!['freetong', 'combra', 'bintumani'].includes(plan_type)) {
      throw new AppError('Invalid subscription plan type', 400, 'VALIDATION_ERROR');
    }
    if (!['monthly', 'yearly'].includes(billing_cycle)) {
      throw new AppError("Billing cycle must be 'monthly' or 'yearly'", 400, 'VALIDATION_ERROR');
    }

    const { SubscriptionCheckout } = await import('../services/subscriptionCheckoutService');
    const result = await SubscriptionCheckout.startPlanChange({
      tenantId,
      userId,
      planType: plan_type,
      billingCycle: billing_cycle,
      req,
    });

    res.json({
      success: true,
      message: 'Redirecting to secure payment to activate your plan.',
      data: result, // { sessionId, redirectUrl, amount }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/school-config/subscription/checkout/:sessionId
 * Poll a subscription payment session's status (used by the billing return
 * page after the payer comes back from Monime). Confirms activation once the
 * webhook (or this poll) has reconciled the payment.
 */
router.get('/subscription/checkout/:sessionId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { SubscriptionCheckout } = await import('../services/subscriptionCheckoutService');
    const result = await SubscriptionCheckout.getStatus(req.params.sessionId, tenantId);
    if (!result) throw new AppError('Subscription session not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/school-config/subscription/ai-analysis
 * Get AI-generated billing analysis and optimization recommendations
 */
router.get('/subscription/ai-analysis', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const subscription = await SubscriptionService.getActiveSubscription(tenantId);
    
    // Fetch limits usage counts
    const studentsLimit = await SubscriptionService.checkLimit(tenantId, 'students');
    const staffLimit = await SubscriptionService.checkLimit(tenantId, 'staff');

    const studentUsagePct = Math.round((studentsLimit.current / studentsLimit.max) * 100);
    const staffUsagePct = Math.round((staffLimit.current / staffLimit.max) * 100);

    const insights: string[] = [];
    const recommendations: string[] = [];
    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Student limit analysis
    if (studentUsagePct >= 95) {
      healthStatus = 'critical';
      insights.push(`Your student directory is at ${studentUsagePct}% capacity (${studentsLimit.current}/${studentsLimit.max} students).`);
      recommendations.push(`Urgent: Upgrade to the next plan immediately. New student admissions are about to be blocked.`);
    } else if (studentUsagePct >= 80) {
      if (healthStatus !== 'critical') healthStatus = 'warning';
      insights.push(`Your student directory is nearing capacity at ${studentUsagePct}% (${studentsLimit.current}/${studentsLimit.max} students).`);
      recommendations.push(`Upgrade to COMBRA soon to expand student limit up to 500 profiles and avoid registration blocks.`);
    } else {
      insights.push(`Student limit utilization is healthy at ${studentUsagePct}% (${studentsLimit.current}/${studentsLimit.max} students).`);
    }

    // Staff limit analysis
    if (staffUsagePct >= 90) {
      if (healthStatus !== 'critical') healthStatus = 'warning';
      insights.push(`Your staff directory has reached ${staffUsagePct}% utilization (${staffLimit.current}/${staffLimit.max} staff members).`);
      recommendations.push(`Upgrade plan to expand your administrative and teaching staff directories.`);
    }

    // Feature availability insights
    if (subscription.plan_type === 'freetong') {
      insights.push(`Your current trial plan (FREETONG) does not include ID Card printing or advanced Grade examinations.`);
      recommendations.push(`Upgrade to COMBRA to unlock PVC Student ID generation, automated Report Cards, and parent WhatsApp messaging.`);
    } else if (subscription.plan_type === 'combra') {
      insights.push(`You are utilizing the COMBRA plan. Advanced features like Payroll, Scholarships, and Multi-branch management are locked.`);
      recommendations.push(`Upgrade to BINTUMANI to unlock unlimited student/staff records, payroll runs, scholarship tracking, and custom school branding.`);
    } else {
      insights.push(`You are running on BINTUMANI (Enterprise) with unlimited students, staff, and complete access to all system modules.`);
      recommendations.push(`Everything is fully optimized. Your school has unlimited operations capacity.`);
    }

    res.json({
      success: true,
      data: {
        healthStatus,
        summary: `School billing system analysis: Your plan is currently ${subscription.plan_type.toUpperCase()} (${subscription.status.toUpperCase()}). Limits utilization is ${healthStatus.toUpperCase()}.`,
        insights,
        recommendations,
        timestamp: new Date().toISOString(),
      }
    });
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

// ============================================================================
// STORAGE (UploadThing) ENDPOINTS — tenant self-service, mirrors email sender
// ============================================================================

/**
 * GET /api/v1/school-config/storage
 * Read the tenant's file-storage (UploadThing) configuration. The stored token
 * is never returned in plaintext — only a masked hint and a configured flag.
 */
router.get('/storage', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const school = await db('schools').where({ tenant_id: tenantId }).first();
    res.json({
      success: true,
      data: {
        provider: school?.storage_provider || 'platform',
        configured: !!school?.storage_configured,
        appId: school?.storage_uploadthing_app_id || null,
        tokenMasked: maskToken(school?.storage_uploadthing_token),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/school-config/storage
 * Configure the tenant's file-storage provider.
 *   { provider: 'platform' | 'own', uploadthingToken?, appId? }
 * In 'own' mode the token is encrypted at rest and the tenant is marked configured.
 */
router.post('/storage', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { provider, uploadthingToken, appId } = req.body as {
      provider?: string; uploadthingToken?: string; appId?: string;
    };
    if (provider !== 'platform' && provider !== 'own') {
      throw new AppError("provider must be 'platform' or 'own'", 400, 'VALIDATION_ERROR');
    }
    const school = await db('schools').where({ tenant_id: tenantId }).first();
    if (!school) throw new AppError('School profile not found for this tenant', 404, 'NOT_FOUND');

    const patch: any = { storage_provider: provider, updated_at: new Date() };

    if (provider === 'own') {
      // Keep the existing token if the caller didn't supply a new one.
      const hasNewToken = uploadthingToken && uploadthingToken.trim().length > 0;
      if (hasNewToken) {
        patch.storage_uploadthing_token = encryptSecret(uploadthingToken!.trim());
      } else if (!school.storage_uploadthing_token) {
        throw new AppError('An UploadThing token is required to enable own storage', 400, 'VALIDATION_ERROR');
      }
      if (appId !== undefined) patch.storage_uploadthing_app_id = appId || null;
      patch.storage_configured = true;
    } else {
      // Platform mode — keep any saved token but mark as not using own storage.
      patch.storage_configured = false;
    }

    await db('schools').where({ tenant_id: tenantId }).update(patch);
    const updated = await db('schools').where({ tenant_id: tenantId }).first();
    res.json({
      success: true,
      message: provider === 'own'
        ? 'File uploads now use your school\'s own UploadThing account.'
        : 'File uploads now use the platform storage account.',
      data: {
        provider: updated.storage_provider,
        configured: !!updated.storage_configured,
        appId: updated.storage_uploadthing_app_id || null,
        tokenMasked: maskToken(updated.storage_uploadthing_token),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// MONIME PAYMENT CREDENTIALS — tenant self-service
// ----------------------------------------------------------------------------
// MONEY ROUTING (critical): student/parent FEE payments settle into the
// SCHOOL's OWN Monime account. Each school configures its own Monime access
// token + space id here. The access token is encrypted at rest and never
// returned in plaintext. Platform revenue (subscriptions / restore) uses the
// platform's own env credentials, not these.
// ============================================================================

/**
 * GET /api/v1/school-config/monime
 * Read the tenant's Monime configuration. The stored token is never returned
 * in plaintext — only a masked hint, the (non-secret) space id, and a flag.
 */
router.get('/monime', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const school = await db('schools').where({ tenant_id: tenantId }).first();
    res.json({
      success: true,
      data: {
        configured: !!school?.monime_configured,
        spaceId: school?.monime_space_id || null,
        tokenMasked: maskToken(school?.monime_access_token),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/school-config/monime
 * Configure the tenant's Monime account for collecting fee payments.
 *   { accessToken?, spaceId, enabled?: boolean }
 * The token is encrypted at rest. Sending enabled:false disables online fee
 * collection for the school without discarding the saved credentials.
 */
router.post('/monime', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const { accessToken, spaceId, enabled } = req.body as {
      accessToken?: string; spaceId?: string; enabled?: boolean;
    };

    const school = await db('schools').where({ tenant_id: tenantId }).first();
    if (!school) throw new AppError('School profile not found for this tenant', 404, 'NOT_FOUND');

    const patch: any = { updated_at: new Date() };

    // Explicit disable — keep saved creds but stop routing money to them.
    if (enabled === false) {
      patch.monime_configured = false;
      await db('schools').where({ tenant_id: tenantId }).update(patch);
      const disabled = await db('schools').where({ tenant_id: tenantId }).first();
      return res.json({
        success: true,
        message: 'Online fee payments are now turned off for your school.',
        data: {
          configured: !!disabled.monime_configured,
          spaceId: disabled.monime_space_id || null,
          tokenMasked: maskToken(disabled.monime_access_token),
        },
      });
    }

    // Space id is required to enable (it identifies the school's Monime account).
    const trimmedSpaceId = (spaceId || '').trim();
    if (!trimmedSpaceId) {
      throw new AppError('Your Monime Space ID is required.', 400, 'VALIDATION_ERROR');
    }
    patch.monime_space_id = trimmedSpaceId;

    // Keep the existing token if the caller didn't supply a new one (so a
    // principal can update the space id without re-entering the secret).
    const hasNewToken = accessToken && accessToken.trim().length > 0;
    if (hasNewToken) {
      patch.monime_access_token = encryptSecret(accessToken!.trim());
    } else if (!school.monime_access_token) {
      throw new AppError('Your Monime access token is required.', 400, 'VALIDATION_ERROR');
    }

    patch.monime_configured = true;

    await db('schools').where({ tenant_id: tenantId }).update(patch);
    const updated = await db('schools').where({ tenant_id: tenantId }).first();
    res.json({
      success: true,
      message: 'Fee payments will now settle into your school\'s own Monime account.',
      data: {
        configured: !!updated.monime_configured,
        spaceId: updated.monime_space_id || null,
        tokenMasked: maskToken(updated.monime_access_token),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
