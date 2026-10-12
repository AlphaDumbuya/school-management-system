/**
 * Shared formatters and small helpers for finance/admissions charts.
 */

/** Compact Leone amount for chart axes and tooltips: Le 950, Le 12.5k, Le 3.2M. */
export function fmtLeShort(v: number): string {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  if (a >= 1_000_000) return `Le ${(n / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `Le ${(n / 1_000).toFixed(1)}k`;
  return `Le ${Math.round(n).toLocaleString()}`;
}

/** Whole-number percentage. */
export const fmtPct = (v: number) => `${Math.round(Number(v) || 0)}%`;

/** Plain count. */
export const fmtCount = (v: number) => `${Math.round(Number(v) || 0).toLocaleString()}`;

/** An empty series for ChartCard (shows its empty state). */
export const NO_SERIES = { series: [] as { name: string; data: number[] }[], labels: [] as string[] };

/**
 * Sum rows into calendar months (oldest first, gaps filled with 0) from a date
 * field, e.g. expenses by month. `max` keeps only the most recent months.
 */
export function monthlyTotals<T>(rows: T[], dateOf: (r: T) => string | Date | null | undefined, valueOf: (r: T) => number, max = 12): { labels: string[]; data: number[] } {
  const sums = new Map<string, number>();
  for (const r of rows) {
    const raw = dateOf(r);
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    sums.set(k, (sums.get(k) || 0) + (Number(valueOf(r)) || 0));
  }
  if (sums.size === 0) return { labels: [], data: [] };
  const keys = Array.from(sums.keys()).sort();
  const [fy, fm] = keys[0].split('-').map(Number);
  const [ly, lm] = keys[keys.length - 1].split('-').map(Number);
  const labels: string[] = [];
  const data: number[] = [];
  for (let y = fy, m = fm; y < ly || (y === ly && m <= lm); m === 12 ? (y++, m = 1) : m++) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    labels.push(new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }));
    data.push(Math.round((sums.get(k) || 0) * 100) / 100);
  }
  return { labels: labels.slice(-max), data: data.slice(-max) };
}

/** Title-case a snake/space label: "under_review" → "Under review". */
export const prettyLabel = (s: string) => {
  const t = String(s || '').replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '—';
};
