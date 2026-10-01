/**
 * academicYear — canonical academic-year helpers (Academic Year Architecture,
 * Module 0 foundation). One place to normalize/compare year strings and to
 * resolve a tenant's active year, so every module agrees on the format.
 *
 * Canonical format: "YYYY/YYYY" (e.g. "2026/2027").
 * Legacy variants we tolerate on READ: "YYYY-YYYY" (hyphen), "YYYY" (single).
 */
import db from './database.js';

/**
 * Convert any accepted year variant to the canonical "YYYY/YYYY".
 *  - "2026/2027" → "2026/2027"
 *  - "2026-2027" → "2026/2027"
 *  - "2026"      → "2026/2027"
 * Returns the input trimmed unchanged if it doesn't match a known shape.
 */
export function normalizeAcademicYear(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Already canonical.
  if (/^\d{4}\/\d{4}$/.test(s)) return s;
  // Hyphenated → slash.
  const hyphen = /^(\d{4})-(\d{4})$/.exec(s);
  if (hyphen) return `${hyphen[1]}/${hyphen[2]}`;
  // Single year → span.
  const single = /^(\d{4})$/.exec(s);
  if (single) { const y = Number(single[1]); return `${y}/${y + 1}`; }
  return s;
}

/**
 * True when two year strings refer to the SAME academic year, tolerant of
 * hyphen/slash/single-year variants. Use this for comparisons against legacy
 * data until everything is normalized.
 */
export function sameAcademicYear(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeAcademicYear(a);
  const nb = normalizeAcademicYear(b);
  return !!na && !!nb && na === nb;
}

/** The current calendar-derived academic year span, as a safe fallback. */
export function currentAcademicYearFallback(): string {
  const y = new Date().getFullYear();
  // School years typically start ~September; before then we're still in the
  // previous span. Keep it simple and deterministic here.
  return `${y}/${y + 1}`;
}

export interface ActiveYear {
  sessionId: string | null;
  yearString: string; // canonical "YYYY/YYYY"
}

/**
 * Resolve a tenant's ACTIVE academic year: the single is_active session's name
 * (normalized), else the most recent session, else the calendar fallback.
 * This is the default year for any read that doesn't specify one.
 */
export async function resolveActiveYear(tenantId: string): Promise<ActiveYear> {
  try {
    const active = await db('academic_sessions')
      .where({ tenant_id: tenantId, is_active: true })
      .orderBy('updated_at', 'desc')
      .first();
    if (active?.name) {
      return { sessionId: active.id, yearString: normalizeAcademicYear(active.name)! };
    }
    const latest = await db('academic_sessions')
      .where({ tenant_id: tenantId })
      .orderBy('name', 'desc')
      .first();
    if (latest?.name) {
      return { sessionId: latest.id, yearString: normalizeAcademicYear(latest.name)! };
    }
  } catch {
    /* fall through to calendar fallback */
  }
  return { sessionId: null, yearString: currentAcademicYearFallback() };
}

export interface YearScope {
  /** Classes belonging to the year (active year also gets legacy no-session classes). */
  classIds: string[];
  /** Date window for records without a class: [from, to). Either side may be open. */
  from: Date | null;
  to: Date | null;
}

const yearStart = (name?: string | null) => {
  const m = /^(\d{4})\//.exec(String(name || ''));
  return m ? Number(m[1]) : NaN;
};

/**
 * Resolve how to scope year-less records (discipline, notes, …) to one academic
 * year. Records are matched by their class first (reliable), else by date:
 * from this year's session start up to the NEXT year's session start (the
 * newest year is open-ended). Returns null when no year was requested.
 */
export async function resolveYearScope(tenantId: string, academicYear: unknown): Promise<YearScope | null> {
  const y = normalizeAcademicYear(typeof academicYear === 'string' ? academicYear : null);
  if (!y || y === 'all' || y === 'undefined' || y === 'null') return null;
  const sessions = await db('academic_sessions').where({ tenant_id: tenantId }).select('id', 'name', 'start_date', 'is_active');
  const session = sessions.find((s: any) => normalizeAcademicYear(s.name) === y);
  if (!session) return { classIds: [], from: new Date(8.64e15), to: null }; // unknown year → nothing
  const classes = await db('classes')
    .leftJoin('users as cc', 'classes.created_by', 'cc.id')
    .where((q) => {
      q.where('classes.academic_session_id', session.id);
      if (session.is_active) q.orWhere((q2) => q2.whereNull('classes.academic_session_id').where('cc.tenant_id', tenantId));
    })
    .select('classes.id');
  const later = sessions
    .filter((s: any) => yearStart(s.name) > yearStart(session.name) && s.start_date)
    .sort((a: any, b: any) => yearStart(a.name) - yearStart(b.name))[0];
  const earlier = sessions.some((s: any) => yearStart(s.name) < yearStart(session.name));
  return {
    classIds: classes.map((r: any) => r.id),
    from: earlier && session.start_date ? new Date(session.start_date) : null,
    to: later ? new Date(later.start_date) : null,
  };
}

/**
 * Apply a YearScope to a query: class match, else (no class) date window.
 * Pass classCol = null for tables with no class column (date window only).
 */
export function applyYearScope(q: any, scope: YearScope | null, classCol: string | null, dateCol: string) {
  if (!scope) return q;
  if (!classCol) {
    if (scope.from) q.where(dateCol, '>=', scope.from);
    if (scope.to) q.where(dateCol, '<', scope.to);
    return q;
  }
  return q.where((w: any) => {
    if (scope.classIds.length) w.whereIn(classCol, scope.classIds);
    w.orWhere((w2: any) => {
      w2.whereNull(classCol);
      if (scope.from) w2.where(dateCol, '>=', scope.from);
      if (scope.to) w2.where(dateCol, '<', scope.to);
    });
  });
}
