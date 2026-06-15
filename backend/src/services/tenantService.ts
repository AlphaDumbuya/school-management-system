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
      let query = db('tenants').select('*');

      if (filters?.status) {
        query = query.where('status', filters.status);
      }

      if (filters?.search) {
        query = query.where((builder) => {
          builder
            .where('name', 'ilike', `%${filters.search}%`)
            .orWhere('slug', 'ilike', `%${filters.search}%`)
            .orWhere('contact_email', 'ilike', `%${filters.search}%`);
        });
      }

      // Count total before pagination
      const countQuery = query.clone();
      const [{ count }] = await countQuery.count('* as count');

      // Apply pagination
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      query = query.orderBy('created_at', 'desc');

      const tenants = await query;

      return {
        data: tenants,
        total: parseInt(count as string, 10),
        limit: filters?.limit || tenants.length,
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
      // Check if slug already exists
      const existingSlug = await db('tenants').where({ slug: data.slug }).first();
      if (existingSlug) {
        throw new AppError('Tenant slug already exists', 400, 'SLUG_EXISTS');
      }

      // Check if domain already exists (if provided)
      if (data.domain) {
        const existingDomain = await db('tenants').where({ domain: data.domain }).first();
        if (existingDomain) {
          throw new AppError('Domain already exists', 400, 'DOMAIN_EXISTS');
        }
      }

      const [tenant] = await db('tenants')
        .insert({
          name: data.name,
          slug: data.slug,
          description: data.description,
          domain: data.domain,
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

      // Check domain uniqueness if being updated
      if (data.domain && data.domain !== tenant.domain) {
        const existingDomain = await db('tenants')
          .where({ domain: data.domain })
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
          domain: data.domain,
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
  static async suspendTenant(tenantId: string, reason: string, updatedBy: string) {
    try {
      const [tenant] = await db('tenants')
        .where({ id: tenantId })
        .update({
          status: 'suspended',
          settings: db.raw(`settings || ?`, [JSON.stringify({ suspension_reason: reason })]),
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

      // Check if tenant has active subscriptions
      const activeSubscription = await db('subscriptions')
        .where({ tenant_id: tenantId, status: 'active' })
        .first();

      if (activeSubscription) {
        throw new AppError(
          'Cannot delete tenant with active subscription. Cancel subscription first.',
          400,
          'ACTIVE_SUBSCRIPTION_EXISTS'
        );
      }

      // Soft delete by setting status
      await db('tenants')
        .where({ id: tenantId })
        .update({
          status: 'expired',
          updated_at: db.fn.now(),
        });

      logger.info(`Tenant deleted: ${tenantId} by user: ${deletedBy}`);

      return { success: true, message: 'Tenant deleted successfully' };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Error deleting tenant:', error);
      throw new AppError('Failed to delete tenant', 500, 'DELETE_TENANT_ERROR');
    }
  }

  /**
   * Get platform statistics
   */
  static async getPlatformStatistics() {
    try {
      const [totalTenants, activeTenants, totalUsers, totalStudents] = await Promise.all([
        db('tenants').count('* as count').first(),
        db('tenants').where({ status: 'active' }).count('* as count').first(),
        db('users').count('* as count').first(),
        db('students').count('* as count').first(),
      ]);

      // Get monthly statistics
      const thisMonth = new Date();
      thisMonth.setDate(1);

      const newTenantsThisMonth = await db('tenants')
        .where('created_at', '>=', thisMonth)
        .count('* as count')
        .first();

      return {
        totalTenants: parseInt(totalTenants?.count as string, 10),
        activeTenants: parseInt(activeTenants?.count as string, 10),
        totalUsers: parseInt(totalUsers?.count as string, 10),
        totalStudents: parseInt(totalStudents?.count as string, 10),
        newTenantsThisMonth: parseInt(newTenantsThisMonth?.count as string, 10),
      };
    } catch (error) {
      logger.error('Error fetching platform statistics:', error);
      throw new AppError('Failed to fetch platform statistics', 500, 'FETCH_STATS_ERROR');
    }
  }
}
