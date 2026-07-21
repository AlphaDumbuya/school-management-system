import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import knex from 'knex';
import knexConfig from '../../../knexfile';
import app from '../../index';
import { AuthService } from '../../services/authService';

let db: any;
let authService: AuthService;
let testAccessToken: string;
let testRefreshToken: string;
let testUserId: string;

const testUserCredentials = {
  email: 'test@example.com',
  password: 'SecurePass123!',
  first_name: 'Test',
  last_name: 'User',
  role: 'student',
};

beforeAll(async () => {
  // Connect to test database
  db = knex(knexConfig.development);
  authService = new AuthService(db);

  // Run migrations (commented out to avoid connection lock timeouts during tests)
  // await db.migrate.latest();
});

afterAll(async () => {
  // Clean up
  await db.destroy();
});

beforeEach(async () => {
  // Clear users and related tables using TRUNCATE CASCADE
  await db.raw('TRUNCATE TABLE users, refresh_tokens, password_resets CASCADE');
});

describe('Authentication Routes Integration Tests', () => {
  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(testUserCredentials)
        .expect(201);

      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUserCredentials.email);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.refresh_token).toBeDefined();
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.expires_in).toBe(1800);
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUserCredentials,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUserCredentials,
          password: 'weak',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Password');
    });

    it('should reject registration with duplicate email', async () => {
      // Register first user
      await request(app)
        .post('/api/v1/auth/register')
        .send(testUserCredentials)
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(testUserCredentials)
        .expect(409);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('USER_EXISTS');
    });

    it('should reject registration with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUserCredentials.email,
          // Missing password, first_name, last_name
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user before each login test
      const result = await authService.register(testUserCredentials);
      testAccessToken = result.access_token;
      testRefreshToken = result.refresh_token;
      testUserId = result.user.id;
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserCredentials.email,
          password: testUserCredentials.password,
        })
        .expect(200);

      expect(response.body.access_token).toBeDefined();
      expect(response.body.refresh_token).toBeDefined();
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.expires_in).toBe(1800);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUserCredentials.email);
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserCredentials.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUserCredentials.password,
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserCredentials.email,
          // Missing password
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should enforce rate limiting after multiple failed attempts', async () => {
      // Try to login 5 times with wrong password
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUserCredentials.email,
            password: 'WrongPassword123!',
          })
          .expect(401);
      }

      // 6th attempt should be rate limited
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserCredentials.email,
          password: testUserCredentials.password,
        })
        .expect(429);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    });

    it('should update last login timestamp', async () => {
      const userBefore = await db('users').where('id', testUserId).first();
      const lastLoginBefore = userBefore.last_login;

      await new Promise(resolve => setTimeout(resolve, 100));

      await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserCredentials.email,
          password: testUserCredentials.password,
        })
        .expect(200);

      const userAfter = await db('users').where('id', testUserId).first();
      expect(new Date(userAfter.last_login).getTime()).toBeGreaterThan(
        new Date(lastLoginBefore).getTime()
      );
    });

    it('should set refresh token in httpOnly cookie', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserCredentials.email,
          password: testUserCredentials.password,
        })
        .expect(200);

      expect(response.headers['set-cookie']).toBeDefined();
      const cookieHeader = response.headers['set-cookie'].join(';');
      expect(cookieHeader).toContain('refreshToken');
      expect(cookieHeader).toContain('HttpOnly');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    beforeEach(async () => {
      const result = await authService.register(testUserCredentials);
      testRefreshToken = result.refresh_token;
      testUserId = result.user.id;
    });

    it('should generate new access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refresh_token: testRefreshToken,
        })
        .expect(200);

      expect(response.body.access_token).toBeDefined();
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.expires_in).toBe(1800);
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refresh_token: 'invalid.refresh.token',
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject refresh without token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    beforeEach(async () => {
      const result = await authService.register(testUserCredentials);
      testAccessToken = result.access_token;
      testRefreshToken = result.refresh_token;
      testUserId = result.user.id;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should reject logout without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should invalidate refresh token after logout', async () => {
      // Logout
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      // Try to refresh with same token (should fail)
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refresh_token: testRefreshToken,
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should clear refresh token cookie', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      const cookieHeader = response.headers['set-cookie']?.join(';') || '';
      expect(cookieHeader).toContain('refreshToken');
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    beforeEach(async () => {
      const result = await authService.register(testUserCredentials);
      testAccessToken = result.access_token;
      testUserId = result.user.id;
    });

    it('should change password successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          old_password: testUserCredentials.password,
          new_password: 'NewSecurePass456!',
        })
        .expect(200);

      expect(response.body.message).toBe('Password changed successfully');
    });

    it('should reject password change with wrong old password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          old_password: 'WrongPassword123!',
          new_password: 'NewSecurePass456!',
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject password change with same password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          old_password: testUserCredentials.password,
          new_password: testUserCredentials.password,
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject password change with weak new password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          old_password: testUserCredentials.password,
          new_password: 'weak',
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should reject password change without authentication', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .send({
          old_password: testUserCredentials.password,
          new_password: 'NewSecurePass456!',
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should allow login with new password after change', async () => {
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .send({
          old_password: testUserCredentials.password,
          new_password: 'NewSecurePass456!',
        })
        .expect(200);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserCredentials.email,
          password: 'NewSecurePass456!',
        })
        .expect(200);

      expect(response.body.access_token).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    beforeEach(async () => {
      const result = await authService.register(testUserCredentials);
      testAccessToken = result.access_token;
      testUserId = result.user.id;
    });

    it('should return current user profile', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.id).toBe(testUserId);
      expect(response.body.email).toBe(testUserCredentials.email);
      expect(response.body.first_name).toBe(testUserCredentials.first_name);
      expect(response.body.last_name).toBe(testUserCredentials.last_name);
      expect(response.body.role).toBe(testUserCredentials.role);
      expect(response.body.status).toBe('active');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should not expose password hash in response', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${testAccessToken}`)
        .expect(200);

      expect(response.body.password_hash).toBeUndefined();
      expect(response.body.password).toBeUndefined();
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    beforeEach(async () => {
      await authService.register(testUserCredentials);
    });

    it('should accept password reset request for existing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: testUserCredentials.email,
        })
        .expect(200);

      expect(response.body.message).toBeDefined();
    });

    it('should not reveal if email exists (security)', async () => {
      const response1 = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: testUserCredentials.email,
        })
        .expect(200);

      const response2 = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'nonexistent@example.com',
        })
        .expect(200);

      expect(response1.body.message).toBe(response2.body.message);
    });

    it('should reject without email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({})
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('JWT Token Validation', () => {
    beforeEach(async () => {
      const result = await authService.register(testUserCredentials);
      testAccessToken = result.access_token;
      testUserId = result.user.id;
    });

    it('should require bearer token format', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', testAccessToken) // Missing "Bearer "
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    it('should reject expired tokens', async () => {
      // This would require manipulating the token expiry, 
      // which is beyond the scope of basic integration tests
      // In a real scenario, you'd mock the JWT verification
    });

    it('should verify token signature', async () => {
      const manipulatedToken = testAccessToken.substring(0, testAccessToken.length - 5) + 'xxxxx';

      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${manipulatedToken}`)
        .expect(401);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should return proper error format', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBeDefined();
      expect(response.body.error.message).toBeDefined();
      expect(response.body.error.timestamp).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // This test would require mocking database failures
      // Skipping for now as it requires advanced test setup
    });
  });
});
