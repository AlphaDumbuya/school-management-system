/**
 * KPI Card Component
 * Displays key performance indicators with trend indicators
 * Phase 11: Frontend Dashboard Implementation
 */

import React from 'react';
import { TrendingUp, TrendingDown } from 'react-icons/fa';
import clsx from 'clsx';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'indigo';
  onClick?: () => void;
  isLoading?: boolean;
}

const colorClasses = {
  blue: 'bg-blue-50 border-blue-200',
  green: 'bg-green-50 border-green-200',
  red: 'bg-red-50 border-red-200',
  amber: 'bg-amber-50 border-amber-200',
  purple: 'bg-purple-50 border-purple-200',
  indigo: 'bg-indigo-50 border-indigo-200',
};

const textColorClasses = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  red: 'text-red-600',
  amber: 'text-amber-600',
  purple: 'text-purple-600',
  indigo: 'text-indigo-600',
};

const trendColorClasses = {
  blue: 'bg-blue-100',
  green: 'bg-green-100',
  red: 'bg-red-100',
  amber: 'bg-amber-100',
  purple: 'bg-purple-100',
  indigo: 'bg-indigo-100',
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = 'blue',
  onClick,
  isLoading,
}) => {
  return (
    <div
      className={clsx(
        'p-6 rounded-lg border-l-4 transition-all duration-200',
        colorClasses[color],
        onClick && 'cursor-pointer hover:shadow-md',
        isLoading && 'opacity-50 pointer-events-none'
      )}
      onClick={onClick}
    >
      {/* Header with icon and trend */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {icon && <div className={clsx('text-xl', textColorClasses[color])}>{icon}</div>}
      </div>

      {/* Value */}
      <div className="mb-2">
        {isLoading ? (
          <div className="h-8 bg-gray-200 rounded animate-pulse w-1/2" />
        ) : (
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        )}
      </div>

      {/* Trend indicator */}
      {trend && (
        <div
          className={clsx(
            'flex items-center gap-1 text-sm font-semibold',
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          )}
        >
          {trend.isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>{Math.abs(trend.value)}%</span>
        </div>
      )}
    </div>
  );
};

export default KPICard;
