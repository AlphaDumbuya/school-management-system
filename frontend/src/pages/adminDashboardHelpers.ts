/**
 * Pure helper functions for AdminDashboard
 * Isolated here so they can be unit-tested independently.
 */

import { ChartData } from '@hooks/useDashboard';
import { ChartSeries } from '@components/admin/charts/ChartCard';

// ── Currency ──────────────────────────────────────────────────────────────────

/**
 * Formats a numeric value as Sierra Leonean Leone currency.
 * Returns "Le 0" for null, undefined, or NaN inputs.
 */
export function formatCurrency(value: number | undefined | null): string {
  if (value == null || isNaN(value as number)) return 'Le 0';
  return `Le ${(value as number).toLocaleString()}`;
}

// ── Chart data transformation ─────────────────────────────────────────────────

/**
 * Converts the useDashboard ChartData format to the ChartCard_DS series format.
 */
export function toChartSeries(chartData: ChartData): { series: ChartSeries[]; labels: string[] } {
  return {
    labels: chartData.labels,
    series: chartData.datasets.map((ds) => ({
      name: ds.label,
      data: ds.data,
    })),
  };
}

/**
 * Returns true when a chart has no meaningful data to display.
 */
export function isChartEmpty(chartData: ChartData | undefined): boolean {
  if (!chartData) return true;
  if (chartData.labels.length === 0) return true;
  return chartData.datasets.every((ds) => ds.data.length === 0);
}

// ── Severity mapping ──────────────────────────────────────────────────────────

/** Maps atRiskStudent severity to a StatusBadge canonical status string */
export const severityToStatus: Record<'high' | 'medium' | 'low', string> = {
  high: 'overdue',    // → destructive
  medium: 'pending',  // → warning
  low: 'inactive',    // → secondary
};

// ── Attendance rate → ProgressBar colour ─────────────────────────────────────

export type ProgressColor = 'red' | 'amber' | 'green';

/**
 * Returns the ProgressBar colour based on attendance rate thresholds:
 *   < 75  → red
 *   75–89 → amber
 *   ≥ 90  → green
 */
export function attendanceColor(rate: number): ProgressColor {
  if (rate < 75) return 'red';
  if (rate < 90) return 'amber';
  return 'green';
}
