import cron from 'node-cron';
import knex from 'knex';
import knexConfig from '../../knexfile.js';
import { CardLifecycleService } from '../services/cardLifecycleService.js';
import { SecurityService } from '../services/securityService.js';
import { logger } from '../utils/logger.js';

/**
 * Identity Management Scheduled Jobs
 * Phase 2.1: Identity Management Module
 * 
 * Sets up cron jobs for:
 * - Daily card expiration checks
 * - Secret rotation checks (weekly)
 * - Expired secret cleanup (daily)
 * - Expiration notifications (daily)
 */

const env = (process.env.NODE_ENV || "development") as keyof typeof knexConfig;
const db = knex(knexConfig[env] || knexConfig.development);
const lifecycleService = new CardLifecycleService(db);
const securityService = new SecurityService(db);

/**
 * Daily job: Check and expire cards
 * Runs at 2:00 AM every day
 * Requirements: 6.5
 */
export const cardExpirationJob = cron.schedule(
  '0 2 * * *',
  async () => {
    try {
      logger.info('Starting daily card expiration check');
      const expiredCount = await lifecycleService.autoExpireCards();
      logger.info(`Completed card expiration check: ${expiredCount} cards expired`);
    } catch (error) {
      logger.error('Failed to run card expiration job', { error });
    }
  },
  {
    scheduled: false, // Don't start automatically
    timezone: 'UTC',
  }
);

/**
 * Daily job: Send expiration notifications
 * Runs at 9:00 AM every day
 * Requirements: 6.8
 */
export const expirationNotificationJob = cron.schedule(
  '0 9 * * *',
  async () => {
    try {
      logger.info('Starting expiration notification job');

      // Get all tenants
      const tenants = await db('tenants').select('id');

      for (const tenant of tenants) {
        try {
          await lifecycleService.sendExpirationNotifications(tenant.id);
        } catch (error) {
          logger.error(`Failed to send notifications for tenant ${tenant.id}`, {
            error,
          });
        }
      }

      logger.info('Completed expiration notification job');
    } catch (error) {
      logger.error('Failed to run expiration notification job', { error });
    }
  },
  {
    scheduled: false,
    timezone: 'UTC',
  }
);

/**
 * Weekly job: Check and rotate tenant secrets
 * Runs at 3:00 AM every Sunday
 * Requirements: 7.2
 */
export const secretRotationJob = cron.schedule(
  '0 3 * * 0',
  async () => {
    try {
      logger.info('Starting secret rotation check');
      await securityService.checkSecretsForRotation();
      logger.info('Completed secret rotation check');
    } catch (error) {
      logger.error('Failed to run secret rotation job', { error });
    }
  },
  {
    scheduled: false,
    timezone: 'UTC',
  }
);

/**
 * Daily job: Cleanup expired secrets
 * Runs at 4:00 AM every day
 */
export const secretCleanupJob = cron.schedule(
  '0 4 * * *',
  async () => {
    try {
      logger.info('Starting expired secret cleanup');
      await securityService.cleanupExpiredSecrets();
      logger.info('Completed expired secret cleanup');
    } catch (error) {
      logger.error('Failed to run secret cleanup job', { error });
    }
  },
  {
    scheduled: false,
    timezone: 'UTC',
  }
);

/**
 * Start all identity management jobs
 */
export function startIdentityManagementJobs(): void {
  cardExpirationJob.start();
  expirationNotificationJob.start();
  secretRotationJob.start();
  secretCleanupJob.start();

  logger.info('Identity management scheduled jobs started', {
    jobs: [
      'cardExpirationJob (daily 2:00 AM)',
      'expirationNotificationJob (daily 9:00 AM)',
      'secretRotationJob (weekly Sunday 3:00 AM)',
      'secretCleanupJob (daily 4:00 AM)',
    ],
  });
}

/**
 * Stop all identity management jobs
 */
export function stopIdentityManagementJobs(): void {
  cardExpirationJob.stop();
  expirationNotificationJob.stop();
  secretRotationJob.stop();
  secretCleanupJob.stop();

  logger.info('Identity management scheduled jobs stopped');
}
