/**
 * Admissions Dashboard — real, tenant-scoped application pipeline.
 *
 * Pulls live data from GET /api/v1/dashboards/admissions/overview (KPIs +
 * status pipeline + recent applications). No mock data. Actions link to the
 * full Admissions management page (/students/admissions).
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight, AlertCircle, Loader2, Users, CheckCircle, Clock } from 'lucide-react';
import { MainLayout } from '@components/layout/MainLayout';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';
import { HeroRefreshButton } from '@components/dashboard/HeroRefreshButton';
import { AnnouncementsWidget } from '@components/dashboard/AnnouncementsWidget';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import useAuthStore from '@store/authStore';
import { admissionsService, AdmissionStatus } from '@services/admissionsService';

const STATUS_LABELS: Record<AdmissionStatus, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  interview_scheduled: 'Interview',
  approved: 'Approved',
  rejected: 'Rejected',
  enrolled: 'Enrolled',
};

const STATUS_BADGE: Record<AdmissionStatus, string> = {
  pending: 'bg-blue-100 text-blue-800',
  under_review: 'bg-orange-100 text-orange-800',
  interview_scheduled: 'bg-indigo-100 text-indigo-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  enrolled: 'bg-purple-100 text-purple-800',
};

// Order of columns shown in the pipeline view
const PIPELINE_ORDER: AdmissionStatus[] = [
  'pending',
  'under_review',
  'interview_scheduled',
  'approved',
  'enrolled',
  'rejected',
];

const PIPELINE_DOT: Record<AdmissionStatus, string> = {
  pending: 'bg-blue-600',
  under_review: 'bg-orange-600',
  interview_scheduled: 'bg-indigo-600',
  approved: 'bg-green-600',
  enrolled: 'bg-purple-600',
  rejected: 'bg-red-600',
};

export const Phase13AdmissionsDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pipeline' | 'list'>('pipeline');

  const { data: resp, isLoading, refetch } = useQuery({
    queryKey: ['admissions-overview'],
    queryFn: () => admissionsService.getOverview(),
    staleTime: 60_000,
  });

  const data = (resp as any)?.data;
  const byStatus = data?.byStatus ?? {};
  const applications: any[] = data?.applications ?? [];

  const kpis = [
    { label: 'Total Applications', value: data?.totalApplications ?? 0, icon: <FileText size={20} />, tint: 'text-blue-600 bg-blue-500/10' },
    { label: 'This Month', value: data?.thisMonth ?? 0, icon: <Users size={20} />, tint: 'text-emerald-600 bg-emerald-500/10' },
    { label: 'Under Review', value: byStatus.under_review ?? 0, icon: <Clock size={20} />, tint: 'text-orange-600 bg-orange-500/10' },
    { label: 'Enrollment Rate', value: `${data?.enrollmentRate ?? 0}%`, icon: <CheckCircle size={20} />, tint: 'text-purple-600 bg-purple-500/10' },
  ];

  const pendingReview = byStatus.pending ?? 0;
  const awaitingDecision = (byStatus.interview_scheduled ?? 0) + (byStatus.under_review ?? 0);

  const pipelineGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    PIPELINE_ORDER.forEach((s) => (groups[s] = []));
    applications.forEach((a) => {
      if (groups[a.status]) groups[a.status].push(a);
    });
    return groups;
  }, [applications]);

  const goToApplications = () => navigate('/students/admissions');

  return (
    <MainLayout>
      <WelcomeHero
        firstName={user?.firstName ?? (user as any)?.first_name}
        role="admissions"
        roleLabel="Admissions Officer"
        subtitle="Manage student applications and the enrollment pipeline."
        actions={<HeroRefreshButton onRefresh={() => refetch()} />}
      />

      <div className="mt-2">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${k.tint} mb-3`}>{k.icon}</div>
              <div className="text-2xl font-black text-gray-900 dark:text-white">
                {isLoading ? <span className="inline-block h-7 w-16 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" /> : k.value}
              </div>
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Announcements */}
        <div className="mb-6">
          <AnnouncementsWidget limit={4} />
        </div>

        {/* Action banner (only when there is real work pending) */}
        {!isLoading && (pendingReview > 0 || awaitingDecision > 0) && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex gap-3">
            <AlertCircle className="text-orange-600 flex-shrink-0" size={20} />
            <div className="flex-1">
              <p className="font-semibold text-orange-900">Action Required</p>
              <p className="text-sm text-orange-800 mt-1">
                {pendingReview} new application{pendingReview === 1 ? '' : 's'} pending review
                {awaitingDecision > 0 ? `, ${awaitingDecision} awaiting a decision.` : '.'}
              </p>
            </div>
            <button onClick={goToApplications} className="self-center px-3 py-2 bg-orange-600 text-white rounded text-xs font-medium hover:bg-orange-700 whitespace-nowrap">
              Review
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'pipeline' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <ArrowRight size={18} />
            Pipeline
          </button>
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'list' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText size={18} />
            Recent Applications
          </button>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
        ) : applications.length === 0 ? (
          <EmptyState
            message="No applications yet"
            description="New admission applications will appear here as they are submitted."
            action={{ label: 'Open Admissions', onClick: goToApplications }}
          />
        ) : activeTab === 'pipeline' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {PIPELINE_ORDER.map((status) => (
              <div key={status} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-3 h-3 rounded-full ${PIPELINE_DOT[status]}`} />
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{STATUS_LABELS[status]}</h3>
                  <span className={`ml-auto text-xs font-semibold px-2 py-1 rounded ${STATUS_BADGE[status]}`}>
                    {byStatus[status] ?? 0}
                  </span>
                </div>
                <div className="space-y-2">
                  {pipelineGroups[status].slice(0, 8).map((app) => (
                    <button
                      key={app.id}
                      onClick={goToApplications}
                      className="w-full text-left p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-blue-300 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{app.studentName}</p>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{app.className}</p>
                    </button>
                  ))}
                  {pipelineGroups[status].length === 0 && (
                    <p className="text-xs text-gray-400 py-2">None</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-700">
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Parent / Guardian</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr key={app.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{app.studentName}</td>
                    <td className="py-3 px-4 text-gray-500">{app.parentName}</td>
                    <td className="py-3 px-4 text-gray-500">{app.className}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded ${STATUS_BADGE[app.status as AdmissionStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[app.status as AdmissionStatus] ?? app.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {app.applicationDate ? new Date(app.applicationDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button onClick={goToApplications} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Phase13AdmissionsDashboard;
