/**
 * AdmissionsPage: /students/admissions
 * The admissions office: every application for an intake year, by stage.
 *  - Stage chips with server counts (they follow the year, search, class and
 *    source filters), search, class and source filters, grid or list.
 *  - Open an application for its details, documents, timeline and the next
 *    allowed steps (review, interview, approve, waitlist, reject, withdraw,
 *    reopen) and Enrol (current-year class, capacity, created once).
 *  - Online application link to share with families.
 * Deep links: ?status=pending opens on a stage, ?open=<id> opens one application.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
  BookOpen, Calendar, CalendarClock, ClipboardCheck, Copy, ExternalLink, Globe, GraduationCap,
  LayoutGrid, Link as LinkIcon, List, Phone, Share2, User, Users, Inbox, BarChart3,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { SearchBar } from '@components/admin/table/SearchBar';
import { DataTable } from '@components/admin/table/DataTable';
import { TablePager } from '@components/admin/table/TablePager';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { Modal } from '@components/admin/feedback/Modal';
import { ExportButton } from '@components/admin/common/ExportButton';
import { YearFilter } from '@components/common/YearFilter';
import { useAcademicYears } from '@hooks/useAcademicYears';
import { Button } from '@components/ui/button';
import { cardTint } from '@lib/cardTint';
import { showToast } from '@utils/toast';
import { admissionsService, type AdmissionRecord, type AdmissionStatus, type EnrolResult, type AdmissionsOverview } from '@services/admissionsService';
import { AdmissionFormModal } from './components/AdmissionFormModal';
import { AdmissionsCharts } from './components/AdmissionsCharts';
import { ApplicationDetailModal, EnrolCredentials, EnrolDialog, StatusPill, ADM_LABEL } from './components/ApplicationDetailModal';

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const initials = (a: AdmissionRecord) => `${a.child_first_name?.[0] ?? ''}${a.child_last_name?.[0] ?? ''}`.toUpperCase();
const GENDER_GRADIENT: Record<string, string> = { male: 'from-blue-400 to-blue-600', female: 'from-pink-400 to-rose-500' };
const STAGES: AdmissionStatus[] = ['pending', 'under_review', 'interview_scheduled', 'approved', 'waitlist', 'enrolled', 'rejected', 'withdrawn'];
const select = 'w-full appearance-none pl-3 pr-8 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500';

export const AdmissionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(params.get('status') || '');
  const [classFilter, setClassFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'' | 'online' | 'office'>('');
  // Intake year: opens on the school's ACTIVE year; '' = all years.
  const { activeYear } = useAcademicYears();
  const [pickedYear, setYear] = useState<string | null>(null);
  const year = pickedYear ?? activeYear;
  const viewingOther = pickedYear !== null && pickedYear !== activeYear;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  // Any filter change goes back to the first page.
  useEffect(() => { setPage(1); }, [search, statusFilter, classFilter, sourceFilter, year]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdmissionRecord | null>(null);
  const [openId, setOpenId] = useState<string | null>(params.get('open'));
  const [enrolFor, setEnrolFor] = useState<AdmissionRecord | null>(null);
  const [enrolResult, setEnrolResult] = useState<{ r: EnrolResult; name: string } | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Keep the URL in step with the stage and the open application (shareable, back button).
  useEffect(() => {
    const next = new URLSearchParams(params);
    if (statusFilter) next.set('status', statusFilter); else next.delete('status');
    if (openId) next.set('open', openId); else next.delete('open');
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, openId]);

  const metaQ = useQuery({ queryKey: ['admissions-meta'], queryFn: () => admissionsService.getMeta(), staleTime: 60_000 });
  const meta = (metaQ.data as any)?.data;

  const { data: shareLinkResult } = useQuery({ queryKey: ['admissions-share-link'], queryFn: admissionsService.getShareLink, staleTime: 5 * 60_000 });
  const sharePath = shareLinkResult?.data?.path;
  const configuredPublicOrigin = (import.meta as ImportMeta & { env?: { VITE_PUBLIC_APP_URL?: string } }).env?.VITE_PUBLIC_APP_URL;
  const publicOrigin = configuredPublicOrigin || (window.location.protocol.startsWith('http') ? window.location.origin : shareLinkResult?.data?.public_base_url || '');
  const shareUrl = sharePath && publicOrigin ? new URL(sharePath, publicOrigin).toString() : '';
  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); showToast.success('Application link copied'); }
    catch { linkInputRef.current?.select(); showToast.error('Select and copy the link shown above'); }
  };
  const shareApplicationUrl = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try { await navigator.share({ title: `${shareLinkResult?.data?.school_name} admissions`, url: shareUrl }); }
      catch (error) { if ((error as Error).name !== 'AbortError') showToast.error('Could not share the link'); }
    } else await copyShareUrl();
  };

  const filters = {
    page, limit: pageSize, status: statusFilter || undefined, search: search || undefined,
    academic_year: year || 'all', class_id: classFilter || undefined, source: sourceFilter || undefined,
  };
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admissions', filters],
    queryFn: async () => { const r: any = await admissionsService.listApplications(filters); if (r?.success === false) throw new Error(r.error || 'Could not load applications'); return r; },
    enabled: pickedYear !== null || !!activeYear,
    staleTime: 30_000,
  });
  // Charts for the chosen intake year (server overview; not narrowed by search/class/source).
  const [showCharts, setShowCharts] = useState<boolean>(() => { try { return localStorage.getItem('wiskul.admissions.charts') !== '0'; } catch { return true; } });
  const toggleCharts = () => setShowCharts((v) => { const n = !v; try { localStorage.setItem('wiskul.admissions.charts', n ? '1' : '0'); } catch { /* ignore */ } return n; });
  const overviewQ = useQuery({
    queryKey: ['admissions-overview', year || 'all'],
    queryFn: async () => { const r: any = await admissionsService.getOverview(year || 'all'); if (r?.success === false) throw new Error(r.error || 'Could not load the charts'); return r.data as AdmissionsOverview; },
    enabled: showCharts && (pickedYear !== null || !!activeYear),
    staleTime: 60_000,
  });
  const applications: AdmissionRecord[] = data?.data ?? [];
  const total = Number(data?.pagination?.total ?? 0);
  const counts: Record<string, number> = data?.counts ?? {};
  const allCount = Object.values(counts).reduce((s, n) => s + Number(n || 0), 0);
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['admissions'] }); queryClient.invalidateQueries({ queryKey: ['admissions-meta'] }); queryClient.invalidateQueries({ queryKey: ['admissions-overview'] }); queryClient.invalidateQueries({ queryKey: ['admission-detail'] }); };

  const kpis = useMemo(() => [
    { label: 'To review', value: (counts.pending || 0) + (counts.under_review || 0), hint: 'New + under review', icon: <Inbox size={18} />, tint: 'bg-amber-500', stage: 'pending' },
    { label: 'Interviews', value: counts.interview_scheduled || 0, hint: 'Scheduled', icon: <CalendarClock size={18} />, tint: 'bg-purple-500', stage: 'interview_scheduled' },
    { label: 'To enrol', value: counts.approved || 0, hint: 'Approved, not yet students', icon: <ClipboardCheck size={18} />, tint: 'bg-emerald-500', stage: 'approved' },
    { label: 'Enrolled', value: counts.enrolled || 0, hint: `${counts.waitlist || 0} on the waitlist`, icon: <GraduationCap size={18} />, tint: 'bg-teal-500', stage: 'enrolled' },
  ], [counts]);

  const onEnrolled = (r: EnrolResult, name: string) => { setEnrolResult({ r, name }); refresh(); };

  const columns: ColumnDef<AdmissionRecord, any>[] = [
    { id: 'application_number', header: 'App ID', cell: ({ row }) => <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{row.original.application_number}</span> },
    { id: 'child', header: 'Child', cell: ({ row }) => (
      <button type="button" onClick={() => setOpenId(row.original.id)} className="!flex flex-col !items-start !justify-start !p-0 text-left min-w-[130px]">
        <p className="font-medium text-blue-700 dark:text-blue-400 hover:underline">{row.original.child_first_name} {row.original.child_last_name}</p>
        <p className="text-[11px] text-gray-500 capitalize">{row.original.child_gender} · {fmtDate(row.original.child_dob)}</p>
      </button>
    ) },
    { id: 'class', header: 'Class', cell: ({ row }) => <span className="text-xs font-semibold">{row.original.enrolled_class_name || row.original.class_name || '—'}</span> },
    { id: 'guardian', header: 'Parent / guardian', cell: ({ row }) => (
      <div className="min-w-[110px]"><p className="text-sm">{row.original.guardian_first_name} {row.original.guardian_last_name}</p><p className="text-[11px] text-gray-500">{row.original.guardian_phone}</p></div>
    ) },
    { id: 'source', header: 'Source', cell: ({ row }) => <span className="text-xs text-gray-500">{row.original.application_source === 'online' ? 'Online' : 'Office'}</span> },
    { id: 'date', header: 'Applied', cell: ({ row }) => <span className="text-xs text-gray-600">{fmtDate(row.original.created_at)}</span> },
    { id: 'status', header: 'Stage', cell: ({ row }) => <StatusPill status={row.original.status} /> },
  ];

  const renderCard = (app: AdmissionRecord, idx: number) => {
    const gradient = GENDER_GRADIENT[app.child_gender?.toLowerCase() ?? ''] ?? 'from-gray-400 to-gray-600';
    const hasPhoto = !!app.child_photo_url && app.child_photo_url.length > 10;
    return (
      <div key={app.id} className={`group relative overflow-hidden ${cardTint(idx)} sm:bg-white sm:dark:bg-gray-800 border sm:border-gray-200/60 sm:dark:border-gray-700/60 rounded-2xl shadow-sm hover:shadow-md transition-all`}>
        <button type="button" onClick={() => setOpenId(app.id)} className="!block w-full text-left !p-5 !pb-3 !rounded-none" aria-label={`Open application of ${app.child_first_name} ${app.child_last_name}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-11 h-11 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-gradient-to-br ${gradient}`}>
              {hasPhoto ? <img src={app.child_photo_url} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-bold text-white">{initials(app)}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600">{app.child_first_name} {app.child_last_name}</h3>
              <span className="font-mono text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{app.application_number}</span>
            </div>
            <StatusPill status={app.status} />
          </div>
          <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-2"><BookOpen size={13} className="text-blue-400" />{app.enrolled_class_name || app.class_name ? <span className="font-semibold text-blue-600 dark:text-blue-400">{app.enrolled_class_name || app.class_name}</span> : <span className="italic text-gray-400">No class chosen</span>}</div>
            <div className="flex items-center gap-2"><User size={13} className="text-indigo-400" /><span className="truncate">{app.guardian_first_name} {app.guardian_last_name}{app.guardian_relationship ? <span className="ml-1 text-gray-400">({app.guardian_relationship})</span> : null}</span></div>
            <div className="flex items-center gap-2"><Phone size={13} className="text-green-400" />{app.guardian_phone}</div>
            <div className="flex items-center gap-2"><Calendar size={13} className="text-purple-400" />{app.status === 'interview_scheduled' && app.interview_date ? <>Interview {new Date(app.interview_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</> : <>Applied {fmtDate(app.created_at)} · {app.application_source === 'online' ? 'online' : 'office'}</>}</div>
            {app.student_number && <div className="flex items-center gap-2"><GraduationCap size={13} className="text-teal-500" />Student {app.student_number}</div>}
          </div>
        </button>
        <div className="flex items-center gap-1 border-t border-gray-100 dark:border-gray-700/50 px-3 py-2">
          <button type="button" onClick={() => setOpenId(app.id)} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20">Open</button>
          {app.status === 'approved' && !app.student_id && (
            <button type="button" onClick={() => setEnrolFor(app)} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20">Enrol</button>
          )}
        </div>
      </div>
    );
  };

  const filtered = !!(search || statusFilter || classFilter || sourceFilter);
  const empty = (
    <EmptyState
      message={filtered ? 'No applications match these filters' : `No applications for ${year || 'any year'} yet`}
      description={filtered ? 'Clear a filter or search for another name.' : 'Share the online application link with families, or enter a walk-in application.'}
      action={filtered ? { label: 'Clear filters', onClick: () => { setSearch(''); setStatusFilter(''); setClassFilter(''); setSourceFilter(''); } } : { label: 'New application', onClick: () => { setEditing(null); setFormOpen(true); } }}
    />
  );

  return (
    <MainLayout>
      <PageShell
        title="Admissions"
        subtitle={`Applications for the ${year || 'all years'} intake, from received to enrolled`}
        breadcrumbs={[{ label: 'Admissions' }]}
        onRefresh={() => { refetch(); metaQ.refetch(); }}
        isRefreshing={isFetching}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-0.5 shadow-sm">
              <button type="button" aria-label="Grid view" aria-pressed={viewMode === 'grid'} onClick={() => setViewMode('grid')} className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600' : 'text-gray-400'}`}><LayoutGrid size={18} /></button>
              <button type="button" aria-label="List view" aria-pressed={viewMode === 'list'} onClick={() => setViewMode('list')} className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600' : 'text-gray-400'}`}><List size={18} /></button>
            </div>
            <ExportButton endpoint={`/api/v1/admissions/export?academic_year=${encodeURIComponent(year || 'all')}${statusFilter ? `&status=${statusFilter}` : ''}${classFilter ? `&class_id=${classFilter}` : ''}${sourceFilter ? `&source=${sourceFilter}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`} filename="admissions" />
            <Button variant="default" size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="whitespace-nowrap shadow-sm">+ New Application</Button>
          </div>
        }
      >
        {/* Online application link */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:border-blue-900 dark:from-blue-950/20 dark:to-indigo-950/10 p-4 sm:p-5">
          <div className="mb-3 flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><Globe size={20} /></span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Online admission link</h2>
              <p className="text-xs text-gray-600 dark:text-gray-300">Share it so families can apply online. Applications arrive here as “New”, and you get a notification. Families need no account.</p>
            </div>
          </div>
          {shareUrl ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 dark:border-blue-900 dark:bg-gray-900">
                  <LinkIcon size={14} className="flex-shrink-0 text-blue-500" />
                  <input ref={linkInputRef} readOnly aria-label="Online admission application link" value={shareUrl} onClick={(e) => e.currentTarget.select()} className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none dark:text-gray-100" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={copyShareUrl} className="flex-1 sm:flex-initial"><Copy size={15} className="mr-1" /> Copy</Button>
                  <Button size="sm" variant="outline" onClick={shareApplicationUrl} className="flex-1 sm:flex-initial"><Share2 size={15} className="mr-1" /> Share</Button>
                </div>
              </div>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline dark:text-blue-400"><ExternalLink size={13} /> Preview the applicant page</a>
            </>
          ) : (
            <p className="text-xs text-amber-700 dark:text-amber-400">{shareLinkResult?.success === false ? 'This school does not have an available application link.' : sharePath ? 'Set a public web address to share admission links from this app.' : 'Loading application link…'}</p>
          )}
        </div>

        {/* KPIs (server counts for the year and filters) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
          {isLoading && !data ? <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></> : kpis.map((k) => (
            <button key={k.label} type="button" onClick={() => setStatusFilter(k.stage)}
              className="!flex flex-col !items-start !justify-start w-full text-left rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 !p-4 hover:border-blue-300">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white ${k.tint} mb-2`}>{k.icon}</div>
              <div className="text-2xl font-black text-gray-900 dark:text-white">{k.value}</div>
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">{k.label}</div>
              <div className="text-[11px] text-gray-500">{k.hint}</div>
            </button>
          ))}
        </div>

        {/* Charts (collapsible, remembered) */}
        <div className="mb-5">
          <button type="button" onClick={toggleCharts} aria-expanded={showCharts}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:border-blue-300">
            <BarChart3 size={14} /> {showCharts ? 'Hide charts' : 'Show charts'}
          </button>
          {showCharts && (
            <div className="mt-3">
              {overviewQ.error
                ? <p role="alert" className="text-sm text-red-600">{(overviewQ.error as Error).message} <button type="button" className="font-bold underline" onClick={() => overviewQ.refetch()}>Retry</button></p>
                : <AdmissionsCharts data={overviewQ.data} loading={overviewQ.isLoading} year={year || 'all years'} />}
            </div>
          )}
        </div>

        {/* Stage chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-3" role="tablist" aria-label="Application stage">
          {[['', 'All', allCount] as const, ...STAGES.map((s) => [s, ADM_LABEL[s], counts[s] || 0] as const)].map(([s, l, n]) => (
            <button key={s || 'all'} type="button" role="tab" aria-selected={statusFilter === s} onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300'}`}>
              {l}<span className={`ml-1.5 ${statusFilter === s ? 'text-blue-100' : 'text-gray-400'}`}>{n}</span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-3 mb-5 items-center">
          <SearchBar placeholder="Search name, application no., parent, phone or email…" onSearch={setSearch} isLoading={isFetching} resultCount={search ? total : undefined} className="w-full" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
            <YearFilter value={year} onChange={(y) => setYear(y)} includeAllOption />
            <div className="min-w-0 sm:min-w-[150px]"><label htmlFor="adm-class" className="sr-only">Class</label>
              <select id="adm-class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className={select}>
                <option value="">All classes</option>
                {(meta?.classes || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select></div>
            <div className="min-w-0 sm:min-w-[140px]"><label htmlFor="adm-source" className="sr-only">Source</label>
              <select id="adm-source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as any)} className={select}>
                <option value="">Online and office</option><option value="online">Online</option><option value="office">Office</option>
              </select></div>
          </div>
        </div>
        {viewingOther && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 px-4 py-2.5 text-sm text-blue-900 dark:text-blue-200">
            <span>{year ? <>Showing the <strong>{year}</strong> intake.</> : <>Showing applications from <strong>all years</strong>.</>} New applications go into {activeYear}, and students are enrolled into {activeYear} classes.</span>
            <button type="button" onClick={() => setYear(activeYear)} className="text-xs font-bold text-blue-700 hover:underline">Back to {activeYear}</button>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm text-red-600">{(error as Error).message} <button type="button" className="font-bold underline" onClick={() => refetch()}>Retry</button></p>
        ) : viewMode === 'grid' ? (
          isLoading && !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
          ) : applications.length === 0 ? empty : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{applications.map(renderCard)}</div>
              <TablePager page={page - 1} pageCount={Math.max(1, Math.ceil(total / pageSize))} size={pageSize} total={total} label="applications"
                onPage={(p) => setPage(p + 1)} onSize={(n) => { setPageSize(n); setPage(1); }} />
            </>
          )
        ) : applications.length === 0 && !isLoading ? empty : (
          <DataTable columns={columns} data={applications} isLoading={isLoading} paginationMode="server" pageIndex={page} pageSize={pageSize}
            totalRows={total} onPageChange={setPage} emptyMessage="No applications found"
            rowActions={(row) => [
              { label: 'Open', onClick: (r: AdmissionRecord) => setOpenId(r.id) },
              ...(row.status === 'approved' && !row.student_id ? [{ label: 'Enrol', onClick: (r: AdmissionRecord) => setEnrolFor(r) }] : []),
            ]} />
        )}

        {(counts.approved || 0) > 0 && statusFilter !== 'approved' && (
          <p className="mt-4 flex items-center gap-2 text-xs text-gray-500"><Users size={13} /> {counts.approved} approved applicant{counts.approved === 1 ? ' is' : 's are'} not enrolled yet. <button type="button" className="font-bold text-blue-600 hover:underline" onClick={() => setStatusFilter('approved')}>Show them</button></p>
        )}
      </PageShell>

      <AdmissionFormModal isOpen={formOpen} editing={editing} onClose={() => { setFormOpen(false); setEditing(null); }}
        onSuccess={() => refresh()} onEnrolled={onEnrolled} />

      <ApplicationDetailModal id={openId} meta={meta} onClose={() => setOpenId(null)} onChanged={refresh}
        onEdit={(a) => { setEditing(a); setFormOpen(true); }} />

      {enrolFor && <EnrolDialog app={enrolFor} meta={meta} onClose={() => setEnrolFor(null)}
        onDone={(r) => { const n = `${enrolFor.child_first_name} ${enrolFor.child_last_name}`; setEnrolFor(null); onEnrolled(r, n); }} />}

      <Modal isOpen={!!enrolResult} onClose={() => setEnrolResult(null)} title="Student enrolled" size="md"
        footer={<Button onClick={() => setEnrolResult(null)}>Done</Button>}>
        {enrolResult && <EnrolCredentials result={enrolResult.r} childLabel={enrolResult.name} />}
      </Modal>
    </MainLayout>
  );
};

export default AdmissionsPage;
