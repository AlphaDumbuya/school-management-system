import type { Knex } from 'knex';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '@middleware/errorHandler';
import { logger } from '@utils/logger';
import { backgroundJobsEnabled } from '@utils/backgroundJobs';

/**
 * Phase 20.5: Caching and Performance Optimization
 * 
 * Provides caching strategies:
 * - In-memory caching
 * - Database caching
 * - Cache invalidation
 * - Offline data caching
 * - Cache statistics
 */

interface CacheEntry {
  id: string;
  tenantId: string;
  key: string;
  value: any;
  ttl: number;
  expiresAt: Date;
  hits: number;
  createdAt: Date;
}

export class CachingService {
  private db: Knex;
  private memoryCache: Map<string, { value: any; expiresAt: Date }> = new Map();
  private maxMemoryCacheSize = 1000;

  /**
   * Initializes caching service
   * @param database - Knex database instance
   */
  constructor(database: Knex) {
    this.db = database;
    logger.info('CachingService initialized');
    // Periodically clean up expired cache entries. The sweep runs a DELETE on
    // the database, so only where background jobs run (a long-running server):
    // every minute in every process kept the hosted database from ever going
    // to sleep. Expired entries are ignored on read anyway, and the in-memory
    // cache is bounded by maxMemoryCacheSize.
    if (backgroundJobsEnabled()) {
      // Every 15 minutes, and never keep the process alive just for this.
      const timer = setInterval(() => this.cleanupExpiredCache(), 15 * 60_000);
      (timer as any).unref?.();
    }
  }

  /**
   * Sets a cache entry
   * @param tenantId - Tenant ID
   * @param key - Cache key
   * @param value - Cache value
   * @param ttlSeconds - Time to live in seconds
   * @param useMemory - Use in-memory cache
   */
  async set(
    tenantId: string,
    key: string,
    value: any,
    ttlSeconds: number = 3600,
    useMemory: boolean = true
  ): Promise<void> {
    try {
      const cacheKey = `${tenantId}:${key}`;
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

      // Store in memory cache
      if (useMemory && this.memoryCache.size < this.maxMemoryCacheSize) {
        this.memoryCache.set(cacheKey, { value, expiresAt });
      }

      // Store in database cache
      const existing = await this.db('cache_entries')
        .where('tenant_id', tenantId)
        .where('key', key)
        .first();

      if (existing) {
        await this.db('cache_entries')
          .where('tenant_id', tenantId)
          .where('key', key)
          .update({
            value: JSON.stringify(value),
            ttl: ttlSeconds,
            expires_at: expiresAt,
            updated_at: new Date(),
          });
      } else {
        await this.db('cache_entries').insert({
          id: uuidv4(),
          tenant_id: tenantId,
          key,
          value: JSON.stringify(value),
          ttl: ttlSeconds,
          expires_at: expiresAt,
          hits: 0,
          created_at: new Date(),
        });
      }

      logger.debug(`Cache set: ${cacheKey} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      logger.error('Failed to set cache', error);
      throw new AppError('Failed to set cache', 500);
    }
  }

  /**
   * Gets a cache entry
   * @param tenantId - Tenant ID
   * @param key - Cache key
   * @returns Cache value or null
   */
  async get(tenantId: string, key: string): Promise<any | null> {
    try {
      const cacheKey = `${tenantId}:${key}`;

      // Try memory cache first
      const memCached = this.memoryCache.get(cacheKey);
      if (memCached) {
        if (memCached.expiresAt > new Date()) {
          logger.debug(`Cache hit (memory): ${cacheKey}`);
          return memCached.value;
        } else {
          this.memoryCache.delete(cacheKey);
        }
      }

      // Try database cache
      const dbCached = await this.db('cache_entries')
        .where('tenant_id', tenantId)
        .where('key', key)
        .where('expires_at', '>', new Date())
        .first();

      if (dbCached) {
        // Update hit count
        await this.db('cache_entries')
          .where('id', dbCached.id)
          .increment('hits', 1);

        logger.debug(`Cache hit (database): ${cacheKey}`);
        return JSON.parse(dbCached.value);
      }

      logger.debug(`Cache miss: ${cacheKey}`);
      return null;
    } catch (error) {
      logger.error('Failed to get cache', error);
      return null; // Return null on error to avoid breaking the app
    }
  }

  /**
   * Invalidates a cache entry
   * @param tenantId - Tenant ID
   * @param key - Cache key
   */
  async invalidate(tenantId: string, key: string): Promise<void> {
    try {
      const cacheKey = `${tenantId}:${key}`;

      // Remove from memory cache
      this.memoryCache.delete(cacheKey);

      // Remove from database cache
      await this.db('cache_entries')
        .where('tenant_id', tenantId)
        .where('key', key)
        .delete();

      logger.debug(`Cache invalidated: ${cacheKey}`);
    } catch (error) {
      logger.error('Failed to invalidate cache', error);
    }
  }

  /**
   * Invalidates cache by pattern
   * @param tenantId - Tenant ID
   * @param pattern - Key pattern (e.g., 'student:*')
   */
  async invalidateByPattern(tenantId: string, pattern: string): Promise<number> {
    try {
      // Remove from memory cache
      const regexPattern = new RegExp(`^${tenantId}:${pattern.replace('*', '.*')}$`);
      for (const [key] of this.memoryCache) {
        if (regexPattern.test(key)) {
          this.memoryCache.delete(key);
        }
      }

      // Remove from database cache
      const count = await this.db('cache_entries')
        .where('tenant_id', tenantId)
        .where('key', 'like', pattern.replace('*', '%'))
        .delete();

      logger.debug(`Cache invalidated by pattern: ${tenantId}:${pattern} (${count} entries)`);
      return count;
    } catch (error) {
      logger.error('Failed to invalidate cache by pattern', error);
      return 0;
    }
  }

  /**
   * Clears all cache for a tenant
   * @param tenantId - Tenant ID
   */
  async clear(tenantId: string): Promise<void> {
    try {
      // Clear from memory cache
      for (const [key] of this.memoryCache) {
        if (key.startsWith(`${tenantId}:`)) {
          this.memoryCache.delete(key);
        }
      }

      // Clear from database cache
      await this.db('cache_entries')
        .where('tenant_id', tenantId)
        .delete();

      logger.info(`Cache cleared for tenant: ${tenantId}`);
    } catch (error) {
      logger.error('Failed to clear cache', error);
    }
  }

  /**
   * Cleans up expired cache entries
   */
  private async cleanupExpiredCache(): Promise<void> {
    try {
      // Clean memory cache
      const now = new Date();
      for (const [key, entry] of this.memoryCache) {
        if (entry.expiresAt < now) {
          this.memoryCache.delete(key);
        }
      }

      // Clean database cache
      const deleted = await this.db('cache_entries')
        .where('expires_at', '<', new Date())
        .delete();

      if (deleted > 0) {
        logger.debug(`Cleaned up ${deleted} expired cache entries`);
      }
    } catch (error) {
      logger.error('Failed to cleanup expired cache', error);
    }
  }

  /**
   * Gets cache statistics
   * @param tenantId - Tenant ID
   * @returns Cache statistics
   */
  async getStatistics(tenantId: string): Promise<{
    memoryCacheSize: number;
    databaseCacheSize: number;
    totalEntries: number;
    averageHits: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  }> {
    try {
      // Memory cache size
      let memoryCacheSize = 0;
      for (const [key] of this.memoryCache) {
        if (key.startsWith(`${tenantId}:`)) {
          memoryCacheSize++;
        }
      }

      // Database cache stats
      const dbStats = await this.db('cache_entries')
        .where('tenant_id', tenantId)
        .select(
          this.db.raw('COUNT(*) as total'),
          this.db.raw('AVG(hits) as avg_hits'),
          this.db.raw('MIN(created_at) as oldest'),
          this.db.raw('MAX(created_at) as newest')
        )
        .first() as any;

      return {
        memoryCacheSize,
        databaseCacheSize: dbStats.total || 0,
        totalEntries: (memoryCacheSize || 0) + (dbStats.total || 0),
        averageHits: Math.round(dbStats.avg_hits || 0),
        oldestEntry: dbStats.oldest,
        newestEntry: dbStats.newest,
      };
    } catch (error) {
      logger.error('Failed to get cache statistics', error);
      return {
        memoryCacheSize: 0,
        databaseCacheSize: 0,
        totalEntries: 0,
        averageHits: 0,
      };
    }
  }

  /**
   * Gets most frequently accessed cache keys
   * @param tenantId - Tenant ID
   * @param limit - Result limit
   * @returns Top cache keys by hits
   */
  async getTopCacheKeys(tenantId: string, limit: number = 10): Promise<Array<{
    key: string;
    hits: number;
    expiresAt: Date;
  }>> {
    try {
      const keys = await this.db('cache_entries')
        .where('tenant_id', tenantId)
        .orderBy('hits', 'desc')
        .limit(limit)
        .select('key', 'hits', 'expires_at');

      return keys.map((k: any) => ({
        key: k.key,
        hits: k.hits,
        expiresAt: k.expires_at,
      }));
    } catch (error) {
      logger.error('Failed to get top cache keys', error);
      return [];
    }
  }
}

export default CachingService;
