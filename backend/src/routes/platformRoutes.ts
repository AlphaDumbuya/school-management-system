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
import { AppError } from '../middleware/errorHandler';
import { UserRole } from '../types/auth';
import { db } from '../utils/database';
import eventCategoryService from '../services/eventCategoryService';

const router = Router();

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
    res.json({ success: true, data: tenant });
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
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      });
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
    res.json({ success: true, data: tenant, message: 'Tenant activated successfully' });
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
    const { reason } = req.body;

    if (!reason) {
      throw new AppError('Suspension reason is required', 400, 'VALIDATION_ERROR');
    }

    const tenant = await TenantService.suspendTenant(id, reason, req.auth!.userId);
    res.json({ success: true, data: tenant, message: 'Tenant suspended successfully' });
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
    res.json({ success: true, message: `Tenant subscription updated to ${plan_type.toUpperCase()}`, data: updated });
  } catch (error) {
    next(error);
  }
});

export default router;
