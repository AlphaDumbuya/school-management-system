import React, { useRef } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  TooltipProps,
} from 'recharts';
import { Download } from 'lucide-react';
import { SkeletonChart } from '../feedback/Skeleton';
import { EmptyState } from '../feedback/EmptyState';
import { Button } from '../../ui/button';

export type ChartType = 'line' | 'bar' | 'pie' | 'donut';

export interface ChartSeries {
  name: string;
  data: number[];
}

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  type: ChartType;
  series: ChartSeries[];
  labels?: string[];
  height?: number;
  isLoading?: boolean;
  onExport?: () => void;
  dateRangeFilter?: React.ReactNode;
  donutCenterLabel?: string;
  colors?: string[];
  emptyState?: {
    message: string;
    description?: string;
    action?: { label: string; onClick: () => void };
  };
}

const PALETTE = ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

// Dark tooltip
const CustomTooltip: React.FC<TooltipProps<any, any>> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-800 text-white rounded px-3 py-2 text-xs shadow-md">
      {label && <p className="font-medium mb-1">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color ?? '#fff' }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

function isSeriesEmpty(series: ChartSeries[], labels?: string[]): boolean {
  if (!labels?.length && !series.length) return true;
  if (series.every((s) => s.data.length === 0)) return true;
  return false;
}

function toRecharts(series: ChartSeries[], labels: string[] = []) {
  return labels.map((label, i) => {
    const point: Record<string, any> = { name: label };
    series.forEach((s) => { point[s.name] = s.data[i] ?? 0; });
    return point;
  });
}

function toPieData(series: ChartSeries[], labels: string[] = []) {
  // For pie/donut we use the first series
  const s = series[0];
  if (!s) return [];
  return s.data.map((value, i) => ({ name: labels[i] ?? `Segment ${i + 1}`, value }));
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  type,
  series,
  labels = [],
  height = 300,
  isLoading = false,
  onExport,
  dateRangeFilter,
  donutCenterLabel,
  colors = PALETTE,
  emptyState,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    if (onExport) { onExport(); return; }
    // Fallback: serialize SVG inside container
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.download = `chart-${title.toLowerCase().replace(/\s+/g, '-')}-${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  };

  const renderChart = () => {
    const needsRotation = labels.length > 8;
    const xAxisProps = needsRotation
      ? { angle: -45, textAnchor: 'end' as const, interval: 0, height: 60 }
      : {};

    if (type === 'line') {
      const chartData = toRecharts(series, labels);
      return (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} {...xAxisProps} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={colors[i % colors.length]}
              strokeWidth={2}
              dot={labels.length === 1 ? { r: 4 } : false}
            />
          ))}
        </LineChart>
      );
    }

    if (type === 'bar') {
      const chartData = toRecharts(series, labels);
      return (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} {...xAxisProps} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map((s, i) => (
            <Bar key={s.name} dataKey={s.name} fill={colors[i % colors.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      );
    }

    const pieData = toPieData(series, labels);

    if (type === 'pie') {
      return (
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius="80%">
            {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      );
    }

    // donut
    const total = pieData.reduce((acc, d) => acc + d.value, 0);
    return (
      <PieChart>
        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="55%" outerRadius="80%">
          {pieData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Pie>
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-sm font-semibold" fill="#111827">
          {donutCenterLabel ?? String(total)}
        </text>
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4 gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {dateRangeFilter}
          {(onExport || true) && (
            <Button variant="ghost" size="icon" onClick={handleExport} aria-label="Export chart">
              <Download size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div ref={containerRef}>
        {isLoading ? (
          <SkeletonChart height={height} />
        ) : isSeriesEmpty(series, labels) ? (
          <div style={{ height }} className="flex items-center justify-center">
            <EmptyState
              message={emptyState?.message ?? 'No data available'}
              description={emptyState?.description}
              action={emptyState?.action}
              className="min-h-0"
            />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={height}>
            {renderChart() as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default ChartCard;
