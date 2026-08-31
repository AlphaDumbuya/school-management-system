/**
 * Student Dashboard — /student/dashboard
 * Real, tenant + student-scoped hub. Shows ONLY the logged-in student's own
 * profile, grades, attendance, timetable, and fees.
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, TrendingUp, Calendar, DollarSign, Clock, MapPin,
  Loader2, GraduationCap, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import { MainLayout } from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import useAuthStore from '@store/authStore';
import { studentDashboardService, StudentDashboardData } from '@services/studentDashboardService';
import { PayFeesButton } from '@components/finance/PayFeesButton';

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
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const { data, isLoading, error } = useQuery({
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

  const displayName = profile?.full_name || `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Student';
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
        title={`Welcome, ${displayName.split(' ')[0]}`}
        subtitle={`${classLabel}${profile?.admission_no ? ` • ${profile.admission_no}` : ''}${profile?.academic_year ? ` • ${profile.academic_year}` : ''}`}
      >
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
            </div>
          )}

          {/* ── Grades ───────────────────────────────────────────────── */}
          {activeTab === 'grades' && (
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
                          <th className="py-2 pr-3">Subject</th>
                          <th className="py-2 px-3">Term</th>
                          <th className="py-2 px-3 text-center">Test 1</th>
                          <th className="py-2 px-3 text-center">Test 2</th>
                          <th className="py-2 px-3 text-center">Mean</th>
                          <th className="py-2 px-3 text-center">Rank</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grades.map((g) => (
                          <tr key={g.id} className="border-b border-gray-50 dark:border-gray-800/50">
                            <td className="py-2 pr-3 font-medium">{g.subject_name}</td>
                            <td className="py-2 px-3 text-gray-500">{g.term}</td>
                            <td className="py-2 px-3 text-center">{g.test1 ?? '—'}</td>
                            <td className="py-2 px-3 text-center">{g.test2 ?? '—'}</td>
                            <td className="py-2 px-3 text-center font-semibold">{g.mean ?? '—'}</td>
                            <td className="py-2 px-3 text-center">{g.subject_rank ? `#${g.subject_rank}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Attendance ───────────────────────────────────────────── */}
          {activeTab === 'attendance' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                {attendance.records.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">No attendance records yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {attendance.records.map((r) => {
                      const s = (r.status || '').toLowerCase();
                      const icon = s === 'present' ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                        : s === 'absent' ? <XCircle className="w-4 h-4 text-red-600" />
                        : <AlertTriangle className="w-4 h-4 text-amber-600" />;
                      return (
                        <div key={r.id} className="flex items-center justify-between p-2.5 border border-gray-100 dark:border-gray-800 rounded-lg text-sm">
                          <span className="text-gray-600 dark:text-gray-300">{new Date(r.date).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1.5 font-medium">{icon} {cap(s)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
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
                  <div className="space-y-5">
                    {scheduleByDay.map(({ day, slots }) => (
                      <div key={day}>
                        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">{cap(day)}</h4>
                        <div className="space-y-2">
                          {slots.map((cls) => (
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
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── Fees ─────────────────────────────────────────────────── */}
          {activeTab === 'fees' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card><CardContent className="pt-5">
                  <p className="text-xs text-gray-500">Total Billed</p>
                  <p className="text-xl font-bold">{fmtMoney(fees.total)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-5">
                  <p className="text-xs text-gray-500">Paid</p>
                  <p className="text-xl font-bold text-green-600">{fmtMoney(fees.paid)}</p>
                </CardContent></Card>
                <Card><CardContent className="pt-5">
                  <p className="text-xs text-gray-500">Outstanding</p>
                  <p className={`text-xl font-bold ${fees.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtMoney(fees.outstanding)}</p>
                </CardContent></Card>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-base">Invoices</CardTitle>
                  {fees.outstanding > 0 && (
                    <PayFeesButton
                      studentId={profile?.id}
                      amount={fees.outstanding}
                      size="sm"
                      label="School Fees"
                    >
                      Pay {fmtMoney(fees.outstanding)}
                    </PayFeesButton>
                  )}
                </CardHeader>
                <CardContent>
                  {fees.invoices.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">No invoices on record.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500 border-b border-gray-100 dark:border-gray-800">
                            <th className="py-2 pr-3">Invoice #</th>
                            <th className="py-2 px-3 text-right">Amount</th>
                            <th className="py-2 px-3 text-right">Paid</th>
                            <th className="py-2 px-3 text-right">Balance</th>
                            <th className="py-2 px-3">Due</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fees.invoices.map((inv) => {
                            const bal = Number(inv.balance) || 0;
                            return (
                            <tr key={inv.id} className="border-b border-gray-50 dark:border-gray-800/50">
                              <td className="py-2 pr-3 font-mono text-xs">{inv.invoice_number}</td>
                              <td className="py-2 px-3 text-right">{fmtMoney(inv.total_amount)}</td>
                              <td className="py-2 px-3 text-right text-green-600">{fmtMoney(inv.total_paid)}</td>
                              <td className="py-2 px-3 text-right font-semibold">{fmtMoney(inv.balance)}</td>
                              <td className="py-2 px-3 text-gray-500">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}</td>
                              <td className="py-2 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                                  inv.status === 'paid' ? 'bg-green-100 text-green-700'
                                    : inv.status === 'overdue' ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                                }`}>{cap(inv.status)}</span>
                              </td>
                              <td className="py-2 px-3 text-right">
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
