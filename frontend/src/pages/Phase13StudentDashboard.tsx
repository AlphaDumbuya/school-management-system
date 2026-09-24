/**
 * Student Dashboard — /student/dashboard
 * Real, tenant + student-scoped hub. Shows ONLY the logged-in student's own
 * profile, grades, attendance, timetable, and fees.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, TrendingUp, Calendar, DollarSign, Clock, MapPin,
  Loader2, GraduationCap, CheckCircle2, XCircle, AlertTriangle,
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
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import useAuthStore from '@store/authStore';
import { studentDashboardService, StudentDashboardData } from '@services/studentDashboardService';
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

export const Phase13StudentDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => studentDashboardService.getDashboard(),
    staleTime: 60_000,
  });

  const dash: StudentDashboardData | undefined = (data as any)?.data ?? (data as any);

  const profile = dash?.profile ?? null;
  const stats = dash?.stats ?? { attendance_rate: 0, average_grade: 0, classes_today: 0, outstanding_fees: 0 };
  const grades = dash?.grades ?? [];
  const attendance = dash?.attendance ?? { present: 0, absent: 0, late: 0, excused: 0, total: 0, percentage: 0, records: [] };
  const todaySchedule = dash?.today_schedule ?? [];
  const weekly = dash?.weekly_schedule ?? [];
  const fees = dash?.fees ?? { total: 0, paid: 0, outstanding: 0, invoices: [] };

  const displayName = profile?.full_name || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'Student';
  const classLabel = profile?.class_name
    ? `${profile.class_name}${profile.class_section ? ` (${profile.class_section})` : ''}`
    : 'Not enrolled';

  // Group weekly schedule by day for the schedule tab
  const scheduleByDay = DAY_ORDER
    .map((day) => ({
      day,
      slots: weekly
        .filter((s) => (s.day_of_week || '').toLowerCase() === day)
        .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')),
    }))
    .filter((d) => d.slots.length > 0);

  const tabs: TabType[] = ['overview', 'grades', 'attendance', 'schedule', 'fees'];

  // ── Chart data (memoised so recharts doesn't re-compute on every render) ──
  const attendanceChartData = useMemo(
    () => [
      { name: 'Present', value: attendance.present, color: '#10B981' },
      { name: 'Late', value: attendance.late, color: '#F59E0B' },
      { name: 'Absent', value: attendance.absent, color: '#EF4444' },
      { name: 'Excused', value: attendance.excused, color: '#3B82F6' },
    ].filter((d) => d.value > 0),
    [attendance.present, attendance.late, attendance.absent, attendance.excused]
  );

  // One bar per subject using the latest mean score available.
  const gradesChartData = useMemo(() => {
    const bySubject = new Map<string, number>();
    grades.forEach((g) => {
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

  const feesChartData = useMemo(
    () => [
      { name: 'Paid', value: Number(fees.paid) || 0, color: '#10B981' },
      { name: 'Outstanding', value: Number(fees.outstanding) || 0, color: '#EF4444' },
    ].filter((d) => d.value > 0),
    [fees.paid, fees.outstanding]
  );

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
          <EmptyState
            message="Couldn't load dashboard"
            description="There was a problem fetching your data. Please refresh and try again."
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageShell
        title="Student Dashboard"
        subtitle="Your grades, attendance, schedule and fees"
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
      >
        <WelcomeHero
          firstName={displayName.split(' ')[0]}
          role="student"
          roleLabel="Student"
          subtitle={`${classLabel}${profile?.admission_no ? ` • ${profile.admission_no}` : ''}${profile?.academic_year ? ` • ${profile.academic_year}` : ''}`}
        />
        {profile == null && (
          <div className="mb-4">
            <EmptyState
              message="Student profile not linked"
              description="Your login isn't linked to a student record yet. Please contact the school office."
            />
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Attendance Rate"
            value={`${stats.attendance_rate}%`}
            icon={<Calendar className="w-5 h-5" />}
            color={stats.attendance_rate >= 85 ? 'green' : stats.attendance_rate >= 70 ? 'amber' : 'red'}
          />
          <KPICard
            title="Average Score"
            value={stats.average_grade ? `${stats.average_grade}%` : '—'}
            icon={<TrendingUp className="w-5 h-5" />}
            color="blue"
          />
          <KPICard
            title="Today's Classes"
            value={String(stats.classes_today)}
            icon={<BookOpen className="w-5 h-5" />}
            color="purple"
          />
          <KPICard
            title="Outstanding Fees"
            value={fmtMoney(stats.outstanding_fees)}
            icon={<DollarSign className="w-5 h-5" />}
            color={stats.outstanding_fees > 0 ? 'amber' : 'green'}
          />
        </div>

        {/* Tabs */}
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
          {/* ── Overview ─────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Announcements scoped to this student's classes + school-wide */}
              <AnnouncementsWidget limit={4} />

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="w-4 h-4" /> Today's Classes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {todaySchedule.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No classes scheduled for today.</p>
                  ) : (
                    <div className="space-y-2">
                      {todaySchedule.map((cls) => (
                        <div key={cls.id} className="flex items-center justify-between p-3 border border-gray-100 dark:border-gray-800 rounded-lg">
                          <div>
                            <p className="font-semibold text-sm">{cls.subject_name || 'Subject'}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                              {cls.teacher_name && <span>{cls.teacher_name}</span>}
                              {cls.room && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {cls.room}</span>}
                            </p>
                          </div>
                          <div className="text-xs font-medium text-blue-600 whitespace-nowrap">
                            {fmtTime(cls.start_time)}{cls.end_time ? ` – ${fmtTime(cls.end_time)}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Attendance Summary</CardTitle>
                </CardHeader>
                <CardContent>
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
                      <p className="text-xs text-gray-500">Excused</p>
                      <p className="text-2xl font-bold text-blue-600">{attendance.excused}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Visual insights ─────────────────────────────────── */}
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
                      <ResponsiveContainer width="100%" height={260}>
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

                {/* Grades by subject bar chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="w-4 h-4" /> Performance by Subject
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {gradesChartData.length === 0 ? (
                      <p className="text-sm text-gray-500 py-12 text-center">No results published yet.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={gradesChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="subject" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullSubject ?? ''}
                            formatter={(value: number) => [`${value}%`, 'Mean Score']}
                          />
                          <Bar dataKey="mean" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={48} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Fees breakdown */}
              {feesChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <DollarSign className="w-4 h-4" /> Fees Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={feesChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
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
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Paid</span>
                          <span className="font-bold text-green-600">{fmtMoney(fees.paid)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Outstanding</span>
                          <span className="font-bold text-red-600">{fmtMoney(fees.outstanding)}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
                          <span className="text-sm text-gray-600 dark:text-gray-300">Total Billed</span>
                          <span className="font-bold">{fmtMoney(fees.total)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── Grades ───────────────────────────────────────────────── */}
          {activeTab === 'grades' && (
            <div className="space-y-6">
              {/* Performance chart */}
              {gradesChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="w-4 h-4" /> Mean Score by Subject
                    </CardTitle>
                  </CardHeader>
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
                        <Bar dataKey="mean" fill="#2563EB" radius={[4, 4, 0, 0]} maxBarSize={56} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="w-4 h-4" /> My Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {grades.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">No results published yet.</p>
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
                          {grades.map((g, i) => (
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
                                {g.mean != null ? (
                                  <span
                                    className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                      Number(g.mean) >= 70
                                        ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                                        : Number(g.mean) >= 50
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                                        : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                                    }`}
                                  >
                                    {g.mean}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-center font-medium text-gray-600 dark:text-gray-300">
                                {g.subject_rank ? `#${g.subject_rank}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Attendance ───────────────────────────────────────────── */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              {/* Attendance breakdown chart */}
              {attendanceChartData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PieChartIcon className="w-4 h-4" /> Attendance Breakdown
                    </CardTitle>
                  </CardHeader>
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
                <CardHeader>
                  <CardTitle className="text-base">Recent Attendance</CardTitle>
                </CardHeader>
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
                          {attendance.records.map((r, i) => {
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
                                <td className="px-4 py-3.5 font-medium text-gray-700 dark:text-gray-200 whitespace-nowrap">
                                  {new Date(r.date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3.5">
                                  <AttendanceTimeDetails record={r} />
                                </td>
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

          {/* ── Schedule ─────────────────────────────────────────────── */}
          {activeTab === 'schedule' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Weekly Timetable</CardTitle>
              </CardHeader>
              <CardContent>
                {scheduleByDay.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">No timetable published for your class yet.</p>
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
                          slots.map((cls, slotIdx) => (
                            <tr
                              key={cls.id}
                              className={`transition-colors hover:bg-sky-100 dark:hover:bg-blue-950/20 ${
                                dayIdx % 2 === 1 ? 'bg-sky-50 dark:bg-gray-800/20' : 'bg-white dark:bg-transparent'
                              }`}
                            >
                              <td className="px-4 py-3.5 font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
                                {slotIdx === 0 ? cap(day) : ''}
                              </td>
                              <td className="px-4 py-3.5 font-medium text-gray-900 dark:text-gray-100">
                                {cls.subject_name || 'Subject'}
                              </td>
                              <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">
                                {cls.teacher_name || '—'}
                              </td>
                              <td className="px-4 py-3.5 text-gray-600 dark:text-gray-300">
                                {cls.room ? (
                                  <span className="inline-flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {cls.room}
                                  </span>
                                ) : (
                                  '—'
                                )}
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

          {/* ── Fees ─────────────────────────────────────────────────── */}
          {activeTab === 'fees' && (
            <div className="space-y-4">
              {/* Per-year / per-term ledger (includes its own billed/paid/outstanding summary).
                  Pay buttons here route to the dedicated My Fees page. */}
              <Card>
                <CardHeader><CardTitle className="text-base">Fees by Term &amp; Year</CardTitle></CardHeader>
                <CardContent>
                  <StudentLedgerView redirectToPay />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <CardTitle className="text-base">Invoices</CardTitle>
                  {fees.outstanding > 0 && (
                    <button
                      onClick={() => navigate('/finance/my-fees', { state: { autoPay: { studentId: profile?.id, amount: fees.outstanding, label: 'School Fees' } } })}
                      className="inline-flex items-center justify-center gap-2 font-semibold rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm hover:shadow-md transition-all px-3 py-1.5 text-xs"
                    >
                      <CreditCard size={13} /> Pay {fmtMoney(fees.outstanding)}
                    </button>
                  )}
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
                          {fees.invoices.map((inv, i) => {
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
      </PageShell>
    </MainLayout>
  );
};

export default Phase13StudentDashboard;
