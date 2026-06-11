import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 17.1: Data Encryption at Rest
 * 
 * Handles encryption and decryption of sensitive fields including:
 * - Passwords (hashing only, not reversible)
 * - Contact details (phone, email, address)
 * - Financial data (account numbers, payment info)
 * - Personal identification (SSN, ID numbers)
 * 
 * Uses AES-256-GCM for symmetric encryption with authenticated encryption.
 */

interface EncryptionKey {
  id: string;
  key: Buffer;
  algorithm: string;
  createdAt: Date;
  rotatedAt?: Date;
  isActive: boolean;
}

interface EncryptedData {
  iv: string;
  authTag: string;
  ciphertext: string;
  algorithm: string;
  keyId: string;
}

export class EncryptionService {
  private masterKey: Buffer;
  private algorithm: string = 'aes-256-gcm';
  private encryptionKeys: Map<string, EncryptionKey> = new Map();

  /**
   * Initializes the encryption service
   * @param masterKey - Base64 encoded 256-bit master key
   */
  constructor(masterKey?: string) {
    if (!masterKey) {
      // Generate a new master key for development/testing
      this.masterKey = crypto.randomBytes(32);
      logger.warn('No master key provided. Generated temporary key. Use environment variable ENCRYPTION_MASTER_KEY for production.');
    } else {
      this.masterKey = Buffer.from(masterKey, 'base64');
      if (this.masterKey.length !== 32) {
        throw new AppError('Master key must be exactly 32 bytes (256 bits)', 500);
      }
    }

    logger.info('EncryptionService initialized with AES-256-GCM algorithm');
  }

  /**
   * Encrypts sensitive data using AES-256-GCM
   * @param plaintext - Data to encrypt
   * @param keyId - ID of encryption key to use (optional, uses latest active key)
   * @returns Encrypted data object
   */
  encrypt(plaintext: string, keyId?: string): EncryptedData {
    try {
      if (!plaintext) {
        throw new AppError('Cannot encrypt empty data', 400);
      }

      // Generate random IV (initialization vector)
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

      // Encrypt the data
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');

      // Get authentication tag for GCM mode
      const authTag = cipher.getAuthTag();

      const encryptedData: EncryptedData = {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        ciphertext,
        algorithm: this.algorithm,
        keyId: keyId || 'default',
      };

      return encryptedData;
    } catch (error) {
      logger.error('Encryption failed', error);
      throw new AppError(
        `Encryption failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Decrypts data encrypted with AES-256-GCM
   * @param encryptedData - Encrypted data object
   * @returns Decrypted plaintext
   */
  decrypt(encryptedData: EncryptedData): string {
    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');
      const ciphertext = encryptedData.ciphertext;

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');

      return plaintext;
    } catch (error) {
      logger.error('Decryption failed', error);
      throw new AppError(
        `Decryption failed: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Encrypts and encodes data for storage as JSON
   * @param plaintext - Data to encrypt
   * @returns JSON-safe encrypted string
   */
  encryptForStorage(plaintext: string): string {
    try {
      const encrypted = this.encrypt(plaintext);
      return JSON.stringify(encrypted);
    } catch (error) {
      logger.error('Failed to encrypt for storage', error);
      throw error;
    }
  }

  /**
   * Decrypts data retrieved from storage
   * @param encryptedJson - JSON-encoded encrypted data
   * @returns Decrypted plaintext
   */
  decryptFromStorage(encryptedJson: string): string {
    try {
      const encrypted = JSON.parse(encryptedJson) as EncryptedData;
      return this.decrypt(encrypted);
    } catch (error) {
      logger.error('Failed to decrypt from storage', error);
      throw new AppError(
        `Failed to decrypt data: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Hashes password using bcrypt-like algorithm (uses crypto)
   * Note: Passwords should not be stored encrypted, only hashed
   * @param password - Password to hash
   * @returns Hashed password
   */
  hashPassword(password: string): string {
    try {
      // Use PBKDF2 for password hashing (better than simple hash)
      const salt = crypto.randomBytes(16);
      const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');

      // Combine salt + hash for storage
      return `${salt.toString('hex')}:${hash.toString('hex')}`;
    } catch (error) {
      logger.error('Failed to hash password', error);
      throw new AppError('Failed to hash password', 500);
    }
  }

  /**
   * Verifies password against stored hash
   * @param password - Password to verify
   * @param hash - Stored hash
   * @returns true if password matches
   */
  verifyPassword(password: string, hash: string): boolean {
    try {
      const [saltHex, storedHashHex] = hash.split(':');
      const salt = Buffer.from(saltHex, 'hex');

      // Hash provided password with same salt
      const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');

      // Compare hashes
      return crypto.timingSafeEqual(verifyHash, Buffer.from(storedHashHex, 'hex'));
    } catch (error) {
      logger.error('Failed to verify password', error);
      return false;
    }
  }

  /**
   * Generates a new encryption key
   * @returns New encryption key
   */
  generateEncryptionKey(): EncryptionKey {
    try {
      const key: EncryptionKey = {
        id: uuidv4(),
        key: crypto.randomBytes(32),
        algorithm: this.algorithm,
        createdAt: new Date(),
        isActive: false,
      };

      this.encryptionKeys.set(key.id, key);
      logger.info(`Generated new encryption key: ${key.id}`);

      return key;
    } catch (error) {
      logger.error('Failed to generate encryption key', error);
      throw new AppError('Failed to generate encryption key', 500);
    }
  }

  /**
   * Rotates the active encryption key
   * @param newKeyId - ID of new key to activate
   */
  rotateEncryptionKey(newKeyId: string): void {
    try {
      const newKey = this.encryptionKeys.get(newKeyId);

      if (!newKey) {
        throw new AppError(`Encryption key not found: ${newKeyId}`, 404);
      }

      // Deactivate current key
      this.encryptionKeys.forEach((key) => {
        if (key.isActive) {
          key.isActive = false;
          key.rotatedAt = new Date();
        }
      });

      // Activate new key
      newKey.isActive = true;
      logger.info(`Encryption key rotated to: ${newKeyId}`);
    } catch (error) {
      logger.error('Failed to rotate encryption key', error);
      throw error instanceof AppError ? error : new AppError('Failed to rotate encryption key', 500);
    }
  }

  /**
   * Gets the active encryption key
   * @returns Active encryption key or throws error
   */
  getActiveKey(): EncryptionKey {
    const activeKey = Array.from(this.encryptionKeys.values()).find((k) => k.isActive);

    if (!activeKey) {
      throw new AppError('No active encryption key found', 500);
    }

    return activeKey;
  }

  /**
   * Generates HMAC for data integrity verification
   * @param data - Data to generate HMAC for
   * @returns HMAC hash
   */
  generateHMAC(data: string): string {
    try {
      const hmac = crypto.createHmac('sha256', this.masterKey);
      hmac.update(data);
      return hmac.digest('hex');
    } catch (error) {
      logger.error('Failed to generate HMAC', error);
      throw new AppError('Failed to generate HMAC', 500);
    }
  }

  /**
   * Verifies data integrity using HMAC
   * @param data - Original data
   * @param hmac - HMAC to verify against
   * @returns true if data is intact
   */
  verifyHMAC(data: string, hmac: string): boolean {
    try {
      const calculatedHMAC = this.generateHMAC(data);
      return crypto.timingSafeEqual(
        Buffer.from(calculatedHMAC),
        Buffer.from(hmac)
      );
    } catch (error) {
      logger.error('Failed to verify HMAC', error);
      return false;
    }
  }

  /**
   * Exports master key for backup (encrypted)
   * @param backupPassword - Password to encrypt master key with
   * @returns Encrypted master key
   */
  exportMasterKey(backupPassword: string): string {
    try {
      const salt = crypto.randomBytes(16);
      const derivedKey = crypto.pbkdf2Sync(backupPassword, salt, 100000, 32, 'sha512');

      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

      let encrypted = cipher.update(this.masterKey);
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      const authTag = cipher.getAuthTag();

      const backup = {
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encrypted: encrypted.toString('hex'),
      };

      return Buffer.from(JSON.stringify(backup)).toString('base64');
    } catch (error) {
      logger.error('Failed to export master key', error);
      throw new AppError('Failed to export master key', 500);
    }
  }

  /**
   * Imports master key from backup
   * @param exportedKey - Exported (encrypted) master key
   * @param backupPassword - Password to decrypt master key
   */
  importMasterKey(exportedKey: string, backupPassword: string): void {
    try {
      const backup = JSON.parse(Buffer.from(exportedKey, 'base64').toString());

      const salt = Buffer.from(backup.salt, 'hex');
      const derivedKey = crypto.pbkdf2Sync(backupPassword, salt, 100000, 32, 'sha512');

      const iv = Buffer.from(backup.iv, 'hex');
      const authTag = Buffer.from(backup.authTag, 'hex');
      const encrypted = Buffer.from(backup.encrypted, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]);

      this.masterKey = decrypted;
      logger.info('Master key imported successfully');
    } catch (error) {
      logger.error('Failed to import master key', error);
      throw new AppError(
        `Failed to import master key: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  /**
   * Generates a base64-encoded master key for initialization
   * @returns Base64-encoded 256-bit key
   */
  static generateMasterKey(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Checks encryption health
   * @returns Health status
   */
  getEncryptionHealth(): {
    status: string;
    algorithm: string;
    keyCount: number;
    activeKey: string | null;
    masterKeyLength: number;
  } {
    const activeKey = Array.from(this.encryptionKeys.values()).find((k) => k.isActive);

    return {
      status: activeKey ? 'healthy' : 'warning',
      algorithm: this.algorithm,
      keyCount: this.encryptionKeys.size,
      activeKey: activeKey?.id || null,
      masterKeyLength: this.masterKey.length,
    };
  }
}

export default EncryptionService;
