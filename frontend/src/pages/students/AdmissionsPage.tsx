/**
 * AdmissionsPage — /students/admissions
 * Manage admission applications following Sierra Leone school format.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { FileText, Clock, CheckCircle, XCircle, Search, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { admissionsService, AdmissionRecord, ADMISSION_STATUSES } from '@services/admissionsService';
import { AdmissionFormModal } from './components/AdmissionFormModal';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_LABELS: Record<string, string> = Object.fromEntries(ADMISSION_STATUSES.map((s) => [s.value, s.label]));

// ── Component ─────────────────────────────────────────────────────────────────

export const AdmissionsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdmissionRecord | null>(null);

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
      showToast.success(`Application ${newStatus}`);
      queryClient.invalidateQueries({ queryKey: ['admissions'] });
    } else {
      showToast.apiError(res.error);
    }
  };

  const columns: ColumnDef<AdmissionRecord, any>[] = [
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

  return (
    <MainLayout>
      <PageShell
        title="Admissions"
        subtitle="Manage student admission applications"
        breadcrumbs={[{ label: 'Admissions' }]}
        actions={
          <RoleGuard roles={['principal', 'super_admin', 'admissions_officer']}>
            <Button variant="default" size="sm" onClick={() => setFormOpen(true)} className="whitespace-nowrap shadow-sm">
              + New Application
            </Button>
          </RoleGuard>
        }
      >
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
            <div className="relative w-full lg:max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, ID, or phone..."
                className="w-full pl-9 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md"><X size={14} /></button>}
            </div>
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

        {/* Table */}
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
          rowActions={(row) => [
            ...(row.status === 'pending' ? [
              { label: 'Approve', onClick: (r: AdmissionRecord) => handleStatusChange(r, 'approved') },
              { label: 'Reject', variant: 'destructive' as const, onClick: (r: AdmissionRecord) => handleStatusChange(r, 'rejected') },
            ] : []),
            { label: 'Delete', variant: 'destructive' as const, onClick: (r: AdmissionRecord) => setDeleteTarget(r) },
          ]}
        />
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
