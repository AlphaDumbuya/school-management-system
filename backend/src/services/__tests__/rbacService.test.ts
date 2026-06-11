import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RBACService } from '../rbacService';
import { AuthService } from '../authService';
import knex from 'knex';
import knexConfig from '../../../knexfile';
import { UserRole } from '../../types/auth';

let db: any;
let rbacService: RBACService;
let authService: AuthService;
let testUserId: string;

beforeAll(async () => {
  // Connect to test database
  db = knex(knexConfig.development);
  rbacService = new RBACService(db);
  authService = new AuthService(db);

  // Run migrations
  await db.migrate.latest();

  // Create test user
  const result = await authService.register({
    email: 'rbac-test@example.com',
    password: 'SecurePass123!',
    first_name: 'RBAC',
    last_name: 'Test',
    role: UserRole.TEACHER,
  });
  testUserId = result.user.id;
});

afterAll(async () => {
  // Clean up
  await db.destroy();
});

describe('RBACService', () => {
  describe('getOrCreatePermission', () => {
    it('should create permission', async () => {
      const permId = await rbacService.getOrCreatePermission(
        'test:create',
        'test',
        'create',
        'Test permission'
      );

      expect(permId).toBeDefined();
      expect(typeof permId).toBe('string');
    });

    it('should return existing permission', async () => {
      const permId1 = await rbacService.getOrCreatePermission(
        'test:read',
        'test',
        'read',
        'Test permission'
      );

      const permId2 = await rbacService.getOrCreatePermission(
        'test:read',
        'test',
        'read',
        'Test permission'
      );

      expect(permId1).toBe(permId2);
    });
  });

  describe('createRole', () => {
    it('should create new role', async () => {
      const role = await rbacService.createRole('test-role', 'Test Role Description');

      expect(role).toBeDefined();
      expect(role.name).toBe('test-role');
      expect(role.description).toBe('Test Role Description');
    });

    it('should reject duplicate role name', async () => {
      await rbacService.createRole('duplicate-role', 'Duplicate Role');

      expect(
        rbacService.createRole('duplicate-role', 'Another Role')
      ).rejects.toThrow();
    });
  });

  describe('getRoleById', () => {
    it('should get role with permissions', async () => {
      const role = await rbacService.createRole('get-role', 'Get Role');

      const retrieved = await rbacService.getRoleById(role.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(role.id);
      expect(retrieved.permissions).toBeDefined();
    });

    it('should throw error for non-existent role', async () => {
      expect(
        rbacService.getRoleById('non-existent')
      ).rejects.toThrow();
    });
  });

  describe('getRoleByName', () => {
    it('should get role by name', async () => {
      const role = await rbacService.createRole('named-role', 'Named Role');

      const retrieved = await rbacService.getRoleByName('named-role');

      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBe('named-role');
    });

    it('should throw error for non-existent role', async () => {
      expect(
        rbacService.getRoleByName('non-existent-role')
      ).rejects.toThrow();
    });
  });

  describe('assignPermissionToRole', () => {
    it('should assign permission to role', async () => {
      const role = await rbacService.createRole('assign-role', 'Assign Role');
      const permId = await rbacService.getOrCreatePermission(
        'assign:test',
        'assign',
        'test'
      );

      await rbacService.assignPermissionToRole(role.id, permId);

      const retrieved = await rbacService.getRoleById(role.id);
      expect(retrieved.permissions.length).toBeGreaterThan(0);
    });

    it('should not duplicate permission assignment', async () => {
      const role = await rbacService.createRole('no-dup-role', 'No Dup Role');
      const permId = await rbacService.getOrCreatePermission(
        'nodup:test',
        'nodup',
        'test'
      );

      await rbacService.assignPermissionToRole(role.id, permId);
      await rbacService.assignPermissionToRole(role.id, permId);

      const retrieved = await rbacService.getRoleById(role.id);
      const matches = retrieved.permissions.filter((p: any) => p.id === permId);
      expect(matches.length).toBe(1);
    });
  });

  describe('removePermissionFromRole', () => {
    it('should remove permission from role', async () => {
      const role = await rbacService.createRole('remove-role', 'Remove Role');
      const permId = await rbacService.getOrCreatePermission(
        'remove:test',
        'remove',
        'test'
      );

      await rbacService.assignPermissionToRole(role.id, permId);
      let retrieved = await rbacService.getRoleById(role.id);
      expect(retrieved.permissions.length).toBeGreaterThan(0);

      await rbacService.removePermissionFromRole(role.id, permId);
      retrieved = await rbacService.getRoleById(role.id);
      expect(retrieved.permissions.length).toBe(0);
    });
  });

  describe('getUserPermissions', () => {
    it('should get permissions for user', async () => {
      const permissions = await rbacService.getUserPermissions(testUserId);

      expect(Array.isArray(permissions)).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      expect(
        rbacService.getUserPermissions('non-existent')
      ).rejects.toThrow();
    });
  });

  describe('hasPermission', () => {
    it('should check if user has permission', async () => {
      // Teacher role should have grade:create permission from seed
      const hasPermission = await rbacService.hasPermission(
        testUserId,
        'grade:create'
      );

      expect(typeof hasPermission).toBe('boolean');
    });

    it('should return false for non-existent permission', async () => {
      const hasPermission = await rbacService.hasPermission(
        testUserId,
        'non:existent'
      );

      expect(hasPermission).toBe(false);
    });
  });

  describe('hasAnyPermission', () => {
    it('should check if user has any permission', async () => {
      const hasPermission = await rbacService.hasAnyPermission(testUserId, [
        'grade:create',
        'grade:read',
      ]);

      expect(typeof hasPermission).toBe('boolean');
    });
  });

  describe('hasAllPermissions', () => {
    it('should check if user has all permissions', async () => {
      const hasPermission = await rbacService.hasAllPermissions(testUserId, [
        'grade:create',
        'grade:read',
      ]);

      expect(typeof hasPermission).toBe('boolean');
    });
  });

  describe('getAllRoles', () => {
    it('should get all roles', async () => {
      const roles = await rbacService.getAllRoles();

      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);
    });
  });

  describe('getAllPermissions', () => {
    it('should get all permissions', async () => {
      const permissions = await rbacService.getAllPermissions();

      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
    });
  });

  describe('getPermissionsByResource', () => {
    it('should get permissions by resource', async () => {
      const permissions = await rbacService.getPermissionsByResource('grade');

      expect(Array.isArray(permissions)).toBe(true);
    });
  });
});
