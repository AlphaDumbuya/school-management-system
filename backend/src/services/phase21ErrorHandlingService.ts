import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';

/**
 * Phase 21.2: Error Handling and Messaging Service
 * 
 * Provides comprehensive error handling:
 * - User-friendly error messages
 * - Error suggestions and resolution
 * - Error logging for support
 * - Error analytics and trending
 */

export interface UserFriendlyError {
  id: string;
  tenantId: string;
  errorCode: string;
  userMessage: string;
  technicalMessage: string;
  suggestions: string[];
  severity: 'info' | 'warning' | 'error' | 'critical';
  helpArticleId?: string;
  createdAt: Date;
}

export interface ErrorLog {
  id: string;
  tenantId: string;
  userId?: string;
  errorCode: string;
  message: string;
  stackTrace: string;
  context: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
  createdAt: Date;
}

export class ErrorHandlingService {
  private db: Knex;

  /**
   * Common error messages library
   */
  private readonly errorMessages: Record<string, { message: string; suggestions: string[]; severity: string }> = {
    'AUTH_INVALID_CREDENTIALS': {
      message: 'The email or password you entered is incorrect.',
      suggestions: ['Check your email address', 'Reset your password if you forgot it', 'Contact support if you continue to have issues'],
      severity: 'warning',
    },
    'AUTH_EXPIRED_TOKEN': {
      message: 'Your session has expired. Please log in again.',
      suggestions: ['Log in with your credentials', 'Enable "Keep me signed in" to stay logged in longer'],
      severity: 'info',
    },
    'AUTH_INSUFFICIENT_PERMISSIONS': {
      message: 'You do not have permission to access this resource.',
      suggestions: ['Contact your administrator for access', 'Check if you have the correct role assigned'],
      severity: 'warning',
    },
    'DATA_NOT_FOUND': {
      message: 'The requested item could not be found.',
      suggestions: ['Check if the item still exists', 'Try refreshing the page', 'Search for the item again'],
      severity: 'warning',
    },
    'VALIDATION_FAILED': {
      message: 'Some of the information you provided is invalid.',
      suggestions: ['Check all required fields are filled', 'Ensure email addresses are valid', 'Check phone numbers have correct format'],
      severity: 'warning',
    },
    'DATABASE_ERROR': {
      message: 'A database error occurred. Please try again later.',
      suggestions: ['Try again in a few moments', 'Contact support if the problem persists', 'Check your internet connection'],
      severity: 'error',
    },
    'PAYMENT_FAILED': {
      message: 'Payment processing failed.',
      suggestions: ['Check your payment method', 'Verify billing address matches card', 'Try a different payment method'],
      severity: 'error',
    },
    'FILE_UPLOAD_FAILED': {
      message: 'The file upload failed.',
      suggestions: ['Check file size is under limit', 'Verify file format is supported', 'Check internet connection'],
      severity: 'warning',
    },
    'NETWORK_ERROR': {
      message: 'Network error. Please check your internet connection.',
      suggestions: ['Check your internet connection', 'Try again when connection is stable', 'Contact support if problem persists'],
      severity: 'warning',
    },
    'SERVER_ERROR': {
      message: 'An unexpected error occurred. Our team has been notified.',
      suggestions: ['Try again in a few moments', 'Contact support if error persists', 'Check status page for updates'],
      severity: 'critical',
    },
  };

  /**
   * Initializes error handling service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('ErrorHandlingService initialized');
  }

  /**
   * Gets user-friendly error message
   * @param errorCode - Error code
   * @param customMessage - Custom message (optional)
   * @param tenantId - Tenant ID
   */
  async getErrorMessage(errorCode: string, tenantId: string, customMessage?: string): Promise<UserFriendlyError> {
    try {
      // Check database for custom error messages
      const customError = await this.db('error_messages')
        .where('tenant_id', tenantId)
        .where('error_code', errorCode)
        .first();

      if (customError) {
        return {
          id: customError.id,
          tenantId,
          errorCode,
          userMessage: customError.user_message,
          technicalMessage: customError.technical_message,
          suggestions: JSON.parse(customError.suggestions || '[]'),
          severity: customError.severity,
          helpArticleId: customError.help_article_id,
          createdAt: customError.created_at,
        };
      }

      // Fall back to default messages
      const defaultError = this.errorMessages[errorCode] || {
        message: customMessage || 'An error occurred. Please try again.',
        suggestions: ['Try again', 'Contact support if error persists'],
        severity: 'error',
      };

      return {
        id: uuidv4(),
        tenantId,
        errorCode,
        userMessage: defaultError.message,
        technicalMessage: customMessage || '',
        suggestions: defaultError.suggestions,
        severity: defaultError.severity as any,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to get error message', error);
      return {
        id: uuidv4(),
        tenantId,
        errorCode,
        userMessage: 'An error occurred. Please try again.',
        technicalMessage: '',
        suggestions: ['Try again', 'Contact support'],
        severity: 'error',
        createdAt: new Date(),
      };
    }
  }

  /**
   * Logs error for support
   * @param tenantId - Tenant ID
   * @param errorCode - Error code
   * @param message - Error message
   * @param stackTrace - Stack trace
   * @param context - Additional context
   * @param userId - User ID (optional)
   */
  async logError(
    tenantId: string,
    errorCode: string,
    message: string,
    stackTrace: string,
    context: Record<string, any> = {},
    userId?: string
  ): Promise<ErrorLog> {
    try {
      const errorId = uuidv4();

      await this.db('error_logs').insert({
        id: errorId,
        tenant_id: tenantId,
        user_id: userId || null,
        error_code: errorCode,
        message,
        stack_trace: stackTrace,
        context: JSON.stringify(context),
        resolved: false,
        created_at: new Date(),
      });

      logger.info(`Error logged: ${errorId} - ${errorCode}`);

      return {
        id: errorId,
        tenantId,
        userId,
        errorCode,
        message,
        stackTrace,
        context,
        resolved: false,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Failed to log error', error);
      throw new AppError('Failed to log error', 500);
    }
  }

  /**
   * Gets error logs with filtering
   * @param tenantId - Tenant ID
   * @param filters - Filter criteria
   */
  async getErrorLogs(
    tenantId: string,
    filters?: {
      errorCode?: string;
      userId?: string;
      resolved?: boolean;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<ErrorLog[]> {
    try {
      let query = this.db('error_logs')
        .where('tenant_id', tenantId);

      if (filters?.errorCode) {
        query = query.where('error_code', filters.errorCode);
      }

      if (filters?.userId) {
        query = query.where('user_id', filters.userId);
      }

      if (filters?.resolved !== undefined) {
        query = query.where('resolved', filters.resolved);
      }

      if (filters?.startDate) {
        query = query.where('created_at', '>=', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.where('created_at', '<=', filters.endDate);
      }

      const limit = filters?.limit || 100;
      const offset = filters?.offset || 0;

      const logs = await query
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .select();

      return logs.map((l: any) => ({
        id: l.id,
        tenantId: l.tenant_id,
        userId: l.user_id,
        errorCode: l.error_code,
        message: l.message,
        stackTrace: l.stack_trace,
        context: JSON.parse(l.context || '{}'),
        resolved: l.resolved,
        resolvedAt: l.resolved_at,
        createdAt: l.created_at,
      }));
    } catch (error) {
      logger.error('Failed to get error logs', error);
      throw new AppError('Failed to get error logs', 500);
    }
  }

  /**
   * Resolves error log
   * @param errorLogId - Error log ID
   */
  async resolveError(errorLogId: string): Promise<void> {
    try {
      await this.db('error_logs')
        .where('id', errorLogId)
        .update({
          resolved: true,
          resolved_at: new Date(),
        });

      logger.debug(`Error resolved: ${errorLogId}`);
    } catch (error) {
      logger.error('Failed to resolve error', error);
      throw new AppError('Failed to resolve error', 500);
    }
  }

  /**
   * Gets error statistics
   * @param tenantId - Tenant ID
   * @param periodDays - Time period in days
   */
  async getErrorStats(tenantId: string, periodDays: number = 30): Promise<{
    totalErrors: number;
    unresolvedErrors: number;
    uniqueErrorCodes: number;
    topErrors: Array<{ code: string; count: number }>;
    errorsByDay: Array<{ date: string; count: number }>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const totalErrors = await this.db('error_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .count('* as count')
        .first() as any;

      const unresolvedErrors = await this.db('error_logs')
        .where('tenant_id', tenantId)
        .where('resolved', false)
        .where('created_at', '>=', startDate)
        .count('* as count')
        .first() as any;

      const uniqueCodes = await this.db('error_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .countDistinct('error_code as count')
        .first() as any;

      const topErrors = await this.db('error_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .groupBy('error_code')
        .select(
          this.db.raw('error_code as code'),
          this.db.raw('COUNT(*) as count')
        )
        .orderBy('count', 'desc')
        .limit(10);

      const errorsByDay = await this.db('error_logs')
        .where('tenant_id', tenantId)
        .where('created_at', '>=', startDate)
        .groupBy(this.db.raw('DATE(created_at)'))
        .select(
          this.db.raw('DATE(created_at) as date'),
          this.db.raw('COUNT(*) as count')
        )
        .orderBy('date', 'asc');

      return {
        totalErrors: totalErrors.count || 0,
        unresolvedErrors: unresolvedErrors.count || 0,
        uniqueErrorCodes: uniqueCodes.count || 0,
        topErrors: topErrors.map((e: any) => ({ code: e.code, count: e.count })),
        errorsByDay: errorsByDay.map((e: any) => ({ date: e.date, count: e.count })),
      };
    } catch (error) {
      logger.error('Failed to get error statistics', error);
      throw new AppError('Failed to get error statistics', 500);
    }
  }
}

export default ErrorHandlingService;
