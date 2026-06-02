import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '@services/authService';
import { PasswordService } from '@services/passwordService';
import { AppError } from '@middleware/errorHandler';
import { authenticate } from '@middleware/authMiddleware';
import { logger } from '@utils/logger';
import knex from 'knex';
import knexConfig from '../../../knexfile';

const router = Router();
const db = knex(knexConfig.development);
const authService = new AuthService(db);

/**
 * POST /api/v1/auth/register
 * Register a new user (admin creates initial admin user)
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, first_name, last_name, role } = req.body;

    // Validate input
    if (!email || !password || !first_name || !last_name) {
      throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
    }

    // Validate password policy
    const passwordValidation = PasswordService.validatePasswordPolicy(password);
    if (!passwordValidation.valid) {
      throw new AppError(
        `Password does not meet requirements: ${passwordValidation.errors.join(', ')}`,
        400,
        'VALIDATION_ERROR'
      );
    }

    // Register user
    const result = await authService.register({
      email,
      password,
      first_name,
      last_name,
      role: role || 'student',
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: 1800, // 30 minutes
      token_type: 'Bearer',
    });

    logger.info(`User registered: ${email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticate user with email and password
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
    }

    // Authenticate
    const result = await authService.login(email, password);

    // Set secure cookie for refresh token (optional)
    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: 1800, // 30 minutes
      token_type: 'Bearer',
      user: result.user,
    });

    logger.info(`User logged in: ${email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw new AppError('Refresh token is required', 400, 'VALIDATION_ERROR');
    }

    const result = await authService.refreshToken(refresh_token);

    res.json({
      access_token: result.access_token,
      expires_in: 1800,
      token_type: 'Bearer',
    });

    logger.info('Token refreshed');
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout user (invalidate tokens if needed)
 */
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // In a production app, you might invalidate the refresh token in the database
    // For now, we just clear the cookie

    res.clearCookie('refreshToken');
    res.json({
      message: 'Logged out successfully',
    });

    logger.info(`User logged out: ${(req as any).user.email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/change-password
 * Change user password (requires old password)
 */
router.post(
  '/change-password',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { old_password, new_password } = req.body;
      const userId = (req as any).user.id;

      if (!old_password || !new_password) {
        throw new AppError('Old and new password are required', 400, 'VALIDATION_ERROR');
      }

      if (old_password === new_password) {
        throw new AppError('New password must be different from old password', 400, 'VALIDATION_ERROR');
      }

      // Validate new password policy
      const passwordValidation = PasswordService.validatePasswordPolicy(new_password);
      if (!passwordValidation.valid) {
        throw new AppError(
          `Password does not meet requirements: ${passwordValidation.errors.join(', ')}`,
          400,
          'VALIDATION_ERROR'
        );
      }

      // Get user from database
      const user = await db('users').where('id', userId).first();
      if (!user) {
        throw new AppError('User not found', 404, 'NOT_FOUND');
      }

      // Verify old password
      const isPasswordValid = await PasswordService.comparePassword(old_password, user.password_hash);
      if (!isPasswordValid) {
        throw new AppError('Incorrect old password', 401, 'AUTHENTICATION_ERROR');
      }

      // Hash new password
      const newPasswordHash = await PasswordService.hashPassword(new_password);

      // Update password
      await db('users').where('id', userId).update({
        password_hash: newPasswordHash,
        updated_at: new Date(),
      });

      res.json({
        message: 'Password changed successfully',
      });

      logger.info(`Password changed for user: ${user.email}`);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/auth/reset-password
 * Request password reset (sends email with reset token)
 */
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw new AppError('Email is required', 400, 'VALIDATION_ERROR');
    }

    // Check if user exists
    const user = await db('users').where('email', email).first();
    if (!user) {
      // Don't reveal if email exists (security best practice)
      res.json({
        message: 'If an account exists for this email, a password reset link has been sent',
      });
      return;
    }

    // TODO: Generate reset token and send email
    // For now, just acknowledge the request
    res.json({
      message: 'If an account exists for this email, a password reset link has been sent',
    });

    logger.info(`Password reset requested for: ${email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user profile
 */
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.id;

    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'status', 'last_login', 'created_at')
      .where('id', userId)
      .first();

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
});

export default router;
