/**
 * AdmissionsPage — /students/admissions
 * Manage student admission applications following Sierra Leone school format.
 * Supports grid / list view toggle (same pattern as ClassesPage).
 */

import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
  FileText, Clock, CheckCircle, XCircle,
  X, ChevronDown, SlidersHorizontal,
  LayoutGrid, List, Copy, Share2, Link as LinkIcon,
  User, BookOpen, Phone, Calendar,
  CheckCircle2, XCircle as XCircleIcon, Trash2,
  ExternalLink, Globe,
} from 'lucide-react';
import { SearchBar } from '@components/admin/table/SearchBar';
import { cardTint } from '@lib/cardTint';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { ExportButton } from '@components/admin/common/ExportButton';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { admissionsService, AdmissionRecord, ADMISSION_STATUSES } from '@services/admissionsService';
import { AdmissionFormModal } from './components/AdmissionFormModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

const STATUS_LABELS: Record<string, string> = Object.fromEntries(ADMISSION_STATUSES.map((s) => [s.value, s.label]));

// Status styling for cards
const STATUS_CONFIG: Record<string, { pill: string; accent: string; dot: string }> = {
  pending:              { pill: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30',    accent: 'from-amber-400 to-orange-400',   dot: 'bg-amber-400' },
  under_review:         { pill: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30',           accent: 'from-blue-400 to-cyan-500',      dot: 'bg-blue-400' },
  interview_scheduled:  { pill: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/30', accent: 'from-purple-400 to-indigo-500',  dot: 'bg-purple-400' },
  approved:             { pill: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30', accent: 'from-emerald-400 to-green-500', dot: 'bg-emerald-400' },
  rejected:             { pill: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30',                  accent: 'from-red-400 to-rose-500',       dot: 'bg-red-400' },
  enrolled:             { pill: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800/30',            accent: 'from-teal-400 to-cyan-500',      dot: 'bg-teal-400' },
};

// Gender avatar gradient
const GENDER_GRADIENT: Record<string, string> = {
  male:   'from-blue-400 to-blue-600',
  female: 'from-pink-400 to-rose-500',
  other:  'from-purple-400 to-indigo-500',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const AdmissionsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdmissionRecord | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const { data: shareLinkResult } = useQuery({
    queryKey: ['admissions-share-link'],
    queryFn: admissionsService.getShareLink,
    staleTime: 5 * 60_000,
  });
  const sharePath = shareLinkResult?.data?.path;
  const configuredPublicOrigin = (import.meta as ImportMeta & { env?: { VITE_PUBLIC_APP_URL?: string } }).env?.VITE_PUBLIC_APP_URL;
  const publicOrigin = configuredPublicOrigin || (window.location.protocol.startsWith('http') ? window.location.origin : shareLinkResult?.data?.public_base_url || '');
  const shareUrl = sharePath && publicOrigin ? new URL(sharePath, publicOrigin).toString() : '';

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast.success('Application link copied');
    } catch {
      linkInputRef.current?.select();
      showToast.error('Select and copy the link shown above');
    }
  };

  const shareApplicationUrl = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${shareLinkResult?.data?.school_name} admissions`, url: shareUrl });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') showToast.error('Could not share the link');
      }
    } else {
      await copyShareUrl();
    }
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admissions', { search, statusFilter, page, pageSize }],
    queryFn: () => admissionsService.listApplications({
      page, limit: pageSize,
      status: statusFilter || undefined,
      search: search || undefined,
    }),
    staleTime: 30_000,
  });

  const applications: AdmissionRecord[] = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? { total: 0, total_pages: 1 };

  const stats = useMemo(() => {
    const total = Number(pagination.total ?? applications.length);
    const pending = applications.filter((a) => a.status === 'pending').length;
    const approved = applications.filter((a) => a.status === 'approved').length;
    const rejected = applications.filter((a) => a.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [applications, pagination]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await admissionsService.deleteApplication(deleteTarget.id);
    if (res.success !== false) {
      showToast.deleted('Application');
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
    } else {
      showToast.apiError(res.error);
    }
    setDeleteTarget(null);
  };

  const handleStatusChange = async (app: AdmissionRecord, newStatus: string) => {
    const res = await admissionsService.updateStatus(app.id, { status: newStatus });
    if (res.success !== false) {
      if (newStatus === 'approved' && res.data?.email_sent === false) {
        showToast.error('Application approved, but the acceptance email could not be sent');
      } else {
        showToast.success(`Application ${newStatus}${newStatus === 'approved' && res.data?.email_sent ? ' — acceptance email sent' : ''}`);
      }
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
    } else {
      showToast.apiError(res.error);
    }
  };

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns: ColumnDef<AdmissionRecord, any>[] = [
    {
      id: 'photo',
      header: '',
      size: 48,
      cell: ({ row }) => {
        const app = row.original;
        const gradient = GENDER_GRADIENT[app.child_gender?.toLowerCase() ?? ''] ?? 'from-gray-400 to-gray-600';
        const hasPhoto = !!app.child_photo_url && app.child_photo_url.length > 10;
        return (
          <div className={`w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${gradient}`}>
            {hasPhoto ? (
              <img src={app.child_photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-white">
                {getInitials(app.child_first_name, app.child_last_name)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: 'application_number',
      accessorKey: 'application_number',
      header: 'App ID',
      cell: ({ row }) => <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">{row.original.application_number}</span>,
    },
    {
      id: 'child_name',
      header: 'Child',
      cell: ({ row }) => (
        <div className="min-w-[130px]">
          <p className="font-medium text-gray-900 dark:text-white">{row.original.child_first_name} {row.original.child_last_name}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{row.original.child_gender} · {formatDate(row.original.child_dob)}</p>
        </div>
      ),
    },
    {
      id: 'class',
      header: 'Class',
      cell: ({ row }) => (
        <span className="text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800/30">
          {row.original.class_name || '—'}
        </span>
      ),
    },
    {
      id: 'guardian',
      header: 'Guardian',
      cell: ({ row }) => (
        <div className="min-w-[110px]">
          <p className="text-sm text-gray-700 dark:text-gray-300">{row.original.guardian_first_name} {row.original.guardian_last_name}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{row.original.guardian_phone}</p>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Applied',
      cell: ({ row }) => <span className="text-xs text-gray-600 dark:text-gray-400">{formatDate(row.original.created_at)}</span>,
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} showDot />,
    },
  ];

  // ── Grid card ─────────────────────────────────────────────────────────────
  const renderApplicationCard = (app: AdmissionRecord, idx: number) => {
    const cfg = STATUS_CONFIG[app.status] ?? STATUS_CONFIG.pending;
    const gradient = GENDER_GRADIENT[app.child_gender?.toLowerCase() ?? ''] ?? 'from-gray-400 to-gray-600';
    const hasPhoto = !!app.child_photo_url && app.child_photo_url.length > 10;

    return (
      <div
        key={app.id}
        className={`group relative overflow-hidden ${cardTint(idx)} sm:bg-white sm:dark:bg-gray-800 sm:border-gray-200/60 sm:dark:border-gray-700/60 border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1`}
      >
        {/* Accent bar */}
        <div className={`h-1 w-full bg-gradient-to-r ${cfg.accent}`} />

        <div className="p-5">
          {/* Avatar + child name + App ID */}
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-12 h-12 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center bg-gradient-to-br ${gradient} shadow-sm`}>
              {hasPhoto ? (
                <img src={app.child_photo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-white">
                  {getInitials(app.child_first_name, app.child_last_name)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {app.child_first_name} {app.child_last_name}
              </h3>
              <span className="font-mono text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                {app.application_number}
              </span>
            </div>
            {/* Status pill */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${cfg.pill}`}>
              {STATUS_LABELS[app.status] ?? app.status}
            </span>
          </div>

          {/* Info rows */}
          <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400 mb-4">
            <div className="flex items-center gap-2">
              <BookOpen size={13} className="text-blue-400 flex-shrink-0" />
              <span>
                {app.class_name
                  ? <span className="font-semibold text-blue-600 dark:text-blue-400">{app.class_name}</span>
                  : <span className="italic text-gray-400">No class assigned</span>
                }
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User size={13} className="text-indigo-400 flex-shrink-0" />
              <span className="truncate">
                {app.guardian_first_name} {app.guardian_last_name}
                <span className="ml-1 text-gray-400 capitalize">({app.guardian_relationship})</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Phone size={13} className="text-green-400 flex-shrink-0" />
              <span>{app.guardian_phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-purple-400 flex-shrink-0" />
              <span>Applied {formatDate(app.created_at)}</span>
            </div>
          </div>

          {/* Academic year badge */}
          {app.academic_year && (
            <div className="mb-3">
              <span className="text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">
                {app.academic_year}
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-1 border-t border-gray-100 dark:border-gray-700/50 pt-3">
            <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
              {app.status === 'pending' || app.status === 'under_review' || app.status === 'interview_scheduled' ? (
                <>
                  <button
                    onClick={() => handleStatusChange(app, 'approved')}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                  >
                    <CheckCircle2 size={13} /> Approve
                  </button>
                  <button
                    onClick={() => handleStatusChange(app, 'rejected')}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                  >
                    <XCircleIcon size={13} /> Reject
                  </button>
                </>
              ) : (
                <span className="flex-1 text-center text-[11px] font-semibold text-gray-400 py-1.5">
                  {STATUS_LABELS[app.status]}
                </span>
              )}
              <button
                onClick={() => setDeleteTarget(app)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors ml-auto"
                title="Delete application"
              >
                <Trash2 size={13} />
              </button>
            </RoleGuard>
          </div>
        </div>
      </div>
    );
  };

  return (
    <MainLayout>
      <PageShell
        title="Admissions"
        subtitle="Manage student admission applications"
        breadcrumbs={[{ label: 'Admissions' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="List View"
              >
                <List size={18} />
              </button>
            </div>

            <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
              <ExportButton endpoint="/api/v1/admissions/export" filename="admissions" />
            </RoleGuard>

            <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
              <Button variant="default" size="sm" onClick={() => setFormOpen(true)} className="whitespace-nowrap shadow-sm">
                + New Application
              </Button>
            </RoleGuard>
          </div>
        }
      >
        <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
          <div className="mb-6 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:border-blue-900 dark:from-blue-950/20 dark:to-indigo-950/10">
            <div className="p-4 sm:p-5">
              <div className="mb-3 flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                  <Globe size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">Online admission link</h2>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Share this link so families can apply online. Applications land here for your review — no account needed for applicants.
                  </p>
                </div>
              </div>
              {shareUrl ? (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 dark:border-blue-900 dark:bg-gray-900">
                      <LinkIcon size={14} className="flex-shrink-0 text-blue-500" />
                      <input
                        ref={linkInputRef}
                        readOnly
                        aria-label="Online admission application link"
                        value={shareUrl}
                        onClick={(event) => event.currentTarget.select()}
                        className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none dark:text-gray-100"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={copyShareUrl} className="flex-1 sm:flex-initial"><Copy size={15} className="mr-1" /> Copy</Button>
                      <Button size="sm" variant="outline" onClick={shareApplicationUrl} className="flex-1 sm:flex-initial"><Share2 size={15} className="mr-1" /> Share</Button>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 border-t border-blue-200/60 pt-3 dark:border-blue-900/60">
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:underline dark:text-blue-400"
                    >
                      <ExternalLink size={13} /> Preview applicant page
                    </a>
                    <span className="text-xs text-gray-400">See exactly what families see before you share.</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  {shareLinkResult?.success === false
                    ? 'This school does not have an available application link.'
                    : sharePath ? 'Set a public web address to share admission links from this app.' : 'Loading application link…'}
                </p>
              )}
            </div>
          </div>
        </RoleGuard>
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {isLoading && !data ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KPICard title="Total Applications" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><FileText size={20} /></div>} color="blue" />
              <KPICard title="Pending" value={stats.pending} icon={<div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center"><Clock size={20} /></div>} color="amber" />
              <KPICard title="Approved" value={stats.approved} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><CheckCircle size={20} /></div>} color="green" />
              <KPICard title="Rejected" value={stats.rejected} icon={<div className="p-2 rounded-xl bg-red-500 text-white shadow-sm flex items-center justify-center"><XCircle size={20} /></div>} color="red" />
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchBar
              placeholder="Search by name, ID, or phone..."
              onSearch={setSearch}
              isLoading={isLoading}
              resultCount={search ? applications.length : undefined}
              className="w-full lg:max-w-md"
            />
            <div className="relative flex-1 sm:flex-initial sm:min-w-[160px] lg:w-auto">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                <option value="">All Statuses</option>
                {ADMISSION_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
          </div>
          {(search || statusFilter) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1"><SlidersHorizontal size={10} /> Filters:</span>
              {search && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">"{search}" <button onClick={() => setSearch('')}><X size={12} /></button></span>}
              {statusFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200/30">{STATUS_LABELS[statusFilter]} <button onClick={() => setStatusFilter('')}><X size={12} /></button></span>}
              <button onClick={() => { setSearch(''); setStatusFilter(''); }} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto">Clear All</button>
            </div>
          )}
        </div>

        {/* ── Grid View ── */}
        {viewMode === 'grid' ? (
          isLoading && !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          ) : applications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <FileText size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">No applications found</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">Try adjusting your filters or create a new application.</p>
              <Button onClick={() => setFormOpen(true)}>Create first application</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {applications.map(renderApplicationCard)}
            </div>
          )
        ) : (
          /* ── List / Table View ── */
          <DataTable
            columns={columns}
            data={applications}
            isLoading={isLoading}
            error={error ? String(error) : null}
            onRetry={refetch}
            paginationMode="server"
            pageIndex={page}
            pageSize={pageSize}
            totalRows={Number(pagination.total)}
            onPageChange={setPage}
            emptyMessage="No applications found"
            emptyAction={{ label: 'Create first application', onClick: () => setFormOpen(true) }}
            rowActions={(row) => {
              const actions: any[] = [
                { label: 'Delete', variant: 'destructive', onClick: (r: AdmissionRecord) => setDeleteTarget(r) },
              ];
              if (row.status === 'pending') {
                actions.unshift(
                  { label: 'Approve', onClick: (r: AdmissionRecord) => handleStatusChange(r, 'approved') },
                  { label: 'Reject', variant: 'destructive', onClick: (r: AdmissionRecord) => handleStatusChange(r, 'rejected') },
                );
              }
              return actions;
            }}
          />
        )}
      </PageShell>

      <AdmissionFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['admissions'] })}
      />

      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Application"
        message={`Delete application for ${deleteTarget?.child_first_name} ${deleteTarget?.child_last_name}?`}
        confirmLabel="Delete"
      />
    </MainLayout>
  );
};

export default AdmissionsPage;
