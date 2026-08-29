import { Knex } from 'knex';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { logger } from '../utils/logger.js';

/**
 * QR Code Service
 * Phase 2.1: Identity Management Module
 * 
 * Handles secure QR code generation, verification, and management for ID cards.
 * Implements SHA-256 security hashes with tenant-specific secrets, rate limiting,
 * brute-force protection, and comprehensive scan logging.
 */

export interface QrCodeData {
  qrCodeId: string;
  content: string;  // Encoded data
  imageDataUrl: string;  // Base64 encoded PNG
  securityHash: string;
}

export interface QrVerificationResult {
  isValid: boolean;
  userId?: string;
  userName?: string;
  role?: string;
  expirationDate?: Date;
  failureReason?: string;
}

export interface ScanLog {
  scannedUserId?: string;
  scanningUserId: string;
  scanningDeviceId: string;
  timestamp: Date;
  result: 'success' | 'invalid_hash' | 'expired' | 'revoked' | 'not_found';
  failureReason?: string;
}

interface QrCodeContent {
  userId: string;
  name: string;
  role: string;
  expirationDate: string;
  securityHash: string;
  tenantId?: string;
}

export class QrCodeService {
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  private readonly RATE_LIMIT_MAX_REQUESTS = 10;
  private readonly BRUTE_FORCE_THRESHOLD = 5;
  private readonly BRUTE_FORCE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  private readonly BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  private readonly QR_CODE_SIZE = 300; // 300x300 pixels at 300 DPI = ~1 inch

  private schemaChecked = false;

  constructor(private db: Knex) {}

  private async ensureColumnType() {
    if (this.schemaChecked) return;
    try {
      await this.db.raw('ALTER TABLE qr_codes ALTER COLUMN image_url TYPE text').catch(() => {});
      await this.db.raw('ALTER TABLE qr_codes ALTER COLUMN card_id DROP NOT NULL').catch(() => {});
      this.schemaChecked = true;
    } catch {
      this.schemaChecked = true;
    }
  }

  /**
   * Generate a secure QR code with embedded security hash
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  async generateQrCode(
    userId: string,
    tenantId: string,
    expirationDate: Date,
    cardId?: string
  ): Promise<QrCodeData> {
    try {
      await this.ensureColumnType();
      // Retrieve user information
      const user = await this.db('users')
        .where({ id: userId, tenant_id: tenantId })
        .first();

      if (!user) {
        throw new Error(`User ${userId} not found for tenant ${tenantId}`);
      }

      // Get active tenant secret
      const secret = await this.getActiveTenantSecret(tenantId);
      if (!secret) {
        throw new Error(`No active secret found for tenant ${tenantId}`);
      }

      const userName = `${user.first_name} ${user.last_name}`;

      // Generate security hash
      const securityHash = this.generateSecurityHash(
        userId,
        userName,
        user.role,
        expirationDate.toISOString(),
        secret
      );

      // Create QR code content (stored raw in DB for the authenticated verify tab)
      const content: QrCodeContent = {
        userId,
        name: userName,
        role: user.role,
        expirationDate: expirationDate.toISOString(),
        securityHash,
        tenantId,
      };

      const contentString = this.encodeQrContent(content);

      // The image encodes a PUBLIC verification URL so ANY phone camera scan
      // opens a live "Verify ID" page (rather than showing raw JSON that does
      // nothing). The full payload is embedded in a URL-safe base64 param.
      const scanTarget = this.buildVerificationUrl(contentString);

      // Generate QR code image with error correction level H (30% damage recovery)
      const imageDataUrl = await QRCode.toDataURL(scanTarget, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: this.QR_CODE_SIZE,
        margin: 1,
      });

      const qrInsertData: any = {
        content: contentString,
        security_hash: securityHash,
        image_url: imageDataUrl,
        expires_at: expirationDate,
        is_valid: true,
        created_at: new Date(),
      };
      if (cardId) {
        qrInsertData.card_id = cardId;
      }

      // Store QR code in database
      const [qrCode] = await this.db('qr_codes')
        .insert(qrInsertData)
        .returning('*');

      logger.info(`Generated QR code for user ${userId}`, {
        qrCodeId: qrCode.id,
        expiresAt: expirationDate,
      });

      return {
        qrCodeId: qrCode.id,
        content: contentString,
        imageDataUrl,
        securityHash,
      };
    } catch (error) {
      logger.error('Failed to generate QR code', { userId, error });
      throw error;
    }
  }

  /**
   * Verify a scanned QR code
   * Requirements: 2.5, 2.6, 2.7, 2.8, 7.4, 7.5
   */
  async verifyQrCode(
    qrCodeContent: string,
    scanningUserId: string,
    scanningDeviceId: string,
    tenantId: string
  ): Promise<QrVerificationResult> {
    try {
      // Check if device is blocked
      const isBlocked = await this.isDeviceBlocked(scanningDeviceId);
      if (isBlocked) {
        await this.logScan({
          scanningUserId,
          scanningDeviceId,
          timestamp: new Date(),
          result: 'invalid_hash',
          failureReason: 'Device temporarily blocked due to multiple failed attempts',
        });

        return {
          isValid: false,
          failureReason: 'device_blocked',
        };
      }

      // Check rate limit
      const isRateLimited = await this.checkRateLimit(scanningDeviceId);
      if (isRateLimited) {
        await this.logScan({
          scanningUserId,
          scanningDeviceId,
          timestamp: new Date(),
          result: 'invalid_hash',
          failureReason: 'Rate limit exceeded',
        });

        return {
          isValid: false,
          failureReason: 'rate_limit_exceeded',
        };
      }

      // Decode QR code content (accept raw JSON, a scanned verify URL, or base64url)
      const content = this.decodeQrContent(this.extractContentString(qrCodeContent));
      if (!content) {
        await this.logScan({
          scanningUserId,
          scanningDeviceId,
          timestamp: new Date(),
          result: 'not_found',
          failureReason: 'Invalid QR code format',
        });

        return {
          isValid: false,
          failureReason: 'invalid_format',
        };
      }

      // Check expiration
      const expirationDate = new Date(content.expirationDate);
      if (new Date() > expirationDate) {
        await this.logScan({
          scannedUserId: content.userId,
          scanningUserId,
          scanningDeviceId,
          timestamp: new Date(),
          result: 'expired',
          failureReason: 'QR code has expired',
        });

        return {
          isValid: false,
          userId: content.userId,
          userName: content.name,
          role: content.role,
          expirationDate,
          failureReason: 'expired',
        };
      }

      // Get active tenant secret
      const secret = await this.getActiveTenantSecret(tenantId);
      if (!secret) {
        throw new Error(`No active secret found for tenant ${tenantId}`);
      }

      // Verify security hash
      const expectedHash = this.generateSecurityHash(
        content.userId,
        content.name,
        content.role,
        content.expirationDate,
        secret
      );

      if (content.securityHash !== expectedHash) {
        // Check failed verification count for brute-force protection
        await this.incrementFailedVerificationCount(scanningDeviceId);

        await this.logScan({
          scannedUserId: content.userId,
          scanningUserId,
          scanningDeviceId,
          timestamp: new Date(),
          result: 'invalid_hash',
          failureReason: 'Security hash verification failed',
        });

        return {
          isValid: false,
          userId: content.userId,
          failureReason: 'invalid_hash',
        };
      }

      // Check if QR code is revoked
      const qrCode = await this.db('qr_codes')
        .where({ security_hash: content.securityHash })
        .first();

      if (qrCode && !qrCode.is_valid) {
        await this.logScan({
          scannedUserId: content.userId,
          scanningUserId,
          scanningDeviceId,
          timestamp: new Date(),
          result: 'revoked',
          failureReason: 'QR code has been revoked',
        });

        return {
          isValid: false,
          userId: content.userId,
          userName: content.name,
          role: content.role,
          failureReason: 'revoked',
        };
      }

      // Verification successful
      await this.logScan({
        scannedUserId: content.userId,
        scanningUserId,
        scanningDeviceId,
        timestamp: new Date(),
        result: 'success',
      });

      // Reset failed verification count on successful scan
      await this.resetFailedVerificationCount(scanningDeviceId);

      return {
        isValid: true,
        userId: content.userId,
        userName: content.name,
        role: content.role,
        expirationDate,
      };
    } catch (error) {
      logger.error('Failed to verify QR code', { error });
      throw error;
    }
  }

  /**
   * Invalidate a QR code
   * Requirements: 2.8
   */
  async invalidateQrCode(qrCodeId: string): Promise<void> {
    try {
      await this.db('qr_codes')
        .where({ id: qrCodeId })
        .update({
          is_valid: false,
        });

      logger.info(`Invalidated QR code ${qrCodeId}`);
    } catch (error) {
      logger.error('Failed to invalidate QR code', { qrCodeId, error });
      throw error;
    }
  }

  /**
   * Invalidate all QR codes for a card
   */
  async invalidateQrCodesByCardId(cardId: string): Promise<void> {
    try {
      await this.db('qr_codes')
        .where({ card_id: cardId })
        .update({
          is_valid: false,
        });

      logger.info(`Invalidated all QR codes for card ${cardId}`);
    } catch (error) {
      logger.error('Failed to invalidate QR codes for card', { cardId, error });
      throw error;
    }
  }

  /**
   * Rotate tenant secret and update all active QR codes
   * Requirements: 7.2
   */
  async rotateTenantSecret(tenantId: string): Promise<void> {
    try {
      // Deactivate old secrets
      await this.db('tenant_secrets')
        .where({ tenant_id: tenantId, is_active: true })
        .update({
          is_active: false,
          valid_until: new Date(),
        });

      // Generate new secret
      const newSecret = crypto.randomBytes(32).toString('hex');
      const secretHash = crypto.createHash('sha256').update(newSecret).digest('hex');

      // Store new secret
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 90); // 90 days

      await this.db('tenant_secrets').insert({
        tenant_id: tenantId,
        secret_key_hash: secretHash,
        valid_from: validFrom,
        valid_until: validUntil,
        is_active: true,
        created_at: new Date(),
      });

      // Update all active QR codes with new security hashes
      const activeQrCodes = await this.db('qr_codes')
        .join('id_cards', 'qr_codes.card_id', 'id_cards.id')
        .where('id_cards.tenant_id', tenantId)
        .where('qr_codes.is_valid', true)
        .select('qr_codes.*');

      for (const qrCode of activeQrCodes) {
        const content = this.decodeQrContent(qrCode.content);
        if (content) {
          const newHash = this.generateSecurityHash(
            content.userId,
            content.name,
            content.role,
            content.expirationDate,
            newSecret
          );

          const newContent = { ...content, securityHash: newHash };
          const newContentString = this.encodeQrContent(newContent);

          await this.db('qr_codes')
            .where({ id: qrCode.id })
            .update({
              content: newContentString,
              security_hash: newHash,
            });
        }
      }

      logger.info(`Rotated tenant secret for tenant ${tenantId}`, {
        updatedQrCodes: activeQrCodes.length,
      });
    } catch (error) {
      logger.error('Failed to rotate tenant secret', { tenantId, error });
      throw error;
    }
  }

  /**
   * Log a QR code scan attempt
   * Requirements: 7.3
   */
  async logScan(scanData: ScanLog): Promise<void> {
    try {
      // Find QR code ID if scanned user is provided
      let qrCodeId: string | null = null;
      if (scanData.scannedUserId) {
        const qrCode = await this.db('qr_codes')
          .join('id_cards', 'qr_codes.card_id', 'id_cards.id')
          .where('id_cards.user_id', scanData.scannedUserId)
          .where('id_cards.status', 'active')
          .select('qr_codes.id')
          .first();

        qrCodeId = qrCode?.id || null;
      }

      await this.db('qr_code_scans').insert({
        qr_code_id: qrCodeId,
        scanned_user_id: scanData.scannedUserId,
        scanning_user_id: scanData.scanningUserId,
        scanning_device_id: scanData.scanningDeviceId,
        result: scanData.result,
        failure_reason: scanData.failureReason,
        scanned_at: scanData.timestamp,
      });
    } catch (error) {
      logger.error('Failed to log QR code scan', { scanData, error });
      // Don't throw - logging failures shouldn't break verification
    }
  }

  /**
   * Generate SHA-256 security hash
   * Requirements: 2.4, 7.1
   */
  private generateSecurityHash(
    userId: string,
    name: string,
    role: string,
    expirationDate: string,
    secret: string
  ): string {
    const data = `${userId}|${name}|${role}|${expirationDate}|${secret}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Build the public verification URL that the QR image encodes.
   * Reads APP_URL / FRONTEND_URL for the base, falling back to a relative path
   * so it still resolves when served from the same origin.
   */
  private buildVerificationUrl(contentString: string): string {
    const base = (
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_APP_URL ||
      ''
    ).replace(/\/+$/, '');
    const payload = Buffer.from(contentString, 'utf8').toString('base64url');
    const path = `/verify-id?d=${payload}`;
    return base ? `${base}${path}` : path;
  }

  /**
   * Encode QR code content to string
   */
  private encodeQrContent(content: QrCodeContent): string {
    return JSON.stringify(content);
  }

  /**
   * Public verification entry point. Accepts either the raw JSON content or a
   * scanned verification URL / base64url payload, resolves the tenant from the
   * embedded payload (no auth session required), and verifies.
   */
  async verifyScannedValue(
    scannedValue: string,
    scanningDeviceId: string
  ): Promise<QrVerificationResult> {
    const contentString = this.extractContentString(scannedValue);
    const parsed = this.decodeQrContent(contentString);
    if (!parsed || !parsed.tenantId) {
      return { isValid: false, failureReason: 'invalid_format' };
    }
    // Public scans have no logged-in user; attribute the scan to the holder.
    return this.verifyQrCode(contentString, parsed.userId, scanningDeviceId, parsed.tenantId);
  }

  /**
   * Normalise a scanned value into the raw JSON content string.
   * Handles: raw JSON, a full verify URL (?d=base64url), or a bare base64url payload.
   */
  private extractContentString(scannedValue: string): string {
    const v = (scannedValue || '').trim();
    if (!v) return v;
    // Already JSON?
    if (v.startsWith('{')) return v;
    // A URL containing ?d= or #d=
    const match = v.match(/[?#&]d=([^&]+)/);
    const b64 = match ? match[1] : (/^[A-Za-z0-9_-]+$/.test(v) ? v : null);
    if (b64) {
      try {
        const decoded = Buffer.from(b64, 'base64url').toString('utf8');
        if (decoded.startsWith('{')) return decoded;
      } catch { /* fall through */ }
    }
    return v;
  }

  /**
   * Decode QR code content from string
   */
  private decodeQrContent(contentString: string): QrCodeContent | null {
    try {
      const content = JSON.parse(contentString);
      if (
        content.userId &&
        content.name &&
        content.role &&
        content.expirationDate &&
        content.securityHash
      ) {
        return content;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get active tenant secret, auto-generating one if not already created
   */
  private async getActiveTenantSecret(tenantId: string): Promise<string> {
    try {
      const secret = await this.db('tenant_secrets')
        .where({ tenant_id: tenantId, is_active: true })
        .first();

      if (secret?.secret_key_hash) {
        return secret.secret_key_hash;
      }

      // Auto-generate active secret for tenant
      const secretKey = crypto.randomBytes(32).toString('hex');
      try {
        await this.db('tenant_secrets').insert({
          tenant_id: tenantId,
          secret_key_hash: secretKey,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
        logger.info(`Auto-generated tenant secret for tenant ${tenantId}`);
      } catch (insertErr) {
        // Table or unique constraint fallback
      }

      return secretKey;
    } catch (err) {
      // Deterministic fallback secret hash if database table read fails
      return crypto.createHash('sha256').update(`wiskul_tenant_secret_${tenantId}`).digest('hex');
    }
  }

  /**
   * Check if device has exceeded rate limit
   * Requirements: 7.4
   */
  private async checkRateLimit(deviceId: string): Promise<boolean> {
    const windowStart = new Date(Date.now() - this.RATE_LIMIT_WINDOW_MS);

    const count = await this.db('qr_code_scans')
      .where('scanning_device_id', deviceId)
      .where('scanned_at', '>', windowStart)
      .count('* as count')
      .first();

    return Number(count?.count || 0) >= this.RATE_LIMIT_MAX_REQUESTS;
  }

  /**
   * Check if device is blocked due to brute-force attempts
   * Requirements: 7.5
   */
  private async isDeviceBlocked(deviceId: string): Promise<boolean> {
    const windowStart = new Date(Date.now() - this.BRUTE_FORCE_WINDOW_MS);

    const failedCount = await this.db('qr_code_scans')
      .where('scanning_device_id', deviceId)
      .whereIn('result', ['invalid_hash', 'not_found'])
      .where('scanned_at', '>', windowStart)
      .count('* as count')
      .first();

    return Number(failedCount?.count || 0) >= this.BRUTE_FORCE_THRESHOLD;
  }

  /**
   * Increment failed verification count (for brute-force detection)
   */
  private async incrementFailedVerificationCount(deviceId: string): Promise<void> {
    // This is implicitly tracked through qr_code_scans table
    // The isDeviceBlocked method checks the count
  }

  /**
   * Reset failed verification count after successful scan
   */
  private async resetFailedVerificationCount(deviceId: string): Promise<void> {
    // No explicit reset needed - time-based window handles this automatically
  }
}
