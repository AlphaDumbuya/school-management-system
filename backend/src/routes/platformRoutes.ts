/**
 * Platform Management Routes
 * Phase 1.1: Add Super Admin Role
 * 
 * Routes for super admin platform management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
import { TenantService } from '../services/tenantService';
import { SubscriptionService } from '../services/subscriptionService';
import { PlatformSettingsService } from '../services/platformSettingsService';
import { TenantUserService } from '../services/tenantUserService';
import { ImpersonationService } from '../services/impersonationService';
import { stripSecretColumns } from '../utils/redact';
import { PlatformAuditService } from '../services/platformAuditService';
import { PlatformCommunicationService } from '../services/platformCommunicationService';
import { NewsletterService } from '../services/newsletterService';
import emailService from '../services/emailService';
import { notifyTenantUsers, describeUserNotice } from '../services/tenantUserNoticeService';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { UserRole } from '../types/auth';
import { db } from '../utils/database';
import eventCategoryService from '../services/eventCategoryService';

const router = Router();

/** Small helper: super admin id + request meta for audit calls. */
function auditMeta(req: any) {
  return { actorUserId: req.auth!.userId, ip: req.ip, userAgent: req.get('user-agent') };
}

/**
 * Resolve the best contact email for a tenant: the tenant's contact_email,
 * else the school profile email, else the principal user's email.
 */
async function tenantContactEmail(tenantId: string): Promise<string | null> {
  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (tenant?.contact_email) return tenant.contact_email;
  const school = await db('schools').where({ tenant_id: tenantId }).first();
  if (school?.email) return school.email;
  const principal = await db('users').where({ tenant_id: tenantId, role: 'principal' }).orderBy('is_owner', 'desc').first();
  return principal?.email || null;
}

/** Fire-and-forget notification — never blocks or fails the admin action. */
function notify(promise: Promise<any>, context: string) {
  promise.catch((err) => logger.warn(`[platform email] ${context} failed: ${err?.message || err}`));
}

/**
 * Everyone who should hear about a change to a school's account: the school's
 * contact email, its school-profile email and its active principals. De-duplicated.
 */
async function noticeRecipients(tenantId: string): Promise<string[]> {
  const found: string[] = [];
  const t = await db('tenants').where({ id: tenantId }).first('contact_email').catch(() => null);
  if (t?.contact_email) found.push(t.contact_email);
  const school = await db('schools').where({ tenant_id: tenantId }).first('email').catch(() => null);
  if (school?.email) found.push(school.email);
  const principals = await db('users').where({ tenant_id: tenantId, role: 'principal', status: 'active' }).orderBy('is_owner', 'desc').pluck('email').catch(() => [] as string[]);
  found.push(...principals);
  const seen = new Set<string>();
  return found.map((e) => String(e || '').trim()).filter((e) => {
    const k = e.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Send a school-status email to all recipients and WAIT for the outcome (up to
 * 15 s). On serverless the function is frozen once the response is sent, so a
 * fire-and-forget email is often never delivered. Returns a sentence the super
 * admin sees, saying exactly who was emailed (or why nobody was).
 */
async function sendStatusNotice(
  tenantId: string,
  context: string,
  build: (to: string) => Promise<{ status?: string } | undefined>,
): Promise<{ sentTo: string[]; text: string }> {
  const recipients = await noticeRecipients(tenantId);
  if (!recipients.length) {
    logger.warn(`[platform email] ${context}: no email address on file for tenant ${tenantId}`);
    return { sentTo: [], text: 'No contact email is on file for this school, so no notice was sent.' };
  }
  const work = Promise.allSettled(recipients.map((to) => build(to)));
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 15_000));
  const outcome = await Promise.race([work, timeout]);
  if (outcome === 'timeout') {
    logger.warn(`[platform email] ${context}: still sending after 15s for tenant ${tenantId}`);
    return { sentTo: [], text: 'The notice email is taking longer than expected and may arrive shortly.' };
  }
  const sentTo = recipients.filter((_, i) => {
    const r = outcome[i];
    return r.status === 'fulfilled' && (r.value as any)?.status === 'sent';
  });
  outcome.forEach((r, i) => {
    if (r.status === 'rejected') logger.warn(`[platform email] ${context} to ${recipients[i]} failed: ${(r.reason as any)?.message || r.reason}`);
  });
  if (sentTo.length) return { sentTo, text: `Notice emailed to ${sentTo.join(', ')}.` };
  return { sentTo: [], text: 'The notice email could not be sent. Check the email settings, or tell the school directly.' };
}

const PLAN_LABELS: Record<string, string> = {
  freetong: 'Freetong (Basic Trial)',
  combra: 'Combra (Standard)',
  bintumani: 'Bintumani (Enterprise)',
};

/**
 * @route   GET /api/platform/statistics
 * @desc    Get platform-wide statistics
 * @access  Super Admin only
 */
router.get('/statistics', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const statistics = await TenantService.getPlatformStatistics();
    res.json({ success: true, data: statistics });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/platform/tenants/suspensions
 * @desc    Suspension tracking — suspended tenants by category, with reason/date.
 * @access  Super Admin only
 * NOTE: must be declared BEFORE `/tenants/:id` so "suspensions" isn't read as an id.
 */
router.get('/tenants/suspensions', authenticate, authorize(UserRole.SUPER_ADMIN), async (_req, res, next) => {
  try {
    const data = await TenantService.getSuspensionOverview();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/platform/tenants
 * @desc    Get all tenants with filtering
 * @access  Super Admin only
 */
router.get('/tenants', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { status, search, limit = 20, offset = 0 } = req.query;

    const filters = {
      status: status as string,
      search: search as string,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    const result = await TenantService.getAllTenants(filters);
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/platform/tenants/:id
 * @desc    Get tenant by ID with statistics
 * @access  Super Admin only
 */
router.get('/tenants/:id', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenant = await TenantService.getTenantById(id);
    const usage = await SubscriptionService.getUsage(id).catch(() => null);
    res.json({ success: true, data: { ...tenant, usage } });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants
 * @desc    Create a new tenant
 * @access  Super Admin only
 */
router.post('/tenants', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { 
      name, slug, description, domain, contactEmail, contactPhone, address, timezone, currency, language, maxUsers, maxStorageGb,
      adminFirstName, adminLastName, adminEmail, adminPassword
    } = req.body;

    // Validation
    if (!name || !slug) {
      throw new AppError('Name and slug are required', 400, 'VALIDATION_ERROR');
    }

    const tenantData = {
      name,
      slug,
      description,
      domain,
      contactEmail,
      contactPhone,
      address,
      timezone,
      currency,
      language,
      maxUsers,
      maxStorageGb,
    };

    const tenant = await TenantService.createTenant(tenantData, req.auth!.userId);

    // Create the principal user account if administrator credentials are provided
    if (adminEmail && adminPassword && adminFirstName && adminLastName) {
      const bcryptjs = await import('bcryptjs');
      const hashedPassword = await bcryptjs.default.hash(adminPassword, 10);

      await db('users').insert({
        tenant_id: tenant.id,
        email: adminEmail.toLowerCase().trim(),
        password_hash: hashedPassword,
        first_name: adminFirstName,
        last_name: adminLastName,
        role: 'principal',
        // The administrator the platform sets up for a school is its owner.
        is_owner: true,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // Welcome email with login details (fire-and-forget).
    const welcomeTo = (adminEmail || contactEmail) as string | undefined;
    if (welcomeTo) {
      notify(
        emailService.sendTenantWelcomeEmail(welcomeTo, {
          schoolName: name,
          loginEmail: adminEmail,
          tempPassword: adminPassword,
        }),
        'tenant welcome'
      );
    }

    // Add the school's CONTACT email (one per tenant, never individual users)
    // to the marketing list. Tenants are customers, so they are opted IN by
    // default for platform newsletters; they can unsubscribe via any email.
    const subTo = (contactEmail || adminEmail) as string | undefined;
    if (subTo) {
      notify(
        NewsletterService.upsertSubscriber({ email: subTo, name, source: 'tenant', tenantId: tenant.id, optIn: true }),
        'tenant newsletter upsert'
      );
    }

    // Seed system event categories for the new tenant (fire-and-forget — don't fail tenant creation)
    eventCategoryService.initializeSystemCategories(tenant.id).catch((err: Error) => {
      console.error(`[platformRoutes] Failed to seed event categories for tenant ${tenant.id}:`, err.message);
    });

    res.status(201).json({ success: true, data: tenant });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/platform/tenants/:id
 * @desc    Update tenant
 * @access  Super Admin only
 */
router.put('/tenants/:id', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const tenant = await TenantService.updateTenant(id, updateData, req.auth!.userId);
    res.json({ success: true, data: tenant });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants/:id/activate
 * @desc    Activate a tenant
 * @access  Super Admin only
 */
router.post('/tenants/:id/activate', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenant = await TenantService.activateTenant(id, req.auth!.userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'tenant.activate' });
    const [notice, users] = await Promise.all([
      sendStatusNotice(id, 'tenant activate', (to) => emailService.sendTenantStatusEmail(to, { schoolName: tenant.name, status: 'activated' })),
      notifyTenantUsers(id, 'restored').catch((e) => { logger.warn(`[platform email] user notice failed: ${e?.message || e}`); return null; }),
    ]);
    res.json({ success: true, data: tenant, notice: { emailed: notice.sentTo, users }, message: `Tenant activated successfully. ${notice.text}${users ? ` ${describeUserNotice(users)}` : ''}` });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants/:id/suspend
 * @desc    Suspend a tenant
 * @access  Super Admin only
 */
router.post('/tenants/:id/suspend', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, category, override } = req.body;

    if (!reason) {
      throw new AppError('Suspension reason is required', 400, 'VALIDATION_ERROR');
    }

    const tenant = await TenantService.suspendTenant(id, reason, req.auth!.userId, category, !!override);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'tenant.suspend', changes: { reason, category, override: !!override } });
    const [notice, users] = await Promise.all([
      sendStatusNotice(id, 'tenant suspend', (to) => emailService.sendTenantStatusEmail(to, { schoolName: tenant.name, status: 'suspended', reason, category, tenantId: id })),
      notifyTenantUsers(id, 'suspended').catch((e) => { logger.warn(`[platform email] user notice failed: ${e?.message || e}`); return null; }),
    ]);
    res.json({ success: true, data: tenant, notice: { emailed: notice.sentTo, users }, message: `Tenant suspended successfully. ${notice.text}${users ? ` ${describeUserNotice(users)}` : ''}` });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/platform/tenants/:id
 * @desc    Delete a tenant
 * @access  Super Admin only
 */
router.delete('/tenants/:id', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await TenantService.deleteTenant(id, req.auth!.userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'tenant.delete' });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants/:id/subscription
 * @desc    Change subscription plan for any tenant
 * @access  Super Admin only
 */
router.post('/tenants/:id/subscription', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan_type, billing_cycle } = req.body;
    const userId = req.auth!.userId;

    if (!plan_type || !billing_cycle) {
      throw new AppError('Plan type and billing cycle are required', 400, 'VALIDATION_ERROR');
    }

    const updated = await SubscriptionService.changePlan(id, plan_type, billing_cycle, userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'subscription.change', changes: { plan_type, billing_cycle } });
    const tenant = await db('tenants').where({ id }).first();
    const to = await tenantContactEmail(id);
    if (to) notify(emailService.sendTenantSubscriptionEmail(to, { schoolName: tenant?.name || 'your school', planLabel: PLAN_LABELS[plan_type] || plan_type, action: 'changed', endDate: (updated as any).end_date, tenantId: id }), 'subscription change');
    res.json({ success: true, message: `Tenant subscription updated to ${plan_type.toUpperCase()}`, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/platform/tenants/:id/email-sender
 * @desc    Read a tenant's transactional email sender config
 * @access  Super Admin only
 */
router.get('/tenants/:id/email-sender', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const school = await db('schools').where({ tenant_id: req.params.id }).first();
    res.json({
      success: true,
      data: {
        mode: school?.email_sender_mode || 'platform',
        verified: !!school?.email_sender_verified,
        fromAddress: school?.email_from_address || null,
        contactEmail: school?.email || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants/:id/email-sender
 * @desc    Switch a tenant's email sender mode. Setup team uses this AFTER
 *          verifying the school's sender/domain in the email provider (Brevo).
 * @access  Super Admin only
 * @body    { mode: 'platform' | 'own', fromAddress?: string }
 */
router.post('/tenants/:id/email-sender', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { mode, fromAddress } = req.body as { mode?: string; fromAddress?: string };
    if (mode !== 'platform' && mode !== 'own') {
      throw new AppError("mode must be 'platform' or 'own'", 400, 'VALIDATION_ERROR');
    }
    const school = await db('schools').where({ tenant_id: id }).first();
    if (!school) throw new AppError('School profile not found for this tenant', 404, 'NOT_FOUND');

    const patch: any = {
      email_sender_mode: mode,
      email_sender_verified: mode === 'own',
      updated_at: new Date(),
    };
    if (mode === 'own') {
      patch.email_from_address = fromAddress || school.email || null;
    } else {
      patch.email_from_address = null;
    }

    await db('schools').where({ tenant_id: id }).update(patch);
    const updated = await db('schools').where({ tenant_id: id }).first();
    res.json({
      success: true,
      message: mode === 'own'
        ? 'Tenant now sends from its own verified email address.'
        : 'Tenant now sends via the platform address (school name + reply-to).',
      data: {
        mode: updated.email_sender_mode,
        verified: !!updated.email_sender_verified,
        fromAddress: updated.email_from_address || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants/:id/notify-users
 * @desc    Email a school's users about its current state (suspended, or back
 *          online). Anyone already told is skipped, so it is safe to press
 *          again to reach the people a large school's first run didn't get to.
 * @access  Super Admin only
 */
router.post('/tenants/:id/notify-users', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenant = await db('tenants').where({ id }).first('status');
    if (!tenant) throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
    if (tenant.status !== 'suspended' && tenant.status !== 'active') {
      throw new AppError('Users are only emailed about a suspended or active school.', 400, 'VALIDATION_ERROR');
    }
    const users = await notifyTenantUsers(id, tenant.status === 'suspended' ? 'suspended' : 'restored', { budgetMs: 45_000 });
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'tenant.notify_users', changes: { ...users } });
    res.json({ success: true, data: users, message: describeUserNotice(users) });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants/:id/restore
 * @desc    Restore a soft-deleted (archived) tenant to active
 * @access  Super Admin only
 */
router.post('/tenants/:id/restore', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenant = await TenantService.restoreTenant(id, req.auth!.userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'tenant.restore' });
    const [notice, users] = await Promise.all([
      sendStatusNotice(id, 'tenant restore', (to) => emailService.sendTenantStatusEmail(to, { schoolName: tenant.name, status: 'restored' })),
      notifyTenantUsers(id, 'restored').catch((e) => { logger.warn(`[platform email] user notice failed: ${e?.message || e}`); return null; }),
    ]);
    res.json({ success: true, data: tenant, notice: { emailed: notice.sentTo, users }, message: `Tenant restored successfully. ${notice.text}${users ? ` ${describeUserNotice(users)}` : ''}` });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/platform/tenants/:id/backup
 * @desc    Download an on-demand data backup (multi-sheet XLSX) of a tenant.
 * @access  Super Admin only
 */
router.get('/tenants/:id/backup', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenant = await db('tenants').where({ id }).first();
    if (!tenant) throw new AppError('Tenant not found', 404, 'NOT_FOUND');

    const { buildTenantBackup } = await import('../services/backupService');
    const { buffer } = await buildTenantBackup(id);

    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'tenant.backup' });

    const safeName = String(tenant.name || 'tenant').replace(/[^a-z0-9]+/gi, '_');
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="WiSkul_Backup_${safeName}_${date}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/platform/tenants/:id/school-profile
 * @desc    Update the tenant's school profile / branding (schools table)
 * @access  Super Admin only
 */
router.put('/tenants/:id/school-profile', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      shortName, logoUrl, principalName, principalEmail, website, city, state,
      country, timezone, languagePreference,
    } = req.body;

    const school = await db('schools').where({ tenant_id: id }).first();
    if (!school) throw new AppError('School profile not found for this tenant', 404, 'NOT_FOUND');

    const patch: any = { updated_at: new Date() };
    if (shortName !== undefined) patch.short_name = shortName;
    if (logoUrl !== undefined) patch.logo_url = logoUrl;
    if (principalName !== undefined) patch.principal_name = principalName;
    if (principalEmail !== undefined) patch.principal_email = principalEmail;
    if (website !== undefined) patch.website = website;
    if (city !== undefined) patch.city = city;
    if (state !== undefined) patch.state = state;
    if (country !== undefined) patch.country = country;
    if (timezone !== undefined) patch.timezone = timezone;
    if (languagePreference !== undefined) patch.language_preference = languagePreference;

    await db('schools').where({ tenant_id: id }).update(patch);
    const updated = await db('schools').where({ tenant_id: id }).first();
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'tenant.school_profile.update' });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/platform/tenants/:id/school-profile
 * @desc    Read the tenant's school profile / branding
 * @access  Super Admin only
 */
router.get('/tenants/:id/school-profile', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const school = await db('schools').where({ tenant_id: req.params.id }).first();
    // Never send the school's stored secrets (payment / storage tokens) to the browser.
    res.json({ success: true, data: school ? stripSecretColumns(school) : null });
  } catch (error) {
    next(error);
  }
});

// ── Billing ───────────────────────────────────────────────────────────────

/**
 * @route   GET /api/platform/tenants/:id/billing
 * @desc    Billing history + active subscription for a tenant
 * @access  Super Admin only
 */
router.get('/tenants/:id/billing', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const [history, subscription] = await Promise.all([
      SubscriptionService.getBillingHistory(id),
      SubscriptionService.getActiveSubscription(id).catch(() => null),
    ]);
    res.json({ success: true, data: { history, subscription } });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants/:id/subscription/renew
 * @access  Super Admin only
 */
router.post('/tenants/:id/subscription/renew', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { billing_cycle } = req.body;
    if (billing_cycle !== 'monthly' && billing_cycle !== 'yearly') {
      throw new AppError("billing_cycle must be 'monthly' or 'yearly'", 400, 'VALIDATION_ERROR');
    }
    const updated = await SubscriptionService.renewSubscription(id, billing_cycle, req.auth!.userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'subscription.renew', changes: { billing_cycle } });
    const tenant = await db('tenants').where({ id }).first();
    const to = await tenantContactEmail(id);
    if (to) notify(emailService.sendTenantSubscriptionEmail(to, { schoolName: tenant?.name || 'your school', planLabel: PLAN_LABELS[(updated as any).plan_type] || (updated as any).plan_type, action: 'renewed', endDate: (updated as any).end_date, tenantId: id }), 'subscription renew');
    res.json({ success: true, data: updated, message: 'Subscription renewed' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants/:id/subscription/extend
 * @access  Super Admin only
 */
router.post('/tenants/:id/subscription/extend', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const days = Number(req.body.days);
    const updated = await SubscriptionService.extendSubscription(id, days, req.auth!.userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'subscription.extend', changes: { days } });
    const tenant = await db('tenants').where({ id }).first();
    const to = await tenantContactEmail(id);
    if (to) notify(emailService.sendTenantSubscriptionEmail(to, { schoolName: tenant?.name || 'your school', planLabel: PLAN_LABELS[(updated as any).plan_type] || (updated as any).plan_type, action: 'extended', endDate: (updated as any).end_date, tenantId: id }), 'subscription extend');
    res.json({ success: true, data: updated, message: `Subscription extended by ${days} days` });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants/:id/subscription/expire
 * @access  Super Admin only
 */
router.post('/tenants/:id/subscription/expire', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await SubscriptionService.expireSubscription(id, req.auth!.userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'subscription.expire' });
    const tenant = await db('tenants').where({ id }).first();
    const to = await tenantContactEmail(id);
    if (to) notify(emailService.sendTenantSubscriptionEmail(to, { schoolName: tenant?.name || 'your school', planLabel: PLAN_LABELS[(updated as any).plan_type] || (updated as any).plan_type, action: 'expired', tenantId: id }), 'subscription expire');
    res.json({ success: true, data: updated, message: 'Subscription expired' });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants/:id/subscription/comp
 * @desc    Grant a COMPLIMENTARY (free) plan to a tenant. No payment, no
 *          tenant-side renewal. Optionally time-boxed via duration_days; omit
 *          for an open-ended (never-expiring) grant. Used for enterprise offers
 *          or relief for struggling schools.
 * @access  Super Admin only
 */
router.post('/tenants/:id/subscription/comp', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { plan_type, duration_days, reason } = req.body as {
      plan_type?: 'freetong' | 'combra' | 'bintumani';
      duration_days?: number | null;
      reason?: string;
    };
    if (!plan_type || !['freetong', 'combra', 'bintumani'].includes(plan_type)) {
      throw new AppError('A valid plan_type is required', 400, 'VALIDATION_ERROR');
    }
    if (duration_days !== undefined && duration_days !== null && (!Number.isFinite(Number(duration_days)) || Number(duration_days) <= 0)) {
      throw new AppError('duration_days must be a positive number of days, or omitted for no expiry', 400, 'VALIDATION_ERROR');
    }

    const updated = await SubscriptionService.grantCompPlan(id, plan_type, req.auth!.userId, {
      durationDays: duration_days ?? null,
      reason,
    });
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'subscription.comp_grant', changes: { plan_type, duration_days: duration_days ?? null, reason: reason || null } });

    const tenant = await db('tenants').where({ id }).first();
    const to = await tenantContactEmail(id);
    if (to) notify(emailService.sendTenantSubscriptionEmail(to, { schoolName: tenant?.name || 'your school', planLabel: PLAN_LABELS[plan_type] || plan_type, action: 'changed', endDate: (updated as any).end_date, tenantId: id }), 'comp grant');
    res.json({
      success: true,
      message: `Complimentary ${plan_type.toUpperCase()} granted${duration_days ? ` for ${duration_days} days` : ' with no expiry'}.`,
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/tenants/:id/subscription/comp/revoke
 * @desc    Revoke a complimentary plan — the school moves to Freetong and can
 *          then upgrade by paying. Non-destructive (existing data is kept).
 * @access  Super Admin only
 */
router.post('/tenants/:id/subscription/comp/revoke', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updated = await SubscriptionService.revokeCompPlan(id, req.auth!.userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'subscription.comp_revoke' });

    const tenant = await db('tenants').where({ id }).first();
    const to = await tenantContactEmail(id);
    if (to) notify(emailService.sendTenantSubscriptionEmail(to, { schoolName: tenant?.name || 'your school', planLabel: PLAN_LABELS.freetong, action: 'changed', endDate: (updated as any).end_date, tenantId: id }), 'comp revoke');
    res.json({ success: true, message: 'Complimentary plan revoked. School moved to Freetong.', data: updated });
  } catch (error) {
    next(error);
  }
});

// ── Platform trial config (new-school promo) ──────────────────────────────────

/**
 * @route   GET /api/platform/settings/trial
 * @desc    Read the new-school promotional trial config.
 * @access  Super Admin only
 */
router.get('/settings/trial', authenticate, authorize(UserRole.SUPER_ADMIN), async (_req, res, next) => {
  try {
    const config = await PlatformSettingsService.getTrialConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/platform/settings/trial
 * @desc    Update the new-school trial config: which plan new schools start on,
 *          for how many days, and whether the promo is active. Applies to
 *          schools created AFTER the change.
 * @access  Super Admin only
 */
router.put('/settings/trial', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { enabled, plan_type, duration_days, after_trial } = req.body as {
      enabled?: boolean; plan_type?: string; duration_days?: number; after_trial?: string;
    };
    if (after_trial !== undefined && !['downgrade', 'require_payment'].includes(after_trial)) {
      throw new AppError("after_trial must be 'downgrade' or 'require_payment'", 400, 'VALIDATION_ERROR');
    }
    if (plan_type !== undefined && !['freetong', 'combra', 'bintumani'].includes(plan_type)) {
      throw new AppError('plan_type must be freetong, combra, or bintumani', 400, 'VALIDATION_ERROR');
    }
    if (duration_days !== undefined && (!Number.isFinite(Number(duration_days)) || Number(duration_days) <= 0)) {
      throw new AppError('duration_days must be a positive number of days', 400, 'VALIDATION_ERROR');
    }
    const updated = await PlatformSettingsService.setTrialConfig(
      {
        enabled,
        planType: plan_type as any,
        durationDays: duration_days !== undefined ? Number(duration_days) : undefined,
        afterTrial: after_trial as any,
      },
      req.auth!.userId
    );
    await PlatformAuditService.record({ ...auditMeta(req), action: 'settings.trial_update', changes: updated });
    res.json({ success: true, message: 'Trial settings updated.', data: updated });
  } catch (error) {
    next(error);
  }
});

// ── Plan catalog (prices, limits, features per plan) ─────────────────────────

/**
 * @route   GET /api/platform/plans
 * @desc    Every plan (incl. hidden ones) + the feature registry, for the editor.
 * @access  Super Admin only
 */
router.get('/plans', authenticate, authorize(UserRole.SUPER_ADMIN), async (_req, res, next) => {
  try {
    const { PlanCatalog, FEATURES, UNLIMITED } = await import('../services/planCatalogService.js');
    const counts = await db('subscriptions').where({ status: 'active' }).groupBy('plan_type')
      .select('plan_type').count({ n: '*' }).catch(() => [] as any[]);
    const tenants = Object.fromEntries(counts.map((r: any) => [r.plan_type, Number(r.n) || 0]));
    res.json({ success: true, data: { plans: await PlanCatalog.list(), features: FEATURES, unlimited: UNLIMITED, tenants } });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/platform/plans/:id
 * @desc    Edit a plan: name, tagline, badge, prices, limits, included
 *          features, marketing highlights, visibility. Applies LIVE to every
 *          school on the plan (features + limits); prices apply to the next
 *          payment. Features a school loses stay visible read-only.
 * @access  Super Admin only
 */
router.put('/plans/:id', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { PlanCatalog } = await import('../services/planCatalogService.js');
    const { EntitlementService } = await import('../services/entitlementService.js');
    const before = await PlanCatalog.get(req.params.id);
    const updated = await PlanCatalog.update(req.params.id, req.body || {}, req.auth!.userId);
    EntitlementService.clear();
    const changedFeatures = Object.keys(updated.features).filter((k) => updated.features[k] !== before.features[k]);
    await PlatformAuditService.record({
      ...auditMeta(req), action: 'plans.update', entityId: updated.id,
      changes: {
        monthly_price: [before.monthly_price, updated.monthly_price], yearly_price: [before.yearly_price, updated.yearly_price],
        max_students: [before.max_students, updated.max_students], max_staff: [before.max_staff, updated.max_staff],
        features: Object.fromEntries(changedFeatures.map((k) => [k, updated.features[k]])),
      },
    });
    res.json({ success: true, message: `${updated.name} plan saved.`, data: updated });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/platform/plans/:id/reset
 * @desc    Restore a plan to its built-in defaults.
 * @access  Super Admin only
 */
router.post('/plans/:id/reset', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { PlanCatalog } = await import('../services/planCatalogService.js');
    const { EntitlementService } = await import('../services/entitlementService.js');
    const plan = await PlanCatalog.reset(req.params.id, req.auth!.userId);
    EntitlementService.clear();
    await PlatformAuditService.record({ ...auditMeta(req), action: 'plans.reset', entityId: plan.id });
    res.json({ success: true, message: `${plan.name} plan reset to defaults.`, data: plan });
  } catch (error) {
    next(error);
  }
});

// ── Tenant users ────────────────────────────────────────────────────────────

router.get('/tenants/:id/users', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const users = await TenantUserService.listUsers(req.params.id, {
      search: req.query.search as string,
      role: req.query.role as string,
      status: req.query.status as string,
    });
    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

router.post('/tenants/:id/users/:userId/reset-password', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    const result = await TenantUserService.resetPassword(id, userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'user.reset_password', entityId: userId });
    // Email the user their temporary password (school-branded).
    const u = await db('users').where({ id: userId, tenant_id: id }).first();
    const userName = u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '';
    notify(
      emailService.sendAccountCredentialsEmail(id, result.email, {
        userName,
        role: u?.role,
        tempPassword: result.tempPassword,
      }),
      'user reset-password'
    );
    res.json({ success: true, data: result, message: 'Temporary password generated' });
  } catch (error) {
    next(error);
  }
});

router.post('/tenants/:id/users/:userId/status', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    await TenantUserService.setStatus(id, userId, req.body.status);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'user.set_status', entityId: userId, changes: { status: req.body.status } });
    res.json({ success: true, message: 'User status updated' });
  } catch (error) {
    next(error);
  }
});

router.post('/tenants/:id/users/:userId/unlock', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    await TenantUserService.unlock(id, userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'user.unlock', entityId: userId });
    res.json({ success: true, message: 'User unlocked' });
  } catch (error) {
    next(error);
  }
});

router.post('/tenants/:id/users/:userId/disable-2fa', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id, userId } = req.params;
    await TenantUserService.disableTwoFactor(id, userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'user.disable_2fa', entityId: userId });
    const u = await db('users').where({ id: userId, tenant_id: id }).first();
    if (u?.email) {
      notify(
        emailService.sendTwoFactorStatusEmail(id, u.email, { userName: `${u.first_name || ''} ${u.last_name || ''}`.trim(), action: 'disabled' }),
        'user disable-2fa'
      );
    }
    res.json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (error) {
    next(error);
  }
});

// ── Impersonation ─────────────────────────────────────────────────────────

router.post('/tenants/:id/impersonate', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body || {};
    const result = await ImpersonationService.start(id, req.auth!.userId, userId);
    await PlatformAuditService.record({ ...auditMeta(req), tenantId: id, action: 'tenant.impersonate', entityId: result.user.id });
    res.json({ success: true, data: result, message: `Now viewing ${result.user.schoolName} as support` });
  } catch (error) {
    next(error);
  }
});

// ── Communications hub ──────────────────────────────────────────────────────

// Inbox
router.get('/communications/messages', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const result = await PlatformCommunicationService.listMessages({
      status: req.query.status as string,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.get('/communications/unread-count', authenticate, authorize(UserRole.SUPER_ADMIN), async (_req, res, next) => {
  try {
    res.json({ success: true, data: { count: await PlatformCommunicationService.unreadCount() } });
  } catch (error) {
    next(error);
  }
});

router.post('/communications/messages/:id/status', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const data = await PlatformCommunicationService.setStatus(req.params.id, req.body.status);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/communications/messages/:id/reply', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { subject, body, purpose } = req.body;
    if (!body?.trim()) throw new AppError('Reply body is required', 400, 'VALIDATION_ERROR');
    await PlatformCommunicationService.reply(req.params.id, subject, body, purpose);
    await PlatformAuditService.record({ ...auditMeta(req), action: 'communication.reply', entityId: req.params.id, entityType: 'platform_message' });
    res.json({ success: true, message: 'Reply sent' });
  } catch (error) {
    next(error);
  }
});

router.delete('/communications/messages/:id', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    await PlatformCommunicationService.deleteMessage(req.params.id);
    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    next(error);
  }
});

// Broadcast
router.post('/communications/broadcast', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { subject, body, audience, purpose } = req.body;
    const result = await PlatformCommunicationService.broadcast(req.auth!.userId, {
      subject, body, audience: audience || 'all', purpose,
    });
    await PlatformAuditService.record({ ...auditMeta(req), action: 'communication.broadcast', entityType: 'platform_broadcast', changes: { audience, recipients: result.recipients } });
    res.json({ success: true, data: result, message: `Broadcast sent to ${result.delivered}/${result.recipients} schools` });
  } catch (error) {
    next(error);
  }
});

router.get('/communications/broadcasts', authenticate, authorize(UserRole.SUPER_ADMIN), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await PlatformCommunicationService.listBroadcasts() });
  } catch (error) {
    next(error);
  }
});

// ── Newsletter / Marketing ───────────────────────────────────────────────────

router.get('/newsletter/subscribers', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const result = await NewsletterService.list({
      status: req.query.status as string,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    });
    const counts = await NewsletterService.counts();
    res.json({ success: true, ...result, counts });
  } catch (error) {
    next(error);
  }
});

router.post('/newsletter/subscribers', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { email, name } = req.body;
    if (!email) throw new AppError('Email is required', 400, 'VALIDATION_ERROR');
    const row: any = await NewsletterService.upsertSubscriber({ email, name, source: 'manual', optIn: true });
    if (row?.justSubscribed && row?.unsubscribe_token) {
      notify(
        emailService.sendNewsletterWelcomeEmail(row.email, {
          name: row.name,
          unsubscribeUrl: NewsletterService.unsubscribeUrl(row.unsubscribe_token),
        }),
        'newsletter welcome'
      );
    }
    res.json({ success: true, data: row });
  } catch (error) {
    next(error);
  }
});

router.post('/newsletter/subscribers/:id/status', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const data = await NewsletterService.setStatus(req.params.id, req.body.status);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.post('/newsletter/campaign', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { subject, body, segment } = req.body;
    const result = await NewsletterService.sendCampaign(req.auth!.userId, { subject, body, segment: segment || 'all' });
    await PlatformAuditService.record({ ...auditMeta(req), action: 'newsletter.campaign', entityType: 'newsletter_campaign', changes: { segment, recipients: result.recipients } });
    res.json({ success: true, data: result, message: `Newsletter sent to ${result.delivered}/${result.recipients} subscribers` });
  } catch (error) {
    next(error);
  }
});

router.get('/newsletter/campaigns', authenticate, authorize(UserRole.SUPER_ADMIN), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await NewsletterService.listCampaigns() });
  } catch (error) {
    next(error);
  }
});

// ── Audit ───────────────────────────────────────────────────────────────────

router.get('/audit', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const rows = await PlatformAuditService.list({
      tenantId: req.query.tenantId as string,
      action: req.query.action as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// ── Support tickets (platform triage, cross-tenant) ──────────────────────────
// Super admins see and manage tickets across ALL tenants here. Tenant users use
// the tenant-scoped /api/v1/support/* endpoints (Phase 21).

/** GET /api/v1/platform/support/tickets — list all tickets (filters). */
router.get('/support/tickets', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { default: SupportTicketService } = await import('../services/phase21SupportTicketService');
    const svc = new SupportTicketService(db);
    const tickets = await svc.getAllTickets({
      status: req.query.status as string,
      priority: req.query.priority as string,
      search: req.query.search as string,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    next(error);
  }
});

/** GET /api/v1/platform/support/tickets/:ticketId — ticket + responses. */
router.get('/support/tickets/:ticketId', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { default: SupportTicketService } = await import('../services/phase21SupportTicketService');
    const svc = new SupportTicketService(db);
    const ticket = await svc.getTicketAdmin(req.params.ticketId);
    const responses = await svc.getResponses(req.params.ticketId);
    res.json({ success: true, data: { ticket, responses } });
  } catch (error) {
    next(error);
  }
});

/** POST /api/v1/platform/support/tickets/:ticketId/reply — agent reply. */
router.post('/support/tickets/:ticketId/reply', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) throw new AppError('message is required', 400, 'VALIDATION_ERROR');
    const { default: SupportTicketService } = await import('../services/phase21SupportTicketService');
    const svc = new SupportTicketService(db);
    const response = await svc.addResponse(req.params.ticketId, req.auth!.userId, message, [], true);
    await PlatformAuditService.record({ ...auditMeta(req), action: 'support.reply', entityId: req.params.ticketId });

    // Notify the requester of the reply.
    try {
      const contact = await svc.getRequesterContact(req.params.ticketId);
      if (contact?.email) {
        notify(
          emailService.sendSupportTicketEmail(contact.email, {
            userName: contact.name || undefined,
            reference: SupportTicketService.reference(req.params.ticketId),
            subject: contact.subject,
            event: 'replied',
            message,
            ticketId: req.params.ticketId,
          }),
          'support reply'
        );
      }
    } catch { /* non-blocking */ }

    res.json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/v1/platform/support/tickets/:ticketId/status — change status. */
router.patch('/support/tickets/:ticketId/status', authenticate, authorize(UserRole.SUPER_ADMIN), async (req, res, next) => {
  try {
    const { status, resolution } = req.body;
    if (!status) throw new AppError('status is required', 400, 'VALIDATION_ERROR');
    const { default: SupportTicketService } = await import('../services/phase21SupportTicketService');
    const svc = new SupportTicketService(db);
    const updated = await svc.updateTicketStatus(req.params.ticketId, status, resolution);
    await PlatformAuditService.record({ ...auditMeta(req), action: 'support.status', entityId: req.params.ticketId, changes: { status } });

    try {
      const contact = await svc.getRequesterContact(req.params.ticketId);
      if (contact?.email) {
        notify(
          emailService.sendSupportTicketEmail(contact.email, {
            userName: contact.name || undefined,
            reference: SupportTicketService.reference(req.params.ticketId),
            subject: contact.subject,
            event: 'status',
            status,
            ticketId: req.params.ticketId,
          }),
          'support status'
        );
      }
    } catch { /* non-blocking */ }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
