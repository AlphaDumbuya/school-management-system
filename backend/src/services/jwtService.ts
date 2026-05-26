import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types/auth';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '30m';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your-refresh-secret-key-change-in-production';
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
