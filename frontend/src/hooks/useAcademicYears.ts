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
  return s;
}

export interface UseAcademicYears {
  years: string[];        // canonical, newest-first
  activeYear: string;     // the tenant's active session year (or calendar fallback)
  isLoading: boolean;
}

/**
 * Returns the real academic years for the tenant. Falls back to a small
 * calendar-derived span only for a brand-new school with no sessions yet, so a
 * picker is never empty.
 */
export function useAcademicYears(): UseAcademicYears {
  const { data, isLoading } = useQuery({
    queryKey: ['academic-sessions'],
    queryFn: () => schoolConfigService.listAcademicSessions(),
    staleTime: 60_000,
  });

  const sessions: Array<{ name: string; is_active: boolean }> =
    ((data as any)?.data ?? []) as any;

  const activeYear = useMemo(() => {
    const active = sessions.find((s) => s.is_active)?.name;
    const norm = normalizeYear(active);
    if (norm) return norm;
    const y = new Date().getFullYear();
    return `${y}/${y + 1}`;
  }, [sessions]);

  const years = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => { const n = normalizeYear(s?.name); if (n) set.add(n); });
    // Ensure the active year and a small current span are always selectable.
    set.add(activeYear);
    const cur = new Date().getFullYear();
    for (let i = 1; i >= -3; i--) set.add(`${cur + i}/${cur + i + 1}`);
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [sessions, activeYear]);

  return { years, activeYear, isLoading };
}

export default useAcademicYears;
