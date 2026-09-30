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
