/**
 * Staff duties: a teacher who ALSO works as Accountant (Bursar) and/or
 * Admissions Officer (users.staff_duties, migration 162).
 *
 * Their main role stays 'teacher', so every teacher feature (their classes,
 * form class, registers, scores, offline app) keeps working with teacher
 * scoping. A duty adds that portal on top:
 *
 *   1. On the duty's own modules (finance, admissions), the request ACTS as
 *      that role from the start (`dutyForPath`). Those modules check the role
 *      in many places (custom guards, handler logic), and a teacher never has
 *      access to them anyway, so acting as the duty there is exact.
 *   2. Anywhere else, `authorize()` lets the request through when a duty is
 *      allowed and the main role isn't, acting as that duty for that request
 *      only (e.g. an admissions-only action on a shared route).
 *
 * Everywhere else the main role applies, so teacher scoping is never widened
 * by accident. Only the principal can grant duties.
 */
export const STAFF_DUTIES = ['accountant', 'admissions_officer'] as const;
export type StaffDuty = (typeof STAFF_DUTIES)[number];

export const isStaffDuty = (r: unknown): r is StaffDuty => STAFF_DUTIES.includes(r as StaffDuty);

/** Normalise the stored value (jsonb array, JSON string or null) to a clean list. */
export function parseDuties(raw: unknown): StaffDuty[] {
  let v: unknown = raw;
  if (typeof v === 'string') {
    try { v = JSON.parse(v); } catch { v = []; }
  }
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.filter(isStaffDuty)));
}

/** Clean a duties list from a request body (unknown values are dropped). */
export function sanitizeDuties(input: unknown): StaffDuty[] {
  return parseDuties(Array.isArray(input) ? input : []);
}

// The duty's own API modules. A teacher has no access to these, so acting as
// the duty for the whole request is safe and matches what the role can do.
const ACCOUNTANT_PREFIXES = [
  '/api/v1/fee-structures',
  '/api/v1/fees', // also /fees-statistics, /fees-overdue, /fees-by-type
  '/api/v1/invoices', // also /invoices-overdue, /invoices-statistics
  '/api/v1/payments', // also /payments-summary, /payments-methods, Monime
  '/api/v1/finance', // ledger, overview, expenses, exports
  '/api/v1/dashboards/accountant',
];
const ACCOUNTANT_PATTERNS = [/^\/api\/v1\/students\/[^/]+\/(fees|outstanding|payments|invoices)(\/|$)/];
const ADMISSIONS_PREFIXES = [
  '/api/v1/admissions',
  '/api/v1/enrollments',
  '/api/v1/dashboards/admissions',
];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}-`) || path.startsWith(`${p}?`));

/** The duty a request path belongs to, if the user holds it; else null. */
export function dutyForPath(path: string, duties: StaffDuty[]): StaffDuty | null {
  if (!duties.length) return null;
  const p = String(path || '').split('?')[0];
  if (duties.includes('accountant') && (startsWithAny(p, ACCOUNTANT_PREFIXES) || ACCOUNTANT_PATTERNS.some((re) => re.test(p)))) {
    return 'accountant';
  }
  if (duties.includes('admissions_officer') && startsWithAny(p, ADMISSIONS_PREFIXES)) {
    return 'admissions_officer';
  }
  return null;
}
