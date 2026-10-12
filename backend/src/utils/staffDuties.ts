/**
 * Staff jobs. A staff member has ONE main job (users.role: teacher, accountant
 * or admissions_officer) and may hold more on top (users.staff_duties, a jsonb
 * array of: 'teacher' | 'accountant' | 'admissions_officer').
 *
 * Examples: a Bursar who also teaches (role accountant, duties ['teacher']),
 * an Admissions Officer who is also a class teacher, a teacher who also keeps
 * the fees (role teacher, duties ['accountant']), a Bursar who also runs
 * admissions (role accountant, duties ['admissions_officer']).
 *
 * How a request is judged:
 *   1. On a job's own API modules the request ACTS as that job from the start
 *      (`dutyForPath`): finance for the Bursar job, admissions for the
 *      Admissions job and the teaching modules (classes, students, registers,
 *      scores, timetable, assignments…) for the Teacher job. Those modules
 *      check the role in many places (guards, handler scoping), so acting as
 *      the job gives exactly that job's access: a teaching job sees and edits
 *      only its own classes, like any teacher.
 *   2. Anywhere else, `authorize()` lets the request through when a held job is
 *      allowed and the main job isn't, acting as that job for that request.
 *
 * Only the principal can grant jobs. Principals and super admins already have
 * access to everything and don't use duties.
 */
export const STAFF_DUTIES = ['teacher', 'accountant', 'admissions_officer'] as const;
export type StaffDuty = (typeof STAFF_DUTIES)[number];

export const isStaffDuty = (r: unknown): r is StaffDuty => STAFF_DUTIES.includes(r as StaffDuty);

/** Main jobs that can carry extra jobs. */
const DUTY_HOLDER_ROLES = ['teacher', 'accountant', 'admissions_officer'];

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

/**
 * The extra jobs that really apply to a user: only for a main job that can
 * carry them, and never the main job itself (a teacher can't also be a
 * "teacher duty"). Use this wherever duties are read.
 */
export function effectiveDuties(role: unknown, raw: unknown): StaffDuty[] {
  const r = String(role || '');
  if (!DUTY_HOLDER_ROLES.includes(r)) return [];
  return parseDuties(raw).filter((d) => d !== r);
}

/** True when the user does teacher work (main job teacher/principal, or a teacher duty). */
export function teachesFor(role: unknown, raw: unknown): boolean {
  const r = String(role || '');
  return r === 'teacher' || r === 'principal' || effectiveDuties(r, raw).includes('teacher');
}

/** True when the user holds this job as main role or as an extra job. */
export function holdsJob(role: unknown, raw: unknown, job: StaffDuty): boolean {
  return String(role || '') === job || effectiveDuties(role, raw).includes(job);
}

// Each job's own API modules. Acting as that job on these is exact: the main
// job either has no access to them, or the job's scoping is what's wanted.
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
// The teaching modules: classes and their students, registers, scores,
// report cards, timetable, assignments, exams, discipline and the offline
// teacher sync.
const TEACHING_PREFIXES = [
  '/api/v1/classes',
  '/api/v1/students',
  '/api/v1/subjects',
  '/api/v1/timetable',
  '/api/v1/schedules',
  '/api/v1/assignments',
  '/api/v1/examinations',
  '/api/v1/results',
  '/api/v1/grades',
  '/api/v1/attendance',
  '/api/v1/report-cards',
  '/api/v1/discipline',
  '/api/v1/sync',
  '/api/v1/dashboards/teacher',
];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}-`) || path.startsWith(`${p}?`));

/** The job a request path belongs to, if the user holds it; else null. */
export function dutyForPath(path: string, duties: StaffDuty[]): StaffDuty | null {
  if (!duties.length) return null;
  const p = String(path || '').split('?')[0];
  if (duties.includes('accountant') && (startsWithAny(p, ACCOUNTANT_PREFIXES) || ACCOUNTANT_PATTERNS.some((re) => re.test(p)))) {
    return 'accountant';
  }
  if (duties.includes('admissions_officer') && startsWithAny(p, ADMISSIONS_PREFIXES)) {
    return 'admissions_officer';
  }
  if (duties.includes('teacher') && startsWithAny(p, TEACHING_PREFIXES)) {
    return 'teacher';
  }
  return null;
}
