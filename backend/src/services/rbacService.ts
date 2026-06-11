import { Knex } from 'knex';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export interface RolePermission {
  id: string;
  name: string;
  description?: string;
  resource: string;
  action: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  isPredefined: boolean;
  permissions: RolePermission[];
  createdAt: Date;
  updatedAt: Date;
}

export class RBACService {
  constructor(private db: Knex) {}

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    try {
      const user = await this.db('users').where({ id: userId }).first();
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Get permissions for user's role
      const permissions = await this.db('permissions')
        .join('role_permissions', 'permissions.id', 'role_permissions.permission_id')
        .join('roles', 'role_permissions.role_id', 'roles.id')
        .where('roles.name', user.role)
        .select('permissions.name');

      return permissions.map((p: any) => p.name);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching user permissions', error);
      throw new AppError('Failed to fetch permissions', 500, 'PERMISSION_FETCH_FAILED');
    }
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    try {
      const permissions = await this.getUserPermissions(userId);
      return permissions.includes(permission);
    } catch (error) {
      logger.error('Error checking permission', error);
      return false;
    }
  }

  /**
   * Check if user has any of the given permissions
   */
  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    try {
      const userPerms = await this.getUserPermissions(userId);
      return permissions.some((p) => userPerms.includes(p));
    } catch (error) {
      logger.error('Error checking permissions', error);
      return false;
    }
  }

  /**
   * Check if user has all of the given permissions
   */
  async hasAllPermissions(userId: string, permissions: string[]): Promise<boolean> {
    try {
      const userPerms = await this.getUserPermissions(userId);
      return permissions.every((p) => userPerms.includes(p));
    } catch (error) {
      logger.error('Error checking permissions', error);
      return false;
    }
  }

  /**
   * Get role by ID with permissions
   */
  async getRoleById(roleId: string): Promise<Role> {
    try {
      const role = await this.db('roles').where({ id: roleId }).first();
      if (!role) {
        throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
      }

      const permissions = await this.db('permissions')
        .join('role_permissions', 'permissions.id', 'role_permissions.permission_id')
        .where('role_permissions.role_id', roleId)
        .select('permissions.*');

      return {
        id: role.id,
        name: role.name,
        description: role.description,
        isPredefined: role.is_predefined,
        permissions,
        createdAt: role.created_at,
        updatedAt: role.updated_at,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching role', error);
      throw new AppError('Failed to fetch role', 500, 'ROLE_FETCH_FAILED');
    }
  }

  /**
   * Get role by name with permissions
   */
  async getRoleByName(roleName: string): Promise<Role> {
    try {
      const role = await this.db('roles').where({ name: roleName }).first();
      if (!role) {
        throw new AppError('Role not found', 404, 'ROLE_NOT_FOUND');
      }

      return this.getRoleById(role.id);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching role by name', error);
      throw new AppError('Failed to fetch role', 500, 'ROLE_FETCH_FAILED');
    }
  }

  /**
   * Get all roles
   */
  async getAllRoles(): Promise<Role[]> {
    try {
      const roles = await this.db('roles').orderBy('name');

      return Promise.all(roles.map((role) => this.getRoleById(role.id)));
    } catch (error) {
      logger.error('Error fetching roles', error);
      throw new AppError('Failed to fetch roles', 500, 'ROLE_FETCH_FAILED');
    }
  }

  /**
   * Create a new role
   */
  async createRole(name: string, description?: string, isPredefined = false): Promise<Role> {
    try {
      // Check if role already exists
      const existing = await this.db('roles').where({ name }).first();
      if (existing) {
        throw new AppError('Role already exists', 409, 'ROLE_EXISTS');
      }

      const [roleId] = await this.db('roles').insert({
        name,
        description,
        is_predefined: isPredefined,
        created_at: new Date(),
        updated_at: new Date(),
      });

      logger.info(`Role created: ${name}`);

      return this.getRoleById(roleId);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error creating role', error);
      throw new AppError('Failed to create role', 500, 'ROLE_CREATION_FAILED');
    }
  }

  /**
   * Assign permission to role
   */
  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    try {
      // Check if already assigned
      const existing = await this.db('role_permissions')
        .where({ role_id: roleId, permission_id: permissionId })
        .first();

      if (existing) {
        return;
      }

      await this.db('role_permissions').insert({
        role_id: roleId,
        permission_id: permissionId,
        created_at: new Date(),
      });

      logger.info(`Permission assigned to role: ${roleId}`);
    } catch (error) {
      logger.error('Error assigning permission to role', error);
      throw new AppError('Failed to assign permission', 500, 'PERMISSION_ASSIGNMENT_FAILED');
    }
  }

  /**
   * Remove permission from role
   */
  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    try {
      await this.db('role_permissions')
        .where({ role_id: roleId, permission_id: permissionId })
        .del();

      logger.info(`Permission removed from role: ${roleId}`);
    } catch (error) {
      logger.error('Error removing permission from role', error);
      throw new AppError('Failed to remove permission', 500, 'PERMISSION_REMOVAL_FAILED');
    }
  }

  /**
   * Get or create permission
   */
  async getOrCreatePermission(
    name: string,
    resource: string,
    action: string,
    description?: string
  ): Promise<string> {
    try {
      const existing = await this.db('permissions').where({ name }).first();
      if (existing) {
        return existing.id;
      }

      const [permissionId] = await this.db('permissions').insert({
        name,
        resource,
        action,
        description,
        created_at: new Date(),
      });

      logger.info(`Permission created: ${name}`);

      return permissionId;
    } catch (error) {
      logger.error('Error creating/fetching permission', error);
      throw new AppError('Failed to create permission', 500, 'PERMISSION_CREATION_FAILED');
    }
  }

  /**
   * Get all permissions
   */
  async getAllPermissions(): Promise<RolePermission[]> {
    try {
      const permissions = await this.db('permissions').orderBy('resource').orderBy('action');
      return permissions;
    } catch (error) {
      logger.error('Error fetching permissions', error);
      throw new AppError('Failed to fetch permissions', 500, 'PERMISSION_FETCH_FAILED');
    }
  }

  /**
   * Get permissions by resource
   */
  async getPermissionsByResource(resource: string): Promise<RolePermission[]> {
    try {
      const permissions = await this.db('permissions')
        .where({ resource })
        .orderBy('action');

      return permissions;
    } catch (error) {
      logger.error('Error fetching permissions by resource', error);
      throw new AppError('Failed to fetch permissions', 500, 'PERMISSION_FETCH_FAILED');
    }
  }
}
