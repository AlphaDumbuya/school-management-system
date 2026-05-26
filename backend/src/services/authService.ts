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
  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    role: UserRole
  ): Promise<UserResponse> {
    try {
      // Check if user already exists
      const existingUser = await this.db('users').where({ email }).first();
      if (existingUser) {
        throw new AppError('User with this email already exists', 409, 'USER_EXISTS');
      }

      // Validate password policy
      const passwordValidation = PasswordService.validatePasswordPolicy(password);
      if (!passwordValidation.valid) {
        throw new AppError(passwordValidation.errors.join(', '), 400, 'INVALID_PASSWORD');
      }

      // Hash password
      const hashedPassword = await PasswordService.hashPassword(password);

      // Create user
      const [userId] = await this.db('users').insert({
        email,
        password_hash: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        role,
        status: UserStatus.ACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
      });

      logger.info(`User registered: ${email} with role ${role}`);

      // Fetch and return user
      return this.getUserById(userId);
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
  async login(email: string, password: string): Promise<AuthResponse> {
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
        last_login_at: new Date(),
        updated_at: new Date(),
      });

      logger.info(`User logged in: ${email}`);

      return {
        accessToken,
        refreshToken,
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
  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
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

      return { accessToken };
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
  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      // Delete refresh token
      await this.db('refresh_tokens').where({
        user_id: userId,
        token: refreshToken,
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
}
