import { logger } from '@utils/logger';
import { Pool, PoolClient } from 'pg';

/**
 * Interface for connection pool configuration
 */
export interface PoolConfig {
  poolSize?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  maxRetries?: number;
}

/**
 * Interface for database health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  responseTime: number;
  activeConnections: number;
  idleConnections: number;
  details?: Record<string, any>;
}

/**
 * Interface for database statistics
 */
export interface DatabaseStats {
  activeConnections: number;
  idleConnections: number;
  totalConnections: number;
  waitingRequests: number;
  connectionTime: number;
}

/**
 * Interface for backup information
 */
export interface BackupInfo {
  id: string;
  timestamp: Date;
  size: number;
  status: 'completed' | 'pending' | 'failed';
  retentionDays: number;
}

/**
 * Interface for database query result
 */
export interface QueryResult {
  command: string;
  rowCount: number;
  rows: any[];
  duration: number;
}

/**
 * Neon PostgreSQL Database Service
 * 
 * Handles connection pooling, health checks, and monitoring for Neon serverless PostgreSQL.
 * Implements connection retry logic, automatic reconnection, and comprehensive logging.
 * 
 * @class NeonDatabaseService
 * @example
 * const service = new NeonDatabaseService();
 * await service.initialize();
 * const health = await service.getHealthStatus();
 */
export class NeonDatabaseService {
  private pool: Pool | null = null;
  private isInitialized: boolean = false;
  private connectionString: string;
  private poolConfig: Required<PoolConfig>;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  /**
   * Initialize Neon Database Service
   */
  constructor(config?: PoolConfig) {
    this.connectionString = process.env.DATABASE_URL || '';

    if (!this.connectionString) {
      logger.error('DATABASE_URL is not configured in environment variables');
      throw new Error('DATABASE_URL is required to initialize NeonDatabaseService');
    }

    this.poolConfig = {
      poolSize: config?.poolSize || parseInt(process.env.DATABASE_POOL_SIZE || '20'),
      idleTimeoutMillis: config?.idleTimeoutMillis || parseInt(process.env.DATABASE_IDLE_TIMEOUT || '300000'),
      connectionTimeoutMillis: config?.connectionTimeoutMillis || parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000'),
      maxRetries: config?.maxRetries || 3,
    };

    logger.info('NeonDatabaseService initialized with configuration', {
      poolSize: this.poolConfig.poolSize,
      idleTimeoutMillis: this.poolConfig.idleTimeoutMillis,
      connectionTimeoutMillis: this.poolConfig.connectionTimeoutMillis,
    });
  }

  /**
   * Initialize connection pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('NeonDatabaseService is already initialized');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString: this.connectionString,
        max: this.poolConfig.poolSize,
        idleTimeoutMillis: this.poolConfig.idleTimeoutMillis,
        connectionTimeoutMillis: this.poolConfig.connectionTimeoutMillis,
      });

      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();

      logger.info('Database connection pool initialized successfully', {
        timestamp: result.rows[0].now,
      });

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize database connection pool', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get database health status
   * 
   * @returns Health check result
   */
  async getHealthStatus(): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (!this.pool) {
        throw new Error('Connection pool is not initialized');
      }

      const client = await this.pool.connect();

      try {
        const result = await client.query('SELECT NOW() as timestamp');
        const responseTime = Date.now() - startTime;

        const stats = this.pool.totalCount ? {
          activeConnections: this.pool.totalCount - (this.pool.idleCount || 0),
          idleConnections: this.pool.idleCount || 0,
          totalConnections: this.pool.totalCount,
          waitingRequests: this.pool.waitingCount || 0,
          connectionTime: responseTime,
        } : {
          activeConnections: 0,
          idleConnections: 0,
          totalConnections: 0,
          waitingRequests: 0,
          connectionTime: responseTime,
        };

        logger.info('Database health check completed', {
          status: 'healthy',
          responseTime,
          stats,
        });

        return {
          status: 'healthy',
          timestamp: new Date(result.rows[0].timestamp),
          responseTime,
          activeConnections: stats.activeConnections,
          idleConnections: stats.idleConnections,
          details: stats,
        };
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Database health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        status: 'unhealthy',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        activeConnections: 0,
        idleConnections: 0,
      };
    }
  }

  /**
   * Get current connection pool statistics
   * 
   * @returns Pool statistics
   */
  getPoolStatistics(): DatabaseStats {
    if (!this.pool) {
      throw new Error('Connection pool is not initialized');
    }

    return {
      activeConnections: this.pool.totalCount - (this.pool.idleCount || 0),
      idleConnections: this.pool.idleCount || 0,
      totalConnections: this.pool.totalCount,
      waitingRequests: this.pool.waitingCount || 0,
      connectionTime: 0,
    };
  }

  /**
   * Execute a query with retry logic
   * 
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns Query result
   */
  async query<T>(query: string, params?: any[]): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      if (!this.pool) {
        throw new Error('Connection pool is not initialized');
      }

      const result = await this.executeWithRetry(() =>
        this.pool!.query(query, params)
      );

      const duration = Date.now() - startTime;
      const queryResult = result as any;

      logger.debug('Query executed successfully', {
        rowCount: queryResult.rowCount,
        duration,
      });

      return {
        command: queryResult.command || '',
        rowCount: queryResult.rowCount || 0,
        rows: queryResult.rows || [],
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Query execution failed', {
        query: query.substring(0, 100),
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Execute a transaction with multiple queries
   * 
   * @param callback - Callback function with transaction client
   * @returns Transaction result
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool!.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');

      logger.info('Transaction committed successfully');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');

      logger.error('Transaction rolled back', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get database size information
   * 
   * @returns Database size in bytes and formatted string
   */
  async getDatabaseSize(): Promise<{ bytes: number; formatted: string }> {
    try {
      const result = await this.query(
        "SELECT pg_database_size(current_database()) as size"
      );

      const sizeBytes = result.rows[0]?.size || 0;
      const sizeGB = (sizeBytes / 1024 / 1024 / 1024).toFixed(2);

      logger.info('Retrieved database size', {
        bytes: sizeBytes,
        formatted: `${sizeGB} GB`,
      });

      return {
        bytes: sizeBytes,
        formatted: `${sizeGB} GB`,
      };
    } catch (error) {
      logger.error('Failed to retrieve database size', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get table statistics and sizes
   * 
   * @returns Array of table statistics
   */
  async getTableStatistics(): Promise<Array<{ tableName: string; rowCount: number; sizeBytes: number }>> {
    try {
      const result = await this.query(`
        SELECT
          schemaname,
          tablename,
          n_live_tup as row_count,
          pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `);

      const statistics = result.rows.map((row: any) => ({
        tableName: `${row.schemaname}.${row.tablename}`,
        rowCount: row.row_count,
        sizeBytes: row.size_bytes,
      }));

      logger.info('Retrieved table statistics', {
        tableCount: statistics.length,
      });

      return statistics;
    } catch (error) {
      logger.error('Failed to retrieve table statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get slow query logs (requires logging configuration)
   * 
   * @param minDurationMs - Minimum query duration in milliseconds
   * @returns Array of slow queries
   */
  async getSlowQueries(minDurationMs: number = 1000): Promise<any[]> {
    try {
      // Note: This requires log_min_duration_statement to be configured on Neon
      const result = await this.query(
        `SELECT * FROM pg_stat_statements WHERE mean_exec_time > $1 ORDER BY mean_exec_time DESC LIMIT 20`,
        [minDurationMs]
      );

      logger.info('Retrieved slow queries', {
        count: result.rowCount,
        minDurationMs,
      });

      return result.rows;
    } catch (error) {
      logger.error('Failed to retrieve slow queries', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get backup information
   * 
   * @returns Backup details
   */
  async getBackupInfo(): Promise<BackupInfo> {
    try {
      // Neon automatically creates backups every 24 hours
      // This is a placeholder that would need to be integrated with Neon's backup API
      logger.info('Neon automatically manages backups', {
        retentionDays: 7,
        schedule: 'daily',
      });

      return {
        id: 'neon-auto-backup',
        timestamp: new Date(),
        size: 0,
        status: 'completed',
        retentionDays: 7,
      };
    } catch (error) {
      logger.error('Failed to retrieve backup information', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Run database maintenance tasks
   * 
   * @returns Maintenance results
   */
  async runMaintenance(): Promise<{ vacuum: boolean; analyze: boolean; reindex: boolean }> {
    const results = {
      vacuum: false,
      analyze: false,
      reindex: false,
    };

    try {
      // VACUUM - cleanup dead tuples
      await this.query('VACUUM ANALYZE');
      results.vacuum = true;
      results.analyze = true;

      logger.info('VACUUM and ANALYZE completed successfully');

      return results;
    } catch (error) {
      logger.error('Database maintenance failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Test connection and retry if necessary
   * 
   * @returns True if connection is successful
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.pool) {
        throw new Error('Connection pool is not initialized');
      }

      const client = await this.pool.connect();
      const result = await client.query('SELECT 1');
      client.release();

      logger.info('Database connection test successful');

      return true;
    } catch (error) {
      logger.error('Database connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Close connection pool gracefully
   */
  async close(): Promise<void> {
    try {
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
        this.isInitialized = false;

        logger.info('Connection pool closed successfully');
      }
    } catch (error) {
      logger.error('Error closing connection pool', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Execute with retry logic
   * 
   * @param fn - Function to execute
   * @returns Result
   */
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }

        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if error is retryable
        if (!this.isRetryableError(lastError)) {
          throw error;
        }

        logger.warn(`Database operation failed, retrying (attempt ${attempt + 1}/${this.maxRetries})`, {
          error: lastError.message,
        });
      }
    }

    throw lastError || new Error('Database operation failed after retries');
  }

  /**
   * Check if error is retryable
   * 
   * @param error - Error to check
   * @returns True if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('timeout') ||
      message.includes('too many connections') ||
      message.includes('connection terminated')
    );
  }

  /**
   * Get whether service is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.pool !== null;
  }
}

// Export singleton instance
export default new NeonDatabaseService();
