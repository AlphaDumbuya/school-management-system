import React, { useState, useMemo } from 'react';
import { Users, FileText, CheckCircle, Clock, AlertCircle, Download, GripVertical, ArrowRight } from 'lucide-react';
import { MainLayout } from '@components/layout/MainLayout';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';
import { AnnouncementsWidget } from '@components/dashboard/AnnouncementsWidget';
import useAuthStore from '@store/authStore';

interface Application {
  id: string;
  studentName: string;
  parentName: string;
  class: string;
  applicationDate: string;
  status: 'new' | 'under-review' | 'approved' | 'enrolled' | 'rejected';
  priority: 'high' | 'normal' | 'low';
  applicantEmail: string;
  phone: string;
}

interface ApplicationMetric {
  id: string;
  label: string;
  value: number;
  trend: number;
  trendDirection: 'up' | 'down' | 'stable';
}

// Mock data
const mockApplicationMetrics: ApplicationMetric[] = [
  {
    id: '1',
    label: 'Total Applications (This Month)',
    value: 45,
    trend: 15,
    trendDirection: 'up',
  },
  {
    id: '2',
    label: 'Under Review',
    value: 12,
    trend: -8,
    trendDirection: 'down',
  },
  {
    id: '3',
    label: 'Approved (This Month)',
    value: 28,
    trend: 22,
    trendDirection: 'up',
  },
  {
    id: '4',
    label: 'Enrollment Rate',
    value: 85,
    trend: 3,
    trendDirection: 'up',
  },
];

const mockApplications: Application[] = [
  {
    id: 'APP-001',
    studentName: 'Mohamed Kamara',
    parentName: 'Alhaji Kamara',
    class: '9-A',
    applicationDate: '2026-07-01',
    status: 'new',
    priority: 'high',
    applicantEmail: 'mkamara@example.com',
    phone: '+232-76-123456',
  },
  {
    id: 'APP-002',
    studentName: 'Fatmata Sesay',
    parentName: 'Momoh Sesay',
    class: '10-B',
    applicationDate: '2026-06-28',
    status: 'under-review',
    priority: 'high',
    applicantEmail: 'fsesay@example.com',
    phone: '+232-77-234567',
  },
  {
    id: 'APP-003',
    studentName: 'Aminata Bangura',
    parentName: 'Sorie Bangura',
    class: '8-A',
    applicationDate: '2026-06-25',
    status: 'approved',
    priority: 'normal',
    applicantEmail: 'abangura@example.com',
    phone: '+232-78-345678',
  },
  {
    id: 'APP-004',
    studentName: 'Ibrahim Koroma',
    parentName: 'Bai Koroma',
    class: '9-B',
    applicationDate: '2026-06-22',
    status: 'enrolled',
    priority: 'normal',
    applicantEmail: 'ikoroma@example.com',
    phone: '+232-30-456789',
  },
  {
    id: 'APP-005',
    studentName: 'Hawa Turay',
    parentName: 'Lansana Turay',
    class: '7-A',
    applicationDate: '2026-06-20',
    status: 'rejected',
    priority: 'low',
    applicantEmail: 'hturay@example.com',
    phone: '+232-31-567890',
  },
];

interface MetricCardProps {
  metric: ApplicationMetric;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric }) => {
  const trendColor = metric.trendDirection === 'up' ? 'text-green-600' : metric.trendDirection === 'down' ? 'text-red-600' : 'text-gray-600';
  const bgColor = metric.trendDirection === 'up' ? 'bg-green-50' : metric.trendDirection === 'down' ? 'bg-red-50' : 'bg-gray-50';

  return (
    <div className={`p-6 rounded-lg border border-gray-200 ${bgColor}`}>
      <p className="text-sm text-gray-600 mb-2">{metric.label}</p>
      <div className="flex items-end justify-between">
        <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
        <div className="flex items-center gap-1">
          {metric.trendDirection === 'up' && (
            <svg className={trendColor} width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 10a.75.75 0 01.75-.75h12.69L10.22 5.03a.75.75 0 111.06-1.06l6.5 6.5a.75.75 0 010 1.06l-6.5 6.5a.75.75 0 11-1.06-1.06l5.22-5.22H2.75A.75.75 0 012 10z" />
            </svg>
          )}
          {metric.trendDirection === 'down' && (
            <svg className={trendColor} width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
              <path d="M18 10a.75.75 0 01-.75.75H4.56l5.22 5.22a.75.75 0 11-1.06 1.06l-6.5-6.5a.75.75 0 010-1.06l6.5-6.5a.75.75 0 111.06 1.06L4.56 9.25H17.25A.75.75 0 0118 10z" />
            </svg>
          )}
          <span className={`text-sm font-semibold ${trendColor}`}>
            {metric.trend > 0 ? '+' : ''}{metric.trend}%
          </span>
        </div>
      </div>
    </div>
  );
};

interface ApplicationCardProps {
  application: Application;
  onView?: (app: Application) => void;
  onStatusChange?: (app: Application, newStatus: string) => void;
}

const ApplicationCard: React.FC<ApplicationCardProps> = ({ application, onView, onStatusChange }) => {
  const statusColors = {
    'new': 'bg-blue-100 text-blue-800',
    'under-review': 'bg-orange-100 text-orange-800',
    'approved': 'bg-green-100 text-green-800',
    'enrolled': 'bg-purple-100 text-purple-800',
    'rejected': 'bg-red-100 text-red-800',
  };

  const priorityColors = {
    high: 'border-red-300 bg-red-50',
    normal: 'border-blue-300 bg-blue-50',
    low: 'border-gray-300 bg-gray-50',
  };

  const statusLabels = {
    'new': 'New',
    'under-review': 'Under Review',
    'approved': 'Approved',
    'enrolled': 'Enrolled',
    'rejected': 'Rejected',
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${priorityColors[application.priority]}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900">{application.studentName}</p>
          <p className="text-xs text-gray-600 mt-1">Parent: {application.parentName}</p>
        </div>
        <span className={`px-3 py-1 text-xs font-semibold rounded capitalize ${statusColors[application.status]}`}>
          {statusLabels[application.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-3">
        <div>Class: {application.class}</div>
        <div>{new Date(application.applicationDate).toLocaleDateString()}</div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onView?.(application)}
          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 font-medium"
        >
          View Details
        </button>
        <button
          onClick={() => onStatusChange?.(application, 'next')}
          className="flex-1 px-3 py-2 border border-blue-600 text-blue-600 rounded text-xs hover:bg-blue-50 font-medium"
        >
          Progress
        </button>
      </div>
    </div>
  );
};

export const Phase13AdmissionsDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'pipeline' | 'list'>('pipeline');
  const [filterStatus, setFilterStatus] = useState<'all' | string>('all');

  const pipelineGroups = useMemo(() => {
    const groups: { [key: string]: Application[] } = {
      'new': [],
      'under-review': [],
      'approved': [],
      'enrolled': [],
      'rejected': [],
    };

    mockApplications.forEach((app) => {
      groups[app.status].push(app);
    });

    return groups;
  }, []);

  const totalApplications = mockApplications.length;
  const newCount = pipelineGroups['new'].length;
  const underReviewCount = pipelineGroups['under-review'].length;
  const approvedCount = pipelineGroups['approved'].length;

  const handleViewDetails = (application: Application) => {
    alert(`View details for ${application.studentName}`);
  };

  const handleStatusChange = (application: Application, direction: string) => {
    alert(`Change status for ${application.studentName}`);
  };

  const handleSendInterview = (application: Application) => {
    alert(`Schedule interview for ${application.studentName}`);
  };

  return (
    <MainLayout>
      {/* Welcome hero */}
      <WelcomeHero
        firstName={user?.firstName ?? (user as any)?.first_name}
        role="admissions"
        roleLabel="Admissions Officer"
        subtitle="Manage student applications and the enrollment pipeline."
      />
      

      {/* Main Content */}
      <div>
        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {mockApplicationMetrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>

        {/* Announcements scoped to this admissions officer (school-wide + admissions audience) */}
        <div className="mb-8">
          <AnnouncementsWidget limit={4} />
        </div>

        {/* Alert */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-8 flex gap-3">
          <AlertCircle className="text-orange-600 flex-shrink-0" size={20} />
          <div>
            <p className="font-semibold text-orange-900">Action Required</p>
            <p className="text-sm text-orange-800 mt-1">
              {underReviewCount} applications pending review. Interview decisions needed for {approvedCount} approved applicants.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'pipeline'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowRight size={18} />
            Pipeline View
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'list'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText size={18} />
            All Applications
          </button>
        </div>

        {/* Pipeline View */}
        {activeTab === 'pipeline' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* New */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                <h3 className="font-semibold text-gray-900">New</h3>
                <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded">
                  {newCount}
                </span>
              </div>
              <div className="space-y-3">
                {pipelineGroups['new'].map((app) => (
                  <div key={app.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-gray-900">{app.studentName}</p>
                    <p className="text-xs text-gray-600 mt-1">{app.class}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Under Review */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-orange-600 rounded-full"></div>
                <h3 className="font-semibold text-gray-900">Under Review</h3>
                <span className="ml-auto bg-orange-100 text-orange-800 text-xs font-semibold px-2 py-1 rounded">
                  {underReviewCount}
                </span>
              </div>
              <div className="space-y-3">
                {pipelineGroups['under-review'].map((app) => (
                  <div key={app.id} className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm font-medium text-gray-900">{app.studentName}</p>
                    <p className="text-xs text-gray-600 mt-1">{app.class}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Approved */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                <h3 className="font-semibold text-gray-900">Approved</h3>
                <span className="ml-auto bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">
                  {approvedCount}
                </span>
              </div>
              <div className="space-y-3">
                {pipelineGroups['approved'].map((app) => (
                  <div key={app.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-medium text-gray-900">{app.studentName}</p>
                    <p className="text-xs text-gray-600 mt-1">{app.class}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Enrolled */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
                <h3 className="font-semibold text-gray-900">Enrolled</h3>
                <span className="ml-auto bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded">
                  {pipelineGroups['enrolled'].length}
                </span>
              </div>
              <div className="space-y-3">
                {pipelineGroups['enrolled'].map((app) => (
                  <div key={app.id} className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm font-medium text-gray-900">{app.studentName}</p>
                    <p className="text-xs text-gray-600 mt-1">{app.class}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Rejected */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 bg-red-600 rounded-full"></div>
                <h3 className="font-semibold text-gray-900">Rejected</h3>
                <span className="ml-auto bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded">
                  {pipelineGroups['rejected'].length}
                </span>
              </div>
              <div className="space-y-3">
                {pipelineGroups['rejected'].map((app) => (
                  <div key={app.id} className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm font-medium text-gray-900">{app.studentName}</p>
                    <p className="text-xs text-gray-600 mt-1">{app.class}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* List View */}
        {activeTab === 'list' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockApplications.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onView={handleViewDetails}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Phase13AdmissionsDashboard;
