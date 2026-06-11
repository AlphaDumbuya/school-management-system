import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 17.4: Unauthorized Access Prevention
 * 
 * Implements:
 * - Access attempt logging
 * - Rate limiting for login attempts
 * - IP-based access controls
 * - Account lockout mechanisms
 * - Security alerts
 */

interface AccessAttempt {
  id: string;
  userId?: string;
  ipAddress: string;
  action: string;
  status: 'success' | 'failure';
  reason?: string;
  userAgent?: string;
  createdAt: Date;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // Time window in milliseconds
  lockoutDurationMs: number;
}

export class AccessControlService {
  private db: Knex;
  private accessAttempts: Map<string, AccessAttempt[]> = new Map();
  private rateLimitConfig: RateLimitConfig = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    lockoutDurationMs: 30 * 60 * 1000, // 30 minutes
  };
  private ipBlocklist: Set<string> = new Set();
  private ipAllowlist: Set<string> = new Set();

  /**
   * Initializes access control service
   * @param database - Knex database instance
   * @param config - Rate limit configuration
   */
  constructor(database: Knex, config?: Partial<RateLimitConfig>) {
    this.db = database;
    if (config) {
      this.rateLimitConfig = { ...this.rateLimitConfig, ...config };
    }
    logger.info('AccessControlService initialized');
  }

  /**
   * Logs an access attempt
   * @param attempt - Access attempt details
   */
  async logAccessAttempt(attempt: Omit<AccessAttempt, 'id' | 'createdAt'>): Promise<void> {
    try {
      const entry: AccessAttempt = {
        id: uuidv4(),
        ...attempt,
        createdAt: new Date(),
      };

      // Store in database
      await this.db('access_logs')
        .insert({
          id: entry.id,
          user_id: entry.userId || null,
          ip_address: entry.ipAddress,
          action: entry.action,
          status: entry.status,
          reason: entry.reason || null,
          user_agent: entry.userAgent || null,
          created_at: entry.createdAt,
        });

      // Track in memory for rate limiting
      this.trackInMemory(entry);

      logger.debug(`Access attempt logged: ${entry.action} from ${entry.ipAddress} - ${entry.status}`);
    } catch (error) {
      logger.error('Failed to log access attempt', error);
    }
  }

  /**
   * Checks if access attempt should be rate limited
   * @param identifier - User ID or IP address
   * @returns Rate limit status
   */
  async checkRateLimit(identifier: string): Promise<{
    allowed: boolean;
    attemptsRemaining: number;
    resetTime?: Date;
    reason?: string;
  }> {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.rateLimitConfig.windowMs);

      // Get recent failed attempts from database
      const attempts = await this.db('access_logs')
        .where((qb) => {
          qb.where('user_id', identifier)
            .orWhere('ip_address', identifier);
        })
        .where('action', 'login')
        .where('status', 'failure')
        .where('created_at', '>=', windowStart)
        .count('* as count')
        .first() as any;

      const failedAttempts = attempts?.count || 0;

      if (failedAttempts >= this.rateLimitConfig.maxAttempts) {
        const resetTime = new Date(
          now.getTime() + this.rateLimitConfig.lockoutDurationMs
        );

        return {
          allowed: false,
          attemptsRemaining: 0,
          resetTime,
          reason: `Too many failed login attempts. Please try again after ${resetTime.toISOString()}`,
        };
      }

      return {
        allowed: true,
        attemptsRemaining: this.rateLimitConfig.maxAttempts - failedAttempts,
      };
    } catch (error) {
      logger.error('Failed to check rate limit', error);
      // Allow on error
      return { allowed: true, attemptsRemaining: this.rateLimitConfig.maxAttempts };
    }
  }

  /**
   * Checks if IP is blocked
   * @param ipAddress - IP address to check
   * @returns true if blocked
   */
  async isIPBlocked(ipAddress: string): Promise<boolean> {
    try {
      // Check in-memory blocklist first
      if (this.ipBlocklist.has(ipAddress)) {
        return true;
      }

      // Check database
      const blocked = await this.db('ip_blocklist')
        .where('ip_address', ipAddress)
        .where('active', true)
        .first();

      if (blocked) {
        this.ipBlocklist.add(ipAddress);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to check IP blocklist', error);
      return false;
    }
  }

  /**
   * Checks if IP is on allowlist (whitelist)
   * @param ipAddress - IP address to check
   * @returns true if on allowlist
   */
  async isIPAllowed(ipAddress: string): Promise<boolean> {
    try {
      // Check in-memory allowlist first
      if (this.ipAllowlist.has(ipAddress)) {
        return true;
      }

      // Check database
      const allowed = await this.db('ip_allowlist')
        .where('ip_address', ipAddress)
        .where('active', true)
        .first();

      if (allowed) {
        this.ipAllowlist.add(ipAddress);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to check IP allowlist', error);
      return false;
    }
  }

  /**
   * Adds IP to blocklist
   * @param ipAddress - IP address to block
   * @param reason - Reason for blocking
   * @param duration - Duration to block (ms), null for permanent
   */
  async blockIP(
    ipAddress: string,
    reason: string,
    duration?: number
  ): Promise<void> {
    try {
      const expiresAt = duration ? new Date(Date.now() + duration) : null;

      await this.db('ip_blocklist')
        .insert({
          id: uuidv4(),
          ip_address: ipAddress,
          reason,
          active: true,
          expires_at: expiresAt,
          created_at: new Date(),
        });

      this.ipBlocklist.add(ipAddress);

      logger.warn(`IP blocked: ${ipAddress} - Reason: ${reason}`);
    } catch (error) {
      logger.error('Failed to block IP', error);
      throw new AppError('Failed to block IP', 500);
    }
  }

  /**
   * Removes IP from blocklist
   * @param ipAddress - IP address to unblock
   */
  async unblockIP(ipAddress: string): Promise<void> {
    try {
      await this.db('ip_blocklist')
        .where('ip_address', ipAddress)
        .delete();

      this.ipBlocklist.delete(ipAddress);

      logger.info(`IP unblocked: ${ipAddress}`);
    } catch (error) {
      logger.error('Failed to unblock IP', error);
      throw new AppError('Failed to unblock IP', 500);
    }
  }

  /**
   * Locks a user account
   * @param userId - User ID
   * @param reason - Reason for lockout
   * @param duration - Lockout duration (ms)
   */
  async lockUserAccount(
    userId: string,
    reason: string,
    duration: number = 30 * 60 * 1000 // 30 minutes default
  ): Promise<void> {
    try {
      const lockedUntil = new Date(Date.now() + duration);

      await this.db('users')
        .where('id', userId)
        .update({
          account_locked: true,
          locked_until: lockedUntil,
          locked_reason: reason,
          updated_at: new Date(),
        });

      logger.warn(`User account locked: ${userId} - Reason: ${reason}`);
    } catch (error) {
      logger.error('Failed to lock user account', error);
      throw new AppError('Failed to lock user account', 500);
    }
  }

  /**
   * Unlocks a user account
   * @param userId - User ID
   */
  async unlockUserAccount(userId: string): Promise<void> {
    try {
      await this.db('users')
        .where('id', userId)
        .update({
          account_locked: false,
          locked_until: null,
          locked_reason: null,
          updated_at: new Date(),
        });

      logger.info(`User account unlocked: ${userId}`);
    } catch (error) {
      logger.error('Failed to unlock user account', error);
      throw new AppError('Failed to unlock user account', 500);
    }
  }

  /**
   * Checks if user account is locked
   * @param userId - User ID
   * @returns Lock status
   */
  async isUserAccountLocked(userId: string): Promise<{
    locked: boolean;
    reason?: string;
    lockedUntil?: Date;
  }> {
    try {
      const user = await this.db('users')
        .where('id', userId)
        .select('account_locked', 'locked_until', 'locked_reason')
        .first();

      if (!user) {
        return { locked: false };
      }

      // Check if lockout has expired
      if (user.account_locked && user.locked_until) {
        if (new Date() > user.locked_until) {
          // Auto-unlock
          await this.unlockUserAccount(userId);
          return { locked: false };
        }
      }

      return {
        locked: user.account_locked,
        reason: user.locked_reason,
        lockedUntil: user.locked_until,
      };
    } catch (error) {
      logger.error('Failed to check user account lock status', error);
      return { locked: false };
    }
  }

  /**
   * Gets access history for a user or IP
   * @param identifier - User ID or IP address
   * @param limit - Maximum records to return
   * @returns Access history
   */
  async getAccessHistory(
    identifier: string,
    limit: number = 100
  ): Promise<AccessAttempt[]> {
    try {
      const logs = await this.db('access_logs')
        .where((qb) => {
          qb.where('user_id', identifier)
            .orWhere('ip_address', identifier);
        })
        .orderBy('created_at', 'desc')
        .limit(limit)
        .select();

      return logs.map((log: any) => ({
        id: log.id,
        userId: log.user_id,
        ipAddress: log.ip_address,
        action: log.action,
        status: log.status,
        reason: log.reason,
        userAgent: log.user_agent,
        createdAt: log.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get access history', error);
      throw new AppError('Failed to get access history', 500);
    }
  }

  /**
   * Generates security alert for suspicious activity
   * @param alert - Alert details
   */
  async generateSecurityAlert(alert: {
    userId?: string;
    ipAddress: string;
    alertType: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }): Promise<void> {
    try {
      await this.db('security_alerts')
        .insert({
          id: uuidv4(),
          user_id: alert.userId || null,
          ip_address: alert.ipAddress,
          alert_type: alert.alertType,
          description: alert.description,
          severity: alert.severity,
          acknowledged: false,
          created_at: new Date(),
        });

      logger.warn(
        `Security alert generated: ${alert.alertType} (${alert.severity}) - ${alert.description}`
      );
    } catch (error) {
      logger.error('Failed to generate security alert', error);
    }
  }

  /**
   * Gets recent security alerts
   * @param severity - Filter by severity (optional)
   * @param limit - Maximum records
   * @returns Security alerts
   */
  async getSecurityAlerts(
    severity?: string,
    limit: number = 100
  ): Promise<any[]> {
    try {
      let query = this.db('security_alerts')
        .where('acknowledged', false);

      if (severity) {
        query = query.where('severity', severity);
      }

      const alerts = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .select();

      return alerts;
    } catch (error) {
      logger.error('Failed to get security alerts', error);
      throw new AppError('Failed to get security alerts', 500);
    }
  }

  /**
   * Acknowledges a security alert
   * @param alertId - Alert ID
   */
  async acknowledgeSecurityAlert(alertId: string): Promise<void> {
    try {
      await this.db('security_alerts')
        .where('id', alertId)
        .update({
          acknowledged: true,
          acknowledged_at: new Date(),
        });

      logger.info(`Security alert acknowledged: ${alertId}`);
    } catch (error) {
      logger.error('Failed to acknowledge security alert', error);
      throw new AppError('Failed to acknowledge security alert', 500);
    }
  }

  /**
   * Tracks access attempts in memory for fast checks
   * @param attempt - Access attempt
   */
  private trackInMemory(attempt: AccessAttempt): void {
    const key = attempt.userId || attempt.ipAddress;
    const attempts = this.accessAttempts.get(key) || [];

    // Add new attempt
    attempts.push(attempt);

    // Remove old attempts outside window
    const windowStart = new Date(Date.now() - this.rateLimitConfig.windowMs);
    const filtered = attempts.filter((a) => a.createdAt > windowStart);

    if (filtered.length > 0) {
      this.accessAttempts.set(key, filtered);
    } else {
      this.accessAttempts.delete(key);
    }
  }

  /**
   * Gets access control health status
   * @returns Health status
   */
  async getAccessControlHealth(): Promise<{
    status: string;
    blockedIPs: number;
    allowedIPs: number;
    lockedAccounts: number;
    recentAlerts: number;
  }> {
    try {
      const blockedIPs = await this.db('ip_blocklist')
        .where('active', true)
        .count('* as count')
        .first() as any;

      const allowedIPs = await this.db('ip_allowlist')
        .where('active', true)
        .count('* as count')
        .first() as any;

      const lockedAccounts = await this.db('users')
        .where('account_locked', true)
        .count('* as count')
        .first() as any;

      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentAlerts = await this.db('security_alerts')
        .where('created_at', '>=', yesterday)
        .count('* as count')
        .first() as any;

      return {
        status: (recentAlerts?.count || 0) > 10 ? 'warning' : 'healthy',
        blockedIPs: blockedIPs?.count || 0,
        allowedIPs: allowedIPs?.count || 0,
        lockedAccounts: lockedAccounts?.count || 0,
        recentAlerts: recentAlerts?.count || 0,
      };
    } catch (error) {
      logger.error('Failed to get access control health', error);
      return {
        status: 'error',
        blockedIPs: 0,
        allowedIPs: 0,
        lockedAccounts: 0,
        recentAlerts: 0,
      };
    }
  }
}

export default AccessControlService;
