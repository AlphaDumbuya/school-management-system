import { db } from '../utils/database.js';
import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '@services/authService';
import { PasswordService } from '@services/passwordService';
import { AppError } from '@middleware/errorHandler';
import { authenticate, authorize, rateLimitLogin, clearLoginAttempts } from '@middleware/authMiddleware';
import { logger } from '@utils/logger';
import { UserRole, UserStatus } from '@types/auth';
import emailService from '@services/emailService';

const router = Router();
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
      role: role || UserRole.STUDENT,
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
 * POST /api/v1/auth/register-school
 * Self-service registration for new schools/tenants
 */
router.post('/register-school', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      school_name,
      contact_email,
      contact_phone,
      country,
      city,
      address,
      school_type,
      school_motto,
      id_student_prefix,
      id_staff_prefix,
      id_admission_prefix,
      id_student_start_from,
      admin_first_name,
      admin_last_name,
      password,
    } = req.body;

    if (!school_name || !contact_email || !admin_first_name || !admin_last_name || !password) {
      throw new AppError('School name, contact email, admin name, and password are required', 400, 'VALIDATION_ERROR');
    }

    const result = await authService.registerSchool({
      school_name,
      contact_email,
      contact_phone,
      country,
      city,
      address,
      school_type,
      school_motto,
      id_student_prefix,
      id_staff_prefix,
      id_admission_prefix,
      id_student_start_from: id_student_start_from ? Number(id_student_start_from) : undefined,
      admin_first_name,
      admin_last_name,
      password,
    });

    res.status(201).json({
      success: true,
      message: 'School registered successfully! Welcome to WiSkul.',
      data: {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        expiresIn: 1800,
        tokenType: 'Bearer',
        user: result.user,
        tenant: result.tenant,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticate user with email and password
 */
router.post('/login', rateLimitLogin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'VALIDATION_ERROR');
    }

    // Authenticate
    const result = await authService.login(email, password);

    // Clear login attempts on successful login (password was valid)
    clearLoginAttempts(email);

    // If 2FA is required, respond with the challenge — no tokens issued yet.
    if ('mfa_required' in result) {
      res.json({
        success: true,
        data: {
          mfaRequired: true,
          mfaToken: result.mfa_token,
        },
      });
      return;
    }

    // Set secure cookie for refresh token (optional)
    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      data: {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        expiresIn: 1800, // 30 minutes
        tokenType: 'Bearer',
        user: result.user,
      },
    });

    logger.info(`User logged in: ${email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/verify-login
 * Complete a 2FA login by exchanging the mfa_token + code for real tokens.
 */
router.post('/2fa/verify-login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mfa_token, code } = req.body;
    if (!mfa_token || !code) {
      throw new AppError('Verification code is required', 400, 'VALIDATION_ERROR');
    }
    const result = await authService.completeMfaLogin(mfa_token, code);

    res.cookie('refreshToken', result.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
        expiresIn: 1800,
        tokenType: 'Bearer',
        user: result.user,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/setup   (authenticated)
 * Begin 2FA setup — returns the secret + otpauth URI for a QR code.
 */
router.post('/2fa/setup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).auth.userId;
    const { default: twoFactorService } = await import('@services/twoFactorService');
    const result = await twoFactorService.setup(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/enable   (authenticated)
 * Verify the first code and enable 2FA. Returns one-time backup codes.
 */
router.post('/2fa/enable', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).auth.userId;
    const { code } = req.body;
    if (!code) throw new AppError('Verification code is required', 400, 'VALIDATION_ERROR');
    const { default: twoFactorService } = await import('@services/twoFactorService');
    const result = await twoFactorService.enable(userId, code);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/disable   (authenticated)
 */
router.post('/2fa/disable', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).auth.userId;
    const { code } = req.body;
    if (!code) throw new AppError('Verification code is required', 400, 'VALIDATION_ERROR');
    const { default: twoFactorService } = await import('@services/twoFactorService');
    await twoFactorService.disable(userId, code);
    res.json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/2fa/backup-codes   (authenticated)
 * Regenerate backup codes (requires a valid current code).
 */
router.post('/2fa/backup-codes', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).auth.userId;
    const { code } = req.body;
    if (!code) throw new AppError('Verification code is required', 400, 'VALIDATION_ERROR');
    const { default: twoFactorService } = await import('@services/twoFactorService');
    const backupCodes = await twoFactorService.regenerateBackupCodes(userId, code);
    res.json({ success: true, data: { backupCodes } });
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
    const userId = (req as any).auth.userId;

    // Delete refresh tokens
    await authService.logout(userId);

    res.clearCookie('refreshToken');
    res.json({
      message: 'Logged out successfully',
    });

    logger.info(`User logged out: ${userId}`);
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
      const userId = (req as any).auth.userId;

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

      // Change password through auth service
      await authService.changePassword(userId, old_password, new_password);

      res.json({
        success: true,
        message: 'Password changed successfully',
      });

      logger.info(`Password changed for user: ${userId}`);
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

    // Request password reset
    const resetToken = await authService.requestPasswordReset(email);

    // Send the reset email if a real token was issued (i.e. the account exists).
    // requestPasswordReset returns a friendly message string when no user is
    // found, so we look up the user to decide whether to send + personalise.
    try {
      const user = await db('users').where({ email }).first();
      if (user && resetToken && !resetToken.startsWith('If an account')) {
        const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'there';
        await emailService.sendPasswordResetEmail(email, name, resetToken);
      }
    } catch (mailErr: any) {
      // Never fail the request because email delivery hiccuped.
      logger.warn(`Could not send password reset email to ${email}: ${mailErr?.message || mailErr}`);
    }

    // Always return a neutral response so we don't reveal whether the account exists.
    // In non-production we also echo the token to aid local testing.
    if (process.env.NODE_ENV !== 'production') {
      res.json({
        message: 'If an account exists for this email, a password reset link has been sent',
        reset_token: resetToken, // Only for development
      });
    } else {
      res.json({
        message: 'If an account exists for this email, a password reset link has been sent',
      });
    }

    logger.info(`Password reset requested for: ${email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/reset-password/confirm
 * Confirm password reset with token
 */
router.post('/reset-password/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reset_token, new_password } = req.body;

    if (!reset_token || !new_password) {
      throw new AppError('Reset token and new password are required', 400, 'VALIDATION_ERROR');
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

    // Reset password
    await authService.resetPassword(reset_token, new_password);

    res.json({
      message: 'Password reset successfully',
    });

    logger.info('Password reset completed');
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
    const userId = (req as any).auth.userId;

    const user = await db('users')
      .select('id', 'email', 'first_name', 'last_name', 'role', 'status', 'tenant_id', 'last_login', 'created_at')
      .where('id', userId)
      .first();

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    let schoolLogoUrl = null;
    let schoolName = null;
    if (user.tenant_id) {
      try {
        // 1. Try schools table
        const school = await db('schools').where('tenant_id', user.tenant_id).first();
        if (school) {
          schoolLogoUrl = school.logo_url;
          schoolName = school.name;
        }

        // 2. Try school_info table
        if (!schoolName) {
          const hasSchoolInfo = await db.schema.hasTable('school_info');
          if (hasSchoolInfo) {
            const schoolInfo = await db('school_info').where('tenant_id', user.tenant_id).first();
            if (schoolInfo && schoolInfo.name) {
              schoolName = schoolInfo.name;
              schoolLogoUrl = schoolLogoUrl || schoolInfo.logo_url || null;
            }
          }
        }

        // 3. Try tenants table
        if (!schoolName) {
          const tenant = await db('tenants').where('id', user.tenant_id).first();
          if (tenant && tenant.name) {
            schoolName = tenant.name;
          }
        }

        // 4. Try school_config_settings table
        if (!schoolName) {
          const hasSettings = await db.schema.hasTable('school_config_settings');
          if (hasSettings) {
            const setting = await db('school_config_settings')
              .where({ tenant_id: user.tenant_id, key: 'school_name' })
              .first();
            if (setting && setting.value) {
              schoolName = setting.value;
            }
          }
        }
      } catch (_) {}
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      status: user.status,
      tenantId: user.tenant_id,
      schoolLogoUrl,
      schoolName,
      lastLogin: user.last_login,
      createdAt: user.created_at,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/users
 * Create a new user (principal only)
 */
router.post('/users', authenticate, authorize(UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, first_name, last_name, role } = req.body;
    const createdBy = (req as any).auth.userId;

    // Validate input
    if (!email || !password || !first_name || !last_name || !role) {
      throw new AppError('Missing required fields: email, password, first_name, last_name, role', 400, 'VALIDATION_ERROR');
    }

    // Validate role
    if (!Object.values(UserRole).includes(role)) {
      throw new AppError(`Invalid role: ${role}`, 400, 'INVALID_ROLE');
    }

    // Create user
    const user = await authService.createUser({
      email,
      password,
      first_name,
      last_name,
      role,
      createdBy,
    });

    res.status(201).json({
      message: 'User created successfully',
      user,
    });

    logger.info(`User created: ${email}`);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users
 * List all users (principal only)
 */
router.get('/users', authenticate, authorize(UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, status, limit = 50, offset = 0 } = req.query;

    const options: any = {
      limit: Math.min(parseInt(limit as string) || 50, 100),
      offset: parseInt(offset as string) || 0,
    };

    if (role && Object.values(UserRole).includes(role as UserRole)) {
      options.role = role;
    }

    if (status && Object.values(UserStatus).includes(status as UserStatus)) {
      options.status = status;
    }

    const result = await authService.listUsers(options);

    res.json({
      users: result.users,
      total: result.total,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/:id
 * Get user by ID (admin or user themselves)
 */
router.get('/users/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const currentUserId = (req as any).auth.userId;
    const currentUserRole = (req as any).auth.role;

    // Allow users to view their own profile, or principals to view anyone
    if (id !== currentUserId && currentUserRole !== UserRole.PRINCIPAL) {
      throw new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    const user = await authService.getUserById(id);

    res.json(user);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/users/:id
 * Update user (admin or user themselves)
 */
router.put('/users/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, role, status } = req.body;
    const currentUserId = (req as any).auth.userId;
    const currentUserRole = (req as any).auth.role;

    // Allow users to update their own profile (except role and status), or principals to update anyone
    if (id !== currentUserId && currentUserRole !== UserRole.PRINCIPAL) {
      throw new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    // Non-principals cannot change role or status
    if (currentUserRole !== UserRole.PRINCIPAL && (role !== undefined || status !== undefined)) {
      throw new AppError('Only principals can modify role or status', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    const updatePayload: any = {};
    if (first_name !== undefined) updatePayload.first_name = first_name;
    if (last_name !== undefined) updatePayload.last_name = last_name;
    if (email !== undefined) updatePayload.email = email;
    if (role !== undefined) updatePayload.role = role;
    if (status !== undefined) updatePayload.status = status;

    const user = await authService.updateUser(id, updatePayload, currentUserId);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: user,
    });

    logger.info(`User updated: ${id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/users/:id
 * Deactivate user (principal only)
 */
router.delete('/users/:id', authenticate, authorize(UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deactivatedBy = (req as any).auth.userId;

    // Prevent admin from deactivating themselves
    if (id === deactivatedBy) {
      throw new AppError('Cannot deactivate your own account', 400, 'CANNOT_DEACTIVATE_SELF');
    }

    await authService.deactivateUser(id, deactivatedBy);

    res.json({
      message: 'User deactivated successfully',
    });

    logger.info(`User deactivated: ${id}`);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/users/:id/reactivate
 * Reactivate user (principal only)
 */
router.post('/users/:id/reactivate', authenticate, authorize(UserRole.PRINCIPAL), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const reactivatedBy = (req as any).auth.userId;

    await authService.reactivateUser(id, reactivatedBy);

    res.json({
      message: 'User reactivated successfully',
    });

    logger.info(`User reactivated: ${id}`);
  } catch (error) {
    next(error);
  }
});

export default router;
