import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, attachUserContext } from '../middleware/authMiddleware';
import { UserRole } from '../types/auth';
import { Phase15SchoolConfigService } from '../services/phase15SchoolConfigService';
import { Phase15GradingConfigService } from '../services/phase15GradingConfigService';
import academicYearService from '../services/academicYearService';
import academicArchiveService from '../services/academicArchiveService';
import { SubscriptionService } from '../services/subscriptionService';
import { AppError } from '../middleware/errorHandler';
import { db } from '../utils/database';
import { encryptSecret } from '../utils/encryption';
import { paymentSettingsLimiter, clientIp } from '../middleware/rateLimit';
import { requireVerifiedSchool } from '../middleware/requireVerifiedSchool';
import { requireOwner } from '../utils/tenantOwner';

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
    // Bursar finance amounts (Le) and day counts must be non-negative numbers.
    for (const k of ['fin_late_fee_fixed', 'fin_late_fee_cap', 'fin_late_fee_grace_days', 'fin_discount_approval_threshold']) {
      if (k in updates && updates[k] != null && updates[k] !== '') {
        const n = Number(updates[k]);
        if (!Number.isFinite(n) || n < 0 || n > 1e10 || (k === 'fin_late_fee_grace_days' && !Number.isInteger(n))) {
          throw new AppError(`${k} must be a non-negative ${k === 'fin_late_fee_grace_days' ? 'whole number of days' : 'amount'}`, 400, 'VALIDATION_ERROR');
        }
      }
    }
    if ('min_attendance_warning' in updates && 'min_attendance_critical' in updates) {
      if (Number(updates.min_attendance_critical) > Number(updates.min_attendance_warning)) {
        throw new AppError('Critical attendance threshold cannot exceed the warning threshold', 400, 'VALIDATION_ERROR');
      }
    }
    if ('staff_signin_closes_at' in updates && !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(updates.staff_signin_closes_at || ''))) {
      throw new AppError('Staff sign-in closing time must be a time like 18:00', 400, 'VALIDATION_ERROR');
    }
    if ('attendance_notify_mode' in updates && !['weekly', 'daily', 'off'].includes(String(updates.attendance_notify_mode))) {
      throw new AppError('attendance_notify_mode must be weekly, daily or off', 400, 'VALIDATION_ERROR');
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

    // The academic year is NEVER changed through a settings save. Changing year
    // is a deliberate rollover (POST /start-new-academic-year, with its own
    // confirmation dialog). A stale or mistyped `academic_year` here must not
    // move the school into another year, so it's pinned to the active session.
    const active = await db('academic_sessions').where({ tenant_id: tenantId, is_active: true }).first();
    if ('academic_year' in updates) {
      if (active?.name) updates.academic_year = active.name;
      else delete updates.academic_year;
    }
    // Term dates saved on the Academic tab define the ACTIVE year's span.
    const termCount = Number(updates.term_count ?? 3);
    const startDate = updates.term_1_start || null;
    const endDate = (termCount === 2 ? updates.term_2_end : updates.term_3_end) || null;
    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
      throw new AppError('The academic year must end after it starts (check Term 1 start and the last term end).', 400, 'VALIDATION_ERROR');
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

    if (active && (startDate || endDate)) {
      await db('academic_sessions').where({ id: active.id }).update({
        ...(startDate ? { start_date: startDate } : {}),
        ...(endDate ? { end_date: endDate } : {}),
        updated_at: new Date(),
      });
    }

    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/school-config/academic-sessions
 * List this tenant's academic sessions (all years), newest first, with the
 * active flag. This is the authoritative source of "which years does this
 * school actually have" — used to drive year pickers so admins can reach ANY
 * past year (e.g. 5 years ago), not a fabricated `new Date()` list.
 */
router.get('/academic-sessions', authenticate, attachUserContext, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const rows = await db('academic_sessions')
      .where({ tenant_id: tenantId })
      .orderBy('is_active', 'desc')
      .orderBy('name', 'desc')
      .select('id', 'name', 'start_date', 'end_date', 'is_active');
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/school-config/archive/:academicYear
 * Full read-only snapshot of one academic year for the Academic Archive page:
 * counts, finance summary, classes (with enrolled), publications, promotions,
 * examinations. Principal/super-admin only.
 */
router.get(
  '/archive/:academicYear',
  authenticate,
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  attachUserContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(req);
      const academicYear = String(req.params.academicYear || '').trim();
      if (!/^\d{4}\/\d{4}$/.test(academicYear)) {
        throw new AppError('academicYear must be in the format YYYY/YYYY', 400, 'VALIDATION_ERROR');
      }
      const data = await academicArchiveService.getYearSnapshot(tenantId, academicYear);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/school-config/archive/student/:studentId
 * Per-student history across all years (enrollments + subject results) for the
 * Academic Archive drill-down. Principal/super-admin only.
 */
router.get(
  '/archive/student/:studentId',
  authenticate,
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  attachUserContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(req);
      const data = await academicArchiveService.getStudentHistory(tenantId, req.params.studentId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/school-config/start-new-year
 * Guided, non-destructive rollover to a new academic year: archives the current
 * session, activates/creates the new one, and (by default) clones the current
 * classes into the new session. Student promotion remains the separate,
 * reviewed /api/v1/promotions/execute flow. Principal/super-admin only.
 */
router.post(
  '/start-new-year',
  authenticate,
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  attachUserContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(req);
      const userId = req.auth!.userId;
      const { new_year_name, start_date, end_date, clone_classes } = req.body || {};
      const result = await academicYearService.startNewAcademicYear({
        tenantId,
        userId,
        newYearName: String(new_year_name || '').trim(),
        startDate: start_date || null,
        endDate: end_date || null,
        cloneClasses: clone_classes !== false,
      });
      res.json({ success: true, data: result, message: 'New academic year started' });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/school-config/carry-forward
 * Bring last year's classes, subjects, teacher assignments, timetable, fee
 * structures and active students into the CURRENT (active) year. For years
 * started before rollover carried everything. Idempotent — safe to re-run.
 */
router.post(
  '/carry-forward',
  authenticate,
  authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN),
  attachUserContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await academicYearService.carryForwardIntoActive(getTenantId(req), req.auth!.userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

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
    const { EntitlementService, ROLE_PORTAL } = await import('../services/entitlementService.js');
    const entitlements = await EntitlementService.forTenant(tenantId);
    // Accounts per gated portal (incl. teachers holding the duty), so the
    // principal can see who a switched-off portal affects.
    const roleCounts = await db('users').where({ tenant_id: tenantId, status: 'active' })
      .whereIn('role', ['parent', 'accountant', 'admissions_officer']).groupBy('role')
      .select('role').count({ n: '*' }).catch(() => [] as any[]);
    const dutyCount = async (duty: string) => Number((await db('users').where({ tenant_id: tenantId, status: 'active' }).whereNot('role', duty)
      .whereRaw("COALESCE(staff_duties, '[]'::jsonb) \\? ?", [duty]).count({ n: '*' }).first().catch(() => null) as any)?.n) || 0;
    const byRole = Object.fromEntries((roleCounts as any[]).map((r) => [r.role, Number(r.n) || 0]));
    const portals = {
      portal_parent: { access: entitlements.features[ROLE_PORTAL.parent], users: byRole.parent || 0 },
      portal_admissions: { access: entitlements.features[ROLE_PORTAL.admissions_officer], users: (byRole.admissions_officer || 0) + await dutyCount('admissions_officer') },
      portal_bursar: { access: entitlements.features[ROLE_PORTAL.accountant], users: (byRole.accountant || 0) + await dutyCount('accountant') },
    };

    res.json({
      success: true,
      data: {
        subscription,
        entitlements,
        portals,
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
router.post('/subscription/change-plan', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, requireOwner, requireVerifiedSchool, async (req: Request, res: Response, next: NextFunction) => {
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
    });

    res.json({
      success: true,
      message: 'Dial the USSD code to activate your plan.',
      data: result, // { sessionId, ussdCode, amount, expireTime }
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
router.get('/subscription/checkout/:sessionId', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/subscription/ai-analysis', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
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

    // Feature availability insights, from the live plan catalog (what the
    // school's plan lacks, and the next plan up that adds it).
    {
      const { PlanCatalog, FEATURES } = await import('../services/planCatalogService.js');
      const plans = await PlanCatalog.list();
      const idx = plans.findIndex((p) => p.id === subscription.plan_type);
      const current = plans[idx];
      const missing = current ? FEATURES.filter((f) => !f.core && !f.soon && !current.features[f.key]) : [];
      if (!current) {
        insights.push(`Your school is on the ${String(subscription.plan_type).toUpperCase()} plan.`);
      } else if (!missing.length) {
        insights.push(`The ${current.name} plan includes every module available today.`);
        recommendations.push('No upgrade needed for features. Keep an eye on your student and staff limits above.');
      } else {
        insights.push(`The ${current.name} plan doesn't include: ${missing.map((f) => f.label).join(', ')}.`);
        const next = plans.slice(idx + 1).find((p) => missing.some((f) => p.features[f.key]));
        if (next) {
          const adds = missing.filter((f) => next.features[f.key]).map((f) => f.label);
          recommendations.push(`Upgrade to ${next.name} to add ${adds.join(', ')}.`);
        }
      }
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
router.get('/subscription/billing', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
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
router.get('/storage', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
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
router.post('/storage', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
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

/** What the app may know about the saved payment settings. Never the token. */
function monimeView(school: any, extra: Record<string, unknown> = {}) {
  return {
    configured: !!school?.monime_configured,
    spaceId: school?.monime_space_id || null,
    // The token is never sent back, not even in part.
    tokenMasked: school?.monime_access_token ? '••••••••' : null,
    ...extra,
  };
}

/**
 * GET /api/v1/school-config/monime
 * Read the tenant's Monime configuration. The stored token is never returned
 * (not even masked from the stored value): only whether one is saved, the
 * (non-secret) space id, whether the person must give a 2FA code to change it,
 * and when / by whom it was last changed.
 */
router.get('/monime', authenticate, authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN), attachUserContext, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = getTenantId(req);
    const school = await db('schools').where({ tenant_id: tenantId }).first();
    const { default: twoFactor } = await import('../services/twoFactorService');
    const security = await import('../services/paymentSettingsSecurity');
    res.json({
      success: true,
      data: monimeView(school, {
        twoFactorRequired: await twoFactor.isEnabled(req.auth!.userId).catch(() => false),
        lastChange: await security.lastChange(db, tenantId).catch(() => null),
      }),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/school-config/monime
 * Configure (or turn off) the tenant's Monime account for collecting fee payments.
 *   { accessToken?, spaceId, enabled?: boolean, currentPassword, twoFactorCode? }
 *
 * This decides where every fee payment goes, so it is protected like a bank
 * account change: principal only, never from an impersonated session, the
 * principal's password (and 2FA code) again, a lock-out after wrong answers,
 * strict validation, a token bound to the school and space, an audit entry,
 * and an alert to the principals and the school contact. See
 * services/paymentSettingsSecurity.ts.
 */
router.post('/monime', paymentSettingsLimiter, authenticate, authorize(UserRole.PRINCIPAL), attachUserContext, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const security = await import('../services/paymentSettingsSecurity');
    const { default: twoFactor } = await import('../services/twoFactorService');
    const tenantId = getTenantId(req);
    const userId = req.auth!.userId;
    const role = String(req.auth!.role);
    const meta = { ip: clientIp(req), userAgent: String(req.headers['user-agent'] || '').slice(0, 300) };

    security.assertNotImpersonated(req);

    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
    const { accessToken, spaceId, enabled, currentPassword, twoFactorCode } = body;
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      throw new AppError('enabled must be true or false', 400, 'VALIDATION_ERROR');
    }

    // Prove it is really the principal, every time.
    await security.assertStepUp(db, { userId, role, password: currentPassword, twoFactorCode, ...meta }, twoFactor);

    const school = await db('schools').where({ tenant_id: tenantId }).first();
    if (!school) throw new AppError('School profile not found for this tenant', 404, 'NOT_FOUND');

    const patch: any = { updated_at: new Date() };
    let change: import('../services/paymentSettingsSecurity').PaymentChange;

    if (enabled === false) {
      // Turn off, keeping the saved credentials.
      if (!school.monime_configured) {
        return res.json({ success: true, message: 'Online fee payments are already off.', data: monimeView(school) });
      }
      patch.monime_configured = false;
      change = { kind: 'disabled', tokenChanged: false, spaceFrom: school.monime_space_id, spaceTo: school.monime_space_id };
    } else {
      const newSpace = security.validateSpaceId(spaceId);
      const spaceChanged = newSpace !== (school.monime_space_id || '');
      const hasNewToken = typeof accessToken === 'string' && accessToken.trim().length > 0;
      const context = security.monimeContext(tenantId, newSpace);

      if (hasNewToken) {
        const token = security.validateAccessToken(accessToken);
        patch.monime_access_token = encryptSecret(token, context);
        change = { kind: school.monime_configured ? 'updated' : 'enabled', tokenChanged: true, tokenFingerprint: security.tokenFingerprint(token), spaceFrom: school.monime_space_id, spaceTo: newSpace };
      } else {
        if (!school.monime_access_token) {
          throw new AppError('Your Monime access token is required.', 400, 'VALIDATION_ERROR');
        }
        // A token belongs to one space: a different space needs its own token.
        if (spaceChanged && school.monime_space_id) {
          throw new AppError('You changed the Space ID, so enter the matching access token too.', 400, 'VALIDATION_ERROR');
        }
        // Same space, token kept: make sure the stored one is bound to this school and space.
        const { decryptSecret, isBoundSecret } = await import('../utils/encryption');
        let kept: string;
        try {
          kept = decryptSecret(school.monime_access_token, security.monimeContext(tenantId, school.monime_space_id || newSpace));
        } catch {
          throw new AppError('The saved access token can no longer be read. Enter your Monime access token again.', 400, 'TOKEN_UNREADABLE');
        }
        if (!isBoundSecret(school.monime_access_token) || spaceChanged) patch.monime_access_token = encryptSecret(kept, context);
        change = { kind: school.monime_configured ? 'updated' : 'enabled', tokenChanged: false, spaceFrom: school.monime_space_id, spaceTo: newSpace };
      }
      patch.monime_space_id = newSpace;
      patch.monime_configured = true;
    }

    // The change and its audit entry are saved together.
    await db.transaction(async (trx) => {
      await trx('schools').where({ tenant_id: tenantId }).update(patch);
      await security.recordChange(trx, { userId, role, tenantId, change, ...meta });
    });

    const updated = await db('schools').where({ tenant_id: tenantId }).first();
    void security.notifyChange(db, { tenantId, actorId: userId, change, ...meta });

    res.json({
      success: true,
      message: change.kind === 'disabled'
        ? 'Online fee payments are now turned off for your school.'
        : 'Fee payments will now settle into your school\'s own Monime account.',
      data: monimeView(updated, {
        twoFactorRequired: await twoFactor.isEnabled(userId).catch(() => false),
        lastChange: await security.lastChange(db, tenantId).catch(() => null),
      }),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
