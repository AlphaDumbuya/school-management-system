import React, { useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  TooltipProps,
} from 'recharts';
import { Download, TrendingUp } from 'lucide-react';
import { saveBlob } from '@lib/download';
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
  /** Formats numeric values in the Y-axis + tooltip (e.g. compact currency). */
  valueFormatter?: (v: number) => string;
  emptyState?: {
    message: string;
    description?: string;
    action?: { label: string; onClick: () => void };
  };
}

// Premium palette — vibrant but harmonious
const PALETTE = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ef4444', // red
  '#315B8C', // brand navy
];

// Gradient stop pairs per color
const GRAD_STOPS: Record<string, [string, string]> = {
  '#3b82f6': ['#3b82f6', '#1d4ed8'],
  '#10b981': ['#10b981', '#059669'],
  '#f59e0b': ['#f59e0b', '#d97706'],
  '#8b5cf6': ['#8b5cf6', '#7c3aed'],
  '#ef4444': ['#ef4444', '#dc2626'],
  '#315B8C': ['#4a7db5', '#1f3d60'],
};

// ── Premium tooltip ──────────────────────────────────────────────────────────
const CustomTooltip: React.FC<TooltipProps<any, any> & { fmt?: (v: number) => string }> = ({ active, payload, label, fmt }) => {
  if (!active || !payload?.length) return null;
  const f = fmt ?? ((v: number) => v?.toLocaleString());
  return (
    <div className="bg-gray-950/95 backdrop-blur-md text-white rounded-xl px-3 py-2.5 text-xs shadow-2xl border border-white/10 min-w-[110px] sm:min-w-[130px] sm:px-4 sm:py-3">
      {label && (
        <p className="font-bold text-white/80 mb-2 pb-1.5 border-b border-white/10 text-[10px] sm:text-[11px] uppercase tracking-wider truncate">
          {label}
        </p>
      )}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3 sm:gap-4 py-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full ring-1 ring-white/20 flex-shrink-0"
              style={{ backgroundColor: entry.color ?? '#fff' }}
            />
            <span className="text-white/60 truncate">{entry.name}</span>
          </div>
          <span className="font-black text-white flex-shrink-0">{f(Number(entry.value) || 0)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Pie tooltip ──────────────────────────────────────────────────────────────
const PieTooltip: React.FC<TooltipProps<any, any> & { fmt?: (v: number) => string }> = ({ active, payload, fmt }) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const f = fmt ?? ((v: number) => v?.toLocaleString());
  return (
    <div className="bg-gray-950/95 backdrop-blur-md text-white rounded-xl px-4 py-3 text-xs shadow-2xl border border-white/10">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full ring-1 ring-white/20" style={{ backgroundColor: entry.payload?.fill }} />
        <span className="font-semibold">{entry.name}</span>
        <span className="font-black ml-auto">{f(Number(entry.value) || 0)}</span>
      </div>
    </div>
  );
};

// ── Custom legend ────────────────────────────────────────────────────────────
const CustomLegend: React.FC<{ payload?: any[]; colorOverrides?: string[] }> = ({ payload, colorOverrides }) => (
  <div className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1.5 mt-2 sm:mt-3">
    {(payload ?? []).map((entry: any, i: number) => (
      <div key={i} className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-gray-500 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: colorOverrides?.[i] ?? entry.color }}
        />
        <span className="truncate">{entry.value}</span>
      </div>
    ))}
  </div>
);

// ── Helpers ──────────────────────────────────────────────────────────────────
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
  const s = series[0];
  if (!s) return [];
  return s.data.map((value, i) => ({ name: labels[i] ?? `Segment ${i + 1}`, value }));
}

// ── Chart Card ───────────────────────────────────────────────────────────────
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
  valueFormatter,
  emptyState,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleExport = () => {
    if (onExport) { onExport(); return; }
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d')?.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const fname = `chart-${title.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.png`;
      canvas.toBlob((b) => { if (b) void saveBlob(b, fname); }, 'image/png');
    };
    img.src = url;
  };

  const renderChart = () => {
    const needsRotation = labels.length > 8;
    const xAxisProps = needsRotation
      ? { angle: -40, textAnchor: 'end' as const, interval: 0, height: 56 }
      : {};

    // ── AREA / LINE ──────────────────────────────────────────────────────────
    if (type === 'line') {
      const chartData = toRecharts(series, labels);
      // Closure so CustomLegend gets real hex colours (not gradient refs)
      const lineLegend = (props: any) => <CustomLegend {...props} colorOverrides={colors} />;
      return (
        <AreaChart data={chartData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
          <defs>
            {series.map((s, i) => {
              const c = colors[i % colors.length];
              return (
                <linearGradient key={s.name} id={`area-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={c} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: '#E2E8F0' }}
            {...xAxisProps}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            width={valueFormatter ? 52 : 38}
            tickFormatter={valueFormatter}
          />
          <Tooltip content={<CustomTooltip fmt={valueFormatter} />} cursor={{ stroke: '#CBD5E1', strokeDasharray: '4 4', strokeWidth: 1 }} />
          <Legend content={lineLegend} />
          {series.map((s, i) => {
            const c = colors[i % colors.length];
            return (
              <Area
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={c}
                strokeWidth={2.5}
                fill={`url(#area-grad-${i})`}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2.5, stroke: '#fff', fill: c }}
              />
            );
          })}
        </AreaChart>
      );
    }

    // ── BAR ─────────────────────────────────────────────────────────────────
    if (type === 'bar') {
      const chartData = toRecharts(series, labels);
      // Closure so CustomLegend gets real hex colours (not gradient url() refs)
      const barLegend = (props: any) => <CustomLegend {...props} colorOverrides={colors} />;
      return (
        <BarChart data={chartData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }} barCategoryGap="30%">
          <defs>
            {series.map((s, i) => {
              const c = colors[i % colors.length];
              const [top, btm] = GRAD_STOPS[c] ?? [c, c];
              return (
                <linearGradient key={s.name} id={`bar-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor={top} stopOpacity={1} />
                  <stop offset="100%" stopColor={btm} stopOpacity={0.75} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
            tickLine={false}
            axisLine={{ stroke: '#E2E8F0' }}
            {...xAxisProps}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
            tickLine={false}
            axisLine={false}
            width={valueFormatter ? 52 : 38}
            tickFormatter={valueFormatter}
          />
          <Tooltip content={<CustomTooltip fmt={valueFormatter} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
          <Legend content={barLegend} />
          {series.map((s, i) => (
            <Bar
              key={s.name}
              dataKey={s.name}
              fill={`url(#bar-grad-${i})`}
              radius={[5, 5, 0, 0]}
              maxBarSize={52}
            />
          ))}
        </BarChart>
      );
    }

    // ── PIE / DONUT ──────────────────────────────────────────────────────────
    const pieData = toPieData(series, labels);
    const isDonut = type === 'donut';
    const total = pieData.reduce((acc, d) => acc + d.value, 0);
    const pieLegend = (props: any) => <CustomLegend {...props} colorOverrides={colors} />;

    return (
      <PieChart>
        <defs>
          {pieData.map((_, i) => {
            const c = colors[i % colors.length];
            const [top, btm] = GRAD_STOPS[c] ?? [c, c];
            return (
              <linearGradient key={i} id={`pie-grad-${i}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%"   stopColor={top} stopOpacity={1} />
                <stop offset="100%" stopColor={btm} stopOpacity={0.9} />
              </linearGradient>
            );
          })}
          {/* Outer ghost ring for depth on donut */}
          {isDonut && (
            <radialGradient id="donut-ring-shadow" cx="50%" cy="50%" r="50%">
              <stop offset="80%" stopColor="#315B8C" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#315B8C" stopOpacity={0} />
            </radialGradient>
          )}
        </defs>

        {/* Ghost outer ring */}
        {isDonut && (
          <Pie
            data={[{ value: 1 }]}
            dataKey="value"
            cx="50%" cy="50%"
            outerRadius="84%"
            innerRadius="78%"
            fill="url(#donut-ring-shadow)"
            stroke="none"
            paddingAngle={0}
            isAnimationActive={false}
          />
        )}

        <Pie
          data={pieData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius="76%"
          innerRadius={isDonut ? '50%' : '0%'}
          paddingAngle={isDonut ? 3 : 2}
          strokeWidth={0}
        >
          {pieData.map((_, i) => (
            <Cell key={i} fill={`url(#pie-grad-${i})`} />
          ))}
        </Pie>
        {isDonut && (
          <>
            <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fill="#111827" style={{ fontSize: 22, fontWeight: 900 }}>
              {donutCenterLabel ?? total.toLocaleString()}
            </text>
            <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" fill="#94a3b8" style={{ fontSize: 11, fontWeight: 600 }}>
              Total
            </text>
          </>
        )}
        <Tooltip content={<PieTooltip fmt={valueFormatter} />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    );
  };

  // ── Card wrapper ─────────────────────────────────────────────────────────
  return (
    <div className="relative bg-white rounded-2xl ring-1 ring-gray-200/80 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden">
      {/* Top accent — brand colours */}
      <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-[#315B8C] via-[#8b5cf6] to-[#3b82f6]" />

      <div className="p-3 sm:p-5 lg:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 sm:mb-5 gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={12} className="text-blue-600" />
              </div>
              <h3 className="text-xs sm:text-[0.9rem] font-bold text-gray-900 tracking-tight truncate">{title}</h3>
            </div>
            {subtitle && <p className="text-[11px] text-gray-400 mt-1.5 ml-8 truncate">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {dateRangeFilter}
            <button
              onClick={handleExport}
              aria-label="Export chart"
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Download size={12} />
            </button>
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
    </div>
  );
};

export default ChartCard;
