/**
 * AdminDashboard — Principal Dashboard
 * Rebuilt using the Admin Dashboard Design System components.
 * Route: /admin/dashboard  (ProtectedRoute requiredRoles={['principal']})
 */

import React, { useEffect } from 'react';
import {
  RefreshCw,
  Users,
  Briefcase,
  BookOpen,
  Wallet,
  UserPlus,
  CalendarDays,
  ClipboardCheck,
  BarChart2,
  Megaphone,
  ArrowLeftRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';
import { AnnouncementsWidget } from '@components/dashboard/AnnouncementsWidget';
import { ChartCard } from '@components/admin/charts/ChartCard';
import VerifySchoolBanner from '@components/verification/VerifySchoolBanner';
import { SkeletonCard, SkeletonChart } from '@components/admin/feedback/Skeleton';
import { ErrorState } from '@components/admin/feedback/ErrorState';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { ProgressBar } from '@components/admin/feedback/ProgressBar';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import SystemHealthPanel from '@components/dashboard/SystemHealthPanel';
import { useDashboard } from '@hooks/useDashboard';
import { useAuth } from '@hooks/useAuth';
import {
  formatCurrency,
  toChartSeries,
  isChartEmpty,
  severityToStatus,
  attendanceColor,
} from './adminDashboardHelpers';

// ── Component ─────────────────────────────────────────────────────────────────

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dashboard, loading, error, refreshDashboard } = useDashboard();

  // Initial load + 5-minute auto-refresh
  useEffect(() => {
    refreshDashboard();
    const interval = setInterval(refreshDashboard, 300_000);
    return () => clearInterval(interval);
  }, [refreshDashboard]);

  const isInitialLoad = loading && dashboard === null;

  // Refresh the whole dashboard; never let a failing fetch throw an unhandled
  // rejection to the console.
  const safeRefresh = () => Promise.resolve(refreshDashboard()).catch((err) =>
    console.warn('[Dashboard] refresh failed:', err)
  );

  // Page actions for PageShell — a single Refresh control (no export/print here).
  const actions = (
    <Button
      variant="default"
      size="sm"
      disabled={loading}
      onClick={safeRefresh}
      aria-label="Refresh dashboard"
    >
      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      <span className="hidden sm:inline">Refresh</span>
    </Button>
  );

  return (
    <MainLayout>
      <PageShell
        title="Principal Dashboard"
        subtitle="Your school at a glance"
        actions={actions}
      >
        {/* Verify-school CTA (unverified owner only) */}
        <VerifySchoolBanner />

        {/* ── Welcome hero ── */}
        <WelcomeHero
          firstName={user?.firstName}
          role={user?.role}
          roleLabel="Principal"
          schoolName={user?.schoolName}
          subtitle="Here's what's happening across your school today."
        />

        {/* ── Error state (initial load failure only) ── */}
        {error && !dashboard && (
          <ErrorState
            message={error ?? 'Failed to load dashboard data'}
            onRetry={refreshDashboard}
            className="mb-8"
          />
        )}

        {/* ── KPI Stat Row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6 mb-8">
          {isInitialLoad ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <KPICard
                title="Total Students"
                value={dashboard ? dashboard.metrics.totalStudents : '—'}
                icon={<Users size={32} />}
                color="blue"
                isLoading={loading && !dashboard}
              />
              <KPICard
                title="Total Teachers"
                value={dashboard ? dashboard.metrics.totalTeachers : '—'}
                icon={<Briefcase size={32} />}
                color="green"
                isLoading={loading && !dashboard}
              />
              <KPICard
                title="Total Classes"
                value={dashboard ? dashboard.metrics.totalClasses : '—'}
                icon={<BookOpen size={32} />}
                color="purple"
                isLoading={loading && !dashboard}
              />
              <KPICard
                title="Academic Pass Avg"
                value={dashboard ? `${dashboard.metrics.averageGrade || 0}%` : '—'}
                icon={<BarChart2 size={32} />}
                color="amber"
                isLoading={loading && !dashboard}
              />
              <KPICard
                title="Outstanding Fees"
                value={dashboard ? formatCurrency(dashboard.metrics.outstandingFees) : '—'}
                icon={<Wallet size={32} />}
                color="red"
                isLoading={loading && !dashboard}
                // 5th card: span full width on mobile (2-col grid) so it isn't
                // left cramped/alone on the last row; normal size on desktop.
                className="col-span-2 lg:col-span-1"
              />
            </>
          )}
        </div>

        {/* System alerts now surface via the header notification bell. */}

        {/* ── Financial Summary + System Health ── */}
        {!isInitialLoad && (
          <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-3">
            {/* Financial Summary */}
            <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Financial Summary</h3>

              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-1">This Month Collected</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(dashboard?.financialSummary?.thisMonthCollected)}
                </p>
              </div>

              <ProgressBar
                value={dashboard?.financialSummary?.collectionRate ?? 0}
                color="green"
                showValue
                className="mb-1"
              />
              <p className="text-xs text-gray-500 mb-4">of monthly target</p>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Outstanding Balance</span>
                  <span className="text-red-600 font-medium">
                    {formatCurrency(dashboard?.financialSummary?.outstandingBalance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Overdue Amount</span>
                  <span className="text-red-600 font-medium">
                    {formatCurrency(dashboard?.financialSummary?.overdueAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-gray-600">Collection Trend</span>
                  <StatusBadge
                    status={
                      (dashboard?.financialSummary?.trend ?? 0) > 0 ? 'active' : 'overdue'
                    }
                  />
                </div>
              </div>
            </div>

            {/* System Health — principal only */}
            <div className="lg:col-span-2">
              <RoleGuard roles={['principal', 'super_admin']}>
                {dashboard?.systemHealth && (
                  <SystemHealthPanel
                    databaseStatus={dashboard.systemHealth.databaseStatus}
                    lastBackup={dashboard.systemHealth.lastBackup}
                    apiResponseTime={dashboard.systemHealth.apiResponseTime}
                    storageUsage={dashboard.systemHealth.storageUsage}
                    activeUsers={dashboard.systemHealth.activeUsers}
                    isPlatformAdmin={user?.role === 'super_admin'}
                  />
                )}
              </RoleGuard>
            </div>
          </div>
        )}

        {/* ── Charts Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {isInitialLoad ? (
            <>
              <SkeletonChart height={300} />
              <SkeletonChart height={300} />
              <SkeletonChart height={300} />
              <SkeletonChart height={300} />
            </>
          ) : (
            <>
              <ChartCard
                title="School Attendance Overview"
                subtitle="Daily attendance rate for your school — last 30 days"
                type="line"
                height={300}
                isLoading={false}
                emptyState={{
                  message: 'No attendance recorded for your school in the last 30 days',
                  description: 'Mark attendance for enrolled students to see your school trend.',
                  action: { label: 'Mark attendance', onClick: () => navigate('/students/attendance') },
                }}
                {...(!isChartEmpty(dashboard?.charts?.attendanceTrend) && dashboard?.charts?.attendanceTrend
                  ? toChartSeries(dashboard.charts.attendanceTrend)
                  : { series: [], labels: [] })}
              />
              <ChartCard
                title="Fee Collection (Last 12 Months)"
                type="bar"
                height={300}
                isLoading={false}
                emptyState={{
                  message: 'No fee collections in the last 12 months',
                  description: 'Recorded payments will appear here automatically.',
                  action: { label: 'Manage fees', onClick: () => navigate('/finance/fees') },
                }}
                {...(!isChartEmpty(dashboard?.charts?.feeCollection) && dashboard?.charts?.feeCollection
                  ? toChartSeries(dashboard.charts.feeCollection)
                  : { series: [], labels: [] })}
              />
              <ChartCard
                title="Student Distribution by Class"
                type="pie"
                height={300}
                isLoading={false}
                emptyState={{
                  message: 'No active class enrollments',
                  description: 'Enroll students in a class to show the distribution.',
                  action: { label: 'Manage classes', onClick: () => navigate('/academic/classes') },
                }}
                {...(!isChartEmpty(dashboard?.charts?.studentDistribution) && dashboard?.charts?.studentDistribution
                  ? toChartSeries(dashboard.charts.studentDistribution)
                  : { series: [], labels: [] })}
              />
              <ChartCard
                title="Academic Performance by Class"
                type="bar"
                height={300}
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

        {/* ── At-Risk Students Panel ── */}
        {!isInitialLoad && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Students at Risk</h2>
              {(dashboard?.atRiskStudents?.length ?? 0) > 0 && (
                <span className="bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {dashboard?.atRiskStudents?.length}
                </span>
              )}
            </div>

            {!dashboard?.atRiskStudents || dashboard.atRiskStudents.length === 0 ? (
              <EmptyState
                message="No students currently meet the risk criteria"
                description="Students appear here when their recorded average is below 40% or attendance falls below 75%."
                action={{ label: 'Review attendance', onClick: () => navigate('/students/attendance') }}
              />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Name</th>
                      <th scope="col" className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Roll No.</th>
                      <th scope="col" className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Class</th>
                      <th scope="col" className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Severity</th>
                      <th scope="col" className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Attendance</th>
                      <th scope="col" className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">Grade</th>
                      <th scope="col" className="px-4 py-3 font-medium text-gray-600">Risk Factors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {dashboard.atRiskStudents.slice(0, 10).map((student) => (
                      <tr key={student.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{student.name}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{student.rollNumber}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{student.className}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={severityToStatus[student.severity]} showDot />
                        </td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-8 flex-shrink-0">
                              {student.attendanceRate.toFixed(0)}%
                            </span>
                            <ProgressBar
                              value={student.attendanceRate}
                              color={attendanceColor(student.attendanceRate)}
                              size="sm"
                              showValue={false}
                              className="flex-1"
                            />
                          </div>
                        </td>
                        <td className={`px-4 py-3 font-medium whitespace-nowrap ${student.averageGrade < 40 ? 'text-red-600' : 'text-green-600'}`}>
                          {student.averageGrade.toFixed(1)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {student.riskFactors.map((factor, i) => (
                              <span
                                key={i}
                                className="inline-block px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded"
                              >
                                {factor}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Announcements (school-wide, principal sees all) ── */}
        <div className="mb-8">
          <AnnouncementsWidget limit={4} />
        </div>

        {/* ── Quick Actions ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Enroll Student',    icon: <UserPlus size={20} />,       route: '/students/directory',            tint: 'bg-blue-50 hover:bg-blue-100 border-blue-100 text-blue-700' },
              { label: 'Create Class',      icon: <BookOpen size={20} />,       route: '/academic/classes',              tint: 'bg-violet-50 hover:bg-violet-100 border-violet-100 text-violet-700' },
              { label: 'Add Teacher',       icon: <Briefcase size={20} />,      route: '/staff/teachers',                tint: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-100 text-emerald-700' },
              { label: 'Manage Timetable',  icon: <CalendarDays size={20} />,   route: '/academic/timetables',           tint: 'bg-sky-50 hover:bg-sky-100 border-sky-100 text-sky-700' },
              { label: 'Publish Results',   icon: <ClipboardCheck size={20} />, route: '/academic/results',              tint: 'bg-amber-50 hover:bg-amber-100 border-amber-100 text-amber-700' },
              { label: 'Generate Report',   icon: <BarChart2 size={20} />,      route: '/reports/academic',              tint: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-100 text-indigo-700' },
              { label: 'Send Announcement', icon: <Megaphone size={20} />,      route: '/communication/announcements',   tint: 'bg-rose-50 hover:bg-rose-100 border-rose-100 text-rose-700' },
              { label: 'Import / Export',   icon: <ArrowLeftRight size={20} />, route: '/students/directory',            tint: 'bg-teal-50 hover:bg-teal-100 border-teal-100 text-teal-700' },
            ].map(({ label, icon, route, tint }) => (
              <button
                key={label}
                onClick={() => navigate(route)}
                className={`group flex flex-col items-center gap-2 h-auto py-5 px-3 rounded-2xl border shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${tint}`}
              >
                <span className="transition-transform duration-300 group-hover:scale-110">{icon}</span>
                <span className="text-xs font-semibold text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>

      </PageShell>
    </MainLayout>
  );
};

export default AdminDashboard;
