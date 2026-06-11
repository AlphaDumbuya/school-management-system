import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 17.2: HTTPS and Transport Security
 * 
 * Configures security headers and HTTPS/TLS settings:
 * - HSTS (HTTP Strict Transport Security)
 * - CSP (Content Security Policy)
 * - X-Frame-Options (Clickjacking protection)
 * - X-Content-Type-Options (MIME type sniffing)
 * - X-XSS-Protection (XSS protection)
 * - Referrer-Policy
 * - Permissions-Policy
 * - And more...
 */

export interface SecurityHeadersConfig {
  enableHSTS: boolean;
  hstsMaxAge: number;
  enableCSP: boolean;
  cspDirectives: Record<string, string>;
  enableFrameProtection: boolean;
  enableMimeTypeProtection: boolean;
  enableXSSProtection: boolean;
  enableReferrerPolicy: boolean;
  enablePermissionsPolicy: boolean;
  trustProxies: boolean;
  redirectHTTP: boolean;
}

export class SecurityHeadersService {
  private config: SecurityHeadersConfig;

  /**
   * Initializes security headers service
   * @param config - Security configuration
   */
  constructor(config?: Partial<SecurityHeadersConfig>) {
    this.config = {
      enableHSTS: true,
      hstsMaxAge: 31536000, // 1 year
      enableCSP: true,
      cspDirectives: {
        'default-src': "'self'",
        'script-src': "'self' 'unsafe-inline' 'unsafe-eval'",
        'style-src': "'self' 'unsafe-inline'",
        'img-src': "'self' data: https:",
        'font-src': "'self'",
        'connect-src': "'self'",
        'frame-ancestors': "'none'",
        'base-uri': "'self'",
        'form-action': "'self'",
      },
      enableFrameProtection: true,
      enableMimeTypeProtection: true,
      enableXSSProtection: true,
      enableReferrerPolicy: true,
      enablePermissionsPolicy: true,
      trustProxies: true,
      redirectHTTP: true,
      ...config,
    };

    logger.info('SecurityHeadersService initialized with configured policies');
  }

  /**
   * Express middleware to apply security headers
   * @returns Middleware function
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        // HTTPS Redirect (if not already HTTPS)
        if (this.config.redirectHTTP && req.protocol !== 'https' && !this.isLocalhost()) {
          return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
        }

        // HSTS (HTTP Strict-Transport-Security)
        if (this.config.enableHSTS) {
          res.setHeader(
            'Strict-Transport-Security',
            `max-age=${this.config.hstsMaxAge}; includeSubDomains; preload`
          );
        }

        // CSP (Content-Security-Policy)
        if (this.config.enableCSP) {
          const cspHeader = this.buildCSPHeader();
          res.setHeader('Content-Security-Policy', cspHeader);
          // Also set report-only for testing
          res.setHeader('Content-Security-Policy-Report-Only', cspHeader);
        }

        // X-Frame-Options (Clickjacking protection)
        if (this.config.enableFrameProtection) {
          res.setHeader('X-Frame-Options', 'DENY');
        }

        // X-Content-Type-Options (MIME sniffing protection)
        if (this.config.enableMimeTypeProtection) {
          res.setHeader('X-Content-Type-Options', 'nosniff');
        }

        // X-XSS-Protection
        if (this.config.enableXSSProtection) {
          res.setHeader('X-XSS-Protection', '1; mode=block');
        }

        // Referrer-Policy
        if (this.config.enableReferrerPolicy) {
          res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        }

        // Permissions-Policy (formerly Feature-Policy)
        if (this.config.enablePermissionsPolicy) {
          res.setHeader(
            'Permissions-Policy',
            [
              'accelerometer=()',
              'ambient-light-sensor=()',
              'autoplay=()',
              'battery=()',
              'camera=()',
              'cross-origin-isolated=()',
              'display-capture=()',
              'document-domain=()',
              'encrypted-media=()',
              'execution-while-not-rendered=()',
              'execution-while-out-of-viewport=()',
              'fullscreen=()',
              'geolocation=()',
              'gyroscope=()',
              'magnetometer=()',
              'microphone=()',
              'midi=()',
              'navigation-override=()',
              'payment=()',
              'picture-in-picture=()',
              'publickey-credentials-get=()',
              'sync-xhr=()',
              'usb=()',
              'vr=()',
              'xr-spatial-tracking=()',
            ].join(', ')
          );
        }

        // Additional headers
        res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
        res.setHeader('X-UA-Compatible', 'IE=edge');

        next();
      } catch (error) {
        logger.error('Error applying security headers', error);
        next();
      }
    };
  }

  /**
   * Builds CSP header string from configuration
   * @returns CSP header value
   */
  private buildCSPHeader(): string {
    return Object.entries(this.config.cspDirectives)
      .map(([directive, value]) => `${directive} ${value}`)
      .join('; ');
  }

  /**
   * Checks if request is from localhost
   * @returns true if localhost
   */
  private isLocalhost(): boolean {
    const host = process.env.NODE_ENV === 'development';
    return host || process.env.ALLOW_HTTP === 'true';
  }

  /**
   * Gets current security configuration
   * @returns Security configuration
   */
  getConfig(): SecurityHeadersConfig {
    return { ...this.config };
  }

  /**
   * Updates security configuration
   * @param config - New configuration
   */
  updateConfig(config: Partial<SecurityHeadersConfig>): void {
    try {
      this.config = { ...this.config, ...config };
      logger.info('Security headers configuration updated');
    } catch (error) {
      logger.error('Failed to update security configuration', error);
      throw new AppError('Failed to update security configuration', 500);
    }
  }

  /**
   * Adds CSP directive
   * @param directive - Directive name
   * @param value - Directive value
   */
  addCSPDirective(directive: string, value: string): void {
    this.config.cspDirectives[directive] = value;
    logger.info(`Added CSP directive: ${directive} ${value}`);
  }

  /**
   * Removes CSP directive
   * @param directive - Directive name
   */
  removeCSPDirective(directive: string): void {
    delete this.config.cspDirectives[directive];
    logger.info(`Removed CSP directive: ${directive}`);
  }

  /**
   * Validates HTTPS configuration
   * @returns Validation result
   */
  validateHTTPSConfiguration(): {
    status: string;
    isSecure: boolean;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    if (!process.env.HTTPS_ENABLED && process.env.NODE_ENV === 'production') {
      recommendations.push('HTTPS is not enabled in production');
    }

    if (!process.env.SSL_CERT_PATH) {
      recommendations.push('SSL certificate path not configured');
    }

    if (!process.env.SSL_KEY_PATH) {
      recommendations.push('SSL key path not configured');
    }

    if (this.config.hstsMaxAge < 31536000 && process.env.NODE_ENV === 'production') {
      recommendations.push('HSTS max-age is less than 1 year (recommended for production)');
    }

    return {
      status: recommendations.length === 0 ? 'healthy' : 'warning',
      isSecure: recommendations.length === 0,
      recommendations,
    };
  }

  /**
   * Validates CSP configuration
   * @returns Validation result
   */
  validateCSPConfiguration(): {
    status: string;
    directives: number;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check for overly permissive directives
    if (
      this.config.cspDirectives['script-src']?.includes("'unsafe-eval'") ||
      this.config.cspDirectives['script-src']?.includes('*')
    ) {
      issues.push('CSP allows unsafe script evaluation');
    }

    if (
      this.config.cspDirectives['default-src'] === "'none'" &&
      !this.config.cspDirectives['script-src']
    ) {
      issues.push('CSP default-src is none but script-src is not specified');
    }

    return {
      status: issues.length === 0 ? 'healthy' : 'warning',
      directives: Object.keys(this.config.cspDirectives).length,
      issues,
    };
  }

  /**
   * Gets security headers health status
   * @returns Health status
   */
  getSecurityHeadersHealth(): {
    status: string;
    headersEnabled: number;
    hstsEnabled: boolean;
    cspEnabled: boolean;
    frameProtection: boolean;
    mimeProtection: boolean;
    xssProtection: boolean;
    referrerPolicy: boolean;
    permissionsPolicy: boolean;
  } {
    let enabledCount = 0;

    if (this.config.enableHSTS) enabledCount++;
    if (this.config.enableCSP) enabledCount++;
    if (this.config.enableFrameProtection) enabledCount++;
    if (this.config.enableMimeTypeProtection) enabledCount++;
    if (this.config.enableXSSProtection) enabledCount++;
    if (this.config.enableReferrerPolicy) enabledCount++;
    if (this.config.enablePermissionsPolicy) enabledCount++;

    return {
      status: enabledCount >= 6 ? 'healthy' : 'warning',
      headersEnabled: enabledCount,
      hstsEnabled: this.config.enableHSTS,
      cspEnabled: this.config.enableCSP,
      frameProtection: this.config.enableFrameProtection,
      mimeProtection: this.config.enableMimeTypeProtection,
      xssProtection: this.config.enableXSSProtection,
      referrerPolicy: this.config.enableReferrerPolicy,
      permissionsPolicy: this.config.enablePermissionsPolicy,
    };
  }
}

export default SecurityHeadersService;
