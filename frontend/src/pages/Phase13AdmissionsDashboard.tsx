/**
 * Admissions Overview: the intake year at a glance.
 * GET /api/v1/dashboards/admissions/overview?academic_year (server counts;
 * default the active year). Every number and card opens the matching stage or
 * application on the Admissions page (?status= / ?open=).
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, CalendarClock, CheckCircle, ClipboardCheck, FileText, Globe, GraduationCap, Inbox, Loader2 } from 'lucide-react';
import { MainLayout } from '@components/layout/MainLayout';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';
import { HeroRefreshButton } from '@components/dashboard/HeroRefreshButton';
import { AnnouncementsWidget } from '@components/dashboard/AnnouncementsWidget';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import useAuthStore from '@store/authStore';
import { admissionsService, type AdmissionStatus, type AdmissionsOverview } from '@services/admissionsService';
import { StatusPill, ADM_LABEL } from './students/components/ApplicationDetailModal';
import { AdmissionsCharts } from './students/components/AdmissionsCharts';

const PIPELINE: AdmissionStatus[] = ['pending', 'under_review', 'interview_scheduled', 'approved', 'waitlist', 'enrolled'];
const DOT: Record<string, string> = {
  pending: 'bg-amber-500', under_review: 'bg-blue-500', interview_scheduled: 'bg-purple-500', approved: 'bg-emerald-500', waitlist: 'bg-orange-500', enrolled: 'bg-teal-500',
};

export const Phase13AdmissionsDashboard: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'pipeline' | 'list' | 'classes'>('pipeline');
  const { activeYear } = useAcademicYears();
  const [picked, setPicked] = useState('');
  const year = picked || activeYear;
  const viewingPast = !!year && !!activeYear && year !== activeYear;

  const { data: resp, isLoading, error, refetch } = useQuery({
    queryKey: ['admissions-overview', year],
    queryFn: async () => { const r: any = await admissionsService.getOverview(year); if (r?.success === false) throw new Error(r.error || 'Could not load the admissions overview'); return r.data as AdmissionsOverview; },
    enabled: !!year,
    staleTime: 60_000,
  });
  const data = resp;
  const byStatus: Record<string, number> = (data?.byStatus as any) ?? {};
  const applications = data?.applications ?? [];
  const go = (q: string) => navigate(`/students/admissions${q}`);

  const kpis = [
    { label: 'Applications', value: data?.totalApplications ?? 0, sub: `${data?.thisMonth ?? 0} this month · ${data?.online ?? 0} online`, icon: <FileText size={20} />, tint: 'text-blue-600 bg-blue-500/10', to: '' },
    { label: 'To review', value: (byStatus.pending ?? 0) + (byStatus.under_review ?? 0), sub: `${byStatus.pending ?? 0} new`, icon: <Inbox size={20} />, tint: 'text-amber-600 bg-amber-500/10', to: '?status=pending' },
    { label: 'Acceptance rate', value: `${data?.acceptanceRate ?? 0}%`, sub: 'of decided applications', icon: <CheckCircle size={20} />, tint: 'text-emerald-600 bg-emerald-500/10', to: '?status=approved' },
    { label: 'Enrolled', value: byStatus.enrolled ?? 0, sub: `${data?.enrollmentRate ?? 0}% of accepted`, icon: <GraduationCap size={20} />, tint: 'text-teal-600 bg-teal-500/10', to: '?status=enrolled' },
  ];

  const groups = useMemo(() => {
    const g: Record<string, typeof applications> = {};
    PIPELINE.forEach((s) => (g[s] = []));
    applications.forEach((a) => { if (g[a.status]) g[a.status].push(a); });
    return g;
  }, [applications]);

  const newCount = byStatus.pending ?? 0;
  const toEnrol = byStatus.approved ?? 0;
  const interviews = data?.upcomingInterviews ?? [];

  return (
    <MainLayout>
      <WelcomeHero
        firstName={user?.firstName ?? (user as any)?.first_name}
        role="admissions"
        roleLabel="Admissions Officer"
        subtitle={`The ${year || ''} intake: applications, interviews and enrolment.`}
        actions={<div className="flex items-center gap-2"><YearFilter value={year} onChange={(y) => setPicked(!y || y === activeYear ? '' : y)} noAutoSelect /><HeroRefreshButton onRefresh={() => refetch()} /></div>}
      />

      <div className="mt-2">
        {viewingPast && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 px-4 py-2.5 text-sm text-blue-900 dark:text-blue-200">
            <span>Showing the <strong>{year}</strong> intake. New applications go into {activeYear}.</span>
            <button type="button" onClick={() => setPicked('')} className="text-xs font-bold text-blue-700 hover:underline">Back to {activeYear}</button>
          </div>
        )}
        {error ? (
          <p role="alert" className="mb-6 text-sm text-red-600">{(error as Error).message} <button type="button" className="font-bold underline" onClick={() => refetch()}>Retry</button></p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {kpis.map((k) => (
              <button key={k.label} type="button" onClick={() => go(k.to)} className="!flex flex-col !items-start !justify-start text-left w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 !p-4 hover:border-blue-300">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${k.tint} mb-3`}>{k.icon}</div>
                <div className="text-2xl font-black text-gray-900 dark:text-white">{isLoading ? <span className="inline-block h-7 w-16 rounded bg-gray-100 dark:bg-gray-700 animate-pulse" /> : k.value}</div>
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mt-0.5">{k.label}</div>
                <div className="text-[11px] text-gray-500">{isLoading ? '' : k.sub}</div>
              </button>
            ))}
          </div>
        )}

        {/* Charts */}
        {!error && (isLoading || (data?.totalApplications ?? 0) > 0) && (
          <div className="mb-6"><AdmissionsCharts data={data} loading={isLoading} year={year} /></div>
        )}

        {/* Work waiting */}
        {!isLoading && !error && !viewingPast && (newCount > 0 || toEnrol > 0 || interviews.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {newCount > 0 && (
              <button type="button" onClick={() => go('?status=pending')} className="!flex !justify-start items-start gap-3 text-left rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 !p-4">
                <AlertCircle className="text-amber-600 flex-shrink-0" size={20} />
                <span><span className="block font-semibold text-amber-900 dark:text-amber-200">{newCount} new application{newCount === 1 ? '' : 's'}</span><span className="text-xs text-amber-800 dark:text-amber-300">Start the review →</span></span>
              </button>
            )}
            {toEnrol > 0 && (
              <button type="button" onClick={() => go('?status=approved')} className="!flex !justify-start items-start gap-3 text-left rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 !p-4">
                <ClipboardCheck className="text-emerald-600 flex-shrink-0" size={20} />
                <span><span className="block font-semibold text-emerald-900 dark:text-emerald-200">{toEnrol} approved, not enrolled</span><span className="text-xs text-emerald-800 dark:text-emerald-300">Enrol them into this year’s classes →</span></span>
              </button>
            )}
            {interviews.length > 0 && (
              <div className="rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/20 p-4">
                <p className="flex items-center gap-2 font-semibold text-purple-900 dark:text-purple-200"><CalendarClock size={18} /> Upcoming interviews</p>
                <ul className="mt-1 space-y-1">
                  {interviews.slice(0, 4).map((i) => (
                    <li key={i.id}><button type="button" onClick={() => go(`?open=${i.id}`)} className="!px-0 !py-0 !justify-start text-xs text-purple-800 dark:text-purple-300 hover:underline text-left">
                      {new Date(i.at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {i.studentName}{i.location ? ` · ${i.location}` : ''}
                    </button></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="mb-6"><AnnouncementsWidget limit={4} /></div>

        <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 mb-6" role="tablist">
          {([['pipeline', 'Pipeline'], ['list', 'Recent applications'], ['classes', 'By class']] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={activeTab === k} onClick={() => setActiveTab(k)}
              className={`px-4 py-3 font-medium text-sm border-b-2 -mb-px ${activeTab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400'}`}>{l}</button>
          ))}
          <button type="button" onClick={() => go('')} className="ml-auto self-center inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline">Open Admissions <ArrowRight size={14} /></button>
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={22} /></div>
        ) : error ? null : (data?.totalApplications ?? 0) === 0 ? (
          <EmptyState
            message={`No applications for ${year} yet`}
            description="Share the online application link from the Admissions page, or enter a walk-in application there."
            action={{ label: 'Open Admissions', onClick: () => go('') }}
          />
        ) : activeTab === 'pipeline' ? (
          <div className="flex gap-4 overflow-x-auto pb-2 snap-x" role="list" aria-label="Pipeline by stage">
            {PIPELINE.map((status) => (
              <div key={status} role="listitem" className="snap-start flex-shrink-0 w-[78%] sm:w-[240px] xl:flex-1 xl:min-w-[200px] bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <button type="button" onClick={() => go(`?status=${status}`)} className="!flex w-full !justify-start items-center gap-2 mb-4 text-left !px-0 !py-0">
                  <span className={`w-3 h-3 rounded-full ${DOT[status]}`} />
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{ADM_LABEL[status]}</h3>
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">{byStatus[status] ?? 0}</span>
                </button>
                <div className="space-y-2">
                  {groups[status].slice(0, 6).map((app) => (
                    <button key={app.id} type="button" onClick={() => go(`?open=${app.id}`)} className="!flex flex-col !items-start !justify-start w-full text-left !p-3 bg-gray-50 dark:bg-gray-700/40 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-blue-300 min-w-0">
                      <p className="w-full text-sm font-medium text-gray-900 dark:text-white truncate">{app.studentName}</p>
                      <p className="w-full text-xs text-gray-500 mt-0.5 truncate">{app.className}</p>
                    </button>
                  ))}
                  {(byStatus[status] ?? 0) > groups[status].slice(0, 6).length && (
                    <button type="button" onClick={() => go(`?status=${status}`)} className="text-xs font-semibold text-blue-600 hover:underline">See all {byStatus[status]} →</button>
                  )}
                  {(byStatus[status] ?? 0) === 0 && <p className="text-xs text-gray-400 py-2">None</p>}
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'list' ? (
          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-700">
                <th className="py-3 px-4">Applicant</th><th className="py-3 px-4">Parent / guardian</th><th className="py-3 px-4">Class</th><th className="py-3 px-4">Stage</th><th className="py-3 px-4">Applied</th>
              </tr></thead>
              <tbody>
                {applications.slice(0, 25).map((app) => (
                  <tr key={app.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="py-3 px-4"><button type="button" onClick={() => go(`?open=${app.id}`)} className="font-medium text-blue-700 dark:text-blue-400 hover:underline">{app.studentName}</button></td>
                    <td className="py-3 px-4 text-gray-500">{app.parentName}</td>
                    <td className="py-3 px-4 text-gray-500">{app.className}</td>
                    <td className="py-3 px-4"><StatusPill status={app.status} /></td>
                    <td className="py-3 px-4 text-gray-500">{app.applicationDate ? new Date(app.applicationDate).toLocaleDateString('en-GB') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 border-b border-gray-100 dark:border-gray-700">
                <th className="py-3 px-4">Class applied for</th><th className="py-3 px-4 text-right">Applications</th><th className="py-3 px-4 text-right">Still open</th><th className="py-3 px-4 text-right">Enrolled</th>
              </tr></thead>
              <tbody>
                {(data?.byClass ?? []).map((c) => (
                  <tr key={c.class_name} className="border-b border-gray-50 dark:border-gray-800">
                    <td className="py-2.5 px-4 font-medium">{c.class_name}</td>
                    <td className="py-2.5 px-4 text-right">{c.applications}</td>
                    <td className="py-2.5 px-4 text-right">{c.open}</td>
                    <td className="py-2.5 px-4 text-right">{c.enrolled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-6 flex items-center gap-2 text-xs text-gray-500"><Globe size={13} /> Online applications come from the link on the Admissions page. You’re notified of each one.</p>
      </div>
    </MainLayout>
  );
};

export default Phase13AdmissionsDashboard;
