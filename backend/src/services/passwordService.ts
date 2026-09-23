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
   * Generate temporary password.
   *
   * Uses an UNAMBIGUOUS character set — no 0/O, 1/l/I — so principals can read
   * out the demo password and account holders can type it without the common
   * "invalid password" confusion. Still meets the policy (upper, lower, digit,
   * special) and stays 12 chars long.
   */
  static generateTemporaryPassword(): string {
    const length = 12;
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I, O
    const lower = 'abcdefghijkmnpqrstuvwxyz';    // no l, o
    const digits = '23456789';                   // no 0, 1
    const special = '!@#$%^&*';
    const all = upper + lower + digits + special;
    const pick = (set: string) => set.charAt(Math.floor(Math.random() * set.length));

    let password = pick(upper) + pick(lower) + pick(digits) + pick(special);
    for (let i = password.length; i < length; i++) password += pick(all);

    // Shuffle so the guaranteed chars aren't always in the same position.
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Generate password reset token
   */
  static generatePasswordResetToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
