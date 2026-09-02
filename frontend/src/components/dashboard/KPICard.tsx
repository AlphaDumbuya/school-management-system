/**
 * KPI Card Component
 * Displays key performance indicators with trend indicators.
 * Polished: soft elevation, tinted icon chip, accent bar, hover lift.
 */

import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  /** Optional context for the trend, e.g. "vs last month". */
  trendLabel?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'indigo' | 'gray';
  onClick?: () => void;
  isLoading?: boolean;
}

const accentClasses = {
  blue: 'before:bg-blue-500',
  green: 'before:bg-emerald-500',
  red: 'before:bg-red-500',
  amber: 'before:bg-amber-500',
  purple: 'before:bg-purple-500',
  indigo: 'before:bg-indigo-500',
  gray: 'before:bg-gray-400',
};

const iconChipClasses = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  purple: 'bg-purple-50 text-purple-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  gray: 'bg-gray-100 text-gray-600',
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon,
  color = 'blue',
  onClick,
  isLoading,
}) => {
  return (
    <div
      className={clsx(
        // Base card: white, soft ring + shadow, left accent bar via ::before
        'group relative overflow-hidden rounded-2xl bg-white p-4 sm:p-5',
        'ring-1 ring-gray-200/70 shadow-sm transition-all duration-300',
        'before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-r-full',
        accentClasses[color],
        onClick && 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:ring-gray-300',
        isLoading && 'opacity-60 pointer-events-none'
      )}
      onClick={onClick}
    >
      {/* Header: title + icon chip */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">{title}</p>
          {subtitle && (
            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div
            className={clsx(
              'flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-lg transition-transform duration-300 group-hover:scale-110',
              iconChipClasses[color]
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mb-2">
        {isLoading ? (
          <div className="h-7 sm:h-9 bg-gray-100 rounded-lg animate-pulse w-2/3" />
        ) : (
          <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight truncate">
            {value}
          </p>
        )}
      </div>

      {/* Trend indicator */}
      {trend && !isLoading && (
        <div className="flex items-center gap-1.5">
          <span
            className={clsx(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-bold',
              trend.isPositive
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-red-50 text-red-600'
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {Math.abs(trend.value)}%
          </span>
          {trendLabel && <span className="text-[11px] text-gray-400 truncate">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
};

export default KPICard;
