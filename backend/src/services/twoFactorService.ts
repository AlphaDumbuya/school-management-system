/**
 * twoFactorService — TOTP-based two-factor authentication.
 *
 * Flow:
 *  1. setup()  → generate a secret (not yet enabled), return QR + otpauth URI.
 *  2. enable() → user submits a code from their app; on success we flip
 *               two_factor_enabled on, persist the encrypted secret, and return
 *               one-time backup codes (shown once).
 *  3. On login, if two_factor_enabled, authService issues an mfa challenge; the
 *     client calls verifyLoginCode() with a TOTP or backup code to finish login.
 *  4. disable() → turns 2FA off (requires a valid code).
 */
import crypto from 'crypto';
import { db } from '@utils/database';
import { logger } from '@utils/logger';
import { AppError } from '@middleware/errorHandler';
import { PasswordService } from './passwordService';
import { generateBase32Secret, verifyTotp, buildOtpAuthUri } from '@utils/totp';
import { encryptSecret, decryptSecret } from '@utils/encryption';

const ISSUER = process.env.TOTP_ISSUER || 'WiSkul';
const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MFA_MAX_ATTEMPTS = 5;

export class TwoFactorService {
  /** Start setup: create a fresh secret (stored encrypted, not yet enabled). */
  async setup(userId: string): Promise<{ secret: string; otpauthUri: string }> {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const secret = generateBase32Secret();
    // Persist encrypted secret but keep two_factor_enabled = false until verified.
    await db('users').where({ id: userId }).update({
      two_factor_secret: encryptSecret(secret),
      two_factor_enabled: false,
      updated_at: new Date(),
    });

    const otpauthUri = buildOtpAuthUri({
      secret,
      label: user.email,
      issuer: ISSUER,
    });
    return { secret, otpauthUri };
  }

  /** Finish setup: verify a code, enable 2FA, return one-time backup codes. */
  async enable(userId: string, token: string): Promise<{ backupCodes: string[] }> {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    if (!user.two_factor_secret) {
      throw new AppError('Start 2FA setup first', 400, 'TWO_FACTOR_NOT_STARTED');
    }

    const secret = decryptSecret(user.two_factor_secret);
    if (!verifyTotp(secret, token)) {
      throw new AppError('Invalid verification code', 400, 'INVALID_2FA_CODE');
    }

    // Generate 10 human-friendly backup codes; store only their hashes.
    const backupCodes = Array.from({ length: 10 }, () => this.generateBackupCode());
    const hashed = await Promise.all(backupCodes.map((c) => PasswordService.hashPassword(c)));

    await db('users').where({ id: userId }).update({
      two_factor_enabled: true,
      two_factor_backup_codes: JSON.stringify(hashed),
      two_factor_enabled_at: new Date(),
      updated_at: new Date(),
    });

    this.sendSecurityEmail(user, 'enabled').catch(() => {});
    logger.info(`2FA enabled for user ${userId}`);
    return { backupCodes };
  }

  /** Disable 2FA (requires a valid current code or backup code). */
  async disable(userId: string, token: string): Promise<void> {
    const user = await db('users').where({ id: userId }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    if (!user.two_factor_enabled) return;

    const ok = await this.verifyCodeForUser(user, token);
    if (!ok) throw new AppError('Invalid verification code', 400, 'INVALID_2FA_CODE');

    await db('users').where({ id: userId }).update({
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_backup_codes: null,
      two_factor_enabled_at: null,
      updated_at: new Date(),
    });

    this.sendSecurityEmail(user, 'disabled').catch(() => {});
    logger.info(`2FA disabled for user ${userId}`);
  }

  /** Create a short-lived MFA challenge after a valid password. Returns mfa_token. */
  async createChallenge(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await db('mfa_challenges').insert({
      user_id: userId,
      token,
      attempts: 0,
      expires_at: new Date(Date.now() + MFA_CHALLENGE_TTL_MS),
      created_at: new Date(),
    });
    return token;
  }

  /**
   * Verify a login code against an mfa challenge. Returns the userId on success.
   * Consumes a backup code if one was used.
   */
  async verifyChallenge(mfaToken: string, code: string): Promise<string> {
    const challenge = await db('mfa_challenges').where({ token: mfaToken }).first();
    if (!challenge) throw new AppError('Invalid or expired session', 401, 'INVALID_MFA_TOKEN');

    if (new Date(challenge.expires_at) < new Date()) {
      await db('mfa_challenges').where({ id: challenge.id }).del();
      throw new AppError('Verification session expired. Please sign in again.', 401, 'MFA_EXPIRED');
    }
    if (challenge.attempts >= MFA_MAX_ATTEMPTS) {
      await db('mfa_challenges').where({ id: challenge.id }).del();
      throw new AppError('Too many attempts. Please sign in again.', 429, 'MFA_TOO_MANY_ATTEMPTS');
    }

    const user = await db('users').where({ id: challenge.user_id }).first();
    if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

    const ok = await this.verifyCodeForUser(user, code);
    if (!ok) {
      await db('mfa_challenges').where({ id: challenge.id }).update({ attempts: challenge.attempts + 1 });
      throw new AppError('Invalid verification code', 401, 'INVALID_2FA_CODE');
    }

    // Success — consume the challenge.
    await db('mfa_challenges').where({ id: challenge.id }).del();
    return user.id;
  }

  /** Verify a code (TOTP or one backup code) against a user row. */
  private async verifyCodeForUser(user: any, code: string): Promise<boolean> {
    const normalized = (code || '').replace(/[\s-]/g, '');

    // Try TOTP first.
    if (user.two_factor_secret) {
      const secret = decryptSecret(user.two_factor_secret);
      if (verifyTotp(secret, normalized)) return true;
    }

    // Fall back to backup codes (consume on use).
    const stored = this.parseBackupCodes(user.two_factor_backup_codes);
    if (stored.length) {
      for (let i = 0; i < stored.length; i++) {
        if (await PasswordService.comparePassword(normalized.toUpperCase(), stored[i])) {
          const remaining = stored.filter((_, idx) => idx !== i);
          await db('users').where({ id: user.id }).update({
            two_factor_backup_codes: JSON.stringify(remaining),
            updated_at: new Date(),
          });
          return true;
        }
      }
    }
    return false;
  }

  /** Regenerate backup codes (requires a valid current code). */
  async regenerateBackupCodes(userId: string, token: string): Promise<string[]> {
    const user = await db('users').where({ id: userId }).first();
    if (!user || !user.two_factor_enabled) {
      throw new AppError('2FA is not enabled', 400, 'TWO_FACTOR_NOT_ENABLED');
    }
    if (!(await this.verifyCodeForUser(user, token))) {
      throw new AppError('Invalid verification code', 400, 'INVALID_2FA_CODE');
    }
    const backupCodes = Array.from({ length: 10 }, () => this.generateBackupCode());
    const hashed = await Promise.all(backupCodes.map((c) => PasswordService.hashPassword(c)));
    await db('users').where({ id: userId }).update({
      two_factor_backup_codes: JSON.stringify(hashed),
      updated_at: new Date(),
    });
    return backupCodes;
  }

  private parseBackupCodes(raw: any): string[] {
    if (!raw) return [];
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return [];
    }
  }

  /** 8-char backup code like "A1B2-C3D4". */
  private generateBackupCode(): string {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  }

  /** Notify the user by email when 2FA is enabled/disabled. */
  private async sendSecurityEmail(user: any, action: 'enabled' | 'disabled') {
    try {
      if (!user.email) return;
      const { default: emailService } = await import('./emailService');
      await emailService.sendTwoFactorStatusEmail(user.tenant_id, user.email, {
        userName: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'there',
        action,
      });
    } catch (err) {
      logger.warn(`Could not send 2FA ${action} email: ${(err as any)?.message || err}`);
    }
  }
}

export default new TwoFactorService();
