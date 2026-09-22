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
import { useQuery } from '@tanstack/react-query';
import { KPICard } from '@components/dashboard/KPICard';
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

// Recent activity mock items (replaced by real data when available)
const MOCK_ACTIVITY = [
  { id: 1, icon: <UserPlus size={15} />, color: 'bg-blue-500', title: 'New student admitted', sub: 'Amara Sesay (Primary 3)', time: '2h ago' },
  { id: 2, icon: <Wallet size={15} />, color: 'bg-emerald-500', title: 'Fee payment received', sub: 'SLE 500 – Kadiatu Kamara', time: '4h ago' },
  { id: 3, icon: <CalendarDays size={15} />, color: 'bg-amber-500', title: 'Timetable updated', sub: '2026/2027 Term 1', time: '5h ago' },
  { id: 4, icon: <Bell size={15} />, color: 'bg-violet-500', title: 'New announcement posted', sub: 'School will reopen Monday, July 20', time: '6h ago' },
  { id: 5, icon: <Briefcase size={15} />, color: 'bg-rose-500', title: 'Teacher added', sub: 'Mohamed Bangura', time: '8h ago' },
];

const MOCK_EVENTS = [
  { id: 1, month: 'SEP', day: '20', title: "Parents' Meeting", sub: '10:00 AM – 12:00 PM · School Hall', color: 'bg-blue-500' },
  { id: 2, month: 'SEP', day: '25', title: 'Mid-Term Exams Begin', sub: 'All Classes · 8:00 AM', color: 'bg-emerald-500' },
  { id: 3, month: 'OCT', day: '05', title: 'Sports Day', sub: 'School Field · 9:00 AM', color: 'bg-amber-500' },
  { id: 4, month: 'OCT', day: '12', title: 'End of Term', sub: 'Academic Year 2026/2027', color: 'bg-rose-500' },
  { id: 5, month: 'OCT', day: '15', title: "Teachers' Workshop", sub: 'ICT in Education · 10:00 AM', color: 'bg-violet-500' },
];

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
  const { dashboard, loading, error, refreshDashboard } = useDashboard();
  const [now, setNow] = useState(new Date());
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
      ...(canSeeTeacherAttendance ? [teacherAttendance.refetch({ throwOnError: true })] : []),
    ]);
  };

  useEffect(() => {
    // Background reloads should retain the current view if they fail. Manual
    // reloads use the same function but let RefreshButton surface the failure.
    const loadDashboard = () => {
      void refreshDashboard().catch(() => undefined);
    };

    loadDashboard();
    const interval = setInterval(loadDashboard, 300_000);
    return () => clearInterval(interval);
  }, [refreshDashboard]);

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

  // Fee collection donut data
  const collected = dashboard?.financialSummary?.thisMonthCollected ?? 0;
  const outstanding = dashboard?.financialSummary?.outstandingBalance ?? 0;
  const totalExpected = collected + outstanding || 1;
  const collectionPct = Math.round((collected / totalExpected) * 100);
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
                <p className="text-[10px] text-gray-400 hidden md:block">Academic Year 2026/2027</p>
              </div>
            </div>
            <RefreshButton onRefresh={refreshOverview} />
          </div>
        </div>

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
                title="Total Students"
                value={dashboard?.metrics.totalStudents ?? 0}
                icon={<Users size={22} />}
                color="blue"
                trend={{ value: 12, isPositive: true }}
                trendLabel="vs last term"
                sparkline={[180, 210, 195, 230, 220, 250, 240, 270, dashboard?.metrics.totalStudents ?? 280]}
                onClick={() => navigate('/students/directory')}
              />
              <KPICard
                title="Teachers"
                value={dashboard?.metrics.totalTeachers ?? 0}
                icon={<Briefcase size={22} />}
                color="green"
                trend={{ value: 7, isPositive: true }}
                trendLabel="vs last term"
                sparkline={[20, 22, 21, 24, 23, 25, 26, 27, dashboard?.metrics.totalTeachers ?? 28]}
                onClick={() => navigate('/staff/teachers')}
              />
              <KPICard
                title="Classes"
                value={dashboard?.metrics.totalClasses ?? 0}
                icon={<BookOpen size={22} />}
                color="purple"
                trend={{ value: 0, isPositive: true }}
                trendLabel="no change"
                sparkline={[10, 10, 11, 11, 12, 12, 12, 12, dashboard?.metrics.totalClasses ?? 12]}
                onClick={() => navigate('/academic/classes')}
              />
              <KPICard
                title="Total Revenue"
                value={dashboard ? formatCurrency(dashboard.financialSummary?.totalRevenue ?? dashboard.metrics.totalCollected) : '—'}
                icon={<Wallet size={22} />}
                color="amber"
                trend={{ value: 18, isPositive: true }}
                trendLabel="vs last month"
                sparkline={[80000, 95000, 102000, 88000, 120000, 115000, 130000, 125000, dashboard?.financialSummary?.totalRevenue ?? 125000]}
                onClick={() => navigate('/finance/fees')}
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
                    <p className="text-[10px] text-gray-400">This Term</p>
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
                      { color: 'bg-gray-200',   label: 'Pending',   value: formatCurrency(outstanding) },
                      { color: 'bg-slate-400',  label: 'Expected',  value: formatCurrency(totalExpected), border: true },
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
              {MOCK_ACTIVITY.map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className={`w-8 h-8 rounded-xl ${item.color} text-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    {item.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900 truncate">{item.title}</p>
                    <p className="text-[10px] text-gray-400 truncate">{item.sub}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5 whitespace-nowrap">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="col-span-1 bg-white rounded-2xl ring-1 ring-gray-200/80 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">Upcoming Events</h3>
              <button onClick={() => navigate('/events/school')} className="text-xs font-bold text-[#315B8C] hover:underline">View All</button>
            </div>
            <div className="divide-y divide-gray-50">
              {MOCK_EVENTS.map((ev) => (
                <div key={ev.id} className="flex items-start gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors group cursor-pointer">
                  <div className={`w-11 flex-shrink-0 ${ev.color} rounded-xl text-white text-center py-1.5 shadow-sm`}>
                    <p className="text-[9px] font-black uppercase tracking-widest opacity-80">{ev.month}</p>
                    <p className="text-base font-black leading-none">{ev.day}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-900 truncate group-hover:text-[#315B8C] transition-colors">{ev.title}</p>
                    <p className="text-[10px] text-gray-400 truncate">{ev.sub}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-300 group-hover:text-[#315B8C] flex-shrink-0 mt-1 transition-colors" />
                </div>
              ))}
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
