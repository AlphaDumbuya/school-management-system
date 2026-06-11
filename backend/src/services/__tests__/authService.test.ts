import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { AuthService } from '../authService';
import { PasswordService } from '../passwordService';
import knex from 'knex';
import knexConfig from '../../../knexfile';
import { UserRole, UserStatus } from '../../types/auth';

let db: any;
let authService: AuthService;

beforeAll(async () => {
  // Connect to test database
  db = knex(knexConfig.development);
  authService = new AuthService(db);
  
  // Run migrations
  await db.migrate.latest();
});

afterAll(async () => {
  // Clean up
  await db.destroy();
});

describe('AuthService', () => {
  describe('register', () => {
    it('should register a new user successfully', async () => {
      const result = await authService.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.STUDENT,
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
    });

    it('should fail if email already exists', async () => {
      await authService.register({
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.STUDENT,
      });

      expect(
        authService.register({
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
          first_name: 'Test',
          last_name: 'User',
          role: UserRole.STUDENT,
        })
      ).rejects.toThrow();
    });

    it('should validate password policy', async () => {
      expect(
        authService.register({
          email: 'weak@example.com',
          password: 'weak',
          first_name: 'Test',
          last_name: 'User',
          role: UserRole.STUDENT,
        })
      ).rejects.toThrow();
    });

    it('should hash password correctly', async () => {
      const result = await authService.register({
        email: 'hash-test@example.com',
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.STUDENT,
      });

      const user = await db('users').where('id', result.user.id).first();
      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe('SecurePass123!');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create test user
      await authService.register({
        email: 'login@example.com',
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.STUDENT,
      });
    });

    it('should login successfully with correct credentials', async () => {
      const result = await authService.login('login@example.com', 'SecurePass123!');

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('login@example.com');
      expect(result.access_token).toBeDefined();
      expect(result.refresh_token).toBeDefined();
    });

    it('should fail with incorrect password', async () => {
      expect(
        authService.login('login@example.com', 'WrongPassword123!')
      ).rejects.toThrow();
    });

    it('should fail with non-existent email', async () => {
      expect(
        authService.login('nonexistent@example.com', 'SecurePass123!')
      ).rejects.toThrow();
    });

    it('should update last_login timestamp', async () => {
      const before = new Date();
      await authService.login('login@example.com', 'SecurePass123!');
      const after = new Date();

      const user = await db('users').where('email', 'login@example.com').first();
      expect(new Date(user.last_login).getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(new Date(user.last_login).getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('refreshToken', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: 'refresh@example.com',
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.STUDENT,
      });

      refreshToken = result.refresh_token;
    });

    it('should generate new access token with valid refresh token', async () => {
      const result = await authService.refreshToken(refreshToken);

      expect(result.access_token).toBeDefined();
      expect(result.access_token).not.toBe(refreshToken);
    });

    it('should fail with invalid refresh token', async () => {
      expect(
        authService.refreshToken('invalid.refresh.token')
      ).rejects.toThrow();
    });
  });

  describe('changePassword', () => {
    let userId: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: 'changepass@example.com',
        password: 'OldPass123!',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.STUDENT,
      });

      userId = result.user.id;
    });

    it('should change password successfully', async () => {
      await authService.changePassword(userId, 'OldPass123!', 'NewPass123!');

      // Old password should not work
      expect(
        authService.login('changepass@example.com', 'OldPass123!')
      ).rejects.toThrow();

      // New password should work
      const result = await authService.login('changepass@example.com', 'NewPass123!');
      expect(result.user).toBeDefined();
    });

    it('should reject invalid old password', async () => {
      expect(
        authService.changePassword(userId, 'WrongPassword', 'NewPass123!')
      ).rejects.toThrow();
    });

    it('should validate new password policy', async () => {
      expect(
        authService.changePassword(userId, 'OldPass123!', 'weak')
      ).rejects.toThrow();
    });
  });

  describe('requestPasswordReset', () => {
    let testEmail: string;

    beforeEach(async () => {
      testEmail = `reset-${Date.now()}@example.com`;
      await authService.register({
        email: testEmail,
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.STUDENT,
      });
    });

    it('should generate reset token', async () => {
      const resetToken = await authService.requestPasswordReset(testEmail);

      expect(resetToken).toBeDefined();
      expect(typeof resetToken).toBe('string');
      expect(resetToken.length).toBeGreaterThan(0);
    });

    it('should create password reset record', async () => {
      await authService.requestPasswordReset(testEmail);

      const user = await db('users').where('email', testEmail).first();
      const resets = await db('password_resets').where({ user_id: user.id });
      expect(resets.length).toBe(1);
      expect(resets[0].expires_at).toBeDefined();
    });
  });

  describe('resetPassword', () => {
    let testEmail: string;

    beforeEach(async () => {
      testEmail = `reset2-${Date.now()}@example.com`;
      await authService.register({
        email: testEmail,
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.STUDENT,
      });
    });

    it('should reset password with valid token', async () => {
      const resetToken = await authService.requestPasswordReset(testEmail);

      await authService.resetPassword(resetToken, 'ResetPass123!');

      // New password should work
      const result = await authService.login(testEmail, 'ResetPass123!');
      expect(result.user).toBeDefined();
    });

    it('should reject invalid token', async () => {
      expect(
        authService.resetPassword('invalid-token', 'NewPass123!')
      ).rejects.toThrow();
    });

    it('should delete reset token after use', async () => {
      const resetToken = await authService.requestPasswordReset(testEmail);

      await authService.resetPassword(resetToken, 'ResetPass123!');

      const user = await db('users').where('email', testEmail).first();
      const resets = await db('password_resets').where({ user_id: user.id });
      expect(resets.length).toBe(0);
    });
  });

  describe('createUser', () => {
    let adminId: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: `admin-${Date.now()}@example.com`,
        password: 'SecurePass123!',
        first_name: 'Admin',
        last_name: 'User',
        role: UserRole.ADMIN,
      });
      adminId = result.user.id;
    });

    it('should create new user with role', async () => {
      const user = await authService.createUser({
        email: 'newteacher@example.com',
        password: 'Teacher123!',
        first_name: 'Teacher',
        last_name: 'User',
        role: UserRole.TEACHER,
        createdBy: adminId,
      });

      expect(user).toBeDefined();
      expect(user.email).toBe('newteacher@example.com');
      expect(user.role).toBe(UserRole.TEACHER);
    });

    it('should reject duplicate email', async () => {
      expect(
        authService.createUser({
          email: 'newteacher@example.com',
          password: 'Teacher123!',
          first_name: 'Duplicate',
          last_name: 'User',
          role: UserRole.TEACHER,
          createdBy: adminId,
        })
      ).rejects.toThrow();
    });
  });

  describe('updateUser', () => {
    let userId: string;
    let adminId: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: `update-${Date.now()}@example.com`,
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.STUDENT,
      });
      userId = result.user.id;

      const adminResult = await authService.register({
        email: `admin2-${Date.now()}@example.com`,
        password: 'SecurePass123!',
        first_name: 'Admin',
        last_name: 'User',
        role: UserRole.ADMIN,
      });
      adminId = adminResult.user.id;
    });

    it('should update user profile', async () => {
      const updated = await authService.updateUser(
        userId,
        {
          first_name: 'Updated',
          last_name: 'Name',
        },
        adminId
      );

      expect(updated.firstName).toBe('Updated');
      expect(updated.lastName).toBe('Name');
    });

    it('should update user role', async () => {
      const updated = await authService.updateUser(
        userId,
        {
          role: UserRole.TEACHER,
        },
        adminId
      );

      expect(updated.role).toBe(UserRole.TEACHER);
    });
  });

  describe('deactivateUser', () => {
    let userId: string;
    let adminId: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: `deactivate-${Date.now()}@example.com`,
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: UserRole.STUDENT,
      });
      userId = result.user.id;

      const adminResult = await authService.register({
        email: `admin3-${Date.now()}@example.com`,
        password: 'SecurePass123!',
        first_name: 'Admin',
        last_name: 'User',
        role: UserRole.ADMIN,
      });
      adminId = adminResult.user.id;
    });

    it('should deactivate user', async () => {
      await authService.deactivateUser(userId, adminId);

      const user = await authService.getUserById(userId);
      expect(user.status).toBe(UserStatus.INACTIVE);
    });

    it('should delete refresh tokens on deactivation', async () => {
      // Refresh token is created during login
      const loginResult = await authService.login(
        `deactivate-${Date.now()}@example.com`,
        'SecurePass123!'
      );

      await authService.deactivateUser(userId, adminId);

      const tokens = await db('refresh_tokens').where({ user_id: userId });
      expect(tokens.length).toBe(0);
    });
  });

  describe('listUsers', () => {
    it('should list all users', async () => {
      const result = await authService.listUsers({});

      expect(result.users).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it('should filter by role', async () => {
      const result = await authService.listUsers({ role: UserRole.ADMIN });

      if (result.users.length > 0) {
        expect(result.users.every((u: any) => u.role === UserRole.ADMIN)).toBe(true);
      }
    });

    it('should support pagination', async () => {
      const result = await authService.listUsers({ limit: 1, offset: 0 });

      expect(result.users.length).toBeLessThanOrEqual(1);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });
  });
});
