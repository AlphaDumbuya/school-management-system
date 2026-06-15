import { Knex } from 'knex';
import { logger } from '../utils/logger.js';
import * as crypto from 'crypto';

/**
 * Security Service
 * Phase 2.1: Identity Management Module
 * 
 * Manages security features including tenant secret management,
 * photo encryption, and security initialization.
 */

export class SecurityService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16;
  private readonly SALT_LENGTH = 64;
  private readonly TAG_LENGTH = 16;
  private readonly SECRET_VALID_DAYS = 90;

  constructor(private db: Knex) {}

  /**
   * Initialize tenant secrets on tenant creation
   * Requirements: 7.1, 7.2
   */
  async initializeTenantSecrets(tenantId: string): Promise<void> {
    try {
      // Check if tenant already has secrets
      const existingSecret = await this.db('tenant_secrets')
        .where({ tenant_id: tenantId, is_active: true })
        .first();

      if (existingSecret) {
        logger.info(`Tenant ${tenantId} already has active secrets`);
        return;
      }

      // Generate new secret
      const secretKey = crypto.randomBytes(32).toString('hex');
      const secretKeyHash = crypto
        .createHash('sha256')
        .update(secretKey)
        .digest('hex');

      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + this.SECRET_VALID_DAYS);

      // Store secret
      await this.db('tenant_secrets').insert({
        tenant_id: tenantId,
        secret_key_hash: secretKeyHash,
        valid_from: validFrom,
        valid_until: validUntil,
        is_active: true,
        created_at: new Date(),
      });

      logger.info(`Initialized secrets for tenant ${tenantId}`, {
        validFrom,
        validUntil,
      });
    } catch (error) {
      logger.error('Failed to initialize tenant secrets', { tenantId, error });
      throw error;
    }
  }

  /**
   * Rotate tenant secrets (90-day cycle)
   * Requirements: 7.2
   */
  async rotateTenantSecret(tenantId: string): Promise<void> {
    try {
      await this.db.transaction(async (trx) => {
        // Get current active secret
        const currentSecret = await trx('tenant_secrets')
          .where({ tenant_id: tenantId, is_active: true })
          .first();

        if (!currentSecret) {
          throw new Error(`No active secret found for tenant ${tenantId}`);
        }

        // Generate new secret
        const newSecretKey = crypto.randomBytes(32).toString('hex');
        const newSecretKeyHash = crypto
          .createHash('sha256')
          .update(newSecretKey)
          .digest('hex');

        const validFrom = new Date();
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + this.SECRET_VALID_DAYS);

        // Insert new secret
        await trx('tenant_secrets').insert({
          tenant_id: tenantId,
          secret_key_hash: newSecretKeyHash,
          valid_from: validFrom,
          valid_until: validUntil,
          is_active: true,
          created_at: new Date(),
        });

        // Keep old secret active for 24-hour overlap
        const overlapEnd = new Date();
        overlapEnd.setHours(overlapEnd.getHours() + 24);

        if (new Date(currentSecret.valid_until) > overlapEnd) {
          await trx('tenant_secrets')
            .where({ id: currentSecret.id })
            .update({
              valid_until: overlapEnd,
            });
        }

        // Deactivate old secret after overlap
        setTimeout(async () => {
          await this.db('tenant_secrets')
            .where({ id: currentSecret.id })
            .update({ is_active: false });
        }, 24 * 60 * 60 * 1000); // 24 hours

        logger.info(`Rotated secrets for tenant ${tenantId}`, {
          oldSecretId: currentSecret.id,
          validFrom,
          validUntil,
        });
      });
    } catch (error) {
      logger.error('Failed to rotate tenant secret', { tenantId, error });
      throw error;
    }
  }

  /**
   * Get active tenant secret
   * Requirements: 7.1
   */
  async getActiveTenantSecret(tenantId: string): Promise<string> {
    try {
      const secret = await this.db('tenant_secrets')
        .where({ tenant_id: tenantId, is_active: true })
        .where('valid_until', '>', new Date())
        .orderBy('created_at', 'desc')
        .first();

      if (!secret) {
        throw new Error(`No active secret found for tenant ${tenantId}`);
      }

      return secret.secret_key_hash;
    } catch (error) {
      logger.error('Failed to get active tenant secret', { tenantId, error });
      throw error;
    }
  }

  /**
   * Encrypt photo data at rest
   * Requirements: 7.6
   */
  async encryptPhoto(photoBuffer: Buffer, tenantId: string): Promise<string> {
    try {
      // Get tenant secret
      const secretHash = await this.getActiveTenantSecret(tenantId);

      // Generate encryption key from secret
      const key = Buffer.from(secretHash.substring(0, 64), 'hex');

      // Generate random IV
      const iv = crypto.randomBytes(this.IV_LENGTH);

      // Create cipher
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      // Encrypt photo
      const encrypted = Buffer.concat([
        cipher.update(photoBuffer),
        cipher.final(),
      ]);

      // Get authentication tag
      const tag = cipher.getAuthTag();

      // Combine IV + tag + encrypted data
      const combined = Buffer.concat([iv, tag, encrypted]);

      // Return as base64
      return combined.toString('base64');
    } catch (error) {
      logger.error('Failed to encrypt photo', { tenantId, error });
      throw error;
    }
  }

  /**
   * Decrypt photo data
   * Requirements: 7.6
   */
  async decryptPhoto(encryptedData: string, tenantId: string): Promise<Buffer> {
    try {
      // Get tenant secret
      const secretHash = await this.getActiveTenantSecret(tenantId);

      // Generate decryption key from secret
      const key = Buffer.from(secretHash.substring(0, 64), 'hex');

      // Decode base64
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract IV, tag, and encrypted data
      const iv = combined.subarray(0, this.IV_LENGTH);
      const tag = combined.subarray(this.IV_LENGTH, this.IV_LENGTH + this.TAG_LENGTH);
      const encrypted = combined.subarray(this.IV_LENGTH + this.TAG_LENGTH);

      // Create decipher
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
      decipher.setAuthTag(tag);

      // Decrypt photo
      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt photo', { tenantId, error });
      throw error;
    }
  }

  /**
   * Check for secrets that need rotation
   */
  async checkSecretsForRotation(): Promise<void> {
    try {
      const rotationThreshold = new Date();
      rotationThreshold.setDate(rotationThreshold.getDate() + 7); // Rotate 7 days before expiry

      const secretsNeedingRotation = await this.db('tenant_secrets')
        .where({ is_active: true })
        .where('valid_until', '<', rotationThreshold)
        .where('valid_until', '>', new Date())
        .select('tenant_id')
        .distinct();

      for (const secret of secretsNeedingRotation) {
        try {
          await this.rotateTenantSecret(secret.tenant_id);
          logger.info(`Auto-rotated secrets for tenant ${secret.tenant_id}`);
        } catch (error) {
          logger.error(`Failed to auto-rotate secrets for tenant ${secret.tenant_id}`, {
            error,
          });
        }
      }

      logger.info(`Checked secrets for rotation, rotated ${secretsNeedingRotation.length} tenants`);
    } catch (error) {
      logger.error('Failed to check secrets for rotation', { error });
      throw error;
    }
  }

  /**
   * Clean up expired secrets
   */
  async cleanupExpiredSecrets(): Promise<void> {
    try {
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Deactivate secrets expired more than 30 days ago
      const result = await this.db('tenant_secrets')
        .where({ is_active: true })
        .where('valid_until', '<', thirtyDaysAgo)
        .update({ is_active: false });

      logger.info(`Cleaned up ${result} expired secrets`);
    } catch (error) {
      logger.error('Failed to cleanup expired secrets', { error });
      throw error;
    }
  }
}
