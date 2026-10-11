/**
 * One definition of "a term" and "an attendance day", shared by the report
 * card, the attendance pages, analytics and the archive, so their numbers
 * always agree.
 *
 * Terms: the academic session's span split into three equal parts. Term 1 has
 * no lower bound and Term 3 no upper bound (early orientation / late days
 * still count); each term's end is exclusive (= next term's start), so a
 * boundary day belongs to exactly one term. Without a session, the standard
 * Sierra Leone calendar is used (Sep–Dec, Jan–mid Apr, mid Apr–Jul).
 *
 * Attendance days: several sessions on one day (morning/afternoon) are ONE
 * day, classified by its best status: present > excused > late > absent.
 * Present, excused and late count as attended.
 */
import db from './database.js';
import { normalizeAcademicYear } from './academicYear.js';

export const TERM_KEYS = ['first_term', 'second_term', 'third_term'] as const;
export type TermKey = (typeof TERM_KEYS)[number];
export type DateWindow = { start: string | null; end: string | null };

/** Accepts 'first_term', 'First Term', 'term1', '1'… → the canonical key. */
export function normalizeTerm(v: unknown): TermKey | null {
  const s = String(v ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!s || s === 'all' || s === 'full' || s === 'year') return null;
  if (TERM_KEYS.includes(s as TermKey)) return s as TermKey;
  const n = s.match(/([123])/)?.[1] ?? (s.startsWith('first') ? '1' : s.startsWith('second') ? '2' : s.startsWith('third') ? '3' : null);
  return n ? TERM_KEYS[Number(n) - 1] : null;
}

const day = (v: any) => (v instanceof Date
  ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
  : String(v).slice(0, 10));

/** The three term windows for an academic year (plus the session's own span). */
export async function resolveTermWindows(
  tenantId: string,
  academicYear: string,
): Promise<(Record<TermKey, DateWindow> & { session: { start: string; end: string } | null }) | null> {
  const year = normalizeAcademicYear(academicYear);
  const sessions = await db('academic_sessions')
    .where('tenant_id', tenantId).whereNotNull('start_date').whereNotNull('end_date')
    .select('name', 'start_date', 'end_date');
  // A year may have several session rows: use the widest span.
  const mine = sessions.filter((s: any) => normalizeAcademicYear(s.name) === year);
  if (mine.length) {
    const startS = mine.map((s: any) => day(s.start_date)).sort()[0];
    const endS = mine.map((s: any) => day(s.end_date)).sort().pop()!;
    const start = Date.UTC(+startS.slice(0, 4), +startS.slice(5, 7) - 1, +startS.slice(8, 10));
    const end = Date.UTC(+endS.slice(0, 4), +endS.slice(5, 7) - 1, +endS.slice(8, 10));
    if (end > start) {
      const third = (end - start) / 3;
      const t1 = new Date(start + third).toISOString().slice(0, 10);
      const t2 = new Date(start + third * 2).toISOString().slice(0, 10);
      return {
        first_term: { start: null, end: t1 },
        second_term: { start: t1, end: t2 },
        third_term: { start: t2, end: null },
        session: { start: startS, end: endS },
      };
    }
  }
  const m = String(year || academicYear).match(/(\d{4})/);
  if (!m) return null;
  const y2 = Number(m[1]) + 1;
  return {
    first_term: { start: null, end: `${y2}-01-01` },
    second_term: { start: `${y2}-01-01`, end: `${y2}-04-16` },
    third_term: { start: `${y2}-04-16`, end: null },
    session: null,
  };
}

/** Limit a query's date column to a term window (end exclusive). */
export function applyDateWindow(q: any, dateCol: string, w: DateWindow | null | undefined) {
  if (!w) return q;
  if (w.start) q.where(dateCol, '>=', w.start);
  if (w.end) q.where(dateCol, '<', w.end);
  return q;
}

/** SQL for one day's best status: 4 present, 3 excused, 2 late, 1 absent. */
export const DAY_RANK_SQL = (col = 'attendance.status') =>
  `MAX(CASE ${col} WHEN 'present' THEN 4 WHEN 'excused' THEN 3 WHEN 'late' THEN 2 WHEN 'absent' THEN 1 ELSE 0 END)`;

export interface DaySummary { days: number; present: number; excused: number; late: number; absent: number; attended: number; rate: number }

/** Tally day ranks (from DAY_RANK_SQL) into counts and an attendance rate (%). */
export function summarizeDayRanks(ranks: number[], decimals = 0): DaySummary {
  let present = 0, excused = 0, late = 0, absent = 0;
  for (const r of ranks) {
    if (r >= 4) present++; else if (r === 3) excused++; else if (r === 2) late++; else if (r === 1) absent++;
  }
  const days = present + excused + late + absent;
  const attended = present + excused + late;
  const f = 10 ** decimals;
  return { days, present, excused, late, absent, attended, rate: days ? Math.round((attended / days) * 100 * f) / f : 0 };
}

/** Same tally from raw rows ({date, status}) already loaded in memory. */
export function summarizeAttendanceRows(rows: Array<{ date?: any; attendance_date?: any; status?: string | null }>, decimals = 0): DaySummary {
  const RANK: Record<string, number> = { present: 4, excused: 3, late: 2, absent: 1 };
  const best = new Map<string, number>();
  for (const r of rows) {
    const key = day(r.attendance_date ?? r.date);
    const rank = RANK[String(r.status || '').toLowerCase()] ?? 0;
    best.set(key, Math.max(best.get(key) ?? 0, rank));
  }
  return summarizeDayRanks(Array.from(best.values()), decimals);
}

/**
 * Attendance may only be written for the ACTIVE year: dates before its start
 * are a past year (read-only history), dates after its end aren't in this
 * year yet. Returns an error message, or null when the date is fine.
 */
export async function attendanceDateProblem(tenantId: string, date: string): Promise<{ code: 'PAST_YEAR_READ_ONLY' | 'OUTSIDE_YEAR'; message: string } | null> {
  const d = String(date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { code: 'OUTSIDE_YEAR', message: 'Enter a valid date (YYYY-MM-DD).' };
  const active = await db('academic_sessions').where({ tenant_id: tenantId, is_active: true }).first('name', 'start_date', 'end_date');
  if (!active?.start_date || !active?.end_date) return null; // no calendar to check against
  // Every row of the same year counts (widest span).
  const w = await resolveTermWindows(tenantId, active.name);
  const start = w?.session?.start ?? day(active.start_date);
  const end = w?.session?.end ?? day(active.end_date);
  const name = normalizeAcademicYear(active.name) || active.name;
  if (d < start) return { code: 'PAST_YEAR_READ_ONLY', message: `${d} is before the ${name} academic year (starts ${start}). Past years' attendance is read-only. If the year really started earlier, correct its start date in Settings → Academic Config.` };
  if (d > end) return { code: 'OUTSIDE_YEAR', message: `${d} is after the ${name} academic year ends (${end}).` };
  return null;
}
