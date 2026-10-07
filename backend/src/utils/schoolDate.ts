/**
 * School-calendar date helpers.
 *
 * "Today" must be the SCHOOL's day (tenants.timezone), not the server's UTC
 * clock — otherwise anything recorded near midnight lands on the wrong day for
 * a school outside UTC.
 */
import { db } from './database.js';
import { resolveActiveYear, resolveYearScope } from './academicYear.js';

const tzCache = new Map<string, { tz: string; at: number }>();

/** The tenant's IANA timezone (cached for 5 minutes), UTC when unset/invalid. */
export async function tenantTimezone(tenantId: string): Promise<string> {
  const cached = tzCache.get(tenantId);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.tz;
  const row = await db('tenants').where({ id: tenantId }).first('timezone').catch(() => null);
  const tz = row?.timezone || 'UTC';
  tzCache.set(tenantId, { tz, at: Date.now() });
  return tz;
}

/** Today's date (YYYY-MM-DD) in the school's timezone. */
export async function tenantToday(tenantId: string): Promise<string> {
  const tz = await tenantTimezone(tenantId);
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** The school's current time of day, "HH:MM" (24h), in its timezone. */
export async function tenantTimeOfDay(tenantId: string): Promise<string> {
  const tz = await tenantTimezone(tenantId);
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(11, 16);
  }
}
/**
 * True when a date (YYYY-MM-DD or ISO) is before the ACTIVE academic year's
 * start, i.e. it belongs to a past year and is read-only history.
 */
export async function isPastYearDate(tenantId: string, date: string | Date): Promise<boolean> {
  const { yearString } = await resolveActiveYear(tenantId);
  const scope = await resolveYearScope(tenantId, yearString);
  if (!scope?.from) return false;
  const d = typeof date === 'string' ? new Date(date.length === 10 ? `${date}T00:00:00.000Z` : date) : date;
  return !Number.isNaN(d.getTime()) && d < scope.from;
}
