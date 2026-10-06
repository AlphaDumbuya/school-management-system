/**
 * Daily finance job when the API runs as a long-lived server: mark overdue
 * fees and (where a school enabled them) add late fees. On Vercel the same
 * work runs from Vercel Cron → /api/v1/cron/finance-daily. Both paths are
 * idempotent, so running both (or twice) never double-charges.
 */
import cron from 'node-cron';
import { logger } from '@utils/logger';
import { lateFeeService } from '@services/finance/lateFeeService';

type ScheduledTask = ReturnType<typeof cron.schedule>;
let job: ScheduledTask | null = null;

export function startFinanceJobs(): void {
  if (job || process.env.VERCEL) return; // serverless: Vercel Cron handles it
  job = cron.schedule('30 1 * * *', () => {
    lateFeeService.runDaily()
      .then((r) => logger.info(`[financeJobs] daily run: ${JSON.stringify(r.map((x: any) => ({ t: x.tenantId, o: x.markedOverdue, l: x.lateFeesCharged })))}`))
      .catch((err) => logger.warn('[financeJobs] daily run failed', { error: String(err) }));
  });
  logger.info('[financeJobs] overdue + late-fee run scheduled (daily 01:30)');
}

export function stopFinanceJobs(): void {
  if (job) { job.stop(); job = null; }
}
