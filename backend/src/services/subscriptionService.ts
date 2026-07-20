import { db } from '../utils/database';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

export interface ActiveSubscription {
  id: string;
  tenant_id: string;
  plan_type: 'freetong' | 'combra' | 'bintumani';
  status: 'active' | 'suspended' | 'expired' | 'cancelled';
  start_date: Date;
  end_date: Date | null;
  monthly_price: number;
  max_users: number;
  max_students: number;
  max_storage_gb: number;
  features: Record<string, boolean>;
  created_at: Date;
  updated_at: Date;
}

export const PLAN_LIMITS = {
  freetong: {
    monthly_price: 400,
    max_users: 15, // matches staff limit of 15 + 1 admin
    max_students: 200,
    max_storage_gb: 5,
    features: {
      attendance_basic: true,
      directory_profiles: true,
      class_subject_mgmt: true,
      fee_collection: true,
      sms_notifications: true,
      id_cards: false,
      events: false,
      advanced_analytics: false,
      whatsapp: false,
      payroll: false,
      scholarships: false,
    },
  },
  combra: {
    monthly_price: 900,
    max_users: 45, // matches staff limit of 40 + 5 admins
    max_students: 500,
    max_storage_gb: 20,
    features: {
      attendance_basic: true,
      attendance_advanced: true,
      directory_profiles: true,
      class_subject_mgmt: true,
      fee_collection: true,
      sms_notifications: true,
      id_cards: true,
      events: true,
      discipline: true,
      advanced_analytics: true,
      whatsapp: true,
      exports: true,
      payroll: false,
      scholarships: false,
    },
  },
  bintumani: {
    monthly_price: 1750,
    max_users: 99999, // unlimited
    max_students: 999999, // unlimited
    max_storage_gb: 100,
    features: {
      attendance_basic: true,
      attendance_advanced: true,
      directory_profiles: true,
      class_subject_mgmt: true,
      fee_collection: true,
      sms_notifications: true,
      id_cards: true,
      events: true,
      discipline: true,
      advanced_analytics: true,
      whatsapp: true,
      exports: true,
      payroll: true,
      scholarships: true,
      custom_branding: true,
      multi_branch: true,
    },
  },
};

export class SubscriptionService {
  /**
   * Get active subscription for a tenant.
   * If none exists, creates a default Freetong trial subscription.
   */
  static async getActiveSubscription(tenantId: string): Promise<ActiveSubscription> {
    try {
      let subscription = await db('subscriptions')
        .where({ tenant_id: tenantId })
        .whereIn('status', ['active', 'expired', 'suspended'])
        .orderBy('created_at', 'desc')
        .first();

      // Check if subscription has expired
      if (subscription && subscription.status === 'active' && subscription.end_date && new Date(subscription.end_date) < new Date()) {
        logger.info(`Subscription ${subscription.id} for tenant ${tenantId} has expired. Updating database status.`);
        
        await db('subscriptions')
          .where({ id: subscription.id })
          .update({ status: 'expired', updated_at: db.fn.now() });

        await db('tenants')
          .where({ id: tenantId })
          .update({ status: 'expired', updated_at: db.fn.now() });

        // Set status locally
        subscription.status = 'expired';
      }

      if (!subscription) {
        logger.info(`No active or past subscription found for tenant ${tenantId}. Initializing default Freetong plan.`);
        subscription = await this.initializeDefaultSubscription(tenantId);
      }

      return {
        ...subscription,
        features: typeof subscription.features === 'string' 
          ? JSON.parse(subscription.features) 
          : subscription.features || {},
      };
    } catch (error) {
      logger.error(`Error in getActiveSubscription: ${error}`);
      throw new AppError('Failed to get active subscription', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Initialize a default Freetong plan for a new tenant
   */
  private static async initializeDefaultSubscription(tenantId: string): Promise<any> {
    const limits = PLAN_LIMITS.freetong;
    const startDate = new Date();
    const endDate = new Date();
    endDate.setFullYear(startDate.getFullYear() + 1); // 1 year duration default

    const [subscription] = await db('subscriptions')
      .insert({
        tenant_id: tenantId,
        plan_type: 'freetong',
        status: 'active',
        start_date: startDate,
        end_date: endDate,
        monthly_price: limits.monthly_price,
        max_users: limits.max_users,
        max_students: limits.max_students,
        max_storage_gb: limits.max_storage_gb,
        features: JSON.stringify(limits.features),
      })
      .returning('*');

    // Link subscription back to the tenant
    await db('tenants')
      .where({ id: tenantId })
      .update({ subscription_id: subscription.id });

    return subscription;
  }

  /**
   * Change plan for tenant
   */
  static async changePlan(
    tenantId: string,
    newPlanType: 'freetong' | 'combra' | 'bintumani',
    billingCycle: 'monthly' | 'yearly',
    userId: string
  ): Promise<ActiveSubscription> {
    try {
      if (!PLAN_LIMITS[newPlanType]) {
        throw new AppError('Invalid subscription plan type', 400, 'VALIDATION_ERROR');
      }

      const limits = PLAN_LIMITS[newPlanType];
      const price = billingCycle === 'monthly' ? limits.monthly_price : limits.monthly_price * 10;
      
      const startDate = new Date();
      const endDate = new Date();
      if (billingCycle === 'monthly') {
        endDate.setMonth(startDate.getMonth() + 1);
      } else {
        endDate.setFullYear(startDate.getFullYear() + 1);
      }

      // Deactivate all previous subscriptions
      await db('subscriptions')
        .where({ tenant_id: tenantId, status: 'active' })
        .update({ status: 'cancelled', updated_at: db.fn.now() });

      // Create new subscription
      const [newSub] = await db('subscriptions')
        .insert({
          tenant_id: tenantId,
          plan_type: newPlanType,
          status: 'active',
          start_date: startDate,
          end_date: endDate,
          monthly_price: billingCycle === 'monthly' ? limits.monthly_price : limits.monthly_price * 10 / 12,
          max_users: limits.max_users,
          max_students: limits.max_students,
          max_storage_gb: limits.max_storage_gb,
          features: JSON.stringify(limits.features),
          created_by: userId,
        })
        .returning('*');

      // Update tenant subscription reference and limits
      await db('tenants')
        .where({ id: tenantId })
        .update({
          subscription_id: newSub.id,
          max_users: limits.max_users,
          max_storage_gb: limits.max_storage_gb,
          updated_at: db.fn.now(),
        });

      // Generate invoice record in billing_history
      await db('billing_history').insert({
        tenant_id: tenantId,
        subscription_id: newSub.id,
        amount: price,
        currency: 'USD',
        payment_method: 'card',
        transaction_id: 'sub_' + uuidv4().substring(0, 12),
        status: 'paid',
        billing_date: startDate,
        due_date: startDate,
        paid_date: startDate,
        notes: `Simulated subscription upgrade to ${newPlanType.toUpperCase()} (${billingCycle})`,
      });

      logger.info(`Tenant ${tenantId} subscription updated to ${newPlanType} by ${userId}`);

      return {
        ...newSub,
        features: limits.features,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error(`Error changing subscription plan: ${error}`);
      throw new AppError('Failed to change subscription plan', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Get billing history for a tenant
   */
  static async getBillingHistory(tenantId: string) {
    try {
      const history = await db('billing_history')
        .where({ tenant_id: tenantId })
        .orderBy('billing_date', 'desc');
      return history;
    } catch (error) {
      logger.error(`Error fetching billing history: ${error}`);
      throw new AppError('Failed to fetch billing history', 500, 'DATABASE_ERROR');
    }
  }

  /**
   * Check if tenant is within subscription limits
   */
  static async checkLimit(
    tenantId: string,
    limitType: 'students' | 'staff'
  ): Promise<{ allowed: boolean; current: number; max: number }> {
    try {
      const sub = await this.getActiveSubscription(tenantId);
      let currentCount = 0;

      if (limitType === 'students') {
        const [{ count }] = await db('students')
          .join('users', 'students.user_id', 'users.id')
          .where('users.tenant_id', tenantId)
          .count('* as count');
        currentCount = parseInt(count as string, 10);
        return {
          allowed: currentCount < sub.max_students,
          current: currentCount,
          max: sub.max_students,
        };
      } else if (limitType === 'staff') {
        const [{ count }] = await db('users')
          .where({ tenant_id: tenantId })
          .whereIn('role', ['teacher', 'accountant', 'admissions_officer', 'principal'])
          .count('* as count');
        currentCount = parseInt(count as string, 10);
        
        // Freetong limits to 15 staff, Combra to 40, Bintumani unlimited.
        const maxStaff = sub.plan_type === 'freetong' ? 15 : sub.plan_type === 'combra' ? 40 : 999999;

        return {
          allowed: currentCount < maxStaff,
          current: currentCount,
          max: maxStaff,
        };
      }

      return { allowed: true, current: 0, max: 999999 };
    } catch (error) {
      logger.error(`Error checking subscription limits: ${error}`);
      throw new AppError('Failed to check subscription limits', 500, 'DATABASE_ERROR');
    }
  }
}
