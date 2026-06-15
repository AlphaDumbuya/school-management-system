import { Knex } from 'knex';
import { logger } from '../utils/logger.js';

/**
 * ID Card Reporting Service
 * Phase 2.1: Identity Management Module
 * 
 * Provides reporting and analytics features for ID card management including
 * dashboard statistics, issuance reports, QR code scan analytics, and
 * security alerts.
 */

export interface CardStatistics {
  totalCards: number;
  activeCards: number;
  expiredCards: number;
  revokedCards: number;
  lostCards: number;
  suspendedCards: number;
}

export interface IssuanceReport {
  date: string;
  count: number;
  role?: string;
}

export interface ScanAnalytics {
  userId: string;
  userName: string;
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  lastScanDate?: Date;
}

export interface SecurityAlert {
  alertType: 'suspicious_scanning' | 'brute_force_attempt' | 'expired_card_usage';
  severity: 'low' | 'medium' | 'high';
  userId?: string;
  deviceId?: string;
  description: string;
  timestamp: Date;
  metadata: any;
}

export class IdCardReportingService {
  constructor(private db: Knex) {}

  /**
   * Get dashboard statistics for cards
   * Requirements: 9.1
   */
  async getDashboardStatistics(
    tenantId: string,
    academicSessionId?: string
  ): Promise<CardStatistics> {
    try {
      let query = this.db('id_cards').where({ tenant_id: tenantId });

      if (academicSessionId) {
        // Filter by academic session if provided
        // This assumes cards have a session association
        query = query.where({ academic_session_id: academicSessionId });
      }

      const [stats] = await query
        .select(
          this.db.raw(`COUNT(*) as total_cards`),
          this.db.raw(`COUNT(*) FILTER (WHERE status = 'active') as active_cards`),
          this.db.raw(`COUNT(*) FILTER (WHERE status = 'expired') as expired_cards`),
          this.db.raw(`COUNT(*) FILTER (WHERE status = 'revoked') as revoked_cards`),
          this.db.raw(`COUNT(*) FILTER (WHERE status = 'lost') as lost_cards`),
          this.db.raw(`COUNT(*) FILTER (WHERE status = 'suspended') as suspended_cards`)
        );

      return {
        totalCards: Number(stats.total_cards || 0),
        activeCards: Number(stats.active_cards || 0),
        expiredCards: Number(stats.expired_cards || 0),
        revokedCards: Number(stats.revoked_cards || 0),
        lostCards: Number(stats.lost_cards || 0),
        suspendedCards: Number(stats.suspended_cards || 0),
      };
    } catch (error) {
      logger.error('Failed to get dashboard statistics', { tenantId, error });
      throw error;
    }
  }

  /**
   * Get card issuance report
   * Requirements: 9.2
   */
  async getIssuanceReport(
    tenantId: string,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'month' | 'role' = 'day'
  ): Promise<IssuanceReport[]> {
    try {
      let query = this.db('id_cards')
        .where({ tenant_id: tenantId })
        .whereBetween('issued_at', [startDate, endDate]);

      if (groupBy === 'role') {
        // Group by user role
        const report = await query
          .join('users', 'id_cards.user_id', 'users.id')
          .select('users.role')
          .count('* as count')
          .groupBy('users.role')
          .orderBy('count', 'desc');

        return report.map((r: any) => ({
          date: r.role,
          count: Number(r.count),
          role: r.role,
        }));
      } else if (groupBy === 'month') {
        // Group by month
        const report = await query
          .select(this.db.raw(`DATE_TRUNC('month', issued_at) as date`))
          .count('* as count')
          .groupBy(this.db.raw(`DATE_TRUNC('month', issued_at)`))
          .orderBy('date', 'asc');

        return report.map((r: any) => ({
          date: new Date(r.date).toISOString().substring(0, 7), // YYYY-MM
          count: Number(r.count),
        }));
      } else {
        // Group by day
        const report = await query
          .select(this.db.raw(`DATE(issued_at) as date`))
          .count('* as count')
          .groupBy(this.db.raw(`DATE(issued_at)`))
          .orderBy('date', 'asc');

        return report.map((r: any) => ({
          date: new Date(r.date).toISOString().substring(0, 10), // YYYY-MM-DD
          count: Number(r.count),
        }));
      }
    } catch (error) {
      logger.error('Failed to get issuance report', { tenantId, startDate, endDate, error });
      throw error;
    }
  }

  /**
   * Get QR code scan analytics for a user
   * Requirements: 9.4
   */
  async getUserScanAnalytics(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<ScanAnalytics> {
    try {
      // Get user's card
      const card = await this.db('id_cards')
        .where({ user_id: userId, status: 'active' })
        .first();

      if (!card) {
        throw new Error(`No active card found for user ${userId}`);
      }

      // Get QR code for card
      const qrCode = await this.db('qr_codes')
        .where({ card_id: card.id })
        .first();

      if (!qrCode) {
        throw new Error(`No QR code found for card ${card.id}`);
      }

      // Build query for scans
      let query = this.db('qr_code_scans').where({ qr_code_id: qrCode.id });

      if (startDate) {
        query = query.where('scanned_at', '>=', startDate);
      }
      if (endDate) {
        query = query.where('scanned_at', '<=', endDate);
      }

      const [stats] = await query.select(
        this.db.raw(`COUNT(*) as total_scans`),
        this.db.raw(`COUNT(*) FILTER (WHERE result = 'success') as successful_scans`),
        this.db.raw(`COUNT(*) FILTER (WHERE result != 'success') as failed_scans`),
        this.db.raw(`MAX(scanned_at) as last_scan_date`)
      );

      // Get user details
      const user = await this.db('users').where({ id: userId }).first();

      return {
        userId,
        userName: user ? `${user.first_name} ${user.last_name}` : 'Unknown',
        totalScans: Number(stats.total_scans || 0),
        successfulScans: Number(stats.successful_scans || 0),
        failedScans: Number(stats.failed_scans || 0),
        lastScanDate: stats.last_scan_date ? new Date(stats.last_scan_date) : undefined,
      };
    } catch (error) {
      logger.error('Failed to get user scan analytics', { userId, error });
      throw error;
    }
  }

  /**
   * Get card generation volume statistics
   * Requirements: 9.5
   */
  async getGenerationVolumeStats(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCards: number;
    byMonth: IssuanceReport[];
    byRole: IssuanceReport[];
  }> {
    try {
      // Total cards
      const [totalResult] = await this.db('id_cards')
        .where({ tenant_id: tenantId })
        .whereBetween('issued_at', [startDate, endDate])
        .count('* as count');

      // By month
      const byMonth = await this.getIssuanceReport(tenantId, startDate, endDate, 'month');

      // By role
      const byRole = await this.getIssuanceReport(tenantId, startDate, endDate, 'role');

      return {
        totalCards: Number(totalResult.count || 0),
        byMonth,
        byRole,
      };
    } catch (error) {
      logger.error('Failed to get generation volume stats', { tenantId, error });
      throw error;
    }
  }

  /**
   * Detect and report security alerts
   * Requirements: 9.6
   */
  async detectSecurityAlerts(tenantId: string): Promise<SecurityAlert[]> {
    try {
      const alerts: SecurityAlert[] = [];
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Detect suspicious scanning patterns (same device, multiple failures)
      const suspiciousScans = await this.db('qr_code_scans')
        .join('qr_codes', 'qr_code_scans.qr_code_id', 'qr_codes.id')
        .join('id_cards', 'qr_codes.card_id', 'id_cards.id')
        .where('id_cards.tenant_id', tenantId)
        .where('qr_code_scans.scanned_at', '>=', last24Hours)
        .where('qr_code_scans.result', '!=', 'success')
        .select('qr_code_scans.scanning_device_id')
        .count('* as count')
        .groupBy('qr_code_scans.scanning_device_id')
        .having(this.db.raw('COUNT(*) > ?', [10]));

      for (const scan of suspiciousScans) {
        alerts.push({
          alertType: 'suspicious_scanning',
          severity: 'high',
          deviceId: scan.scanning_device_id,
          description: `Device ${scan.scanning_device_id} has ${scan.count} failed scan attempts in the last 24 hours`,
          timestamp: now,
          metadata: { failedAttempts: scan.count },
        });
      }

      // Detect brute force attempts (same device, rapid failures)
      const bruteForceAttempts = await this.db('qr_code_scans')
        .join('qr_codes', 'qr_code_scans.qr_code_id', 'qr_codes.id')
        .join('id_cards', 'qr_codes.card_id', 'id_cards.id')
        .where('id_cards.tenant_id', tenantId)
        .where('qr_code_scans.scanned_at', '>=', new Date(now.getTime() - 15 * 60 * 1000)) // Last 15 minutes
        .where('qr_code_scans.result', '!=', 'success')
        .select('qr_code_scans.scanning_device_id')
        .count('* as count')
        .groupBy('qr_code_scans.scanning_device_id')
        .having(this.db.raw('COUNT(*) >= ?', [5]));

      for (const attempt of bruteForceAttempts) {
        alerts.push({
          alertType: 'brute_force_attempt',
          severity: 'high',
          deviceId: attempt.scanning_device_id,
          description: `Possible brute force attack: Device ${attempt.scanning_device_id} has ${attempt.count} failed attempts in 15 minutes`,
          timestamp: now,
          metadata: { failedAttempts: attempt.count, timeWindow: '15 minutes' },
        });
      }

      // Detect expired card usage attempts
      const expiredCardAttempts = await this.db('qr_code_scans')
        .join('qr_codes', 'qr_code_scans.qr_code_id', 'qr_codes.id')
        .join('id_cards', 'qr_codes.card_id', 'id_cards.id')
        .where('id_cards.tenant_id', tenantId)
        .where('qr_code_scans.scanned_at', '>=', last24Hours)
        .where('qr_code_scans.result', 'expired')
        .select(
          'id_cards.user_id',
          this.db.raw('COUNT(*) as count'),
          this.db.raw('MAX(qr_code_scans.scanned_at) as last_attempt')
        )
        .groupBy('id_cards.user_id')
        .having(this.db.raw('COUNT(*) > ?', [3]));

      for (const attempt of expiredCardAttempts) {
        alerts.push({
          alertType: 'expired_card_usage',
          severity: 'medium',
          userId: attempt.user_id,
          description: `User ${attempt.user_id} attempted to use expired card ${attempt.count} times`,
          timestamp: new Date(attempt.last_attempt),
          metadata: { attempts: attempt.count },
        });
      }

      logger.info(`Detected ${alerts.length} security alerts for tenant ${tenantId}`);
      return alerts;
    } catch (error) {
      logger.error('Failed to detect security alerts', { tenantId, error });
      throw error;
    }
  }

  /**
   * Get scan history for analytics
   */
  async getScanHistory(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      const scans = await this.db('qr_code_scans')
        .join('qr_codes', 'qr_code_scans.qr_code_id', 'qr_codes.id')
        .join('id_cards', 'qr_codes.card_id', 'id_cards.id')
        .join('users as scanned_users', 'id_cards.user_id', 'scanned_users.id')
        .join('users as scanning_users', 'qr_code_scans.scanning_user_id', 'scanning_users.id')
        .where('id_cards.tenant_id', tenantId)
        .whereBetween('qr_code_scans.scanned_at', [startDate, endDate])
        .select(
          'qr_code_scans.scanned_at',
          'qr_code_scans.result',
          'qr_code_scans.failure_reason',
          'scanned_users.first_name as scanned_first_name',
          'scanned_users.last_name as scanned_last_name',
          'scanned_users.role as scanned_role',
          'scanning_users.first_name as scanning_first_name',
          'scanning_users.last_name as scanning_last_name',
          'qr_code_scans.scanning_device_id'
        )
        .orderBy('qr_code_scans.scanned_at', 'desc')
        .limit(1000);

      return scans;
    } catch (error) {
      logger.error('Failed to get scan history', { tenantId, error });
      throw error;
    }
  }
}
