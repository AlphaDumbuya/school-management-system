import { describe, it, expect } from 'vitest';
import { PasswordService } from '../passwordService';

describe('PasswordService', () => {
  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPassword123!';
      const hash = await PasswordService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(10);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'TestPassword123!';
      const hash1 = await PasswordService.hashPassword(password);
      const hash2 = await PasswordService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should verify correct password', async () => {
      const password = 'TestPassword123!';
      const hash = await PasswordService.hashPassword(password);
      const isValid = await PasswordService.comparePassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await PasswordService.hashPassword(password);
      const isValid = await PasswordService.comparePassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });

    it('should handle empty passwords', async () => {
      const hash = await PasswordService.hashPassword('TestPassword123!');
      const isValid = await PasswordService.comparePassword('', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('validatePasswordPolicy', () => {
    it('should accept valid password', () => {
      const result = PasswordService.validatePasswordPolicy('SecurePass123!');

      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('should reject password too short', () => {
      const result = PasswordService.validatePasswordPolicy('Short1!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase', () => {
      const result = PasswordService.validatePasswordPolicy('password123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = PasswordService.validatePasswordPolicy('PASSWORD123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = PasswordService.validatePasswordPolicy('SecurePass!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const result = PasswordService.validatePasswordPolicy('SecurePass123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should accept password with various special characters', () => {
      const specialChars = ['!', '@', '#', '$', '%', '^', '&', '*'];

      specialChars.forEach((char) => {
        const result = PasswordService.validatePasswordPolicy(`SecurePass123${char}`);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe('generateTemporaryPassword', () => {
    it('should generate temporary password', () => {
      const password = PasswordService.generateTemporaryPassword();

      expect(password).toBeDefined();
      expect(password.length).toBeGreaterThanOrEqual(12);
    });

    it('should generate different passwords each time', () => {
      const password1 = PasswordService.generateTemporaryPassword();
      const password2 = PasswordService.generateTemporaryPassword();

      expect(password1).not.toBe(password2);
    });

    it('generated password should meet policy requirements', () => {
      const password = PasswordService.generateTemporaryPassword();
      const validation = PasswordService.validatePasswordPolicy(password);

      expect(validation.valid).toBe(true);
    });
  });
});
