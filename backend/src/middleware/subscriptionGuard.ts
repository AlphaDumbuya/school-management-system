import { Request, Response, NextFunction } from 'express';
import { SubscriptionService } from '../services/subscriptionService';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

/**
 * Middleware to check if the tenant subscription plan includes a specific feature
 */
export const requirePlanFeature = (featureKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenant_id || (req.auth as any)?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant context required', 400, 'TENANT_CONTEXT_MISSING');
      }

      const subscription = await SubscriptionService.getActiveSubscription(tenantId);
      
      // Enforce active subscription status checks
      if (subscription.status === 'expired' || subscription.status === 'suspended') {
        throw new AppError(
          `Your school subscription has ${subscription.status}. Please renew your plan to restore access to features.`,
          403,
          'SUBSCRIPTION_EXPIRED'
        );
      }

      const isFeatureEnabled = subscription.features[featureKey] === true;

      if (!isFeatureEnabled) {
        logger.warn(`Tenant ${tenantId} tried to access feature '${featureKey}' which is not included in their ${subscription.plan_type.toUpperCase()} plan.`);
        throw new AppError(
          `Your current subscription plan (${subscription.plan_type.toUpperCase()}) does not include this feature. Please upgrade to access this feature.`,
          403,
          'PLAN_LIMIT_REACHED'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware to check if the tenant is within subscription limits before creating entities (students/staff)
 */
export const checkSubscriptionLimit = (limitType: 'students' | 'staff') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = req.user?.tenant_id || (req.auth as any)?.tenantId;

      if (!tenantId) {
        throw new AppError('Tenant context required', 400, 'TENANT_CONTEXT_MISSING');
      }

      const subscription = await SubscriptionService.getActiveSubscription(tenantId);
      
      // Enforce active subscription status checks
      if (subscription.status === 'expired' || subscription.status === 'suspended') {
        throw new AppError(
          `Your school subscription has ${subscription.status}. Please renew your plan to restore access.`,
          403,
          'SUBSCRIPTION_EXPIRED'
        );
      }

      const limitCheck = await SubscriptionService.checkLimit(tenantId, limitType);

      if (!limitCheck.allowed) {
        logger.warn(`Tenant ${tenantId} reached the maximum limit of ${limitType} (${limitCheck.current}/${limitCheck.max}). Creation blocked.`);
        throw new AppError(
          `You have reached the maximum limit of ${limitType} for your current plan (${limitCheck.current} of ${limitCheck.max}). Please upgrade your subscription plan to add more.`,
          403,
          'PLAN_LIMIT_REACHED'
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
