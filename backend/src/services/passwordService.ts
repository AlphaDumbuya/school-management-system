import bcrypt from 'bcryptjs';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 10;

// Password policy constants
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REQUIRE_UPPERCASE = true;
const PASSWORD_REQUIRE_LOWERCASE = true;
const PASSWORD_REQUIRE_NUMBERS = true;
const PASSWORD_REQUIRE_SPECIAL = true;

export class PasswordService {
  /**
   * Hash password
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const salt = await bcrypt.genSalt(SALT_ROUNDS);
      const hashedPassword = await bcrypt.hash(password, salt);
      return hashedPassword;
    } catch (error) {
      logger.error('Error hashing password', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Compare password with hash
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    try {
      const isMatch = await bcrypt.compare(password, hash);
      return isMatch;
    } catch (error) {
      logger.error('Error comparing password', error);
      throw new Error('Failed to compare password');
    }
  }

  /**
   * Validate password policy
   */
  static validatePasswordPolicy(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check minimum length
    if (password.length < PASSWORD_MIN_LENGTH) {
      errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
    }

    // Check for uppercase
    if (PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check for lowercase
    if (PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check for numbers
    if (PASSWORD_REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for special characters
    if (PASSWORD_REQUIRE_SPECIAL && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate temporary password
   */
  static generateTemporaryPassword(): string {
    const length = 12;
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    // Ensure at least one of each required character type
    password += 'A'; // uppercase
    password += 'a'; // lowercase
    password += '1'; // number
    password += '!'; // special

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }

  /**
   * Generate password reset token
   */
  static generatePasswordResetToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
