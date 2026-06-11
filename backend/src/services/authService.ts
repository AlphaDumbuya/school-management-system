import { Knex } from 'knex';
import { JWTService } from './jwtService';
import { PasswordService } from './passwordService';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { AuthResponse, UserResponse, UserRole, UserStatus } from '../types/auth';

export class AuthService {
  constructor(private db: Knex) {}

  /**
   * Register new user
   */
  async register(payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: UserRole;
  }): Promise<{ user: UserResponse; access_token: string; refresh_token: string }> {
    try {
      // Check if user already exists
      const existingUser = await this.db('users').where({ email: payload.email }).first();
      if (existingUser) {
        throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
      }

      // Validate password policy
      const passwordValidation = PasswordService.validatePasswordPolicy(payload.password);
      if (!passwordValidation.valid) {
        throw new AppError(passwordValidation.errors.join(', '), 400, 'INVALID_PASSWORD');
      }

      // Hash password
      const hashedPassword = await PasswordService.hashPassword(payload.password);

      // Create user
      const [userId] = await this.db('users').insert({
        email: payload.email,
        password_hash: hashedPassword,
        first_name: payload.first_name,
        last_name: payload.last_name,
        role: payload.role,
        status: UserStatus.ACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
      });

      logger.info(`User registered: ${payload.email} with role ${payload.role}`);

      // Generate tokens
      const user = await this.getUserById(userId);
      const access_token = JWTService.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const refresh_token = JWTService.generateRefreshToken(user.id);

      // Store refresh token
      await this.db('refresh_tokens').insert({
        user_id: user.id,
        token: refresh_token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        created_at: new Date(),
      });

      return {
        user: this.mapUserToResponse(user),
        access_token,
        refresh_token,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error registering user', error);
      throw new AppError('Failed to register user', 500, 'REGISTRATION_FAILED');
    }
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<{ access_token: string; refresh_token: string; user: UserResponse }> {
    try {
      // Find user by email
      const user = await this.db('users').where({ email }).first();
      if (!user) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Check user status
      if (user.status !== UserStatus.ACTIVE) {
        throw new AppError(`User account is ${user.status}`, 403, 'ACCOUNT_INACTIVE');
      }

      // Verify password
      const isPasswordValid = await PasswordService.comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // Generate tokens
      const accessToken = JWTService.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const refreshToken = JWTService.generateRefreshToken(user.id);

      // Store refresh token
      await this.db('refresh_tokens').insert({
        user_id: user.id,
        token: refreshToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        created_at: new Date(),
      });

      // Update last login
      await this.db('users').where({ id: user.id }).update({
        last_login: new Date(),
        updated_at: new Date(),
      });

      logger.info(`User logged in: ${email}`);

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: this.mapUserToResponse(user),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error logging in user', error);
      throw new AppError('Login failed', 500, 'LOGIN_FAILED');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    try {
      // Verify refresh token
      const decoded = JWTService.verifyRefreshToken(refreshToken);

      // Check if refresh token exists in database
      const storedToken = await this.db('refresh_tokens')
        .where({
          user_id: decoded.userId,
          token: refreshToken,
        })
        .first();

      if (!storedToken) {
        throw new AppError('Refresh token not found', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Check if token is expired
      if (new Date(storedToken.expires_at) < new Date()) {
        throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
      }

      // Get user
      const user = await this.getUserById(decoded.userId);

      // Generate new access token
      const accessToken = JWTService.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      logger.info(`Access token refreshed for user: ${user.email}`);

      return { access_token: accessToken };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error refreshing token', error);
      throw new AppError('Failed to refresh token', 500, 'REFRESH_FAILED');
    }
  }

  /**
   * Logout user
   */
  async logout(userId: string): Promise<void> {
    try {
      // Delete all refresh tokens for this user
      await this.db('refresh_tokens').where({
        user_id: userId,
      }).del();

      logger.info(`User logged out: ${userId}`);
    } catch (error) {
      logger.error('Error logging out user', error);
      throw new AppError('Logout failed', 500, 'LOGOUT_FAILED');
    }
  }

  /**
   * Change password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    try {
      // Get user
      const user = await this.getUserById(userId);

      // Verify old password
      const isPasswordValid = await PasswordService.comparePassword(oldPassword, user.password_hash);
      if (!isPasswordValid) {
        throw new AppError('Current password is incorrect', 401, 'INVALID_PASSWORD');
      }

      // Validate new password policy
      const passwordValidation = PasswordService.validatePasswordPolicy(newPassword);
      if (!passwordValidation.valid) {
        throw new AppError(passwordValidation.errors.join(', '), 400, 'INVALID_PASSWORD');
      }

      // Hash new password
      const hashedPassword = await PasswordService.hashPassword(newPassword);

      // Update password
      await this.db('users').where({ id: userId }).update({
        password_hash: hashedPassword,
        updated_at: new Date(),
      });

      logger.info(`Password changed for user: ${userId}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error changing password', error);
      throw new AppError('Failed to change password', 500, 'PASSWORD_CHANGE_FAILED');
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<string> {
    try {
      // Find user by email
      const user = await this.db('users').where({ email }).first();
      if (!user) {
        // Don't reveal if user exists
        logger.info(`Password reset requested for non-existent email: ${email}`);
        return 'If an account exists with this email, a password reset link will be sent';
      }

      // Generate reset token
      const resetToken = PasswordService.generatePasswordResetToken();
      const resetTokenHash = await PasswordService.hashPassword(resetToken);

      // Store reset token
      await this.db('password_resets').insert({
        user_id: user.id,
        token_hash: resetTokenHash,
        expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        created_at: new Date(),
      });

      logger.info(`Password reset requested for user: ${email}`);

      // Return token (in production, this would be sent via email)
      return resetToken;
    } catch (error) {
      logger.error('Error requesting password reset', error);
      throw new AppError('Failed to request password reset', 500, 'PASSWORD_RESET_FAILED');
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(resetToken: string, newPassword: string): Promise<void> {
    try {
      // Validate new password policy
      const passwordValidation = PasswordService.validatePasswordPolicy(newPassword);
      if (!passwordValidation.valid) {
        throw new AppError(passwordValidation.errors.join(', '), 400, 'INVALID_PASSWORD');
      }

      // Find valid reset token
      const resetRecords = await this.db('password_resets')
        .where('expires_at', '>', new Date())
        .select();

      let validReset = null;
      for (const record of resetRecords) {
        const isValid = await PasswordService.comparePassword(resetToken, record.token_hash);
        if (isValid) {
          validReset = record;
          break;
        }
      }

      if (!validReset) {
        throw new AppError('Invalid or expired reset token', 400, 'INVALID_RESET_TOKEN');
      }

      // Hash new password
      const hashedPassword = await PasswordService.hashPassword(newPassword);

      // Update password
      await this.db('users').where({ id: validReset.user_id }).update({
        password_hash: hashedPassword,
        updated_at: new Date(),
      });

      // Delete reset token
      await this.db('password_resets').where({ id: validReset.id }).del();

      logger.info(`Password reset for user: ${validReset.user_id}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error resetting password', error);
      throw new AppError('Failed to reset password', 500, 'PASSWORD_RESET_FAILED');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<any> {
    try {
      const user = await this.db('users').where({ id: userId }).first();
      if (!user) {
        throw new AppError('User not found', 404, 'USER_NOT_FOUND');
      }
      return user;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error fetching user', error);
      throw new AppError('Failed to fetch user', 500, 'FETCH_USER_FAILED');
    }
  }

  /**
   * Map user to response format
   */
  private mapUserToResponse(user: any): UserResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
    };
  }

  /**
   * Create user (admin function)
   */
  async createUser(payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: UserRole;
    createdBy: string;
  }): Promise<UserResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.db('users').where({ email: payload.email }).first();
      if (existingUser) {
        throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
      }

      // Validate password policy
      const passwordValidation = PasswordService.validatePasswordPolicy(payload.password);
      if (!passwordValidation.valid) {
        throw new AppError(passwordValidation.errors.join(', '), 400, 'INVALID_PASSWORD');
      }

      // Hash password
      const hashedPassword = await PasswordService.hashPassword(payload.password);

      // Create user
      const [userId] = await this.db('users').insert({
        email: payload.email,
        password_hash: hashedPassword,
        first_name: payload.first_name,
        last_name: payload.last_name,
        role: payload.role,
        status: UserStatus.ACTIVE,
        created_by: payload.createdBy,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Log audit
      await this.logAudit({
        userId: payload.createdBy,
        action: 'CREATE_USER',
        entityType: 'users',
        entityId: userId,
        changes: { email: payload.email, role: payload.role },
      });

      logger.info(`User created: ${payload.email} with role ${payload.role}`);

      const user = await this.getUserById(userId);
      return this.mapUserToResponse(user);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error creating user', error);
      throw new AppError('Failed to create user', 500, 'USER_CREATION_FAILED');
    }
  }

  /**
   * Update user profile
   */
  async updateUser(
    userId: string,
    payload: {
      first_name?: string;
      last_name?: string;
      email?: string;
      role?: UserRole;
      status?: UserStatus;
    },
    updatedBy: string
  ): Promise<UserResponse> {
    try {
      const user = await this.getUserById(userId);

      // Check if email is being changed to an existing email
      if (payload.email && payload.email !== user.email) {
        const existingUser = await this.db('users').where({ email: payload.email }).first();
        if (existingUser) {
          throw new AppError('Email is already in use', 409, 'EMAIL_IN_USE');
        }
      }

      const updates: any = {};
      const changes: any = {};

      if (payload.first_name !== undefined) {
        updates.first_name = payload.first_name;
        changes.first_name = [user.first_name, payload.first_name];
      }
      if (payload.last_name !== undefined) {
        updates.last_name = payload.last_name;
        changes.last_name = [user.last_name, payload.last_name];
      }
      if (payload.email !== undefined) {
        updates.email = payload.email;
        changes.email = [user.email, payload.email];
      }
      if (payload.role !== undefined) {
        updates.role = payload.role;
        changes.role = [user.role, payload.role];
      }
      if (payload.status !== undefined) {
        updates.status = payload.status;
        changes.status = [user.status, payload.status];
      }

      updates.updated_at = new Date();
      updates.updated_by = updatedBy;

      await this.db('users').where({ id: userId }).update(updates);

      // Log audit
      await this.logAudit({
        userId: updatedBy,
        action: 'UPDATE_USER',
        entityType: 'users',
        entityId: userId,
        changes,
      });

      logger.info(`User updated: ${userId}`);

      const updatedUser = await this.getUserById(userId);
      return this.mapUserToResponse(updatedUser);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error updating user', error);
      throw new AppError('Failed to update user', 500, 'USER_UPDATE_FAILED');
    }
  }

  /**
   * Deactivate user (soft delete)
   */
  async deactivateUser(userId: string, deactivatedBy: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);

      if (user.status === UserStatus.INACTIVE) {
        throw new AppError('User is already inactive', 400, 'USER_ALREADY_INACTIVE');
      }

      await this.db('users').where({ id: userId }).update({
        status: UserStatus.INACTIVE,
        updated_at: new Date(),
        updated_by: deactivatedBy,
      });

      // Log audit
      await this.logAudit({
        userId: deactivatedBy,
        action: 'DEACTIVATE_USER',
        entityType: 'users',
        entityId: userId,
        changes: { status: [user.status, UserStatus.INACTIVE] },
      });

      // Delete refresh tokens
      await this.db('refresh_tokens').where({ user_id: userId }).del();

      logger.info(`User deactivated: ${userId}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error deactivating user', error);
      throw new AppError('Failed to deactivate user', 500, 'USER_DEACTIVATION_FAILED');
    }
  }

  /**
   * Reactivate user
   */
  async reactivateUser(userId: string, reactivatedBy: string): Promise<void> {
    try {
      const user = await this.getUserById(userId);

      if (user.status === UserStatus.ACTIVE) {
        throw new AppError('User is already active', 400, 'USER_ALREADY_ACTIVE');
      }

      await this.db('users').where({ id: userId }).update({
        status: UserStatus.ACTIVE,
        updated_at: new Date(),
        updated_by: reactivatedBy,
      });

      // Log audit
      await this.logAudit({
        userId: reactivatedBy,
        action: 'REACTIVATE_USER',
        entityType: 'users',
        entityId: userId,
        changes: { status: [user.status, UserStatus.ACTIVE] },
      });

      logger.info(`User reactivated: ${userId}`);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error reactivating user', error);
      throw new AppError('Failed to reactivate user', 500, 'USER_REACTIVATION_FAILED');
    }
  }

  /**
   * List users with filtering
   */
  async listUsers(options: {
    role?: UserRole;
    status?: UserStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ users: UserResponse[]; total: number }> {
    try {
      let query = this.db('users');

      if (options.role) {
        query = query.where('role', options.role);
      }

      if (options.status) {
        query = query.where('status', options.status);
      }

      const total = await query.clone().count('* as count').first();
      const users = await query
        .orderBy('created_at', 'desc')
        .limit(options.limit || 50)
        .offset(options.offset || 0);

      return {
        users: users.map((u) => this.mapUserToResponse(u)),
        total: total?.count || 0,
      };
    } catch (error) {
      logger.error('Error listing users', error);
      throw new AppError('Failed to list users', 500, 'USER_LIST_FAILED');
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserResponse | null> {
    try {
      const user = await this.db('users').where({ email }).first();
      if (!user) {
        return null;
      }
      return this.mapUserToResponse(user);
    } catch (error) {
      logger.error('Error fetching user by email', error);
      throw new AppError('Failed to fetch user', 500, 'FETCH_USER_FAILED');
    }
  }

  /**
   * Log audit event
   */
  private async logAudit(payload: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    changes?: any;
  }): Promise<void> {
    try {
      await this.db('audit_logs').insert({
        user_id: payload.userId,
        action: payload.action,
        entity_type: payload.entityType,
        entity_id: payload.entityId,
        changes: payload.changes ? JSON.stringify(payload.changes) : null,
        created_at: new Date(),
      });
    } catch (error) {
      logger.warn('Failed to log audit event', error);
    }
  }
}
