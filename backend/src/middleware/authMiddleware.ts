import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/jwtService';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';
import { AuthContext, UserRole } from '../types/auth';
import { db } from '../utils/database';

// Extend Express Request to include auth context
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      user?: {
        id: string;
        tenant_id: string;
        tenantId: string;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Missing or invalid authorization header', 401, 'MISSING_AUTH_HEADER');
    }

    const token = authHeader.substring(7);

    try {
      const payload = JWTService.verifyAccessToken(token);

      req.auth = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        permissions: [], // Will be populated by permission middleware
      };

      next();
    } catch (error) {
      if (error instanceof Error) {
        throw new AppError(error.message, 401, 'INVALID_TOKEN');
      }
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to populate req.user with tenant_id from database.
 * Must be used AFTER authenticate middleware.
 */
export const attachUserContext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      return next();
    }
    const user = await db('users').select('id', 'tenant_id', 'email', 'role', 'status').where('id', req.auth.userId).first();
    if (user) {
      // Enforce the user's OWN account status on every request. Deactivating,
      // suspending or dismissing a user must cut them off immediately — not
      // only at their next login — so any already-issued token stops working
      // the moment their status leaves 'active'.
      if (user.status && user.status !== 'active') {
        throw new AppError(
          `Your account is ${user.status}. Please contact your school administrator.`,
          403,
          'ACCOUNT_INACTIVE'
        );
      }

      // Cascade tenant restriction to ALL its users on every request: if the
      // platform owner suspended/expired the tenant, cut off access immediately
      // (already-issued tokens stop working). Super admins are platform-level
      // and exempt.
      if (user.role !== 'super_admin' && user.tenant_id) {
        const tenant = await db('tenants').select('status').where({ id: user.tenant_id }).first();
        if (!tenant || tenant.status !== 'active') {
          throw new AppError(
            'Your school account has been suspended or is inactive. Please contact WiSkul support.',
            403,
            'TENANT_SUSPENDED'
          );
        }
      }

      req.user = {
        id: user.id,
        tenant_id: user.tenant_id,
        tenantId: user.tenant_id,
        email: user.email,
        role: user.role,
      };
      req.auth.tenantId = user.tenant_id;
    }
    next();
  } catch (error) {
    // Deliberate access denials (e.g. TENANT_SUSPENDED) must propagate, not be
    // swallowed. Only tolerate incidental DB lookup failures.
    if (error instanceof AppError) {
      return next(error);
    }
    logger.warn('Failed to fetch user context from DB', error);
    next(); // Continue without tenant info
  }
};

/**
 * Authorization middleware - checks if user has required role
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      if (!allowedRoles.includes(req.auth.role)) {
        logger.warn(`Unauthorized access attempt by user ${req.auth.userId} with role ${req.auth.role}`);
        throw new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Permission middleware - checks if user has required permission
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      if (!req.auth.permissions.includes(permission)) {
        logger.warn(`Unauthorized permission access by user ${req.auth.userId} for permission ${permission}`);
        throw new AppError('Permission denied', 403, 'PERMISSION_DENIED');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      try {
        const payload = JWTService.verifyAccessToken(token);

        req.auth = {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
          permissions: [],
        };
      } catch (error) {
        // Silently ignore token errors for optional auth
        logger.debug('Optional auth token verification failed', error);
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Rate limiting middleware for login attempts
 */
const loginAttempts = new Map<string, { count: number; resetTime: number }>();

// Use higher limits in development so you don't get locked out during testing
const IS_DEV = process.env.NODE_ENV !== 'production';
const MAX_LOGIN_ATTEMPTS = IS_DEV ? 20 : 5;
const LOGIN_ATTEMPT_WINDOW = IS_DEV ? 2 * 60 * 1000 : 15 * 60 * 1000; // 2 min dev / 15 min prod

export const rateLimitLogin = (req: Request, res: Response, next: NextFunction) => {
  const identifier = req.body.email || req.ip;

  const attempt = loginAttempts.get(identifier);
  const now = Date.now();

  if (attempt && now < attempt.resetTime) {
    if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
      throw new AppError(
        `Too many login attempts. Please try again after ${Math.ceil((attempt.resetTime - now) / 1000)} seconds`,
        429,
        'TOO_MANY_ATTEMPTS'
      );
    }
    attempt.count++;
  } else {
    loginAttempts.set(identifier, {
      count: 1,
      resetTime: now + LOGIN_ATTEMPT_WINDOW,
    });
  }

  next();
};

/**
 * Clear login attempts after successful login
 */
export const clearLoginAttempts = (email: string) => {
  loginAttempts.delete(email);
};
