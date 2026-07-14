import React, { useEffect, useState } from 'react';
import {
  Users,
  BookOpen,
  Briefcase,
  DollarSign,
  Plus,
  Download,
  RefreshCw,
  Loader,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import AdminMetricsCard from '@components/dashboard/AdminMetricsCard';
import AlertCard, { AlertProps } from '@components/dashboard/AlertCard';
import ChartComponent from '@components/dashboard/ChartComponent';
import SystemHealthPanel from '@components/dashboard/SystemHealthPanel';
import AtRiskStudentsPanel, { AtRiskStudent } from '@components/dashboard/AtRiskStudentsPanel';
import { useDashboard } from '@hooks/useDashboard';
import { useAuth } from '@hooks/useAuth';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { dashboard, loading, error, refreshDashboard } = useDashboard();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [selectedStudent, setSelectedStudent] = useState<AtRiskStudent | null>(null);

  useEffect(() => {
    refreshDashboard();
    // Refresh every 5 minutes
    const interval = setInterval(refreshDashboard, 300000);
    return () => clearInterval(interval);
  }, [refreshDashboard]);

  if (loading && !dashboard) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Loader className="animate-spin mx-auto mb-4 text-blue-500" size={40} />
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  const activeDismissedAlerts = dismissedAlerts.has ? 0 : 1;
  const visibleAlerts = (dashboard?.alerts || []).filter(
    (alert) => !dismissedAlerts.has(alert.id)
  );

  const handleDismissAlert = (id: string) => {
    setDismissedAlerts(new Set([...dismissedAlerts, id]));
  };

  const handleRefresh = () => {
    refreshDashboard();
  };

  const isPrincipal = user?.role === 'principal';
  const dashboardTitle = user?.role === 'principal' ? 'Principal Dashboard' : 'Admin Dashboard';
  return (
    <MainLayout>
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-3xl font-bold text-gray-900">{dashboardTitle}</h1>
              <p className="text-sm text-gray-600 mt-1">
                Welcome back, {user?.firstName} {user?.lastName}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-sm bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">
                <Download size={14} />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
            <p className="font-semibold">Error loading dashboard</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <AdminMetricsCard
            label="Total Students"
            value={dashboard?.metrics?.totalStudents || 0}
            icon={<Users size={32} />}
            color="blue"
            trend={5}
          />
          <AdminMetricsCard
            label="Total Teachers"
            value={dashboard?.metrics?.totalTeachers || 0}
            icon={<Briefcase size={32} />}
            color="green"
            trend={2}
          />
          <AdminMetricsCard
            label="Total Classes"
            value={dashboard?.metrics?.totalClasses || 0}
            icon={<BookOpen size={32} />}
            color="purple"
            trend={0}
          />
          <AdminMetricsCard
            label="Outstanding Fees"
            value={`Le${(dashboard?.metrics?.outstandingFees || 0).toLocaleString()}`}
            icon={<DollarSign size={32} />}
            color="red"
            trend={-8}
          />
        </div>

        {/* Alerts Section */}
        {visibleAlerts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">System Alerts</h2>
            <div className="space-y-3">
              {visibleAlerts.slice(0, 3).map((alert) => (
                <AlertCard
                  key={alert.id}
                  id={alert.id}
                  type={alert.severity}
                  title={alert.title}
                  message={alert.message}
                  actionUrl={alert.actionUrl}
                  dismissible={alert.dismissible}
                  onDismiss={handleDismissAlert}
                />
              ))}
            </div>
          </div>
        )}

        {/* Financial Summary and System Health */}
        <div className={`grid grid-cols-1 gap-6 mb-8 ${isPrincipal ? 'lg:grid-cols-3' : ''}`}>
          {/* Financial Summary Card */}
          <div className={`${isPrincipal ? 'lg:col-span-1' : ''} bg-white rounded-lg shadow-md p-6`}>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Financial Summary</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">This Month Collected</p>
                <p className="text-2xl font-bold text-green-600">
                  Le{(dashboard?.financialSummary?.thisMonthCollected || 0).toLocaleString()}
                </p>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{
                    width: `${(dashboard?.financialSummary?.collectionRate || 0).toFixed(0)}%`,
                  }}
                ></div>
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-semibold">
                  {(dashboard?.financialSummary?.collectionRate || 0).toFixed(1)}%
                </span>{' '}
                of monthly target
              </div>
            </div>
          </div>

          {/* System Health — principal only */}
          {isPrincipal && (
            <div className="lg:col-span-2">
              {dashboard?.systemHealth && (
                <SystemHealthPanel
                  databaseStatus={dashboard.systemHealth.databaseStatus}
                  lastBackup={dashboard.systemHealth.lastBackup}
                  apiResponseTime={dashboard.systemHealth.apiResponseTime}
                  storageUsage={dashboard.systemHealth.storageUsage}
                  activeUsers={dashboard.systemHealth.activeUsers}
                />
              )}
            </div>
          )}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {dashboard?.charts?.attendanceTrend && (
            <ChartComponent
              title="Attendance Trend (Last 30 Days)"
              data={dashboard.charts.attendanceTrend}
              type="line"
              height={300}
            />
          )}
          {dashboard?.charts?.feeCollection && (
            <ChartComponent
              title="Fee Collection (Last 12 Months)"
              data={dashboard.charts.feeCollection}
              type="bar"
              height={300}
            />
          )}
        </div>

        {/* Student Distribution and Academic Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {dashboard?.charts?.studentDistribution && (
            <ChartComponent
              title="Student Distribution by Class"
              data={dashboard.charts.studentDistribution}
              type="pie"
              height={300}
            />
          )}
          {dashboard?.charts?.academicPerformance && (
            <ChartComponent
              title="Academic Performance by Class"
              data={dashboard.charts.academicPerformance}
              type="bar"
              height={300}
            />
          )}
        </div>

        {/* At Risk Students */}
        {dashboard?.atRiskStudents && (
          <div className="mb-8">
            <AtRiskStudentsPanel
              students={dashboard.atRiskStudents}
              onStudentClick={setSelectedStudent}
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Shared actions */}
            <button className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700">
              <Plus size={20} />
              <span className="text-sm font-medium">Enroll Student</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700">
              <Plus size={20} />
              <span className="text-sm font-medium">Create Class</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700">
              <Plus size={20} />
              <span className="text-sm font-medium">Add Teacher</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700">
              <BookOpen size={20} />
              <span className="text-sm font-medium">Assign Class</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700">
              <Briefcase size={20} />
              <span className="text-sm font-medium">Manage Timetable</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700">
              <Download size={20} />
              <span className="text-sm font-medium">Publish Results</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700">
              <Download size={20} />
              <span className="text-sm font-medium">Generate Report</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700">
              <Users size={20} />
              <span className="text-sm font-medium">Send Announcement</span>
            </button>
            {/* Principal-only */}
            {isPrincipal && (
              <button className="flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700">
                <Download size={20} />
                <span className="text-sm font-medium">Import / Export</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminDashboard;
