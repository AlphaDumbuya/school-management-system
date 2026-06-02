import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AuthService } from '../authService';
import { PasswordService } from '../passwordService';
import knex from 'knex';
import knexConfig from '../../../../knexfile';

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
        role: 'student',
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
        role: 'student',
      });

      expect(
        authService.register({
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
          first_name: 'Test',
          last_name: 'User',
          role: 'student',
        })
      ).rejects.toThrow('Email already exists');
    });

    it('should hash password correctly', async () => {
      const result = await authService.register({
        email: 'hash-test@example.com',
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: 'student',
      });

      const user = await db('users').where('id', result.user.id).first();
      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe('SecurePass123!');
    });
  });

  describe('login', () => {
    beforeAll(async () => {
      // Create test user
      await authService.register({
        email: 'login@example.com',
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: 'student',
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
      ).rejects.toThrow('Invalid credentials');
    });

    it('should fail with non-existent email', async () => {
      expect(
        authService.login('nonexistent@example.com', 'SecurePass123!')
      ).rejects.toThrow('Invalid credentials');
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

    beforeAll(async () => {
      const result = await authService.register({
        email: 'refresh@example.com',
        password: 'SecurePass123!',
        first_name: 'Test',
        last_name: 'User',
        role: 'student',
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
});
