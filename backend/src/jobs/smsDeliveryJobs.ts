import cron from 'node-cron';
import { logger } from '@utils/logger';
import smsWhatsAppService from '@services/smsWhatsAppService';

/**
 * SMS/WhatsApp Delivery Jobs
 * - Runs every minute to process pending messages
 */
export const processPendingDeliveriesJob = cron.schedule(
  '*/1 * * * *',
  async () => {
    try {
      logger.info('Starting SMS/WhatsApp pending delivery job');
      // Process a reasonable batch
      await smsWhatsAppService.processPendingDeliveries(200);
      logger.info('Completed SMS/WhatsApp pending delivery job');
    } catch (error) {
      logger.error('Failed to run SMS/WhatsApp delivery job', { error });
    }
  },
  {
    timezone: 'UTC',
  }
);

// node-cron v4 no longer supports a `scheduled: false` creation option —
// tasks start immediately on schedule(). Stop it right away so it only
// runs once startSmsDeliveryJobs() is explicitly called.
processPendingDeliveriesJob.stop();

export function startSmsDeliveryJobs(): void {
  processPendingDeliveriesJob.start();
  logger.info('SMS/WhatsApp delivery job started (every 1 minute)');
}

export function stopSmsDeliveryJobs(): void {
  processPendingDeliveriesJob.stop();
  logger.info('SMS/WhatsApp delivery job stopped');
}
