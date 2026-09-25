import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types/auth';
import { logger } from '../utils/logger';

/**
 * Resolve a required signing secret.
 *
 * In production a missing secret is a hard failure — we NEVER fall back to a
 * repo-visible placeholder (that would make admin tokens forgeable). Boot-time
 * validation in utils/env.ts already blocks this, but we enforce it here too as
 * defence-in-depth. In non-production we allow a clearly-marked dev fallback so
 * local onboarding isn't blocked.
 */
function requireSecret(name: 'JWT_SECRET' | 'REFRESH_TOKEN_SECRET'): string {
  const value = process.env[name];
  if (value && value.length >= 32) return value;
  if ((process.env.NODE_ENV || 'development') === 'production') {
    throw new Error(`${name} is missing or too short — refusing to sign tokens in production`);
  }
  logger.warn(`${name} not set (or <32 chars); using an INSECURE development-only fallback.`);
  return `dev-only-insecure-${name.toLowerCase()}-do-not-use-in-production`;
}

const JWT_SECRET = requireSecret('JWT_SECRET');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '30m';
const REFRESH_TOKEN_SECRET = requireSecret('REFRESH_TOKEN_SECRET');
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

export class JWTService {
  /**
   * Generate access token
   */
  static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    try {
      const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRY,
        algorithm: 'HS256',
      });
      return token;
    } catch (error) {
      logger.error('Error generating access token', error);
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(userId: string): string {
    try {
      const token = jwt.sign({ userId }, REFRESH_TOKEN_SECRET, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
        algorithm: 'HS256',
      });
      return token;
    } catch (error) {
      logger.error('Error generating refresh token', error);
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256'],
      }) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): { userId: string } {
    try {
      const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET, {
        algorithms: ['HS256'],
      }) as { userId: string };
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      return decoded;
    } catch (error) {
      logger.error('Error decoding token', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) {
        return true;
      }
      return decoded.exp * 1000 < Date.now();
    } catch (error) {
      return true;
    }
  }
}
