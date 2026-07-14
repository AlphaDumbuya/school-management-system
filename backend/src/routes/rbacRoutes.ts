import { Router, Request, Response, NextFunction } from 'express';
import { RBACService } from '@services/rbacService';
import { AppError } from '@middleware/errorHandler';
import { authenticate, authorize } from '@middleware/authMiddleware';
import { logger } from '@utils/logger';
import knex from 'knex';
import knexConfig from '../../knexfile';
import { UserRole } from '@types/auth';

const router = Router();
const env = (process.env.NODE_ENV || "development") as keyof typeof knexConfig;
const db = knex(knexConfig[env] || knexConfig.development);
const rbacService = new RBACService(db);

/**
 * GET /api/v1/roles
 * Get all roles (principal only)
 */
router.get('/', authenticate, authorize(UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await rbacService.getAllRoles();

    res.json({
      roles,
      total: roles.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/roles/:id
 * Get role by ID with permissions (principal only)
 */
router.get('/:id', authenticate, authorize(UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const role = await rbacService.getRoleById(id);

    res.json(role);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/roles
 * Create a new role (principal only)
 */
router.post('/', authenticate, authorize(UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      throw new AppError('Role name is required', 400, 'VALIDATION_ERROR');
    }

    const role = await rbacService.createRole(name, description, false);

    res.status(201).json({
      message: 'Role created successfully',
      role,
    });

    logger.info(`Role created: ${name}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/roles/:roleId/permissions/:permissionId
 * Assign permission to role (principal only)
 */
router.post(
  '/:roleId/permissions/:permissionId',
  authenticate,
  authorize(UserRole.PRINCIPAL),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roleId, permissionId } = req.params;

      // Verify role exists
      await rbacService.getRoleById(roleId);

      // Assign permission
      await rbacService.assignPermissionToRole(roleId, permissionId);

      res.status(201).json({
        message: 'Permission assigned to role',
      });

      logger.info(`Permission assigned to role: ${roleId}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/v1/roles/:roleId/permissions/:permissionId
 * Remove permission from role (principal only)
 */
router.delete(
  '/:roleId/permissions/:permissionId',
  authenticate,
  authorize(UserRole.PRINCIPAL),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roleId, permissionId } = req.params;

      // Remove permission
      await rbacService.removePermissionFromRole(roleId, permissionId);

      res.json({
        message: 'Permission removed from role',
      });

      logger.info(`Permission removed from role: ${roleId}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/permissions
 * Get all permissions (principal only)
 */
router.get('/permissions', authenticate, authorize(UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = await rbacService.getAllPermissions();

    res.json({
      permissions,
      total: permissions.length,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/permissions/resource/:resource
 * Get permissions by resource (principal only)
 */
router.get(
  '/resource/:resource',
  authenticate,
  authorize(UserRole.PRINCIPAL),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { resource } = req.params;

      const permissions = await rbacService.getPermissionsByResource(resource);

      res.json({
        permissions,
        total: permissions.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/users/:userId/permissions
 * Get permissions for a user
 */
router.get(
  '/users/:userId/permissions',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const currentUserId = (req as any).auth.userId;
      const currentUserRole = (req as any).auth.role;

      // Allow users to view their own permissions, or principals to view anyone's
      if (userId !== currentUserId && currentUserRole !== UserRole.PRINCIPAL) {
        throw new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
      }

      const permissions = await rbacService.getUserPermissions(userId);

      res.json({
        userId,
        permissions,
        total: permissions.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
