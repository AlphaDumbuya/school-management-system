/**
 * EventAnalyticsPage — /events/analytics
 * Production-ready event analytics dashboard following admin page pattern.
 * KPIs, trend charts, category breakdown, date filters.
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, Users, TrendingUp, Award, BarChart2, PieChart as PieIcon,
  X, SlidersHorizontal, ChevronDown,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { Button } from '@components/ui/button';
import { eventsService } from '@services/eventsService';
import type { OverallStats, AnalyticsFilters } from '@appTypes/events';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';

// ── Constants ─────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

const QUICK_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last 12 months', days: 365 },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const EventAnalyticsPage: React.FC = () => {
  const [filters, setFilters] = useState<AnalyticsFilters>({});
  // Academic year: opens on the ACTIVE year. Explicit dates (quick range or
  // custom) take over; choosing a year again clears them.
  const [pickedYear, setPickedYear] = useState('');
  const { activeYear } = useAcademicYears();
  const year = pickedYear || activeYear;
  const hasDates = !!(filters.start_date || filters.end_date);
  const viewingPast = !hasDates && !!year && !!activeYear && year < activeYear;
  const pickYear = (y: string) => { setPickedYear(y); setFilters({}); };

  // ── Fetch Analytics ─────────────────────────────────────────────────────────
  const query: AnalyticsFilters = hasDates ? filters : { academic_year: year || undefined };
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['event-analytics', query],
    queryFn: () => eventsService.getOverallAnalytics(query),
    enabled: hasDates || !!year,
    staleTime: 60_000,
  });

  // The API response may be wrapped or direct — handle both patterns
  const stats: OverallStats | null = useMemo(() => {
    if (!data) return null;
    // Direct response: data IS the stats object
    if ((data as any)?.total_events !== undefined) return data as unknown as OverallStats;
    // Wrapped: data.data is the stats
    if ((data as any)?.data?.total_events !== undefined) return (data as any).data as OverallStats;
    return null;
  }, [data]);

  // ── Filter Handlers ─────────────────────────────────────────────────────────
  const applyQuickRange = (days: number) => {
    const today = new Date();
    const from = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    setFilters({
      start_date: from.toISOString().split('T')[0],
      end_date: today.toISOString().split('T')[0],
    });
  };

  const clearFilters = () => setFilters({});
  const hasFilters = hasDates;

  return (
    <MainLayout>
      <PageShell
        title="Event Analytics"
        subtitle="Comprehensive insights into event performance and engagement"
        breadcrumbs={[{ label: 'Events', href: '/events/school' }, { label: 'Analytics' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={<YearFilter value={hasDates ? '' : year} onChange={pickYear} noAutoSelect />}
      >
        {/* What period the figures cover */}
        <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${
          viewingPast
            ? 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200'
            : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-300'
        }`}>
          <span>
            {hasDates
              ? <>Showing events from <strong>{filters.start_date || 'the start'}</strong> to <strong>{filters.end_date || 'today'}</strong>.</>
              : <>Showing the <strong>{year}</strong> academic year{viewingPast ? ' (history)' : ''}.</>}
          </span>
          {(hasDates || viewingPast) && activeYear && (
            <button type="button" onClick={() => pickYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline dark:text-blue-300">
              Back to {activeYear}
            </button>
          )}
        </div>
        {/* ── Date Filter Bar ── */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Quick range buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Range:</span>
              {QUICK_RANGES.map((r) => (
                <button
                  key={r.days}
                  onClick={() => applyQuickRange(r.days)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    filters.start_date && new Date().getTime() - new Date(filters.start_date).getTime() <= (r.days + 1) * 86400000 &&
                    new Date().getTime() - new Date(filters.start_date).getTime() >= (r.days - 1) * 86400000
                      ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Custom date inputs */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={filters.start_date || ''}
                onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value || undefined }))}
                className="px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={filters.end_date || ''}
                onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value || undefined }))}
                className="px-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {hasFilters && (
                <button onClick={clearFilters} className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Clear filters">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Active filter badges */}
          {hasFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1">
                <SlidersHorizontal size={10} /> Active:
              </span>
              {filters.start_date && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200/30">
                  From: {filters.start_date}
                  <button onClick={() => setFilters((f) => ({ ...f, start_date: undefined }))}><X size={11} /></button>
                </span>
              )}
              {filters.end_date && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200/30">
                  To: {filters.end_date}
                  <button onClick={() => setFilters((f) => ({ ...f, end_date: undefined }))}><X size={11} /></button>
                </span>
              )}
              <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto transition-colors">
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* ── Loading State ── */}
        {isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SkeletonCard /><SkeletonCard />
            </div>
          </div>
        )}

        {/* ── Error State ── */}
        {!isLoading && error && (
          <EmptyState
            message="Failed to load analytics"
            description="There was an error fetching the analytics data. Please try again."
          />
        )}

        {/* ── Empty State ── */}
        {!isLoading && !error && !stats && (
          <EmptyState
            message="No analytics data available"
            description="Create some events and gather registrations to see analytics here."
          />
        )}

        {/* ── Analytics Content ── */}
        {!isLoading && stats && (
          <div className="space-y-8">
            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <KPICard
                title="Total Events"
                value={Number(stats.total_events ?? 0)}
                icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><Calendar size={20} /></div>}
                color="blue"
              />
              <KPICard
                title="Upcoming Events"
                value={Number(stats.upcoming_events ?? 0)}
                icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><TrendingUp size={20} /></div>}
                color="green"
              />
              <KPICard
                title="Total Registrations"
                value={Number(stats.total_registrations ?? 0)}
                icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><Users size={20} /></div>}
                color="purple"
              />
              <KPICard
                title="Avg Attendance"
                value={`${Number(stats.average_attendance_rate ?? 0).toFixed(1)}%`}
                icon={<div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center"><Award size={20} /></div>}
                color="amber"
              />
            </div>

            {/* Charts Row 1: Pie + Bar */}
            {stats.popular_categories && stats.popular_categories.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Distribution Pie */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <PieIcon size={16} className="text-blue-500" />
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Events by Category</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={stats.popular_categories}
                        dataKey="total_events"
                        nameKey="category_name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        innerRadius={40}
                        label={({ category_name, percent }) => `${category_name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={false}
                      >
                        {stats.popular_categories.map((_, idx) => (
                          <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--tooltip-bg, #fff)', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Category Performance Bar */}
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart2 size={16} className="text-green-500" />
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Category Performance</h3>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={stats.popular_categories} margin={{ bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="category_name" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 11, fill: '#6b7280' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="total_registrations" fill="#3B82F6" name="Registrations" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="average_attendance_rate" fill="#10B981" name="Attendance %" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Charts Row 2: Trends */}
            {stats.trends && stats.trends.length > 0 && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-amber-500" />
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Event Trends Over Time</h3>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={stats.trends} margin={{ right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="events_count" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3 }} name="Events" />
                    <Line type="monotone" dataKey="registrations_count" stroke="#10B981" strokeWidth={2.5} dot={{ r: 3 }} name="Registrations" />
                    <Line type="monotone" dataKey="attendance_count" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 3 }} name="Attendance" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Category Statistics Table */}
            {stats.popular_categories && stats.popular_categories.length > 0 && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Category Statistics</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                        <th className="text-left py-3.5 px-4 font-bold text-xs text-white uppercase tracking-wider">Category</th>
                        <th className="text-right py-3.5 px-4 font-bold text-xs text-white uppercase tracking-wider">Events</th>
                        <th className="text-right py-3.5 px-4 font-bold text-xs text-white uppercase tracking-wider">Upcoming</th>
                        <th className="text-right py-3.5 px-4 font-bold text-xs text-white uppercase tracking-wider">Completed</th>
                        <th className="text-right py-3.5 px-4 font-bold text-xs text-white uppercase tracking-wider">Registrations</th>
                        <th className="text-right py-3.5 px-4 font-bold text-xs text-white uppercase tracking-wider">Attendance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {stats.popular_categories.map((cat, idx) => (
                        <tr key={cat.category_id} className={`transition-colors hover:bg-sky-100 dark:hover:bg-gray-800/50 ${idx % 2 === 1 ? 'bg-sky-50 dark:bg-gray-900/30' : 'bg-white dark:bg-transparent'}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                              <span className="font-medium text-gray-900 dark:text-white">{cat.category_name}</span>
                            </div>
                          </td>
                          <td className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">{cat.total_events}</td>
                          <td className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">{cat.upcoming_events}</td>
                          <td className="text-right py-3 px-4 text-gray-600 dark:text-gray-400">{cat.completed_events}</td>
                          <td className="text-right py-3 px-4 font-semibold text-gray-700 dark:text-gray-300">{cat.total_registrations}</td>
                          <td className="text-right py-3 px-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                              cat.average_attendance_rate >= 80
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800/30 text-green-700 dark:text-green-400'
                                : cat.average_attendance_rate >= 60
                                  ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-400'
                                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30 text-red-700 dark:text-red-400'
                            }`}>
                              {cat.average_attendance_rate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* No categories fallback */}
            {(!stats.popular_categories || stats.popular_categories.length === 0) && (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
                <BarChart2 size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No category data yet</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Create event categories and assign them to events to see breakdown analytics.</p>
              </div>
            )}
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default EventAnalyticsPage;
