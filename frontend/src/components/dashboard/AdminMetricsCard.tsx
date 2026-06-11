import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple';
  onClick?: () => void;
}

const colorClasses = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
};

const iconColorClasses = {
  blue: 'text-blue-500',
  green: 'text-green-500',
  red: 'text-red-500',
  amber: 'text-amber-500',
  purple: 'text-purple-500',
};

export const AdminMetricsCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  trend,
  icon,
  color = 'blue',
  onClick,
}) => {
  const trendColor = trend && trend > 0 ? 'text-green-600' : 'text-red-600';
  const trendIcon = trend && trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />;

  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-lg border-2 ${colorClasses[color]} transition-all duration-300 hover:shadow-lg cursor-pointer`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-2">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{value}</span>
            {unit && <span className="text-sm text-gray-500">{unit}</span>}
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 mt-2 ${trendColor} text-sm font-semibold`}>
              {trendIcon}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <div className={`text-3xl ${iconColorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
};

export default AdminMetricsCard;
