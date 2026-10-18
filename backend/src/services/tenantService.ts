/**
 * Tenant Service
 * Phase 1.1: Add Super Admin Role - Platform Management
 * 
 * Handles multi-tenant operations for super admin
 */

import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface TenantCreateData {
  name: string;
  slug: string;
  description?: string;
  domain?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  timezone?: string;
  currency?: string;
  language?: string;
  maxUsers?: number;
  maxStorageGb?: number;
}

export interface TenantUpdateData {
  name?: string;
  description?: string;
  domain?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  timezone?: string;
  currency?: string;
  language?: string;
  status?: 'active' | 'suspended' | 'trial' | 'expired';
  maxUsers?: number;
  maxStorageGb?: number;
  settings?: Record<string, any>;
}

export class TenantService {
  /**
   * Get all tenants with optional filtering
   */
  static async getAllTenants(filters?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    try {
      let query = db('tenants');

      if (filters?.status) {
        query = query.where('status', filters.status);
      } else {
        // Default view hides only ARCHIVED (soft-deleted) tenants — those carry
        // `settings.archived_from`. Lapsed/expired-subscription tenants stay
        // visible so the super admin can renew them.
        // NOTE: use jsonb_exists() rather than the `?` operator, which Knex
        // would treat as a positional binding placeholder.
        query = query.whereRaw(`NOT (status = 'expired' AND jsonb_exists(settings, 'archived_from'))`);
      }

      if (filters?.search) {
        query = query.where((builder) => {
          builder
            .where('name', 'ilike', `%${filters.search}%`)
            .orWhere('slug', 'ilike', `%${filters.search}%`)
            .orWhere('contact_email', 'ilike', `%${filters.search}%`);
        });
      }

      // Count total before pagination and select columns
      const countQuery = query.clone();
      const [{ count }] = await countQuery.count('* as count');

      // Add select * to main query
      let mainQuery = query.select('*');

      // Apply pagination
      if (filters?.limit) {
        mainQuery = mainQuery.limit(filters.limit);
      }
      if (filters?.offset) {
        mainQuery = mainQuery.offset(filters.offset);
      }

      mainQuery = mainQuery.orderBy('created_at', 'desc');

      const tenants = await mainQuery;

      // Attach lightweight per-tenant counts (users + students) in two grouped
      // queries, then map — avoids N+1 while giving the platform views real data.
      const tenantIds = tenants.map((t: any) => t.id);
      let userCounts: Record<string, number> = {};
      let studentCounts: Record<string, number> = {};
      if (tenantIds.length) {
        const uRows = await db('users').whereIn('tenant_id', tenantIds).groupBy('tenant_id').select('tenant_id').count('* as count');
        userCounts = Object.fromEntries(uRows.map((r: any) => [r.tenant_id, parseInt(r.count as string, 10) || 0]));
        const sRows = await db('students')
          .join('users', 'students.user_id', 'users.id')
          .whereIn('users.tenant_id', tenantIds)
          .groupBy('users.tenant_id')
          .select('users.tenant_id as tenant_id')
          .count('students.id as count');
        studentCounts = Object.fromEntries(sRows.map((r: any) => [r.tenant_id, parseInt(r.count as string, 10) || 0]));
      }

      const enriched = tenants.map((t: any) => ({
        ...t,
        stats: {
          usersCount: userCounts[t.id] ?? 0,
          studentsCount: studentCounts[t.id] ?? 0,
          staffCount: 0,
        },
      }));

      return {
        data: enriched,
        total: parseInt(count as string, 10) || 0,
        limit: filters?.limit || enriched.length,
        offset: filters?.offset || 0,
      };
    } catch (error) {
      logger.error('Error fetching tenants:', error);
      throw new AppError('Failed to fetch tenants', 500, 'FETCH_TENANTS_ERROR');
    }
  }

  /**
   * Get tenant by ID
   */
  static async getTenantById(tenantId: string) {
    try {
      const tenant = await db('tenants').where({ id: tenantId }).first();

      if (!tenant) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      // Get tenant statistics
      const [userCount, studentCount, activeUsers] = await Promise.all([
        db('users').where({ tenant_id: tenantId }).count('* as count').first(),
        db('students')
          .join('users', 'students.user_id', 'users.id')
          .where('users.tenant_id', tenantId)
          .count('* as count')
          .first(),
        db('users')
          .where({ tenant_id: tenantId, status: 'active' })
          .count('* as count')
          .first(),
      ]);

      return {
        ...tenant,
        statistics: {
          totalUsers: parseInt(userCount?.count as string, 10),
          totalStudents: parseInt(studentCount?.count as string, 10),
          activeUsers: parseInt(activeUsers?.count as string, 10),
        },
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error fetching tenant:', error);
      throw new AppError('Failed to fetch tenant', 500, 'FETCH_TENANT_ERROR');
    }
  }

  /**
   * Create a new tenant
   */
  static async createTenant(data: TenantCreateData, createdBy: string) {
    try {
      const domainVal = data.domain && data.domain.trim() !== '' ? data.domain.trim() : null;

      // Check if slug already exists
      const existingSlug = await db('tenants').where({ slug: data.slug }).first();
      if (existingSlug) {
        throw new AppError('Tenant slug already exists', 400, 'SLUG_EXISTS');
      }

      // Check if domain already exists (if provided)
      if (domainVal) {
        const existingDomain = await db('tenants').where({ domain: domainVal }).first();
        if (existingDomain) {
          throw new AppError('Domain already exists', 400, 'DOMAIN_EXISTS');
        }
      }

      const [tenant] = await db('tenants')
        .insert({
          name: data.name,
          slug: data.slug,
          description: data.description,
          domain: domainVal,
          contact_email: data.contactEmail,
          contact_phone: data.contactPhone,
          address: data.address,
          timezone: data.timezone || 'UTC',
          currency: data.currency || 'USD',
          language: data.language || 'en',
          max_users: data.maxUsers || 1000,
          max_storage_gb: data.maxStorageGb || 100,
          status: 'active',
          settings: {},
          created_at: db.fn.now(),
          updated_at: db.fn.now(),
        })
        .returning('*');

      logger.info(`Tenant created: ${tenant.id} by user: ${createdBy}`);

      return tenant;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error creating tenant:', error);
      throw new AppError('Failed to create tenant', 500, 'CREATE_TENANT_ERROR');
    }
  }

  /**
   * Update tenant
   */
  static async updateTenant(tenantId: string, data: TenantUpdateData, updatedBy: string) {
    try {
      const tenant = await db('tenants').where({ id: tenantId }).first();
      if (!tenant) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      const domainVal = data.domain && data.domain.trim() !== '' ? data.domain.trim() : null;

      // Check domain uniqueness if being updated
      if (domainVal && domainVal !== tenant.domain) {
        const existingDomain = await db('tenants')
          .where({ domain: domainVal })
          .whereNot({ id: tenantId })
          .first();
        if (existingDomain) {
          throw new AppError('Domain already exists', 400, 'DOMAIN_EXISTS');
        }
      }

      const [updatedTenant] = await db('tenants')
        .where({ id: tenantId })
        .update({
          name: data.name,
          description: data.description,
          domain: domainVal,
          contact_email: data.contactEmail,
          contact_phone: data.contactPhone,
          address: data.address,
          timezone: data.timezone,
          currency: data.currency,
          language: data.language,
          status: data.status,
          max_users: data.maxUsers,
          max_storage_gb: data.maxStorageGb,
          settings: data.settings,
          updated_at: db.fn.now(),
        })
        .returning('*');

      logger.info(`Tenant updated: ${tenantId} by user: ${updatedBy}`);

      return updatedTenant;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error updating tenant:', error);
      throw new AppError('Failed to update tenant', 500, 'UPDATE_TENANT_ERROR');
    }
  }

  /**
   * Activate tenant
   */
  static async activateTenant(tenantId: string, updatedBy: string) {
    try {
      const [tenant] = await db('tenants')
        .where({ id: tenantId })
        .update({
          status: 'active',
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!tenant) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      logger.info(`Tenant activated: ${tenantId} by user: ${updatedBy}`);

      return tenant;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error activating tenant:', error);
      throw new AppError('Failed to activate tenant', 500, 'ACTIVATE_TENANT_ERROR');
    }
  }

  /**
   * Suspend tenant
   */
  /**
   * Determine whether a tenant's subscription is genuinely overdue/lapsed.
   * Used to prevent suspending a paying tenant for "non-payment" by mistake.
   * Returns { overdue, planStatus, endDate } — overdue=true when there is no
   * active in-date subscription.
   */
  static async getSubscriptionState(tenantId: string): Promise<{ overdue: boolean; planStatus: string | null; endDate: string | null }> {
    try {
      const hasSubs = await db.schema.hasTable('subscriptions');
      if (!hasSubs) return { overdue: false, planStatus: null, endDate: null };
      // Most recent subscription row for this tenant.
      const sub = await db('subscriptions')
        .where({ tenant_id: tenantId })
        .orderBy('start_date', 'desc')
        .first();
      if (!sub) return { overdue: true, planStatus: null, endDate: null }; // no plan on file = treat as overdue
      const status = String(sub.status || '').toLowerCase();
      const endDate: string | null = sub.end_date ? new Date(sub.end_date).toISOString() : null;
      const pastEnd = !!sub.end_date && new Date(sub.end_date).getTime() < Date.now();
      // Overdue when the plan isn't active, or it's active but past its end date.
      const overdue = status === 'expired' || status === 'cancelled' || status === 'suspended' || pastEnd;
      return { overdue, planStatus: status || null, endDate };
    } catch {
      // If we can't determine, don't block — return not-overdue so the guard is lenient.
      return { overdue: false, planStatus: null, endDate: null };
    }
  }

  static async suspendTenant(tenantId: string, reason: string, updatedBy: string, category?: string, override?: boolean) {
    try {
      const validCategories = ['payment', 'policy', 'abuse', 'review', 'security', 'other'];
      const suspensionCategory = validCategories.includes(String(category)) ? String(category) : 'other';

      // Integrity guard: don't suspend a tenant for "overdue payment" when their
      // subscription is actually active/in-date — that would send a false notice.
      // The platform owner can still proceed by passing override=true (recorded).
      if (suspensionCategory === 'payment' && !override) {
        const sub = await this.getSubscriptionState(tenantId);
        if (!sub.overdue) {
          throw new AppError(
            `This school's subscription is currently active${sub.endDate ? ` (valid until ${new Date(sub.endDate).toLocaleDateString()})` : ''}, so suspending for "overdue payment" would be inaccurate. Choose a different category, or confirm to override.`,
            409,
            'SUSPENSION_CATEGORY_MISMATCH'
          );
        }
      }
      const [tenant] = await db('tenants')
        .where({ id: tenantId })
        .update({
          status: 'suspended',
          settings: db.raw(`settings || ?`, [JSON.stringify({
            suspension_reason: reason,
            suspension_category: suspensionCategory,
            suspended_at: new Date().toISOString(),
          })]),
          updated_at: db.fn.now(),
        })
        .returning('*');

      if (!tenant) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      logger.info(`Tenant suspended: ${tenantId} by user: ${updatedBy}, reason: ${reason}`);

      return tenant;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error suspending tenant:', error);
      throw new AppError('Failed to suspend tenant', 500, 'SUSPEND_TENANT_ERROR');
    }
  }

  /**
   * Delete tenant (soft delete by setting status)
   */
  static async deleteTenant(tenantId: string, deletedBy: string) {
    try {
      const tenant = await db('tenants').where({ id: tenantId }).first();
      if (!tenant) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      // Automatically cancel active subscriptions for this tenant instead of blocking
      await db('subscriptions')
        .where({ tenant_id: tenantId })
        .update({
          status: 'cancelled',
          updated_at: db.fn.now(),
        });

      const deletedSlug = `${tenant.slug}-deleted-${Date.now()}`;
      const deletedName = `${tenant.name} (Archived-${Date.now()})`;

      // Soft delete: mark expired, rename/slug, detach subscription, and stash
      // the original name/slug in settings so a later restore is clean.
      await db('tenants')
        .where({ id: tenantId })
        .update({
          status: 'expired',
          name: deletedName,
          slug: deletedSlug,
          subscription_id: null,
          settings: db.raw(`settings || ?`, [
            JSON.stringify({ archived_from: { name: tenant.name, slug: tenant.slug }, archived_at: new Date().toISOString() }),
          ]),
          updated_at: db.fn.now(),
        });

      logger.info(`Tenant soft-deleted: ${tenantId} by user: ${deletedBy}`);

      return { success: true, message: 'Tenant deleted successfully' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deleting tenant:', error);
      throw new AppError('Failed to delete tenant', 500, 'DELETE_TENANT_ERROR');
    }
  }

  /**
   * Restore a soft-deleted (archived) tenant back to active, recovering its
   * original name and slug from settings.archived_from when available.
   */
  static async restoreTenant(tenantId: string, restoredBy: string) {
    try {
      const tenant = await db('tenants').where({ id: tenantId }).first();
      if (!tenant) {
        throw new AppError('Tenant not found', 404, 'TENANT_NOT_FOUND');
      }

      const settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : (tenant.settings || {});
      const archivedFrom = settings.archived_from || {};

      // If the recovered slug is already taken (rare), keep the archived slug.
      let restoreSlug = archivedFrom.slug || tenant.slug;
      if (archivedFrom.slug) {
        const clash = await db('tenants').where({ slug: archivedFrom.slug }).whereNot({ id: tenantId }).first();
        if (clash) restoreSlug = `${archivedFrom.slug}-restored-${Date.now()}`;
      }

      const nextSettings = { ...settings };
      delete nextSettings.archived_from;
      delete nextSettings.archived_at;

      const [restored] = await db('tenants')
        .where({ id: tenantId })
        .update({
          status: 'active',
          name: archivedFrom.name || tenant.name,
          slug: restoreSlug,
          settings: JSON.stringify(nextSettings),
          updated_at: db.fn.now(),
        })
        .returning('*');

      logger.info(`Tenant restored: ${tenantId} by user: ${restoredBy}`);
      return restored;
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error restoring tenant:', error);
      throw new AppError('Failed to restore tenant', 500, 'RESTORE_TENANT_ERROR');
    }
  }

  /**
   * Get platform statistics
   */
  static async getPlatformStatistics() {
    try {
      const [totalTenants, activeTenants, suspendedTenants, trialTenants, totalUsers, totalStudents] = await Promise.all([
        db('tenants').whereNot({ status: 'expired' }).count('* as count').first(),
        db('tenants').where({ status: 'active' }).count('* as count').first(),
        db('tenants').where({ status: 'suspended' }).count('* as count').first(),
        db('tenants').where({ status: 'trial' }).count('* as count').first(),
        db('users')
          .whereIn('tenant_id', db('tenants').select('id').whereNot({ status: 'expired' }))
          .count('* as count')
          .first(),
        db('students')
          .join('users', 'students.user_id', 'users.id')
          .whereIn('users.tenant_id', db('tenants').select('id').whereNot({ status: 'expired' }))
          .count('students.id as count')
          .first(),
      ]);

      // Get monthly statistics
      const thisMonth = new Date();
      thisMonth.setDate(1);

      const newTenantsThisMonth = await db('tenants')
        .where('created_at', '>=', thisMonth)
        .count('* as count')
        .first();

      // ── New-feature adoption (real counts; guarded so missing tables/columns
      // never break the dashboard) ──
      const safeCount = async (fn: () => Promise<any>): Promise<number> => {
        try {
          const row = await fn();
          return parseInt(row?.count as string, 10) || 0;
        } catch {
          return 0;
        }
      };

      const activeTenantIds = db('tenants').select('id').whereNot({ status: 'expired' });

      const [verifiedSchools, passkeyUsers, twoFactorUsers, pendingVerifications] = await Promise.all([
        // Verified schools = tenant owners (principals) with verification_status 'verified'.
        safeCount(() =>
          db('users')
            .where({ role: 'principal', verification_status: 'verified' })
            .whereIn('tenant_id', activeTenantIds)
            .countDistinct('tenant_id as count')
            .first()
        ),
        // Distinct users with at least one registered passkey.
        safeCount(() => db('user_passkeys').countDistinct('user_id as count').first()),
        // Users with authenticator-app 2FA enabled.
        safeCount(() =>
          db('users')
            .where({ two_factor_enabled: true })
            .whereIn('tenant_id', activeTenantIds)
            .count('* as count')
            .first()
        ),
        // School verifications waiting for WiSkul's review.
        safeCount(() =>
          db('verification_records')
            .where({ status: 'pending' })
            .whereIn('tenant_id', activeTenantIds)
            .count('* as count')
            .first()
        ),
      ]);

      const totalTenantsNum = parseInt(totalTenants?.count as string, 10) || 0;

      return {
        totalTenants: totalTenantsNum,
        activeTenants: parseInt(activeTenants?.count as string, 10) || 0,
        suspendedTenants: parseInt(suspendedTenants?.count as string, 10) || 0,
        trialTenants: parseInt(trialTenants?.count as string, 10) || 0,
        totalUsers: parseInt(totalUsers?.count as string, 10) || 0,
        totalStudents: parseInt(totalStudents?.count as string, 10) || 0,
        newTenantsThisMonth: parseInt(newTenantsThisMonth?.count as string, 10) || 0,
        // Feature adoption
        verifiedSchools,
        unverifiedSchools: Math.max(0, totalTenantsNum - verifiedSchools),
        pendingVerifications,
        passkeyUsers,
        twoFactorUsers,
      };
    } catch (error) {
      logger.error('Error fetching platform statistics:', error);
      throw new AppError('Failed to fetch platform statistics', 500, 'FETCH_STATS_ERROR');
    }
  }

  /**
   * Suspension tracking for the platform owner: every currently-suspended tenant
   * with its category, reason and date, plus per-category counts. Lets the owner
   * see WHY schools are suspended at a glance (e.g. how many for non-payment vs
   * policy violations).
   */
  static async getSuspensionOverview() {
    try {
      const rows = await db('tenants')
        .select('id', 'name', 'slug', 'contact_email', 'settings', 'updated_at')
        .where({ status: 'suspended' })
        .orderBy('updated_at', 'desc');

      const CATEGORIES = ['payment', 'policy', 'abuse', 'review', 'security', 'other'] as const;
      const counts: Record<string, number> = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));

      const tenants = rows.map((t: any) => {
        const settings = typeof t.settings === 'string' ? JSON.parse(t.settings || '{}') : (t.settings || {});
        const category = CATEGORIES.includes(settings.suspension_category) ? settings.suspension_category : 'other';
        counts[category] = (counts[category] || 0) + 1;
        return {
          id: t.id,
          name: t.name,
          slug: t.slug,
          contactEmail: t.contact_email || null,
          category,
          reason: settings.suspension_reason || null,
          suspendedAt: settings.suspended_at || t.updated_at || null,
        };
      });

      return { total: tenants.length, counts, tenants };
    } catch (error) {
      logger.error('Error fetching suspension overview:', error);
      throw new AppError('Failed to fetch suspension overview', 500, 'FETCH_SUSPENSIONS_ERROR');
    }
  }
}
