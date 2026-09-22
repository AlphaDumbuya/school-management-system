/**
 * KPI Card — premium stat card with gradient icon chip, animated count-up,
 * optional sparkline mini-chart, glow on hover, and colour-coded top accent.
 */

import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import clsx from 'clsx';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  trendLabel?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'indigo' | 'gray';
  onClick?: () => void;
  isLoading?: boolean;
  className?: string;
  /** Optional sparkline data points */
  sparkline?: number[];
}

const THEME = {
  blue:   { bar: 'bg-blue-500',    chip: 'from-[#315B8C] to-[#1d4ed8]',    text: 'text-blue-700',    glow: 'hover:shadow-blue-500/20',    bg: 'bg-blue-50',    spark: '#3b82f6' },
  green:  { bar: 'bg-emerald-500', chip: 'from-emerald-500 to-teal-600',   text: 'text-emerald-700', glow: 'hover:shadow-emerald-500/20', bg: 'bg-emerald-50', spark: '#10b981' },
  red:    { bar: 'bg-red-500',     chip: 'from-red-500 to-rose-600',       text: 'text-red-700',     glow: 'hover:shadow-red-500/20',     bg: 'bg-red-50',     spark: '#ef4444' },
  amber:  { bar: 'bg-amber-500',   chip: 'from-amber-500 to-orange-500',   text: 'text-amber-700',   glow: 'hover:shadow-amber-500/20',   bg: 'bg-amber-50',   spark: '#f59e0b' },
  purple: { bar: 'bg-purple-500',  chip: 'from-purple-500 to-violet-600',  text: 'text-purple-700',  glow: 'hover:shadow-purple-500/20',  bg: 'bg-purple-50',  spark: '#8b5cf6' },
  indigo: { bar: 'bg-indigo-500',  chip: 'from-indigo-500 to-blue-700',    text: 'text-indigo-700',  glow: 'hover:shadow-indigo-500/20',  bg: 'bg-indigo-50',  spark: '#6366f1' },
  gray:   { bar: 'bg-gray-400',    chip: 'from-gray-400 to-gray-500',      text: 'text-gray-700',    glow: 'hover:shadow-gray-400/10',    bg: 'bg-gray-100',   spark: '#9ca3af' },
};

function useCountUp(target: number, duration = 900) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(eased * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return display;
}

/** Renders a tiny SVG polyline sparkline */
const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (data.length < 2) return null;
  const w = 80, h = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const last = pts[pts.length - 1];
  const [lx, ly] = last.split(',').map(Number);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-12 sm:w-20 h-5 sm:h-7 overflow-visible flex-shrink-0">
      <defs>
        <linearGradient id={`spark-fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <polygon
        points={`0,${h} ${pts.join(' ')} ${w},${h}`}
        fill={`url(#spark-fill-${color.replace('#', '')})`}
      />
      {/* Line */}
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* End dot */}
      <circle cx={lx} cy={ly} r={2.5} fill={color} />
    </svg>
  );
};

export const KPICard: React.FC<KPICardProps> = ({
  title, value, subtitle, trend, trendLabel,
  icon, color = 'blue', onClick, isLoading, className, sparkline,
}) => {
  const t = THEME[color];
  const numericValue = typeof value === 'number' ? value : null;
  const animated = useCountUp(numericValue ?? 0);
  const displayValue = isLoading ? null : numericValue !== null ? animated : value;

  return (
    <div
      onClick={onClick}
      className={clsx(
        'group relative overflow-hidden rounded-2xl bg-white p-3 sm:p-5',
        'ring-1 ring-gray-200/80 shadow-sm transition-all duration-300',
        'hover:shadow-xl hover:-translate-y-1 hover:ring-gray-300/60',
        t.glow,
        onClick && 'cursor-pointer',
        isLoading && 'opacity-60 pointer-events-none',
        className,
      )}
    >
      {/* Top accent beam */}
      <div className={`absolute top-0 inset-x-0 h-[3px] rounded-b-none ${t.bar} opacity-90`} />

      {/* Subtle background tint on hover */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${t.bg} pointer-events-none`}
        style={{ maskImage: 'radial-gradient(ellipse at 50% 0%, black 0%, transparent 70%)' }}
      />

      {/* Header: title + icon chip */}
      <div className="flex items-start justify-between gap-1.5 sm:gap-3 mb-2 sm:mb-3 mt-0.5 sm:mt-1">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] sm:text-sm font-semibold text-gray-500 truncate">{title}</p>
          {subtitle && <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {icon && (
          <div className={clsx(
            'flex-shrink-0 w-8 h-8 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-white',
            'bg-gradient-to-br shadow-md transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg',
            t.chip,
          )}>
            <span className="[&>svg]:w-3.5 [&>svg]:h-3.5 sm:[&>svg]:w-5 sm:[&>svg]:h-5">{icon}</span>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="mb-1">
        {isLoading ? (
          <div className="h-7 sm:h-9 bg-gray-100 rounded-lg animate-pulse w-2/3" />
        ) : (
          <p className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight truncate text-gray-900">
            {displayValue}
          </p>
        )}
      </div>

      {/* Trend + sparkline row */}
      <div className="flex items-end justify-between gap-1 sm:gap-2 mt-1.5 sm:mt-2">
        {trend && !isLoading ? (
          <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
            <span className={clsx(
              'inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-xs font-bold flex-shrink-0',
              trend.isPositive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600',
            )}>
              {trend.isPositive ? <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
              {trend.isPositive ? '+' : ''}{Math.abs(trend.value)}%
            </span>
            {trendLabel && (
              <span className="text-[9px] sm:text-[11px] text-gray-400 truncate">
                {trendLabel}
              </span>
            )}
          </div>
        ) : <div />}

        {sparkline && sparkline.length >= 2 && !isLoading && (
          <Sparkline data={sparkline} color={t.spark} />
        )}
      </div>
    </div>
  );
};

export default KPICard;
