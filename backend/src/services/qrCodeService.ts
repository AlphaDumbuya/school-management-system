import { Knex } from 'knex';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { publicAppUrl } from '../utils/publicUrl.js';

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
  // Enrichment shown on a successful verification (looked up post-verify).
  memberId?: string;      // student_id / teacher_id
  className?: string;     // student's current class
  photoUrl?: string;      // ID photo
  schoolName?: string;    // tenant/school name
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
    cardId?: string,
    baseUrl?: string
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

      // Insert the row FIRST so we get a stable qr id. The QR image then encodes
      // a SHORT public URL (…/verify-id?c=<id>) instead of a huge base64 blob —
      // short URLs make far sparser, more reliably scannable QR codes.
      const qrInsertData: any = {
        content: contentString,
        security_hash: securityHash,
        expires_at: expirationDate,
        is_valid: true,
        created_at: new Date(),
      };
      if (cardId) {
        qrInsertData.card_id = cardId;
      }

      const [qrCode] = await this.db('qr_codes')
        .insert(qrInsertData)
        .returning('*');

      // Build the compact scan URL from the stored id.
      const scanTarget = this.buildVerificationUrl(qrCode.id, baseUrl);

      // Generate QR code image with error correction level H (30% damage recovery)
      const imageDataUrl = await QRCode.toDataURL(scanTarget, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: this.QR_CODE_SIZE,
        margin: 1,
      });

      // Store the rendered image back on the row.
      await this.db('qr_codes')
        .where({ id: qrCode.id })
        .update({ image_url: imageDataUrl });

      logger.info(`Generated QR code for user ${userId}`, {
        qrCodeId: qrCode.id,
        expiresAt: expirationDate,
        scanTarget,
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

      // Check if QR code is revoked.
      //
      // IMPORTANT: the security_hash is derived from userId+name+role+expiry, so
      // regenerating a card produces MULTIPLE qr_codes rows that share the SAME
      // hash (older ones is_valid=false, the current one is_valid=true). A naive
      // `.first()` on the hash returns the OLDEST row and wrongly reports a valid
      // card as revoked. We instead treat the card as valid if ANY qr row with
      // this hash is still valid (i.e. it hasn't been fully revoked/replaced).
      const anyValidQr = await this.db('qr_codes')
        .where({ security_hash: content.securityHash, is_valid: true })
        .first();

      if (!anyValidQr) {
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

      // Enrich the result with the member's ID number, class, photo and school
      // so the public verify screen can show a richer, more trustworthy card.
      const extra = await this.enrichVerification(content.userId, content.role, tenantId);

      return {
        isValid: true,
        userId: content.userId,
        userName: content.name,
        role: content.role,
        expirationDate,
        ...extra,
      };
    } catch (error) {
      logger.error('Failed to verify QR code', { error });
      throw error;
    }
  }

  /**
   * Look up extra display fields for a verified member: their ID number, class
   * (students), photo and the school name. Never throws — returns {} on failure
   * so a lookup hiccup can't turn a valid card into an error.
   */
  private async enrichVerification(
    userId: string,
    role: string,
    tenantId: string
  ): Promise<{ memberId?: string; className?: string; photoUrl?: string; schoolName?: string }> {
    const out: { memberId?: string; className?: string; photoUrl?: string; schoolName?: string } = {};
    try {
      // School name (tenant/school).
      try {
        const school = await this.db('schools').where({ tenant_id: tenantId }).first().catch(() => null);
        const tenant = school ? null : await this.db('tenants').where({ id: tenantId }).first().catch(() => null);
        out.schoolName = school?.name || tenant?.name || undefined;
      } catch { /* ignore */ }

      const r = (role || '').toLowerCase();
      if (r === 'student') {
        // Student row is linked to the user via user_id.
        const student = await this.db('students')
          .where({ user_id: userId, tenant_id: tenantId })
          .first()
          .catch(() => null);
        if (student) {
          out.memberId = student.student_id || undefined;
          out.photoUrl = student.photo_url || undefined;
          // Current active class via enrollments → classes.
          const cls = await this.db('enrollments')
            .join('classes', 'enrollments.class_id', 'classes.id')
            .where('enrollments.student_id', student.id)
            .whereIn('enrollments.status', ['active', 'enrolled'])
            .orderBy('enrollments.enrollment_date', 'desc')
            .select('classes.name as name')
            .first()
            .catch(() => null);
          out.className = cls?.name || undefined;
        }
      } else {
        // Teacher / staff: id + photo from users (+ teachers for the staff id).
        const user = await this.db('users').where({ id: userId }).first().catch(() => null);
        if (user) out.photoUrl = user.photo_url || out.photoUrl;
        const teacher = await this.db('teachers').where({ user_id: userId }).first().catch(() => null);
        if (teacher) out.memberId = teacher.teacher_id || undefined;
      }
    } catch (err) {
      logger.warn(`enrichVerification failed for user ${userId}: ${String((err as any)?.message || err)}`);
    }
    return out;
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
  private buildVerificationUrl(qrId: string, baseUrl?: string): string {
    // Prefer an explicitly-provided origin (derived from the request, so the QR
    // points to wherever the app is actually served). Fall back to env config.
    const base = (baseUrl || publicAppUrl()).replace(/\/+$/, '');
    const path = `/verify-id?c=${qrId}`;
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
    await this.ensureColumnType();
    const v = (scannedValue || '').trim();
    if (!v) return { isValid: false, failureReason: 'invalid_format' };

    // 1) Short URL / bare id form: …/verify-id?c=<qrId>  or just a UUID.
    const qrId = this.extractQrId(v);
    if (qrId) {
      const row = await this.db('qr_codes').where({ id: qrId }).first();
      if (!row || !row.content) {
        return { isValid: false, failureReason: 'invalid_format' };
      }
      const parsed = this.decodeQrContent(row.content);
      if (!parsed) return { isValid: false, failureReason: 'invalid_format' };
      const tenantId = parsed.tenantId || (await this.resolveTenantFromCard(row.card_id));
      if (!tenantId) return { isValid: false, failureReason: 'invalid_format' };
      return this.verifyQrCode(row.content, parsed.userId, scanningDeviceId, tenantId);
    }

    // 2) Legacy: raw JSON content or base64url payload embedded in a URL.
    const contentString = this.extractContentString(v);
    const parsed = this.decodeQrContent(contentString);
    if (!parsed) return { isValid: false, failureReason: 'invalid_format' };
    const tenantId = parsed.tenantId || (await this.resolveTenantByHash(parsed.securityHash));
    if (!tenantId) return { isValid: false, failureReason: 'invalid_format' };
    return this.verifyQrCode(contentString, parsed.userId, scanningDeviceId, tenantId);
  }

  /** Pull a qr_codes.id (UUID) out of a scanned short URL or bare value. */
  private extractQrId(scannedValue: string): string | null {
    const v = (scannedValue || '').trim();
    const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const paramMatch = v.match(/[?#&]c=([^&\s]+)/);
    if (paramMatch && uuidRe.test(paramMatch[1])) return paramMatch[1];
    if (uuidRe.test(v) && v.length <= 60) {
      const m = v.match(uuidRe);
      return m ? m[0] : null;
    }
    return null;
  }

  /** Resolve tenant from the card linked to a QR (for legacy QRs missing tenantId). */
  private async resolveTenantFromCard(cardId?: string): Promise<string | null> {
    if (!cardId) return null;
    const card = await this.db('id_cards').where({ id: cardId }).first();
    return card?.tenant_id || null;
  }

  /** Resolve tenant by matching a stored QR's card → id_cards.tenant_id via security hash. */
  private async resolveTenantByHash(securityHash?: string): Promise<string | null> {
    if (!securityHash) return null;
    const row = await this.db('qr_codes')
      .join('id_cards', 'qr_codes.card_id', 'id_cards.id')
      .where('qr_codes.security_hash', securityHash)
      .select('id_cards.tenant_id')
      .first();
    return row?.tenant_id || null;
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
    // Deterministic secret derived from the tenant id. This is the SAME on
    // every call, so a hash created at generation time always matches at
    // verification time — even if the tenant_secrets row can't be read/written.
    // Using it as the canonical value fixes the previous bug where a random
    // secret was regenerated per call (making every scan fail invalid_hash).
    const deterministic = crypto
      .createHash('sha256')
      .update(`wiskul_tenant_secret_${tenantId}`)
      .digest('hex');

    try {
      const existing = await this.db('tenant_secrets')
        .where({ tenant_id: tenantId, is_active: true })
        .orderBy('created_at', 'asc')
        .first();

      if (existing?.secret_key_hash) {
        return existing.secret_key_hash;
      }

      // No secret yet — persist the DETERMINISTIC one (not a random value) so
      // it's stable across processes. valid_from/valid_until are NOT NULL.
      const now = new Date();
      const until = new Date();
      until.setFullYear(until.getFullYear() + 5);
      try {
        await this.db('tenant_secrets').insert({
          tenant_id: tenantId,
          secret_key_hash: deterministic,
          valid_from: now,
          valid_until: until,
          is_active: true,
          created_at: now,
        });
        logger.info(`Auto-generated tenant secret for tenant ${tenantId}`);
      } catch (insertErr) {
        // If the row already exists (race) or insert fails, fall through — the
        // deterministic value is still correct and stable.
        logger.warn(`tenant_secrets insert skipped for ${tenantId}`, { insertErr: (insertErr as Error)?.message });
      }

      return deterministic;
    } catch {
      // DB read failed entirely — deterministic value keeps generate/verify aligned.
      return deterministic;
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
