/**
 * Parent Dashboard — /parent/dashboard
 * Real, tenant + parent-scoped hub. Shows ONLY the logged-in parent's own
 * children with per-child grades, attendance, timetable and fees.
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, TrendingUp, Calendar, DollarSign, Clock, MapPin, GraduationCap,
  Loader2, AlertTriangle, CheckCircle2, XCircle, UserCircle2,
} from 'lucide-react';
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
                    <div className="space-y-6">
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

                      <Card>
                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Today &amp; Weekly Timetable</CardTitle></CardHeader>
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
                    <Card>
                      <CardHeader><CardTitle className="text-base flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Results</CardTitle></CardHeader>
                      <CardContent>
                        {!detail?.results_published ? (
                          <p className="text-sm text-gray-500 py-6 text-center">Results have not been published yet.</p>
                        ) : grades.length === 0 ? (
                          <p className="text-sm text-gray-500 py-6 text-center">No results recorded.</p>
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
                                {grades.map((g: any) => (
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

                  {/* Attendance */}
                  {activeTab === 'attendance' && (
                    <Card>
                      <CardHeader><CardTitle className="text-base">Attendance ({attendance.percentage}%)</CardTitle></CardHeader>
                      <CardContent>
                        {attendance.records.length === 0 ? (
                          <p className="text-sm text-gray-500 py-6 text-center">No attendance records yet.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {attendance.records.map((r: any) => {
                              const s = (r.status || '').toLowerCase();
                              const icon = s === 'present' ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                                : s === 'absent' ? <XCircle className="w-4 h-4 text-red-600" />
                                : <AlertTriangle className="w-4 h-4 text-amber-600" />;
                              return (
                                <div key={r.id} className="flex flex-wrap items-start justify-between gap-2 p-2.5 border border-gray-100 dark:border-gray-800 rounded-lg text-sm">
                                  <div><span className="text-gray-600 dark:text-gray-300">{new Date(r.date).toLocaleDateString()}</span><AttendanceTimeDetails record={r} className="mt-1" /></div>
                                  <span className="flex items-center gap-1.5 font-medium">{icon} {cap(s)}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Schedule */}
                  {activeTab === 'schedule' && (
                    <Card>
                      <CardHeader><CardTitle className="text-base">Weekly Timetable</CardTitle></CardHeader>
                      <CardContent>
                        {scheduleByDay.length === 0 ? (
                          <p className="text-sm text-gray-500 py-6 text-center">No timetable published for this class yet.</p>
                        ) : (
                          <div className="space-y-5">
                            {scheduleByDay.map(({ day, slots }) => (
                              <div key={day}>
                                <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-2">{cap(day)}</h4>
                                <div className="space-y-2">
                                  {slots.map((cls: any) => (
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

                  {/* Fees */}
                  {activeTab === 'fees' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Card><CardContent className="pt-5"><p className="text-xs text-gray-500">Total Billed</p><p className="text-xl font-bold">{fmtMoney(fees.total)}</p></CardContent></Card>
                        <Card><CardContent className="pt-5"><p className="text-xs text-gray-500">Paid</p><p className="text-xl font-bold text-green-600">{fmtMoney(fees.paid)}</p></CardContent></Card>
                        <Card><CardContent className="pt-5"><p className="text-xs text-gray-500">Outstanding</p><p className={`text-xl font-bold ${fees.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>{fmtMoney(fees.outstanding)}</p></CardContent></Card>
                      </div>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between gap-3">
                          <CardTitle className="text-base">Invoices</CardTitle>
                          {fees.outstanding > 0 && currentChildId && (
                            <PayFeesButton studentId={currentChildId} amount={fees.outstanding} size="sm" label="School Fees">
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
                                  {fees.invoices.map((inv: any) => {
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
              </>
            )}
          </>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default Phase13ParentDashboard;
