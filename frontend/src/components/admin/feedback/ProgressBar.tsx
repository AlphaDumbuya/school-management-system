import React, { useState, useEffect } from 'react';

export type ProgressBarSize = 'sm' | 'md' | 'lg';
export type ProgressBarColor = 'blue' | 'green' | 'amber' | 'red' | 'purple';

export interface ProgressBarProps {
  value: number;
  label?: string;
  color?: ProgressBarColor;
  size?: ProgressBarSize;
  showValue?: boolean;
  className?: string;
}

const HEIGHT: Record<ProgressBarSize, string> = {
  sm: '4px',
  md: '8px',
  lg: '12px',
};

const COLOR_CLASS: Record<ProgressBarColor, string> = {
  blue: 'bg-blue-600',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  color = 'blue',
  size = 'md',
  showValue = false,
  className = '',
}) => {
  const clamped = Math.min(100, Math.max(0, value));
  const [width, setWidth] = useState('0%');

  useEffect(() => {
    // Defer to next tick so the CSS transition fires from 0% → target
    const timer = setTimeout(() => setWidth(`${clamped}%`), 16);
    return () => clearTimeout(timer);
  }, [clamped]);

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`flex items-center gap-2 ${className}`}
    >
      {label && <span className="text-xs text-gray-600 whitespace-nowrap">{label}</span>}
      <div
        className="flex-1 bg-gray-200 rounded-full overflow-hidden"
        style={{ height: HEIGHT[size] }}
      >
        <div
          className={`${COLOR_CLASS[color]} h-full rounded-full`}
          style={{ width, transition: 'width 600ms ease-out' }}
        />
      </div>
      {showValue && (
        <span className="text-xs text-gray-600 whitespace-nowrap">{clamped}%</span>
      )}
    </div>
  );
};

export default ProgressBar;
