/**
 * AdmissionsCharts: the intake year as charts. Shared by the Admissions
 * Overview dashboard and the Admissions page. Takes the server overview
 * (`/admissions/overview`), so the numbers match the cards beside it.
 */
import React from 'react';
import { ChartCard } from '@components/admin/charts/ChartCard';
import { fmtCount, NO_SERIES } from '@lib/chartFormat';
import type { AdmissionsOverview } from '@services/admissionsService';
import { ADM_LABEL } from './ApplicationDetailModal';

/** Stage colours, in pipeline order (matches the dots on the pipeline board). */
const STAGES: { key: string; color: string }[] = [
  { key: 'pending', color: '#f59e0b' },
  { key: 'under_review', color: '#3b82f6' },
  { key: 'interview_scheduled', color: '#8b5cf6' },
  { key: 'approved', color: '#10b981' },
  { key: 'waitlist', color: '#f97316' },
  { key: 'enrolled', color: '#14b8a6' },
  { key: 'rejected', color: '#ef4444' },
  { key: 'withdrawn', color: '#9ca3af' },
];

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

export const AdmissionsCharts: React.FC<{ data?: AdmissionsOverview; loading?: boolean; year?: string }> = ({ data, loading, year }) => {
  const byStatus: Record<string, number> = (data?.byStatus as any) ?? {};
  const stages = STAGES.filter((s) => (byStatus[s.key] ?? 0) > 0);

  const funnel = stages.length
    ? { labels: stages.map((s) => ADM_LABEL[s.key as keyof typeof ADM_LABEL] || s.key), series: [{ name: 'Applications', data: stages.map((s) => byStatus[s.key]) }] }
    : NO_SERIES;

  const months = data?.byMonth ?? [];
  const trend = months.length
    ? {
      labels: months.map((m) => monthLabel(m.month)),
      series: [
        { name: 'Online', data: months.map((m) => m.online) },
        { name: 'Office', data: months.map((m) => m.office) },
      ],
    }
    : NO_SERIES;

  // Top 8 classes by applications: applied, still open, enrolled.
  const classes = [...(data?.byClass ?? [])].slice(0, 8);
  const byClass = classes.length
    ? {
      labels: classes.map((c) => c.class_name),
      series: [
        { name: 'Applied', data: classes.map((c) => c.applications) },
        { name: 'Still open', data: classes.map((c) => c.open) },
        { name: 'Enrolled', data: classes.map((c) => c.enrolled) },
      ],
    }
    : NO_SERIES;

  const online = data?.online ?? 0;
  const office = Math.max(0, (data?.totalApplications ?? 0) - online);
  const source = online + office > 0
    ? { labels: ['Online form', 'Walk-in / office'], series: [{ name: 'Applications', data: [online, office] }] }
    : NO_SERIES;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <ChartCard title="Applications received" subtitle={`By month · ${year || 'this intake'}`} type="line" height={260}
            isLoading={loading} colors={['#3b82f6', '#8b5cf6']} valueFormatter={fmtCount}
            emptyState={{ message: 'No applications yet', description: 'Applications will chart here by month.' }} {...trend} />
        </div>
        <ChartCard title="Where applications come from" subtitle="Online form vs walk-in" type="donut" height={260}
          isLoading={loading} colors={['#3b82f6', '#f59e0b']} valueFormatter={fmtCount}
          donutCenterLabel={data?.totalApplications ? String(data.totalApplications) : undefined}
          emptyState={{ message: 'No applications yet' }} {...source} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <ChartCard title="Pipeline" subtitle="Applications at each stage" type="bar" height={280}
          isLoading={loading} colors={['#3b82f6']} valueFormatter={fmtCount}
          emptyState={{ message: 'No applications yet' }} {...funnel} />
        <div className="lg:col-span-2">
          <ChartCard title="Demand by class" subtitle="Applied, still open and enrolled (top 8 classes)" type="bar" height={280}
            isLoading={loading} colors={['#3b82f6', '#f59e0b', '#10b981']} valueFormatter={fmtCount}
            emptyState={{ message: 'No class data yet', description: 'Applications that name a class will show here.' }} {...byClass} />
        </div>
      </div>
    </div>
  );
};

export default AdmissionsCharts;
