import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';

/**
 * RBAC (Role-Based Access Control) middleware - checks if user has required permission
 */
export const rbacMiddleware = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      if (!req.auth.permissions.includes(requiredPermission)) {
        logger.warn(`Unauthorized permission access by user ${req.auth.userId} for permission ${requiredPermission}`);
        throw new AppError('Permission denied', 403, 'PERMISSION_DENIED');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default rbacMiddleware;
