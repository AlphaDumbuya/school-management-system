import React from 'react';

// ── Base Skeleton ──────────────────────────────────────────────────────────────

export interface SkeletonProps {
  width?: string;    // CSS width value, default '100%'
  height?: string;   // CSS height value, default '1rem'
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
}) => (
  <div
    className={`bg-gray-200 animate-pulse rounded ${className}`}
    style={{ width, height }}
  />
);

// ── SkeletonText ───────────────────────────────────────────────────────────────

export interface SkeletonTextProps {
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ className = '' }) => (
  <Skeleton height="0.875rem" className={`mb-2 ${className}`.trim()} />
);

// ── SkeletonCard ───────────────────────────────────────────────────────────────

export const SkeletonCard: React.FC = () => (
  <div className="p-6 rounded-lg border-l-4 border-gray-200 bg-gray-50">
    {/* Label area */}
    <SkeletonText className="w-1/2" />
    {/* Value area */}
    <Skeleton height="2rem" className="mt-2" />
    {/* Trend placeholder */}
    <Skeleton height="0.875rem" width="30%" className="mt-2" />
  </div>
);

// ── SkeletonTableRow ───────────────────────────────────────────────────────────

export interface SkeletonTableRowProps {
  columnCount: number;
}

export const SkeletonTableRow: React.FC<SkeletonTableRowProps> = ({ columnCount }) => (
  <tr>
    {Array.from({ length: columnCount }).map((_, index) => (
      <td key={index} className="px-4 py-3">
        <Skeleton height="0.875rem" />
      </td>
    ))}
  </tr>
);

// ── SkeletonChart ──────────────────────────────────────────────────────────────

export interface SkeletonChartProps {
  height?: number; // px, default 300
}

export const SkeletonChart: React.FC<SkeletonChartProps> = ({ height }) => (
  <Skeleton height={`${height ?? 300}px`} className="rounded-lg" />
);
