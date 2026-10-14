import { Knex } from 'knex';
import { createHash } from 'crypto';
import { JWTService } from './jwtService';
import { PasswordService } from './passwordService';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { AuthResponse, UserResponse, UserRole, UserStatus } from '../types/auth';
import { sendSchoolWelcomeEmail } from './emailService';
import { effectiveDuties } from '../utils/staffDuties';
import { leadTitle, schoolTypeFor } from '../utils/schoolLevels';
import { isTenantOwner } from '../utils/tenantOwner';

/**
 * Hash a refresh token for at-rest storage. Refresh tokens are high-entropy
 * signed JWTs (not guessable), so a fast SHA-256 is the correct choice — we
 * store only the hash and look up by hash, so a DB dump never yields a usable
 * token. (bcrypt/argon are for low-entropy human passwords, not needed here.)
 */
function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

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

      // Create a new tenant for this registration so each school is isolated.
      // We derive a slug from the email domain or the user's name to keep it unique.
      const emailDomain = payload.email.split('@')[1]?.replace(/\.[^.]+$/, '') || 'school';
      const baseName = `${payload.first_name} ${payload.last_name}'s School`;
      const baseSlug = emailDomain.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const uniqueSuffix = Date.now();
      const slug = `${baseSlug}-${uniqueSuffix}`;

      const [newTenant] = await this.db('tenants').insert({
        name: baseName,
        slug,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*');
      const tenantId = newTenant.id;

      // Create user
      const [userRow] = await this.db('users').insert({
        tenant_id: tenantId,
        email: payload.email,
        password_hash: hashedPassword,
        first_name: payload.first_name,
        last_name: payload.last_name,
        role: payload.role,
        status: UserStatus.ACTIVE,
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*');
      const userId = userRow.id;

      logger.info(`User registered: ${payload.email} with role ${payload.role}`);

      // Generate tokens
      const user = await this.getUserById(userId);
      const access_token = JWTService.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      const refresh_token = JWTService.generateRefreshToken(user.id);

      // Store the HASH of the refresh token (never the raw value).
      await this.db('refresh_tokens').insert({
        user_id: user.id,
        token_hash: hashRefreshToken(refresh_token),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        created_at: new Date(),
      });

      return {
        user: await this.mapUserToResponse(user),
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
   * Self-service School & Tenant Registration
   * Creates tenant, default academic session, and the school owner's account (a principal flagged as owner) in one flow.
   */
  async registerSchool(payload: {
    school_name: string;
    contact_email: string;
    contact_phone?: string;
    country?: string;
    city?: string;
    address?: string;
    school_type?: string;
    school_motto?: string;
    id_student_prefix?: string;
    id_staff_prefix?: string;
    id_admission_prefix?: string;
    id_student_start_from?: number;
    admin_first_name: string;
    admin_last_name: string;
    password: string;
  }): Promise<{ user: UserResponse; tenant: any; access_token: string; refresh_token: string }> {
    try {
      const email = payload.contact_email.trim().toLowerCase();

      // Check if user already exists
      const existingUser = await this.db('users').where({ email }).first();
      if (existingUser) {
        throw new AppError('An account with this email already exists', 409, 'USER_EXISTS');
      }

      // Validate password policy
      const passwordValidation = PasswordService.validatePasswordPolicy(payload.password);
      if (!passwordValidation.valid) {
        throw new AppError(passwordValidation.errors.join(', '), 400, 'INVALID_PASSWORD');
      }

      const hashedPassword = await PasswordService.hashPassword(payload.password);

      // Create unique tenant slug
      const baseSlug = payload.school_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'school';
      const uniqueSuffix = Date.now().toString(36);
      const slug = `${baseSlug}-${uniqueSuffix}`;

      // Insert Tenant
      const tenantPayload: any = {
        name: payload.school_name.trim(),
        slug,
        status: 'active',
        created_at: new Date(),
        updated_at: new Date(),
      };

      if (payload.contact_email) tenantPayload.contact_email = payload.contact_email;
      if (payload.contact_phone) tenantPayload.contact_phone = payload.contact_phone;
      if (payload.address) tenantPayload.address = payload.address;

      const [newTenant] = await this.db('tenants').insert(tenantPayload).returning('*');
      const tenantId = newTenant.id;

      // Create the canonical `schools` profile row. The whole system reads the
      // school's branding/config from here (Settings → School Info, storage,
      // report cards, ID cards) and school_config_settings FKs to it. Without
      // this row a self-serve school had no `schools` record, so the Settings
      // tabs and ID generation silently fell back to defaults.
      let schoolId: string | null = null;
      try {
        const hasSchools = await this.db.schema.hasTable('schools');
        if (hasSchools) {
          const existingSchool = await this.db('schools').where('tenant_id', tenantId).first();
          if (existingSchool) {
            schoolId = existingSchool.school_id;
          } else {
            const schoolInsert: any = {
              tenant_id: tenantId,
              name: payload.school_name.trim(),
              email,
              phone: payload.contact_phone || null,
              address: payload.address || null,
              city: payload.city || null,
              country: payload.country || 'Sierra Leone',
              principal_name: `${payload.admin_first_name.trim()} ${payload.admin_last_name.trim()}`,
              principal_email: email,
              created_at: new Date(),
              updated_at: new Date(),
            };
            // motto became a first-class column on schools (migration 134).
            if (payload.school_motto) {
              const hasMotto = await this.db.schema.hasColumn('schools', 'motto').catch(() => false);
              if (hasMotto) schoolInsert.motto = payload.school_motto;
            }
            const [schoolRow] = await this.db('schools').insert(schoolInsert).returning('school_id');
            schoolId = schoolRow.school_id;
          }
        }
      } catch (err) {
        logger.warn(`registerSchool: could not create schools row for tenant ${tenantId}: ${(err as Error).message}`);
      }

      // Keep the legacy school_info table populated too (older reads fall back to it).
      try {
        const hasSchoolInfo = await this.db.schema.hasTable('school_info');
        if (hasSchoolInfo) {
          await this.db('school_info').insert({
            tenant_id: tenantId,
            name: payload.school_name.trim(),
            email: email,
            phone: payload.contact_phone || null,
            country: payload.country || 'Sierra Leone',
            city: payload.city || null,
            address: payload.address || null,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      } catch (_) {}

      // Create default Academic Session for this new school
      try {
        const hasAcademicSessions = await this.db.schema.hasTable('academic_sessions');
        if (hasAcademicSessions) {
          // The school year starting this September (from August on, the
          // coming one), not a fixed year.
          const now = new Date();
          const sy = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
          await this.db('academic_sessions').insert({
            tenant_id: tenantId,
            name: `${sy}/${sy + 1} Academic Year`,
            start_date: `${sy}-09-01`,
            end_date: `${sy + 1}-07-31`,
            // The academic_sessions column is `is_active` (migration 001), NOT
            // `is_current`. Using the wrong name silently failed the insert
            // (it's in a try/catch), so new self-serve schools got NO active
            // session — breaking class-creation's auto-resolve which looks up
            // `{ tenant_id, is_active: true }`.
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      } catch (_) {
        // Ignored if table optional
      }

      // Create Principal User. If this fails (e.g. the same email registered a
      // moment ago), remove the half-created school so it doesn't linger as an
      // orphan tenant with no owner.
      let userRow: any;
      try {
        [userRow] = await this.db('users').insert({
          tenant_id: tenantId,
          email,
          password_hash: hashedPassword,
          first_name: payload.admin_first_name.trim(),
          last_name: payload.admin_last_name.trim(),
          role: UserRole.PRINCIPAL,
          // The person who registers a school is its owner.
          is_owner: true,
          status: UserStatus.ACTIVE,
          created_at: new Date(),
          updated_at: new Date(),
        }).returning('*');
      } catch (userErr: any) {
        await this.db('tenants').where({ id: tenantId }).del().catch((e: any) =>
          logger.warn(`registerSchool: could not remove orphan tenant ${tenantId}: ${e?.message || e}`));
        if (String(userErr?.code) === '23505') throw new AppError('An account with this email already exists', 409, 'USER_EXISTS');
        throw userErr;
      }

      // Seed initial ID-format + school-type settings into school_config_settings
      // — the SAME table the ID generator (utils/idGenerator) and the Settings
      // page read from. Previously these were written to `school_settings`, a
      // different table nothing reads, so the prefixes/type chosen at signup
      // were silently ignored until the principal re-saved them in Settings.
      // Done AFTER the principal exists because created_by is NOT NULL.
      try {
        const hasConfig = await this.db.schema.hasTable('school_config_settings');
        if (hasConfig && schoolId) {
          const seed: Array<{ setting_key: string; setting_value: string; data_type: string; is_public: boolean }> = [
            { setting_key: 'id_student_prefix', setting_value: payload.id_student_prefix || 'STU', data_type: 'string', is_public: false },
            { setting_key: 'id_staff_prefix', setting_value: payload.id_staff_prefix || 'TCH', data_type: 'string', is_public: false },
            { setting_key: 'id_admission_prefix', setting_value: payload.id_admission_prefix || 'ADM', data_type: 'string', is_public: false },
            { setting_key: 'school_type', setting_value: payload.school_type || 'Mixed', data_type: 'string', is_public: true },
          ];
          if (payload.id_student_start_from) {
            seed.push({ setting_key: 'id_student_start_from', setting_value: String(payload.id_student_start_from), data_type: 'number', is_public: false });
          }
          await this.db('school_config_settings').insert(
            seed.map((row) => ({
              school_id: schoolId,
              tenant_id: tenantId,
              setting_key: row.setting_key,
              setting_value: row.setting_value,
              data_type: row.data_type,
              is_public: row.is_public,
              created_by: userRow.id,
              created_at: new Date(),
              updated_at: new Date(),
            }))
          ).onConflict(['school_id', 'setting_key']).merge();
        }
      } catch (err) {
        logger.warn(`registerSchool: could not seed config settings for tenant ${tenantId}: ${(err as Error).message}`);
      }

      logger.info(`Self-serve School Registered: "${payload.school_name}" by ${email}`);

      const user = await this.getUserById(userRow.id);
      const access_token = JWTService.generateAccessToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });
      const refresh_token = JWTService.generateRefreshToken(user.id);

      await this.db('refresh_tokens').insert({
        user_id: user.id,
        token_hash: hashRefreshToken(refresh_token),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        created_at: new Date(),
      });

      // Dispatch welcome email asynchronously (non-blocking)
      sendSchoolWelcomeEmail({
        toEmail: email,
        ownerName: `${payload.admin_first_name} ${payload.admin_last_name}`,
        schoolName: payload.school_name,
        leadTitle: leadTitle(payload.school_type),
      }).catch((err) => logger.warn(`Could not send welcome email to ${email}: ${err.message}`));

      return {
        user: await this.mapUserToResponse(user),
        tenant: newTenant,
        access_token,
        refresh_token,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error('Error in self-serve school registration', error);
      throw new AppError(error?.message || 'Failed to register school', 500, 'SCHOOL_REGISTRATION_FAILED');
    }
  }

  /**
   * Login user
   */
  async login(
    email: string,
    password: string
  ): Promise<
    | { access_token: string; refresh_token: string; user: UserResponse }
    | { mfa_required: true; mfa_token: string }
  > {
    try {
      // The identifier may be an email (parents/staff) OR a username
      // (students sign in with their student ID number). Match either.
      const identifier = (email || '').trim();
      const user = identifier.includes('@')
        ? await this.db('users').where({ email: identifier.toLowerCase() }).first()
        : await this.db('users')
            .whereRaw('lower(username) = ?', [identifier.toLowerCase()])
            .orWhereRaw('lower(email) = ?', [identifier.toLowerCase()])
            .first();
      if (!user) {
        throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
      }

      // Check user status (normalise casing/whitespace so a stray value like
      // "Suspended" or " suspended " still blocks sign-in).
      if (String(user.status || '').trim().toLowerCase() !== UserStatus.ACTIVE) {
        throw new AppError(`Your account is ${user.status}. Please contact your school administrator.`, 403, 'ACCOUNT_INACTIVE');
      }

      // Verify password
      const isPasswordValid = await PasswordService.comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
      }

      // If the user has 2FA enabled, don't issue tokens yet — issue a short-lived
      // MFA challenge that the client exchanges for tokens after entering a code.
      if (user.two_factor_enabled) {
        const { default: twoFactorService } = await import('./twoFactorService');
        const mfaToken = await twoFactorService.createChallenge(user.id);
        logger.info(`2FA challenge issued for ${email}`);
        return { mfa_required: true, mfa_token: mfaToken };
      }

      logger.info(`User logged in: ${email}`);
      return await this.issueSessionForUser(user);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error('Error logging in user:', { error: String(error), stack: error instanceof Error ? error.stack : undefined });
      throw new AppError(`Login failed: ${String(error)}`, 500, 'LOGIN_FAILED');
    }
  }

  /**
   * Issue access + refresh tokens for an already-authenticated user row and
   * record the session. Shared by password login and MFA completion.
   */
  /**
   * Block sign-in when the user's TENANT is not active (suspended / expired /
   * archived by the platform owner). Super admins are platform-level and exempt.
   * Called from every session-issuing path so restrictions cascade to ALL of a
   * tenant's users automatically.
   */
  private async assertTenantActive(user: any): Promise<void> {
    if (user.role === 'super_admin') return; // platform operator — no tenant gate
    if (!user.tenant_id) return;
    const tenant = await this.db('tenants').select('status', 'settings').where({ id: user.tenant_id }).first();
    if (!tenant) {
      throw new AppError('Your school account is unavailable. Contact support.', 403, 'TENANT_UNAVAILABLE');
    }
    if (tenant.status === 'active') {
      // Portals the school's plan doesn't include can't sign in at all.
      const { assertPortalAllowed } = await import('./entitlementService.js');
      await assertPortalAllowed(user.tenant_id, user.role);
      return;
    }
    // Not active: say WHY, from what the platform owner recorded. The account
    // owner (principal) gets the exact reason and next step; everyone else a
    // neutral summary and a pointer to their school administrator.
    const { describeTenantBlock } = await import('../utils/tenantBlock.js');
    const { isTenantOwner } = await import('../utils/tenantOwner.js');
    const info = describeTenantBlock(tenant, await isTenantOwner(user));
    const err = new AppError(info.message, 403, info.code);
    (err as any).suspension = info.suspension;
    throw err;
  }

  /**
   * Start a session for a known user id without a password. Only for callers
   * that have already proven the right to it (e.g. an emailed demo link for
   * the read-only demo school). Same checks as every other sign-in path.
   */
  async issueSessionForUserId(userId: string): Promise<{ access_token: string; refresh_token: string; user: UserResponse }> {
    const user = await this.db('users').where({ id: userId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    return this.issueSessionForUser(user);
  }

  private async issueSessionForUser(
    user: any
  ): Promise<{ access_token: string; refresh_token: string; user: UserResponse }> {
    // Enforce the user's OWN account status on EVERY session-issuing path
    // (password login, MFA completion, passkey, passwordless). Previously only
    // password login checked this, so a suspended/dismissed/inactive user could
    // still complete a passkey/MFA sign-in. Centralising it here closes that gap.
    if (user.status && String(user.status).trim().toLowerCase() !== UserStatus.ACTIVE) {
      throw new AppError(`Your account is ${user.status}. Please contact your school administrator.`, 403, 'ACCOUNT_INACTIVE');
    }
    // Enforce tenant-level restriction before issuing any session.
    await this.assertTenantActive(user);

    const accessToken = JWTService.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = JWTService.generateRefreshToken(user.id);

    await this.db('refresh_tokens').insert({
      user_id: user.id,
      token_hash: hashRefreshToken(refreshToken),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      created_at: new Date(),
    });

    await this.db('users').where({ id: user.id }).update({
      last_login: new Date(),
      updated_at: new Date(),
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: await this.mapUserToResponse(user),
    };
  }

  /**
   * Complete a 2FA login: verify the code against the MFA challenge and, on
   * success, issue the real session tokens.
   */
  async completeMfaLogin(
    mfaToken: string,
    code: string
  ): Promise<{ access_token: string; refresh_token: string; user: UserResponse }> {
    const { default: twoFactorService } = await import('./twoFactorService');
    const userId = await twoFactorService.verifyChallenge(mfaToken, code);
    const user = await this.db('users').where({ id: userId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    logger.info(`2FA login completed for ${user.email}`);
    return await this.issueSessionForUser(user);
  }

  /**
   * Complete a login using a passkey (WebAuthn) as the second factor. Verifies
   * the assertion against the mfa challenge, then issues the SAME session tokens
   * as a completed TOTP 2FA login (spec Correctness Property 7).
   */
  async completePasskeyLogin(
    mfaToken: string,
    response: any
  ): Promise<{ access_token: string; refresh_token: string; user: UserResponse }> {
    const { default: passkeyService } = await import('./passkeyService');
    const { userId } = await passkeyService.verifyAuthentication(mfaToken, response);
    const user = await this.db('users').where({ id: userId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    logger.info(`Passkey login completed for ${user.email}`);
    return await this.issueSessionForUser(user);
  }

  /**
   * Passwordless login: verify a passkey assertion that resolves the user from
   * the credential itself (no email/password), then issue the session. Password
   * + 2FA remain available as a fallback if the passkey has issues.
   */
  async completePasskeyPasswordlessLogin(
    response: any
  ): Promise<{ access_token: string; refresh_token: string; user: UserResponse }> {
    const { default: passkeyService } = await import('./passkeyService');
    const { userId } = await passkeyService.verifyUsernameless(response);
    const user = await this.db('users').where({ id: userId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    logger.info(`Passwordless passkey login for ${user.email}`);
    return await this.issueSessionForUser(user);
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    try {
      // Verify refresh token. A bad or expired token is a definite "no" (401),
      // not a server fault: the app signs out on 401 but keeps the session on
      // 5xx (a database blip on resume must not log an active user out).
      let decoded: { userId: string };
      try {
        decoded = JWTService.verifyRefreshToken(refreshToken);
      } catch (verifyError) {
        const expired = verifyError instanceof Error && /expired/i.test(verifyError.message);
        throw new AppError(
          expired ? 'Refresh token expired' : 'Invalid refresh token',
          401,
          expired ? 'REFRESH_TOKEN_EXPIRED' : 'INVALID_REFRESH_TOKEN'
        );
      }

      // Look up by the token HASH (we never store the raw token).
      const tokenHash = hashRefreshToken(refreshToken);
      const storedToken = await this.db('refresh_tokens')
        .where({
          user_id: decoded.userId,
          token_hash: tokenHash,
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

      // Re-check the user's OWN status — a deactivated / suspended / dismissed
      // account must not be able to silently renew its access token.
      if (String(user.status || '').trim().toLowerCase() !== UserStatus.ACTIVE) {
        // Revoke this refresh token so the dead session can't keep trying.
        await this.db('refresh_tokens').where({ token_hash: tokenHash }).del().catch(() => { /* best effort */ });
        throw new AppError(`Your account is ${user.status}. Please contact your school administrator.`, 403, 'ACCOUNT_INACTIVE');
      }

      // Re-check tenant status — a suspended tenant can't silently renew tokens.
      await this.assertTenantActive(user);

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
  async logout(userId: string, refreshToken?: string): Promise<void> {
    try {
      if (refreshToken) {
        // End THIS session only. Revoking every token for the user meant an
        // idle web tab timing out (or signing out on one phone) silently killed
        // the user's other, still-active sessions at their next token refresh.
        await this.db('refresh_tokens').where({
          user_id: userId,
          token_hash: hashRefreshToken(refreshToken),
        }).del();
      } else {
        // Older clients don't send their refresh token: keep the old behaviour.
        await this.db('refresh_tokens').where({
          user_id: userId,
        }).del();
      }

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

      // Update password and clear the stored demo/temp password — once the user
      // sets their own, the auto-generated one is no longer valid or shown.
      await this.db('users').where({ id: userId }).update({
        password_hash: hashedPassword,
        temp_password: null,
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

      // Invalidate ALL reset tokens for this user (not just the one used) so a
      // second outstanding link can't be replayed.
      await this.db('password_resets').where({ user_id: validReset.user_id }).del();

      // Revoke every active session for this user. A reset is commonly triggered
      // after a suspected compromise, so any previously issued refresh tokens
      // must stop working — the user re-authenticates with the new password.
      await this.db('refresh_tokens').where({ user_id: validReset.user_id }).del();

      logger.info(`Password reset for user: ${validReset.user_id} (all sessions revoked)`);
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
  private async mapUserToResponse(user: any): Promise<UserResponse> {
    let schoolLogoUrl = null;
    let schoolName = null;

    if (user.tenant_id) {
      try {
        // 1. Try schools table
        const school = await this.db('schools').where('tenant_id', user.tenant_id).first();
        if (school) {
          schoolLogoUrl = school.logo_url;
          schoolName = school.name;
        }

        // 2. Try school_info table if schoolName not found
        if (!schoolName) {
          const hasSchoolInfo = await this.db.schema.hasTable('school_info');
          if (hasSchoolInfo) {
            const schoolInfo = await this.db('school_info').where('tenant_id', user.tenant_id).first();
            if (schoolInfo && schoolInfo.name) {
              schoolName = schoolInfo.name;
              schoolLogoUrl = schoolLogoUrl || schoolInfo.logo_url || null;
            }
          }
        }

        // 3. Try tenants table if schoolName still not found
        if (!schoolName) {
          const tenant = await this.db('tenants').where('id', user.tenant_id).first();
          if (tenant && tenant.name) {
            schoolName = tenant.name;
          }
        }

        // 4. Try school_config_settings table if schoolName still not found
        if (!schoolName) {
          const hasSettings = await this.db.schema.hasTable('school_config_settings');
          if (hasSettings) {
            const setting = await this.db('school_config_settings')
              .where({ tenant_id: user.tenant_id, key: 'school_name' })
              .first();
            if (setting && setting.value) {
              schoolName = setting.value;
            }
          }
        }
      } catch (err) {
        logger.warn(`Error mapping school info for tenant ${user.tenant_id}: ${err}`);
      }
    }

    // Resolve the best available profile photo for the header/sidebar avatar:
    //   1. verification profile photo (account owner)
    //   2. the user's general photo (teachers/staff/ID cards)
    //   3. for students, the photo stored on their students row
    let profilePhotoUrl: string | null = user.profile_photo_url || user.photo_url || null;
    if (!profilePhotoUrl && user.role === 'student') {
      try {
        const student = await this.db('students')
          .where({ user_id: user.id })
          .first()
          .catch(() => null);
        if (student?.photo_url) profilePhotoUrl = student.photo_url;
      } catch { /* non-fatal */ }
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      status: user.status,
      tenantId: user.tenant_id,
      schoolLogoUrl,
      schoolName,
      schoolType: await schoolTypeFor(this.db, user.tenant_id),
      leadTitle: leadTitle(await schoolTypeFor(this.db, user.tenant_id)),
      isOwner: user.role === 'principal' ? await isTenantOwner(user) : false,
      isNamedOwner: user.role === 'principal' && (user as any).is_owner === true,
      profilePhotoUrl,
      verificationStatus: user.verification_status || 'unverified',
      hasOnboarded: !!user.onboarded_at,
      two_factor_enabled: !!user.two_factor_enabled,
      createdAt: user.created_at,
      // Extra portals for a teacher who is also Bursar / Admissions Officer.
      staffDuties: effectiveDuties(user.role, (user as any).staff_duties),
    } as UserResponse;
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

      // The new user MUST belong to the creating principal's tenant. Previously
      // this used `tenants.first()` (the oldest tenant in the DB), which silently
      // placed every admin-created user into the WRONG school and broke tenant
      // isolation. Derive the tenant from the creator instead.
      const creator = await this.db('users')
        .select('tenant_id')
        .where({ id: payload.createdBy })
        .first();
      if (!creator?.tenant_id) {
        throw new AppError('Cannot resolve tenant for the creating user', 400, 'TENANT_REQUIRED');
      }
      const tenantId = creator.tenant_id;
      // Only roles whose portal is in the school's plan.
      const { assertPortalAllowed } = await import('./entitlementService.js');
      await assertPortalAllowed(tenantId, String(payload.role), { forAccountCreation: true });

      // Create user
      const [userRow] = await this.db('users').insert({
        tenant_id: tenantId,
        email: payload.email,
        password_hash: hashedPassword,
        first_name: payload.first_name,
        last_name: payload.last_name,
        role: payload.role,
        status: UserStatus.ACTIVE,
        created_by: payload.createdBy,
        created_at: new Date(),
        updated_at: new Date(),
      }).returning('*');
      const userId = userRow.id;

      // Log audit
      await this.logAudit({
        userId: payload.createdBy,
        action: 'CREATE_USER',
        entityType: 'users',
        entityId: userId,
        changes: { email: payload.email, role: payload.role },
      });

      logger.info(`User created: ${payload.email} with role ${payload.role}`);

      // Email the new user their account details (non-blocking, best-effort).
      import('./emailService')
        .then(({ default: emailService }) =>
          emailService.sendAccountCredentialsEmail(tenantId, payload.email, {
            userName: `${payload.first_name} ${payload.last_name}`.trim(),
            role: payload.role,
            tempPassword: payload.password,
          })
        )
        .catch((err) => logger.warn(`Could not send account credentials email to ${payload.email}: ${err?.message || err}`));

      const user = await this.getUserById(userId);
      return await this.mapUserToResponse(user);
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
      if (payload.email && payload.email.toLowerCase() !== String(user.email ?? '').toLowerCase()) {
        // Case-insensitive: emails are the login identifier.
        const existingUser = await this.db('users')
          .whereRaw('LOWER(email) = ?', [payload.email.toLowerCase()])
          .whereNot({ id: userId })
          .first();
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
      return await this.mapUserToResponse(updatedUser);
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
    tenantId?: string;
  }): Promise<{ users: UserResponse[]; total: number }> {
    try {
      let query = this.db('users');

      // Tenant scoping — a principal must only ever see users of their own
      // school. Without this the list leaked every tenant's users.
      if (options.tenantId) {
        query = query.where('tenant_id', options.tenantId);
      }

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
        users: await Promise.all(users.map((u) => this.mapUserToResponse(u))),
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
      return await this.mapUserToResponse(user);
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
