/**
 * AdminDashboard — Principal Dashboard
 * Rebuilt using the Admin Dashboard Design System components.
 * Route: /admin/dashboard  (ProtectedRoute requiredRoles={['principal']})
 */

import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Download,
  Users,
  Briefcase,
  BookOpen,
  DollarSign,
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
import { ChartCard } from '@components/admin/charts/ChartCard';
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

// ── Severity badge colour map ─────────────────────────────────────────────────

const ALERT_SEVERITY_CLASSES: Record<string, string> = {
  info:     'border-blue-500 bg-blue-50',
  warning:  'border-amber-500 bg-amber-50',
  error:    'border-red-500 bg-red-50',
  critical: 'border-red-500 bg-red-50',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dashboard, loading, error, refreshDashboard } = useDashboard();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  // Initial load + 5-minute auto-refresh
  useEffect(() => {
    refreshDashboard();
    const interval = setInterval(refreshDashboard, 300_000);
    return () => clearInterval(interval);
  }, [refreshDashboard]);

  const isInitialLoad = loading && dashboard === null;

  const handleDismissAlert = (id: string) =>
    setDismissedAlerts((prev) => new Set([...prev, id]));

  const visibleAlerts = (dashboard?.alerts ?? []).filter(
    (a) => !dismissedAlerts.has(a.id)
  );
  const shownAlerts = visibleAlerts.slice(0, 3);
  const hasMoreAlerts = visibleAlerts.length > 3;

  // Page actions for PageShell
  const actions = (
    <>
      <Button
        variant="default"
        size="sm"
        disabled={loading}
        onClick={refreshDashboard}
        aria-label="Refresh dashboard"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        <span className="hidden sm:inline">Refresh</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.print()}
        aria-label="Export dashboard"
      >
        <Download size={14} />
        <span className="hidden sm:inline">Export</span>
      </Button>
    </>
  );

  return (
    <MainLayout>
      <PageShell
        title="Principal Dashboard"
        subtitle={`Welcome back, ${user?.firstName ?? ''} ${user?.lastName ?? ''}`}
        actions={actions}
      >
        {/* ── Error state (initial load failure only) ── */}
        {error && !dashboard && (
          <ErrorState
            message={error ?? 'Failed to load dashboard data'}
            onRetry={refreshDashboard}
            className="mb-8"
          />
        )}

        {/* ── KPI Stat Row ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {isInitialLoad ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <KPICard
                title="Total Students"
                value={dashboard?.metrics?.totalStudents ?? 0}
                icon={<Users size={32} />}
                color="blue"
                isLoading={loading && !dashboard}
              />
              <KPICard
                title="Total Teachers"
                value={dashboard?.metrics?.totalTeachers ?? 0}
                icon={<Briefcase size={32} />}
                color="green"
                isLoading={loading && !dashboard}
              />
              <KPICard
                title="Total Classes"
                value={dashboard?.metrics?.totalClasses ?? 0}
                icon={<BookOpen size={32} />}
                color="purple"
                isLoading={loading && !dashboard}
              />
              <KPICard
                title="Outstanding Fees"
                value={formatCurrency(dashboard?.metrics?.outstandingFees)}
                icon={<DollarSign size={32} />}
                color="red"
                isLoading={loading && !dashboard}
              />
            </>
          )}
        </div>

        {/* ── Alerts Panel ── */}
        {!isInitialLoad && visibleAlerts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">System Alerts</h2>
            <div className="space-y-3">
              {shownAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`border-l-4 rounded-lg p-4 flex items-start justify-between gap-3 ${
                    ALERT_SEVERITY_CLASSES[alert.severity] ?? ALERT_SEVERITY_CLASSES.info
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{alert.message}</p>
                    {alert.actionUrl && (
                      <a
                        href={alert.actionUrl}
                        className="text-sm text-blue-600 hover:underline mt-1 inline-block"
                      >
                        View details →
                      </a>
                    )}
                  </div>
                  {alert.dismissible && (
                    <button
                      aria-label="Dismiss alert"
                      onClick={() => handleDismissAlert(alert.id)}
                      className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {hasMoreAlerts && (
              <p className="mt-3 text-sm text-blue-600 hover:underline cursor-pointer">
                View all {visibleAlerts.length} alerts
              </p>
            )}
          </div>
        )}

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
                title="Attendance Trend (Last 30 Days)"
                type="line"
                height={300}
                isLoading={false}
                {...(!isChartEmpty(dashboard?.charts?.attendanceTrend) && dashboard?.charts?.attendanceTrend
                  ? toChartSeries(dashboard.charts.attendanceTrend)
                  : { series: [], labels: [] })}
              />
              <ChartCard
                title="Fee Collection (Last 12 Months)"
                type="bar"
                height={300}
                isLoading={false}
                {...(!isChartEmpty(dashboard?.charts?.feeCollection) && dashboard?.charts?.feeCollection
                  ? toChartSeries(dashboard.charts.feeCollection)
                  : { series: [], labels: [] })}
              />
              <ChartCard
                title="Student Distribution by Class"
                type="pie"
                height={300}
                isLoading={false}
                {...(!isChartEmpty(dashboard?.charts?.studentDistribution) && dashboard?.charts?.studentDistribution
                  ? toChartSeries(dashboard.charts.studentDistribution)
                  : { series: [], labels: [] })}
              />
              <ChartCard
                title="Academic Performance by Class"
                type="bar"
                height={300}
                isLoading={false}
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
                message="No students at risk"
                description="All students are performing within acceptable parameters"
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

        {/* ── Quick Actions ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Enroll Student',    icon: <UserPlus size={18} />,       route: '/students/directory' },
              { label: 'Create Class',      icon: <BookOpen size={18} />,       route: '/academic/classes' },
              { label: 'Add Teacher',       icon: <Briefcase size={18} />,      route: '/staff/teachers' },
              { label: 'Manage Timetable',  icon: <CalendarDays size={18} />,   route: '/academic/timetables' },
              { label: 'Publish Results',   icon: <ClipboardCheck size={18} />, route: '/academic/examinations' },
              { label: 'Generate Report',   icon: <BarChart2 size={18} />,      route: '/reports/academic' },
              { label: 'Send Announcement', icon: <Megaphone size={18} />,      route: '/communication/announcements' },
              { label: 'Import / Export',   icon: <ArrowLeftRight size={18} />, route: '/import-export' },
            ].map(({ label, icon, route }) => (
              <Button
                key={route}
                variant="outline"
                className="flex flex-col items-center gap-2 h-auto py-4 text-gray-700"
                onClick={() => navigate(route)}
              >
                {icon}
                <span className="text-xs font-medium">{label}</span>
              </Button>
            ))}
          </div>
        </div>

      </PageShell>
    </MainLayout>
  );
};

export default AdminDashboard;
