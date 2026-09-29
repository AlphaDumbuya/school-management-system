/**
 * Parent Dashboard — /parent/dashboard
 * Real, tenant + parent-scoped hub. Shows ONLY the logged-in parent's own
 * children with per-child grades, attendance, timetable and fees.
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, TrendingUp, Calendar, DollarSign, Clock, MapPin, GraduationCap,
  Loader2, AlertTriangle, CheckCircle2, XCircle, UserCircle2,
  PieChart as PieChartIcon, BarChart3, CreditCard,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';
import { AnnouncementsWidget } from '@components/dashboard/AnnouncementsWidget';
import useAuthStore from '@store/authStore';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { parentDashboardService } from '@services/parentDashboardService';
import { PayFeesButton } from '@components/finance/PayFeesButton';
import { StudentLedgerView } from '@components/finance/StudentLedgerView';
import { AttendanceTimeDetails } from '@components/attendance/AttendanceTimeDetails';

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function fmtTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  if (isNaN(hour)) return t;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function fmtMoney(n: number | string | undefined): string {
  const v = Number(n || 0);
  return `Le ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cap(s?: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type TabType = 'overview' | 'grades' | 'attendance' | 'schedule' | 'fees';

export const Phase13ParentDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const { data: dashResp, isLoading, error, refetch } = useQuery({
    queryKey: ['parent-dashboard'],
    queryFn: () => parentDashboardService.getDashboard(),
    staleTime: 60_000,
  });

  const dash = (dashResp as any)?.data ?? (dashResp as any);
  const children = dash?.children ?? [];
  const stats = dash?.stats ?? { total_children: 0, total_outstanding: 0, average_attendance: 0, average_grade: 0 };

  const currentChildId = selectedChildId || children[0]?.id || '';

  const { data: childResp, isLoading: childLoading } = useQuery({
    queryKey: ['parent-child-detail', currentChildId],
    queryFn: () => parentDashboardService.getChildDetail(currentChildId),
    enabled: !!currentChildId,
    staleTime: 60_000,
  });
  const detail = (childResp as any)?.data ?? (childResp as any);

  const profile = detail?.profile ?? null;
  const grades = detail?.grades ?? [];
  const attendance = detail?.attendance ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0, percentage: 0, records: [] };
  const schedule = detail?.schedule ?? [];
  const fees = detail?.fees ?? { total: 0, paid: 0, outstanding: 0, invoices: [] };

  const scheduleByDay = useMemo(() =>
    DAY_ORDER
      .map((day) => ({
        day,
        slots: schedule
          .filter((s: any) => (s.day_of_week || '').toLowerCase() === day)
          .sort((a: any, b: any) => (a.start_time || '').localeCompare(b.start_time || '')),
      }))
      .filter((d) => d.slots.length > 0),
  [schedule]);

  const tabs: TabType[] = ['overview', 'grades', 'attendance', 'schedule', 'fees'];

  // ── Chart data ─────────────────────────────────────────────────────────
  // Per-child comparison across all the parent's children.
  const childCompareData = useMemo(
    () =>
      (children as any[]).map((c) => ({
        name: (c.name || '').split(' ')[0] || c.name,
        fullName: c.name,
        attendance: Number(c.attendance_rate) || 0,
        grade: Number(c.average_grade) || 0,
      })),
    [children]
  );

  // Selected child's attendance donut.
  const attendanceChartData = useMemo(
    () => [
      { name: 'Present', value: attendance.present, color: '#10B981' },
      { name: 'Late', value: attendance.late, color: '#F59E0B' },
      { name: 'Absent', value: attendance.absent, color: '#EF4444' },
      { name: 'Excused', value: attendance.excused, color: '#3B82F6' },
    ].filter((d) => d.value > 0),
    [attendance.present, attendance.late, attendance.absent, attendance.excused]
  );

  // Selected child's fees breakdown.
  const feesChartData = useMemo(
    () => [
      { name: 'Paid', value: Number(fees.paid) || 0, color: '#10B981' },
      { name: 'Outstanding', value: Number(fees.outstanding) || 0, color: '#EF4444' },
    ].filter((d) => d.value > 0),
    [fees.paid, fees.outstanding]
  );

  // Selected child's grades bar chart (latest mean per subject).
  const gradesChartData = useMemo(() => {
    const bySubject = new Map<string, number>();
    (grades as any[]).forEach((g) => {
      if (g.mean != null && !Number.isNaN(Number(g.mean))) {
        bySubject.set(g.subject_name, Number(g.mean));
      }
    });
    return Array.from(bySubject.entries()).map(([subject, mean]) => ({
      subject: subject.length > 10 ? `${subject.slice(0, 10)}…` : subject,
      fullSubject: subject,
      mean,
    }));
  }, [grades]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center py-24 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading your dashboard…
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="py-16">
          <EmptyState message="Couldn't load dashboard" description="There was a problem fetching your data. Please refresh and try again." />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell title="Parent Portal" subtitle="Monitor your children's progress" onRefresh={() => refetch()} isRefreshing={isLoading}>
        <WelcomeHero
          firstName={user?.firstName ?? (user as any)?.first_name}
          role="parent"
          roleLabel="Parent"
          subtitle="Follow your children's attendance, grades and fees in one place."
        />
        {children.length === 0 ? (
          <EmptyState
            message="No children linked"
            description="Your account isn't linked to any student yet. Please contact the school office."
          />
        ) : (
          <>
            {/* Aggregate KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="Children" value={String(stats.total_children)} icon={<Users className="w-5 h-5" />} color="blue" />
              <KPICard title="Avg Attendance" value={`${stats.average_attendance}%`} icon={<Calendar className="w-5 h-5" />} color={stats.average_attendance >= 85 ? 'green' : 'amber'} />
              <KPICard title="Avg Score" value={stats.average_grade ? `${stats.average_grade}%` : '—'} icon={<TrendingUp className="w-5 h-5" />} color="purple" />
              <KPICard title="Total Outstanding" value={fmtMoney(stats.total_outstanding)} icon={<DollarSign className="w-5 h-5" />} color={stats.total_outstanding > 0 ? 'amber' : 'green'} />
            </div>

            {/* Multi-child comparison — only meaningful with 2+ children */}
            {childCompareData.length > 1 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart3 className="w-4 h-4" /> Children Comparison
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={childCompareData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                        formatter={(value: number, key: string) => [`${value}%`, key === 'attendance' ? 'Attendance' : 'Avg Score']}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                      <Bar name="Attendance" dataKey="attendance" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar name="Avg Score" dataKey="grade" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* School & class announcements (scoped to this parent's children) */}
            <div className="mt-6">
              <AnnouncementsWidget limit={4} title="School & Class Announcements" />
            </div>

            {/* Child selector */}
            <div className="flex gap-2 overflow-x-auto mt-6 pb-1">
              {children.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedChildId(c.id); setActiveTab('overview'); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm whitespace-nowrap transition ${
                    currentChildId === c.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-gray-300'
                  }`}
                >
                  {c.photo_url
                    ? <img src={c.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                    : <UserCircle2 className="w-6 h-6" />}
                  <span className="font-medium">{c.name}</span>
                  {c.class_name && <span className="text-xs text-gray-400">· {c.class_name}</span>}
                </button>
              ))}
            </div>

            {childLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
              </div>
            ) : !profile ? (
              <div className="py-12"><EmptyState message="Select a child to view details" /></div>
            ) : (
              <>
                {/* Per-child header + tabs */}
                <div className="border-b border-gray-200 dark:border-gray-800 mt-6">
                  <div className="flex gap-2 sm:gap-4 overflow-x-auto">
                    {tabs.map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-3 sm:px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                          activeTab === tab
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        {cap(tab)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  {/* Overview */}
                  {activeTab === 'overview' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                          <p className="text-xs text-gray-500">Present</p>
                          <p className="text-2xl font-bold text-green-600">{attendance.present}</p>
                        </div>
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                          <p className="text-xs text-gray-500">Late</p>
                          <p className="text-2xl font-bold text-amber-600">{attendance.late}</p>
                        </div>
                        <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                          <p className="text-xs text-gray-500">Absent</p>
                          <p className="text-2xl font-bold text-red-600">{attendance.absent}</p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                          <p className="text-xs text-gray-500">Outstanding</p>
                          <p className="text-lg font-bold text-blue-600">{fmtMoney(fees.outstanding)}</p>
                        </div>
                      </div>

                      {!detail?.results_published && (
                        <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 text-sm text-amber-700 dark:text-amber-400">
                          <AlertTriangle size={16} /> Results for {profile.name} have not been published yet.
                        </div>
                      )}

                      {/* Visual insights for the selected child */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Attendance donut */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <PieChartIcon className="w-4 h-4" /> Attendance Breakdown
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {attendanceChartData.length === 0 ? (
                              <p className="text-sm text-gray-500 py-12 text-center">No attendance recorded yet.</p>
                            ) : (
                              <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                  <Pie
                                    data={attendanceChartData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={2}
                                    label={({ name, value }) => `${name}: ${value}`}
                                  >
                                    {attendanceChartData.map((entry) => (
                                      <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                                    formatter={(value: number) => [`${value} day${value === 1 ? '' : 's'}`, '']}
                                  />
                                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                                </PieChart>
                              </ResponsiveContainer>
                            )}
                          </CardContent>
                        </Card>

                        {/* Fees breakdown */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <DollarSign className="w-4 h-4" /> Fees Breakdown
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {feesChartData.length === 0 ? (
                              <p className="text-sm text-gray-500 py-12 text-center">No fees on record.</p>
                            ) : (
                              <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                  <Pie
                                    data={feesChartData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={85}
                                    label={({ name }) => name}
                                  >
                                    {feesChartData.map((entry) => (
                                      <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                                    formatter={(value: number) => [fmtMoney(value), '']}
                                  />
                                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                                </PieChart>
                              </ResponsiveContainer>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      <Card>
                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Weekly Timetable</CardTitle></CardHeader>
                        <CardContent>
                          {scheduleByDay.length === 0 ? (
                            <p className="text-sm text-gray-500 py-4 text-center">No timetable published for this class yet.</p>
                          ) : (
                            <p className="text-sm text-gray-500">See the Schedule tab for the full weekly timetable.</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Grades */}
                  {activeTab === 'grades' && (
                    <div className="space-y-4">
                      {detail?.results_published && gradesChartData.length > 0 && (
                        <Card>
                          <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Mean Score by Subject</CardTitle></CardHeader>
                          <CardContent>
                            <ResponsiveContainer width="100%" height={280}>
                              <BarChart data={gradesChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="subject" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                                <Tooltip
                                  contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullSubject ?? ''}
                                  formatter={(value: number) => [`${value}%`, 'Mean Score']}
                                />
                                <Bar dataKey="mean" radius={[4, 4, 0, 0]} maxBarSize={56}>
                                  {gradesChartData.map((d) => (
                                    <Cell key={d.fullSubject} fill={d.mean < 50 ? '#EF4444' : '#2563EB'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <CardTitle className="text-base flex items-center gap-2">
                              <GraduationCap className="w-4 h-4" /> Results
                              {profile?.academic_year && (
                                <span className="ml-1 inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[11px] font-bold">
                                  Current year: {profile.academic_year}
                                </span>
                              )}
                            </CardTitle>
                            <button
                              onClick={() => navigate('/academic/report-cards')}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                              <Clock size={13} /> View previous years
                            </button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {!detail?.results_published ? (
                            <p className="text-sm text-gray-500 py-6 text-center">Results for {profile?.academic_year || 'this year'} have not been published yet.</p>
                          ) : grades.length === 0 ? (
                            <p className="text-sm text-gray-500 py-6 text-center">No results recorded.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                              <table className="w-full text-sm text-left">
                                <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                                  <tr className="text-white">
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Subject</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Term</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center">Test 1</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center">Test 2</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center">Mean</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-center">Rank</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                  {grades.map((g: any, i: number) => {
                                    const mean = Number(g.mean);
                                    const hasMean = g.mean != null && !Number.isNaN(mean);
                                    const isFail = hasMean && mean > 0 && mean < 50;
                                    return (
                                      <tr
                                        key={g.id}
                                        className={`transition-colors hover:bg-sky-100 dark:hover:bg-blue-950/20 ${
                                          i % 2 === 1 ? 'bg-sky-50 dark:bg-gray-800/20' : 'bg-white dark:bg-transparent'
                                        }`}
                                      >
                                        <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-gray-100">{g.subject_name}</td>
                                        <td className="px-4 py-3.5 text-gray-500">{g.term}</td>
                                        <td className="px-4 py-3.5 text-center text-gray-700 dark:text-gray-300">{g.test1 ?? '—'}</td>
                                        <td className="px-4 py-3.5 text-center text-gray-700 dark:text-gray-300">{g.test2 ?? '—'}</td>
                                        <td className="px-4 py-3.5 text-center">
                                          {hasMean ? (
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                              isFail
                                                ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                                : mean >= 70
                                                ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                            }`}>
                                              {g.mean}
                                            </span>
                                          ) : '—'}
                                        </td>
                                        <td className="px-4 py-3.5 text-center font-medium text-gray-600 dark:text-gray-300">{g.subject_rank ? `#${g.subject_rank}` : '—'}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Attendance */}
                  {activeTab === 'attendance' && (
                    <div className="space-y-4">
                      {attendanceChartData.length > 0 && (
                        <Card>
                          <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieChartIcon className="w-4 h-4" /> Attendance Breakdown ({attendance.percentage}%)</CardTitle></CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
                              <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                  <Pie
                                    data={attendanceChartData}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={2}
                                    label={({ name, value }) => `${name}: ${value}`}
                                  >
                                    {attendanceChartData.map((entry) => (
                                      <Cell key={entry.name} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip
                                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                                    formatter={(value: number) => [`${value} day${value === 1 ? '' : 's'}`, '']}
                                  />
                                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="grid grid-cols-2 gap-3 text-center">
                                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                                  <p className="text-xs text-gray-500">Present</p>
                                  <p className="text-2xl font-bold text-green-600">{attendance.present}</p>
                                </div>
                                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                                  <p className="text-xs text-gray-500">Late</p>
                                  <p className="text-2xl font-bold text-amber-600">{attendance.late}</p>
                                </div>
                                <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                                  <p className="text-xs text-gray-500">Absent</p>
                                  <p className="text-2xl font-bold text-red-600">{attendance.absent}</p>
                                </div>
                                <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                                  <p className="text-xs text-gray-500">Excused</p>
                                  <p className="text-2xl font-bold text-blue-600">{attendance.excused}</p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardHeader><CardTitle className="text-base">Recent Attendance</CardTitle></CardHeader>
                        <CardContent>
                          {attendance.records.length === 0 ? (
                            <p className="text-sm text-gray-500 py-6 text-center">No attendance records yet.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                              <table className="w-full text-sm text-left">
                                <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                                  <tr className="text-white">
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Details</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                  {attendance.records.map((r: any, i: number) => {
                                    const s = (r.status || '').toLowerCase();
                                    const icon = s === 'present' ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                                      : s === 'absent' ? <XCircle className="w-4 h-4 text-red-600" />
                                      : <AlertTriangle className="w-4 h-4 text-amber-600" />;
                                    const badge = s === 'present'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                                      : s === 'absent'
                                      ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400';
                                    return (
                                      <tr
                                        key={r.id}
                                        className={`transition-colors hover:bg-sky-100 dark:hover:bg-blue-950/20 ${
                                          i % 2 === 1 ? 'bg-sky-50 dark:bg-gray-800/20' : 'bg-white dark:bg-transparent'
                                        }`}
                                      >
                                        <td className="px-4 py-3.5 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">{new Date(r.date).toLocaleDateString()}</td>
                                        <td className="px-4 py-3.5"><AttendanceTimeDetails record={r} /></td>
                                        <td className="px-4 py-3.5 text-right">
                                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge}`}>
                                            {icon} {cap(s)}
                                          </span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Schedule */}
                  {activeTab === 'schedule' && (
                    <Card>
                      <CardHeader><CardTitle className="text-base">Weekly Timetable</CardTitle></CardHeader>
                      <CardContent>
                        {scheduleByDay.length === 0 ? (
                          <p className="text-sm text-gray-500 py-6 text-center">No timetable published for this class yet.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                                <tr className="text-white">
                                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Day</th>
                                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Subject</th>
                                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Teacher</th>
                                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Room</th>
                                  <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-right">Time</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {scheduleByDay.map(({ day, slots }, dayIdx) =>
                                  slots.map((cls: any, slotIdx: number) => (
                                    <tr
                                      key={cls.id}
                                      className={`transition-colors hover:bg-sky-100 dark:hover:bg-blue-950/20 ${
                                        dayIdx % 2 === 1 ? 'bg-sky-50 dark:bg-gray-800/20' : 'bg-white dark:bg-transparent'
                                      }`}
                                    >
                                      <td className="px-4 py-3.5 font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">{slotIdx === 0 ? cap(day) : ''}</td>
                                      <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-gray-100">{cls.subject_name || 'Subject'}</td>
                                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">{cls.teacher_name || '—'}</td>
                                      <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">
                                        {cls.room ? <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {cls.room}</span> : '—'}
                                      </td>
                                      <td className="px-4 py-3.5 text-right font-medium text-blue-600 whitespace-nowrap">
                                        {fmtTime(cls.start_time)}{cls.end_time ? ` – ${fmtTime(cls.end_time)}` : ''}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Fees */}
                  {activeTab === 'fees' && (
                    <div className="space-y-4">
                      {/* Per-year / per-term ledger for the selected child
                          (includes its own billed/paid/outstanding summary) */}
                      {currentChildId && (
                        <div>
                          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3 px-1">Fees by Term &amp; Year</h3>
                          <StudentLedgerView studentId={currentChildId} redirectToPay />
                        </div>
                      )}

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Invoices</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {fees.invoices.length === 0 ? (
                            <p className="text-sm text-gray-500 py-6 text-center">No invoices on record.</p>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                              <table className="w-full text-sm text-left">
                                <thead className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                                  <tr className="text-white">
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Invoice #</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-right">Amount</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-right">Paid</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-right">Balance</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Due</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3.5 font-bold text-xs uppercase tracking-wider text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                  {fees.invoices.map((inv: any, i: number) => {
                                    const bal = Number(inv.balance) || 0;
                                    return (
                                    <tr
                                      key={inv.id}
                                      className={`transition-colors hover:bg-sky-100 dark:hover:bg-blue-950/20 ${
                                        i % 2 === 1 ? 'bg-sky-50 dark:bg-gray-800/20' : 'bg-white dark:bg-transparent'
                                      }`}
                                    >
                                      <td className="px-4 py-3.5 font-mono text-xs text-gray-700 dark:text-gray-300">{inv.invoice_number}</td>
                                      <td className="px-4 py-3.5 text-right text-gray-700 dark:text-gray-300">{fmtMoney(inv.total_amount)}</td>
                                      <td className="px-4 py-3.5 text-right text-green-600">{fmtMoney(inv.total_paid)}</td>
                                      <td className="px-4 py-3.5 text-right font-semibold text-gray-900 dark:text-gray-100">{fmtMoney(inv.balance)}</td>
                                      <td className="px-4 py-3.5 text-gray-500">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                                      <td className="px-4 py-3.5">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                          inv.status === 'paid' ? 'bg-green-100 text-green-700'
                                            : inv.status === 'overdue' ? 'bg-red-100 text-red-700'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}>{cap(inv.status)}</span>
                                      </td>
                                      <td className="px-4 py-3.5 text-right">
                                        {bal > 0 && inv.status !== 'paid'
                                          ? <PayFeesButton invoiceId={inv.id} size="sm">Pay</PayFeesButton>
                                          : <span className="text-xs text-gray-400">—</span>}
                                      </td>
                                    </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default Phase13ParentDashboard;
