/**
 * useAcademicYears — the ONE source of academic-year options for the whole app
 * (Academic Year Architecture, Module 0).
 *
 * Fetches the tenant's REAL academic sessions and returns a canonical, sorted
 * list of year strings plus the active year. Every page's year filter uses this
 * — never a `new Date()`-fabricated list.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import schoolConfigService from '@services/schoolConfigService';

/** Normalize any year variant to canonical "YYYY/YYYY". */
export function normalizeYear(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}\/\d{4}$/.test(s)) return s;
  const h = /^(\d{4})-(\d{4})$/.exec(s);
  if (h) return `${h[1]}/${h[2]}`;
  const one = /^(\d{4})$/.exec(s);
  if (one) { const y = Number(one[1]); return `${y}/${y + 1}`; }
  // A span inside a longer name ("2026/2027 Academic Year", what new schools
  // get at sign-up): same rule as the server's normalizeAcademicYear.
  const e = /(\d{4})\s*[/-]\s*(\d{4})/.exec(s);
  if (e && Number(e[2]) === Number(e[1]) + 1) return `${e[1]}/${e[2]}`;
  return s;
}

export interface UseAcademicYears {
  years: string[];        // canonical, newest-first
  activeYear: string;     // the tenant's active session year; '' while loading
  isLoading: boolean;
}

/**
 * Returns the real academic years for the tenant (from academic_sessions),
 * newest first. Never invents years; only a school with no sessions at all
 * gets a single calendar-year entry so a picker is never empty.
 */
export function useAcademicYears(): UseAcademicYears {
  const { data, isLoading } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: () => schoolConfigService.listAcademicSessions(),
    staleTime: 60_000,
  });

  const sessions: Array<{ name: string; is_active: boolean }> =
    ((data as any)?.data ?? []) as any;

  // The school's ACTIVE session. Empty while loading — never a calendar guess,
  // otherwise pickers lock onto the wrong year before the real one arrives.
  // Only a school with no sessions at all falls back to the calendar year.
  const activeYear = useMemo(() => {
    if (isLoading) return '';
    const active = sessions.find((s) => s.is_active)?.name;
    const norm = normalizeYear(active);
    if (norm) return norm;
    const newest = sessions.map((s) => normalizeYear(s?.name)).filter(Boolean).sort().pop();
    if (newest) return newest as string;
    const y = new Date().getFullYear();
    return `${y}/${y + 1}`;
  }, [sessions, isLoading]);

  // ONLY the school's real academic years. A brand-new school with no
  // sessions yet gets just one entry (the calendar year) so pickers aren't empty.
  const years = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => { const n = normalizeYear(s?.name); if (n && /^\d{4}\/\d{4}$/.test(n)) set.add(n); });
    if (set.size === 0 && activeYear) set.add(activeYear);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [sessions, activeYear]);

  return { years, activeYear, isLoading };
}

export default useAcademicYears;
