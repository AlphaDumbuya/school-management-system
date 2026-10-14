/**
 * Weekly student review: shared helpers.
 *
 * Rating words + colours (used by the teacher grid and the parent/student
 * history), and school-week date helpers. Dates are handled as local
 * 'YYYY-MM-DD' keys and built with the local Date constructor, never via
 * `new Date('YYYY-MM-DD')` (which is UTC and shifts the day in some zones).
 */

// ── Ratings ──────────────────────────────────────────────────────────────────

export type RatingValue = 1 | 2 | 3 | 4 | 5;

export interface RatingStyle {
  value: RatingValue;
  label: string;
  /** Light + dark badge (background + text). */
  badge: string;
  /** Selected button / filled state. */
  solid: string;
  /** Unselected button: faint tint of the rating colour so the scale reads. */
  idle: string;
  /** Bar fill (trend strip). */
  bar: string;
  /** Plain coloured text. */
  text: string;
}

export const WEEKLY_RATINGS: readonly RatingStyle[] = [
  {
    value: 5,
    label: 'Excellent',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    solid: 'border-emerald-600 bg-emerald-600 text-white shadow-sm',
    idle: 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-gray-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40',
    bar: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    value: 4,
    label: 'Very good',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
    solid: 'border-teal-600 bg-teal-600 text-white shadow-sm',
    idle: 'border-teal-300 bg-white text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:bg-gray-800 dark:text-teal-300 dark:hover:bg-teal-950/40',
    bar: 'bg-teal-500',
    text: 'text-teal-700 dark:text-teal-300',
  },
  {
    value: 3,
    label: 'Good',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
    solid: 'border-blue-600 bg-blue-600 text-white shadow-sm',
    idle: 'border-blue-300 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:bg-blue-950/40',
    bar: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
  },
  {
    value: 2,
    label: 'Needs support',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    solid: 'border-amber-500 bg-amber-500 text-white shadow-sm',
    idle: 'border-amber-300 bg-white text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:bg-gray-800 dark:text-amber-300 dark:hover:bg-amber-950/40',
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
  },
  {
    value: 1,
    label: 'Concern',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    solid: 'border-red-600 bg-red-600 text-white shadow-sm',
    idle: 'border-red-300 bg-white text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:bg-red-950/40',
    bar: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
  },
];

/** Ascending 1..5 (the order buttons are shown in: Concern -> Excellent). */
export const WEEKLY_RATINGS_ASC: readonly RatingStyle[] = [...WEEKLY_RATINGS].reverse();

/** Label + colour classes for a rating; null for anything outside 1..5. */
export function getRatingStyle(value: number | null | undefined): RatingStyle | null {
  if (value == null) return null;
  const n = Math.round(Number(value));
  return WEEKLY_RATINGS.find((r) => r.value === n) ?? null;
}

export function ratingLabel(value: number | null | undefined): string {
  return getRatingStyle(value)?.label ?? '';
}

/** Average of the given ratings as a rating style (rounded), or null when empty. */
export function averageRating(values: Array<number | null | undefined>): RatingStyle | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && v >= 1 && v <= 5);
  if (nums.length === 0) return null;
  return getRatingStyle(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// ── Attendance chips ─────────────────────────────────────────────────────────

export type WeekDayStatus = 'present' | 'late' | 'excused' | 'absent' | 'none';

export interface DayStatusStyle {
  word: string;
  /** One-letter form for tight chips (always paired with the word as a tooltip / SR text). */
  letter: string;
  chip: string;
}

export const DAY_STATUS: Record<WeekDayStatus, DayStatusStyle> = {
  present: { word: 'Present', letter: 'P', chip: 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  late: { word: 'Late', letter: 'L', chip: 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  excused: { word: 'Excused', letter: 'E', chip: 'border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300' },
  absent: { word: 'Absent', letter: 'A', chip: 'border-red-400 bg-red-100 text-red-800 ring-1 ring-red-300 dark:border-red-700 dark:bg-red-900/40 dark:text-red-300 dark:ring-red-800' },
  none: { word: 'No register', letter: '–', chip: 'border-dashed border-gray-300 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-500' },
};

/** Higher = better, for merging several sessions of one day into one status. */
const STATUS_RANK: Record<WeekDayStatus, number> = { none: 0, absent: 1, excused: 2, late: 3, present: 4 };

export function normalizeDayStatus(status: unknown): WeekDayStatus {
  const s = String(status ?? '').toLowerCase();
  return s === 'present' || s === 'late' || s === 'excused' || s === 'absent' ? s : 'none';
}

/** Best status of the day wins (a morning absence with an afternoon present = present). */
export function bestStatus(a: WeekDayStatus, b: WeekDayStatus): WeekDayStatus {
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a;
}

// ── Dates ────────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
const WEEKDAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

export function weekdayFull(index: number): string {
  return WEEKDAY_FULL[index] ?? '';
}

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' -> local Date at midnight; null when malformed. */
export function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(key ?? ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function addDaysToKey(key: string, days: number): string {
  const d = parseDateKey(key);
  if (!d) return key;
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

/** Monday of the week containing `key` (Saturday/Sunday belong to the week that just ended). */
export function mondayOfKey(key: string): string {
  const d = parseDateKey(key);
  if (!d) return key;
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return localDateKey(d);
}

export function currentWeekStart(now: Date = new Date()): string {
  return mondayOfKey(localDateKey(now));
}

/** The five school-day keys (Mon..Fri) of the week starting `weekStart`. */
export function weekDayKeys(weekStart: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => addDaysToKey(weekStart, i));
}

function dayNum(d: Date): string {
  return String(d.getDate());
}

/** 'Mon 6 – Fri 10 Oct 2026' (adds month/year to the first date only when they differ). */
export function formatWeekRange(weekStart: string): string {
  const start = parseDateKey(weekStart);
  const end = parseDateKey(addDaysToKey(weekStart, 4));
  if (!start || !end) return weekStart;
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const first = `Mon ${dayNum(start)}${sameMonth ? '' : ` ${MONTHS[start.getMonth()]}`}${sameYear ? '' : ` ${start.getFullYear()}`}`;
  return `${first} – Fri ${dayNum(end)} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

/** 'Week of 6 – 10 Oct 2026' (Monday to Friday, whatever week_end the server sends). */
export function formatWeekOf(weekStart: string): string {
  const start = parseDateKey(weekStart);
  const end = parseDateKey(addDaysToKey(weekStart, 4));
  if (!start || !end) return `Week of ${weekStart}`;
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();
  const first = `${dayNum(start)}${sameMonth ? '' : ` ${MONTHS[start.getMonth()]}`}${sameYear ? '' : ` ${start.getFullYear()}`}`;
  return `Week of ${first} – ${dayNum(end)} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

/** '6 Oct' */
export function formatShortDate(key: string): string {
  const d = parseDateKey(key);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : key;
}

export const COMMENT_MAX = 600;
