/**
 * AdminDashboard — Principal Dashboard
 * Premium redesign matching the WiSkul reference overview layout.
 * Route: /admin/dashboard  (ProtectedRoute requiredRoles={['principal']})
 *
 * Layout:
 *   Row 1 — Greeting + date/academic year
 *   Row 2 — 4 KPI stat cards (with sparklines)
 *   Row 3 — Enrollment chart | Fee Collection donut | Quick Actions
 *   Row 4 — Recent Activity | Upcoming Events | Messages
 */

import React, { useEffect, useState } from 'react';
import {
  Users, Briefcase, BookOpen, Wallet,
  UserPlus, CalendarDays, BarChart2,
  CreditCard, Send, ChevronRight,
  CalendarCheck, Bell, AlertCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KPICard } from '@components/dashboard/KPICard';
import { YearFilter } from '@components/common/YearFilter';
import { eventsService } from '@services/eventsService';
import schoolConfigService from '@services/schoolConfigService';
import { showToast } from '@utils/toast';
import MainLayout from '@components/layout/MainLayout';
import { AnnouncementsWidget } from '@components/dashboard/AnnouncementsWidget';
import { ChartCard } from '@components/admin/charts/ChartCard';
import VerifySchoolBanner from '@components/verification/VerifySchoolBanner';
import { SkeletonCard, SkeletonChart } from '@components/admin/feedback/Skeleton';
import { ErrorState } from '@components/admin/feedback/ErrorState';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import SystemHealthPanel from '@components/dashboard/SystemHealthPanel';
import { useDashboard } from '@hooks/useDashboard';
import { useAuth } from '@hooks/useAuth';
import { RefreshButton } from '@components/admin/common/RefreshButton';
import { teacherAttendanceService } from '@services/teacherAttendanceService';
import {
  formatCurrency,
  toChartSeries,
  isChartEmpty,
} from './adminDashboardHelpers';

// ─── Helpers ────────────────────────────────────────────────────────────────

const timeGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const ACTIVITY_STYLE: Record<string, { icon: React.ReactNode; color: string }> = {
  student: { icon: <UserPlus size={15} />, color: 'bg-blue-500' },
  payment: { icon: <Wallet size={15} />, color: 'bg-emerald-500' },
  announcement: { icon: <Bell size={15} />, color: 'bg-violet-500' },
};

const EVENT_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500'];

const timeAgo = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// Quick action definitions
const QUICK_ACTIONS = [
  { label: 'Add Student',   icon: <UserPlus size={18} />,   route: '/students/directory',          grad: 'from-[#315B8C] to-[#1d4ed8]' },
  { label: 'Add Staff',     icon: <Briefcase size={18} />,  route: '/staff/teachers',              grad: 'from-emerald-500 to-teal-600' },
  { label: 'Create Class',  icon: <BookOpen size={18} />,   route: '/academic/classes',            grad: 'from-violet-500 to-purple-700' },
  { label: 'Record Pay',    icon: <CreditCard size={18} />, route: '/finance/payments',            grad: 'from-amber-500 to-orange-600' },
  { label: 'Announce',      icon: <Send size={18} />,       route: '/communication/announcements', grad: 'from-rose-500 to-pink-600' },
  { label: 'Generate ID',   icon: <CreditCard size={18} />, route: '/identity/cards',              grad: 'from-sky-500 to-blue-600' },
  { label: 'Create Event',  icon: <CalendarDays size={18} />, route: '/events/school',             grad: 'from-teal-500 to-cyan-600' },
  { label: 'Reports',       icon: <BarChart2 size={18} />,  route: '/reports/academic',            grad: 'from-indigo-500 to-blue-700' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // '' = the school's active year; the filter can open any real past year.
  const [year, setYear] = useState('');
  const { dashboard, loading, error, refreshDashboard } = useDashboard(year);
  const yearInfo = dashboard?.academicYear;
  const viewingPast = !!yearInfo && !yearInfo.isActive;
  const [now, setNow] = useState(new Date());

  // Real upcoming events (published, from today) instead of placeholders.
  const upcomingEvents = useQuery({
    queryKey: ['dashboard-upcoming-events'],
    queryFn: () => eventsService.getUpcomingEvents(5),
    staleTime: 60_000,
  });
  const events: any[] = ((upcomingEvents.data as any)?.data ?? (upcomingEvents.data as any) ?? []) as any[];

  // Finish a year transition: move students still in last year's classes.
  const [carrying, setCarrying] = useState(false);
  const pending = yearInfo?.pendingCarryForward ?? null;
  const finishTransition = async () => {
    if (!pending) return;
    if (!window.confirm(
      `Move ${pending.students} student(s) from ${pending.fromYear} into their ${yearInfo?.activeYear} classes, ` +
      'and copy any missing classes, subjects, teacher assignments, timetable and fee structures? Last year stays as history.',
    )) return;
    setCarrying(true);
    try {
      const res: any = await schoolConfigService.carryForwardIntoCurrentYear();
      if (res?.success === false) throw new Error(res?.error || 'Could not move students into the new year');
      showToast.success(`${res?.data?.studentsMoved ?? 0} student(s) moved into ${res?.data?.toYear ?? 'the new year'}.`);
      await queryClient.invalidateQueries();
    } catch (e: any) {
      showToast.error(e?.response?.data?.message || e?.message || 'Could not move students into the new year');
    } finally {
      setCarrying(false);
    }
  };
  const attendanceDate = now.toISOString().slice(0, 10);
  const canSeeTeacherAttendance = user?.role === 'principal' || user?.role === 'super_admin';
  const teacherAttendance = useQuery({
    queryKey: ['teacher-attendance', 'roster', attendanceDate],
    queryFn: () => teacherAttendanceService.getRoster(attendanceDate),
    enabled: canSeeTeacherAttendance,
    refetchInterval: 60_000,
    staleTime: 0,
  });

  const refreshOverview = async () => {
    await Promise.all([
      refreshDashboard(),
      upcomingEvents.refetch(),
      ...(canSeeTeacherAttendance ? [teacherAttendance.refetch({ throwOnError: true })] : []),
    ]);
  };

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const isInitialLoad = loading && dashboard === null;

  // Short date for mobile, full date for larger screens
  const shortDate = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const fullDate  = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = user?.firstName || 'Admin';
  const greeting = timeGreeting();

  // Fee collection donut — the selected year's fees (billed vs collected).
  const collected = dashboard?.financialSummary?.totalRevenue ?? 0;
  const outstanding = dashboard?.financialSummary?.outstandingBalance ?? 0;
  const totalExpected = (dashboard?.financialSummary as any)?.totalBilled || collected + outstanding;
  const collectionPct = totalExpected > 0 ? Math.round((collected / totalExpected) * 100) : 0;

  // KPI trend vs the previous academic year (hidden when there's no prior year).
  const yearTrend = (pct: number | null | undefined) =>
    pct == null || !yearInfo?.previousYear
      ? {}
      : { trend: { value: Math.abs(pct), isPositive: pct >= 0 }, trendLabel: `vs ${yearInfo.previousYear}` };
  const teacherRows = teacherAttendance.data?.teachers ?? [];
  const onCampusCount = teacherRows.filter((teacher) => teacher.attendance?.signed_in_at && !teacher.attendance?.signed_out_at).length;
  const signedOutCount = teacherRows.filter((teacher) => teacher.attendance?.signed_out_at).length;
  const absentCount = teacherRows.filter((teacher) => teacher.attendance?.status === 'absent').length;
  const unmarkedCount = teacherRows.filter((teacher) => !teacher.attendance).length;
  const teacherTime = (value?: string | null) => value
    ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <MainLayout>
      <div className="space-y-3 sm:space-y-5 pb-8 max-w-[1600px] mx-auto">

        {/* Verify school banner */}
        <VerifySchoolBanner />

        {/* Error state */}
        {error && !dashboard && (
          <ErrorState message={error ?? 'Failed to load dashboard data'} onRetry={refreshDashboard} />
        )}

        {/* ═══ ROW 1 — Greeting + date ═══ */}
        <div className="flex items-center justify-between gap-2">
          {/* Left: greeting — single line on mobile, wraps gracefully */}
          <div className="min-w-0 flex-1">
            <h1 className="text-base xs:text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight leading-snug">
              {greeting}, {firstName}!{' '}
              <span role="img" aria-label="wave">👋</span>
            </h1>
            <p className="text-gray-400 text-[11px] sm:text-sm mt-0.5 hidden sm:block">
              Welcome back to WiSkul. Here's what's happening today.
            </p>
          </div>

          {/* Right: compact date chip + refresh — never wider than necessary */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Mobile: icon-only date pill */}
            <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2.5 py-2 shadow-sm">
              <CalendarCheck size={14} className="text-[#315B8C] flex-shrink-0" />
              {/* Short date on mobile, full on sm+ */}
              <div className="leading-tight">
                <p className="text-[11px] font-bold text-gray-900 sm:hidden whitespace-nowrap">{shortDate}</p>
                <p className="text-xs font-bold text-gray-900 hidden sm:block whitespace-nowrap">{fullDate}</p>
                <p className="text-[10px] text-gray-400 hidden md:block">
                  {yearInfo?.name ? `Academic Year ${yearInfo.name}${viewingPast ? ' (past)' : ''}` : 'No academic year set'}
                </p>
              </div>
            </div>
            <YearFilter value={year} onChange={setYear} />
            <RefreshButton onRefresh={refreshOverview} />
          </div>
        </div>

        {/* Viewing a past year — everything below is that year's snapshot */}
        {viewingPast && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <span>Showing <strong>{yearInfo?.name}</strong>. The current year is {yearInfo?.activeYear}.</span>
            <button type="button" onClick={() => setYear(yearInfo?.activeYear ?? '')} className="text-xs font-bold text-blue-700 hover:underline">
              Back to {yearInfo?.activeYear}
            </button>
          </div>
        )}

        {/* Year transition not finished — students still in last year's classes */}
        {!viewingPast && pending && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-2 text-sm text-amber-900">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
              <span>
                <strong>{pending.students}</strong> student(s) are still in {pending.fromYear} classes, so their portals
                still show {pending.fromYear}. Move them into {yearInfo?.activeYear} to finish the year change.
              </span>
            </div>
            <button
              type="button"
              onClick={finishTransition}
              disabled={carrying}
              className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {carrying ? 'Moving…' : `Move students into ${yearInfo?.activeYear}`}
            </button>
          </div>
        )}

        {/* ═══ ROW 2 — KPI Cards ═══
            Mobile: 2×2 grid | lg+: 4 in a row
            Revenue card spans 2 cols on mobile so it gets full width (matches visual weight)
        */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {isInitialLoad ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KPICard
                title="Students"
                value={dashboard?.metrics.totalStudents ?? 0}
                subtitle={yearInfo?.name ? `Enrolled in ${yearInfo.name}` : undefined}
                icon={<Users size={22} />}
                color="blue"
                {...yearTrend(dashboard?.trends?.students)}
                onClick={() => navigate('/students/directory')}
              />
              <KPICard
                title="Teachers"
                value={dashboard?.metrics.totalTeachers ?? 0}
                subtitle={viewingPast ? `Taught in ${yearInfo?.name}` : 'Active staff'}
                icon={<Briefcase size={22} />}
                color="green"
                {...yearTrend(dashboard?.trends?.teachers)}
                onClick={() => navigate('/staff/teachers')}
              />
              <KPICard
                title="Classes"
                value={dashboard?.metrics.totalClasses ?? 0}
                subtitle={yearInfo?.name ? `In ${yearInfo.name}` : undefined}
                icon={<BookOpen size={22} />}
                color="purple"
                {...yearTrend(dashboard?.trends?.classes)}
                onClick={() => navigate('/academic/classes')}
              />
              <KPICard
                title="Fees Collected"
                value={dashboard ? formatCurrency(dashboard.financialSummary?.totalRevenue ?? 0) : '—'}
                subtitle={yearInfo?.name ? `${yearInfo.name} fees` : undefined}
                icon={<Wallet size={22} />}
                color="amber"
                onClick={() => navigate('/finance/payments')}
              />
            </>
          )}
        </div>

        {/* ═══ ROW 3 — Charts + Quick Actions ═══
            Mobile: stacked full-width
            sm:  Fee donut + Quick Actions side-by-side (2 cols), enrollment chart full-width above
            lg:  All 3 in a row (1/3 each)
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">

          {/* Enrollment Overview chart — full width on mobile/sm, 1 col on lg */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            {isInitialLoad ? (
              <SkeletonChart height={260} />
            ) : (
              <ChartCard
                title="Enrollment Overview"
                subtitle="Students per class"
                type="bar"
                height={240}
                colors={['#315B8C', '#93c5fd']}
                isLoading={false}
                emptyState={{
                  message: 'No enrollment data',
                  description: 'Enroll students in classes to see the breakdown.',
                  action: { label: 'Manage students', onClick: () => navigate('/students/directory') },
                }}
                {...(!isChartEmpty(dashboard?.charts?.studentDistribution) && dashboard?.charts?.studentDistribution
                  ? toChartSeries(dashboard.charts.studentDistribution)
                  : { series: [], labels: [] })}
              />
            )}
          </div>

          {/* Fee Collection donut */}
          <div className="col-span-1">
            <div className="bg-white rounded-2xl ring-1 ring-gray-200/80 shadow-sm h-full overflow-hidden flex flex-col">
              <div className="h-[3px] bg-gradient-to-r from-[#315B8C] via-[#8b5cf6] to-[#3b82f6] flex-shrink-0" />
              <div className="p-3 sm:p-4 flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900">Fee Collection</h3>
                    <p className="text-[10px] text-gray-400">{yearInfo?.name ? `Academic Year ${yearInfo.name}` : 'All fees'}</p>
                  </div>
                  <span className="text-[11px] font-bold text-[#315B8C] bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100 flex-shrink-0">
                    {collectionPct}%
                  </span>
                </div>

                {/* Donut + legend — horizontally centered, tightly packed */}
                <div className="flex items-center gap-3 sm:gap-4 flex-1">
                  {/* Donut */}
                  <div className="relative w-[96px] h-[96px] sm:w-[108px] sm:h-[108px] flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                      <circle
                        cx="18" cy="18" r="15.9" fill="none"
                        stroke="#315B8C" strokeWidth="3.5"
                        strokeDasharray={`${collectionPct} ${100 - collectionPct}`}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-lg sm:text-xl font-black text-gray-900">{collectionPct}%</span>
                      <span className="text-[9px] text-gray-400 font-semibold leading-tight">Collected</span>
                    </div>
                  </div>

                  {/* Legend — compact rows */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    {[
                      { color: 'bg-[#315B8C]', label: 'Collected', value: formatCurrency(collected) },
                      { color: 'bg-gray-200',   label: 'Outstanding', value: formatCurrency(outstanding) },
                      { color: 'bg-slate-400',  label: 'Billed',      value: formatCurrency(totalExpected), border: true },
                    ].map(({ color, label, value, border }) => (
                      <div key={label} className={`flex items-center justify-between gap-2 ${border ? 'pt-1.5 border-t border-gray-100' : ''}`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
                          <span className="text-[10px] sm:text-[11px] text-gray-400 truncate">{label}</span>
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-bold text-gray-900 flex-shrink-0">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => navigate('/finance/fees')}
                  className="mt-3 w-full text-center text-xs font-bold text-[#315B8C] hover:text-[#1d4ed8] transition-colors"
                >
                  View Fee Details →
                </button>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="col-span-1">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#111827] shadow-xl ring-1 ring-white/10 p-4 sm:p-5 h-full flex flex-col">
              {/* Decorative blobs */}
              <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 rounded-full bg-indigo-600/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-[#315B8C]/15 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '18px 18px' }} />

              <h3 className="relative text-xs font-bold uppercase tracking-widest text-white/50 mb-3">Quick Actions</h3>

              {/* 2-col on mobile (tap-friendly), 4-col on sm+ */}
              <div className="relative grid grid-cols-2 xs:grid-cols-4 sm:grid-cols-2 lg:grid-cols-4 gap-2 flex-1">
                {QUICK_ACTIONS.map(({ label, icon, route, grad }) => (
                  <button
                    key={label}
                    onClick={() => navigate(route)}
                    className="group flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 ring-1 ring-white/10 hover:ring-white/25 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${grad} text-white flex items-center justify-center shadow-md transition-transform duration-200 group-hover:scale-110 flex-shrink-0`}>
                      {icon}
                    </div>
                    <span className="text-[10px] font-semibold text-white/70 group-hover:text-white text-center leading-tight transition-colors">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ ROW 4 — Activity | Events | Announcements ═══
            Mobile: stacked
            sm:  Activity + Events side-by-side, Announcements full-width below
            lg:  All 3 in a row
        */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4">

          {/* Recent Activities */}
          <div className="col-span-1 bg-white rounded-2xl ring-1 ring-gray-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Recent Activity</h3>
              <button onClick={() => navigate('/students/directory')} className="text-xs font-bold text-[#315B8C] hover:underline">View All</button>
            </div>
            <div className="divide-y divide-gray-50">
              {(dashboard?.recentActivity ?? []).length === 0 && (
                <p className="px-4 sm:px-5 py-6 text-xs text-gray-400 text-center">No recent activity yet.</p>
              )}
              {(dashboard?.recentActivity ?? []).map((item) => {
                const style = ACTIVITY_STYLE[item.kind] ?? ACTIVITY_STYLE.student;
                return (
                  <div key={item.id} className="flex items-start gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className={`w-8 h-8 rounded-xl ${style.color} text-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      {style.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 truncate">{item.title}</p>
                      <p className="text-[10px] text-gray-400 truncate">{item.sub}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 whitespace-nowrap">{timeAgo(item.at)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="col-span-1 bg-white rounded-2xl ring-1 ring-gray-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Upcoming Events</h3>
              <button onClick={() => navigate('/events/school')} className="text-xs font-bold text-[#315B8C] hover:underline">View All</button>
            </div>
            <div className="divide-y divide-gray-50">
              {events.length === 0 && (
                <p className="px-4 sm:px-5 py-6 text-xs text-gray-400 text-center">
                  {upcomingEvents.isLoading ? 'Loading events…' : 'No upcoming events.'}
                </p>
              )}
              {events.slice(0, 5).map((ev: any, i: number) => {
                const d = new Date(ev.start_date);
                return (
                  <button
                    type="button"
                    key={ev.event_id ?? ev.id ?? i}
                    onClick={() => navigate(ev.event_id || ev.id ? `/events/school/${ev.event_id ?? ev.id}` : '/events/school')}
                    className="w-full text-left flex items-start gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors group"
                  >
                    <div className={`w-11 flex-shrink-0 ${EVENT_COLORS[i % EVENT_COLORS.length]} rounded-xl text-white text-center py-1.5 shadow-sm`}>
                      <p className="text-[9px] font-black uppercase tracking-widest opacity-80">{d.toLocaleDateString('en-GB', { month: 'short' })}</p>
                      <p className="text-base font-black leading-none">{d.getDate()}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-[#315B8C] transition-colors">{ev.title}</p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {ev.all_day ? 'All day' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {ev.location ? ` · ${ev.location}` : ''}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-[#315B8C] flex-shrink-0 mt-1 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Announcements — full-width on mobile+sm, 1 col on lg */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1 bg-white rounded-2xl ring-1 ring-gray-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Announcements</h3>
              <button onClick={() => navigate('/communication/announcements')} className="text-xs font-bold text-[#315B8C] hover:underline">View All</button>
            </div>
            <div className="px-4 sm:px-5 py-2">
              <AnnouncementsWidget limit={5} />
            </div>
          </div>
        </div>

        {/* ═══ System Health (principal only, below fold) ═══ */}
        {!isInitialLoad && dashboard?.systemHealth && (
          <RoleGuard roles={['principal', 'super_admin']}>
            <SystemHealthPanel
              databaseStatus={dashboard.systemHealth.databaseStatus}
              lastBackup={dashboard.systemHealth.lastBackup}
              apiResponseTime={dashboard.systemHealth.apiResponseTime}
              storageUsage={dashboard.systemHealth.storageUsage}
              activeUsers={dashboard.systemHealth.activeUsers}
              isPlatformAdmin={user?.role === 'super_admin'}
            />
          </RoleGuard>
        )}

        {/* ═══ Charts — Attendance + Academic Performance ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-4">
          {isInitialLoad ? (
            <><SkeletonChart height={280} /><SkeletonChart height={280} /></>
          ) : (
            <>
              <ChartCard
                title="School Attendance Overview"
                subtitle="Daily attendance rate (%) — last 30 days"
                type="bar"
                height={260}
                colors={['#315B8C']}
                isLoading={false}
                emptyState={{
                  message: 'No attendance recorded in the last 30 days',
                  description: 'Mark attendance for enrolled students to see your trend.',
                  action: { label: 'Mark attendance', onClick: () => navigate('/students/attendance') },
                }}
                {...(!isChartEmpty(dashboard?.charts?.attendanceTrend) && dashboard?.charts?.attendanceTrend
                  ? toChartSeries(dashboard.charts.attendanceTrend)
                  : { series: [], labels: [] })}
              />
              <ChartCard
                title="Academic Performance by Class"
                subtitle="Average grade per class"
                type="bar"
                height={260}
                colors={['#10b981', '#315B8C']}
                isLoading={false}
                emptyState={{
                  message: 'No graded results available',
                  description: 'Published grade records will appear by class.',
                  action: { label: 'View results', onClick: () => navigate('/academic/results') },
                }}
                {...(!isChartEmpty(dashboard?.charts?.academicPerformance) && dashboard?.charts?.academicPerformance
                  ? toChartSeries(dashboard.charts.academicPerformance)
                  : { series: [], labels: [] })}
              />
            </>
          )}
        </div>

        {/* ═══ Teacher Attendance ═══ */}
        {canSeeTeacherAttendance && (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200/80 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Teacher Attendance Today</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {teacherAttendance.isLoading ? 'Loading teacher attendance…' : `${onCampusCount} on campus · ${signedOutCount} signed out · ${absentCount} absent · ${unmarkedCount} not marked`}
                </p>
              </div>
              <button type="button" onClick={() => navigate('/staff/attendance')}
                className="text-xs font-bold text-blue-700 hover:underline">Open teacher register</button>
            </div>
            {teacherAttendance.isError ? (
              <p role="alert" className="mt-3 text-xs text-red-600">Could not load teacher attendance. Refresh to try again.</p>
            ) : teacherRows.length > 0 ? (
              <div className="mt-3 max-h-56 overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[620px] text-left text-xs">
                  <thead className="sticky top-0 bg-gray-50 text-gray-500"><tr><th className="px-3 py-2">Teacher</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Sign in</th><th className="px-3 py-2">Sign out</th><th className="px-3 py-2">Comments</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {teacherRows.map((teacher) => <tr key={teacher.id}>
                      <td className="px-3 py-2 font-semibold text-gray-900">{teacher.first_name} {teacher.last_name}</td>
                      <td className="px-3 py-2 capitalize">{teacher.attendance?.status ?? 'Not marked'}</td>
                      <td className="px-3 py-2">{teacherTime(teacher.attendance?.signed_in_at)}</td>
                      <td className="px-3 py-2">{teacherTime(teacher.attendance?.signed_out_at)}</td>
                      <td className="max-w-[240px] px-3 py-2 text-gray-600">{[teacher.attendance?.sign_in_comment, teacher.attendance?.sign_out_comment, teacher.attendance?.remarks].filter(Boolean).join(' · ') || '—'}</td>
                    </tr>)}
                  </tbody>
                </table>
              </div>
            ) : !teacherAttendance.isLoading ? (
              <p className="mt-3 text-xs text-gray-500">No active teachers found for this school.</p>
            ) : null}
          </section>
        )}

        {/* ═══ At-Risk Students ═══ */}
        {!isInitialLoad && dashboard?.atRiskStudents && dashboard.atRiskStudents.length > 0 && (
          <div className="bg-white rounded-2xl ring-1 ring-gray-200/80 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-gray-100">
              <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
              <h3 className="text-sm font-bold text-gray-900">Students at Risk</h3>
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full ml-auto flex-shrink-0">
                {dashboard.atRiskStudents.length}
              </span>
            </div>

            {/* Scrollable table on small screens */}
            <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
              <table className="w-full text-sm text-left" style={{ minWidth: '580px' }}>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Name', 'Roll No.', 'Class', 'Attendance', 'Grade', 'Risk Factors'].map((h) => (
                      <th key={h} className="px-3 sm:px-4 py-3 font-semibold text-gray-500 text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {dashboard.atRiskStudents.slice(0, 8).map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 sm:px-4 py-3 font-semibold text-gray-900 whitespace-nowrap text-xs">{s.name}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{s.rollNumber}</td>
                      <td className="px-3 sm:px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{s.className}</td>
                      <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-12 sm:w-16">
                            <div
                              className={`h-full rounded-full ${s.attendanceRate >= 90 ? 'bg-emerald-500' : s.attendanceRate >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${s.attendanceRate}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{s.attendanceRate.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className={`px-3 sm:px-4 py-3 font-bold whitespace-nowrap text-xs ${s.averageGrade < 40 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {s.averageGrade.toFixed(1)}
                      </td>
                      <td className="px-3 sm:px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {s.riskFactors.map((f, i) => (
                            <span key={i} className="inline-block px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-semibold rounded-full border border-red-100 whitespace-nowrap">{f}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
};

export default AdminDashboard;
