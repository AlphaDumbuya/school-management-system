/**
 * backgroundJobs: should this process run the in-process scheduled jobs
 * (node-cron: SMS queue every minute, event reminders every hour, daily
 * finance / subscription / identity jobs, the Friday attendance digest)?
 *
 * Each job queries the database when it fires, so a process that runs them
 * keeps the hosted database awake around the clock (the SMS job alone runs every
 * minute), which is what uses up its monthly allowance.
 *
 *  - Vercel (serverless): no. Functions are frozen between requests, so node-cron
 *    can't fire reliably there anyway; the daily and weekly work runs from the
 *    Vercel Cron routes (/api/v1/cron/*, see vercel.json).
 *  - Local development: no. A laptop running `npm run dev` against the shared
 *    database must not run production jobs (or keep that database awake all day).
 *  - A long-running production server (Docker / VM): yes.
 *
 * ENABLE_BACKGROUND_JOBS=true or false overrides this in any environment.
 */
export function backgroundJobsEnabled(): boolean {
  const flag = String(process.env.ENABLE_BACKGROUND_JOBS || '').trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  if (process.env.VERCEL) return false;
  return (process.env.NODE_ENV || 'development') === 'production';
}
