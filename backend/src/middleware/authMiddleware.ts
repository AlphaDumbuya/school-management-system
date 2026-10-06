import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/jwtService';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';
import { AuthContext, UserRole } from '../types/auth';
import { db } from '../utils/database';
import { parseDuties, dutyForPath } from '../utils/staffDuties';

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
        /** The role this request acts as (main role, or a staff duty on its own module). */
        role: string;
        /** The user's main role (users.role). */
        primary_role?: string;
        /** Extra duties a teacher holds (accountant / admissions_officer). */
        staff_duties?: string[];
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

      // Routers run `authenticate → attachUserContext` and most handlers repeat
      // `authenticate`. Keep the LIVE role/tenant attachUserContext already
      // loaded for this user; otherwise the repeat call would put the token's
      // (up to 30-min-old) role back, and authorize() would keep a promoted or
      // demoted user on their old permissions until the token is reissued.
      const live = req.user && String(req.user.id) === String(payload.userId) ? req.user : null;
      req.auth = {
        userId: payload.userId,
        email: payload.email,
        role: (live?.role as any) || payload.role,
        permissions: [], // Will be populated by permission middleware
        ...(live?.tenant_id ? { tenantId: live.tenant_id } : {}),
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
    // select('*') so staff_duties is read when the column exists, without
    // breaking before migration 162 runs.
    const user = await db('users').select('*').where('id', req.auth.userId).first();
    if (user) {
      // Enforce the user's OWN account status on every request. Deactivating,
      // suspending or dismissing a user must cut them off immediately — not
      // only at their next login — so any already-issued token stops working
      // the moment their status leaves 'active'.
      if (user.status && String(user.status).trim().toLowerCase() !== 'active') {
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

      // Staff duties (teacher + Bursar / Admissions): on the duty's own module
      // the request acts as that role; everywhere else the main role applies.
      const duties = user.role === 'teacher' ? parseDuties(user.staff_duties) : [];
      const actingRole = dutyForPath(req.originalUrl || req.url, duties) || user.role;

      req.user = {
        id: user.id,
        tenant_id: user.tenant_id,
        tenantId: user.tenant_id,
        email: user.email,
        role: actingRole,
        primary_role: user.role,
        staff_duties: duties,
      };
      req.auth.tenantId = user.tenant_id;
      // Trust the LIVE role from the DB over whatever the (possibly stale) JWT
      // carried. This makes role changes — e.g. promoting a teacher to
      // principal — take effect on the very next request, without waiting for
      // the access token to be reissued. authorize() reads req.auth.role.
      if (actingRole) {
        req.auth.role = actingRole as any;
      }
    }
    next();
  } catch (error) {
    // Deliberate access denials (e.g. TENANT_SUSPENDED) must propagate, not be
    // swallowed. Only tolerate incidental DB lookup failures.
    if (error instanceof AppError) {
      return next(error);
    }
    // The database didn't answer. Carrying on without req.user made handlers
    // crash ("reading 'tenant_id'") or answer a misleading "Tenant context is
    // required". Say what actually happened, so the app can retry.
    logger.warn('Failed to fetch user context from DB', error);
    return next(new AppError('The server is busy reconnecting to the database. Please try again in a moment.', 503, 'DB_UNAVAILABLE'));
  }
};

/**
 * Authorization middleware - checks if user has required role.
 *
 * Accepts BOTH calling conventions so a mistake at the call site can't silently
 * deny everyone:
 *   authorize(UserRole.PRINCIPAL, UserRole.SUPER_ADMIN)   // spread
 *   authorize(['principal', 'super_admin'])               // single array
 * (Several route files use the array form; without flattening, the role check
 * would compare a string against a nested array and reject every request.)
 */
export const authorize = (...allowedRoles: Array<UserRole | UserRole[]>) => {
  const flatRoles = allowedRoles.flat() as UserRole[];
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new AppError('Authentication required', 401, 'NOT_AUTHENTICATED');
      }

      // Decide on the LIVE role. Routers without attachUserContext only have
      // the token's role, which can be up to 30 minutes stale after a role
      // change (promotion, demotion, portal move), so read it from the DB.
      let role = req.auth.role;
      let duties: string[] = req.user?.staff_duties ?? [];
      if (!req.user || String(req.user.id) !== String(req.auth.userId)) {
        const row = await db('users').where('id', req.auth.userId).first('*').catch(() => null);
        if (row && row.status && String(row.status).trim().toLowerCase() !== 'active') {
          throw new AppError(`Your account is ${row.status}. Please contact your school administrator.`, 403, 'ACCOUNT_INACTIVE');
        }
        if (row?.role) {
          duties = row.role === 'teacher' ? parseDuties(row.staff_duties) : [];
          role = (dutyForPath(req.originalUrl || req.url, duties as any) || row.role) as any;
        }
        req.auth.role = role;
      }

      // A teacher with a staff duty (Bursar / Admissions) may use a route the
      // duty allows; the request then acts as that duty from here on.
      if (!flatRoles.includes(role)) {
        const duty = duties.find((d) => flatRoles.includes(d as UserRole));
        if (duty) {
          role = duty as UserRole;
          req.auth.role = role;
          if (req.user) req.user.role = duty;
        }
      }

      if (!flatRoles.includes(role)) {
        logger.warn(`Unauthorized access attempt by user ${req.auth.userId} with role ${role}`);
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
