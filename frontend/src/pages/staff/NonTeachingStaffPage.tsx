/**
 * Support Staff — /staff/members
 * Security, cleaners, cooks, drivers, gardeners, maintenance. Easy onboarding:
 * a staff record (details, photo, emergency contact) with no portal login.
 * Professional staff (teachers, accountants, admissions officers) are onboarded
 * in full under Staff → Teaching & Admin Staff.
 */
import { initialQuery, useQuerySearch } from '@hooks/useQuerySearch';
import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Users, UserCheck, Shield, Sparkles, Info } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { SearchBar } from '@components/admin/table/SearchBar';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { ConfirmationDialog } from '@components/admin/feedback/ConfirmationDialog';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { staffService, SupportStaff, SUPPORT_JOB_LABEL } from '@services/staffService';
import { StaffFormModal } from './components/StaffFormModal';

const fmtDate = (d?: string | null) => {
  if (!d) return '—';
  const ymd = String(d).slice(0, 10);
  const dt = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T00:00:00`) : new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const NonTeachingStaffPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(initialQuery());
  useQuerySearch(setSearch);
  const [jobFilter, setJobFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SupportStaff | null>(null);
  const [statusTarget, setStatusTarget] = useState<SupportStaff | null>(null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['support-staff', { search, jobFilter, statusFilter }],
    queryFn: () => staffService.list({ search: search || undefined, job_type: jobFilter || undefined, status: statusFilter || undefined }),
    staleTime: 30_000,
  });
  // apiClient never throws: a failed load must not read as "no staff".
  const loadError: string | null = error
    ? String(error)
    : (data as any)?.success === false ? ((data as any)?.error || 'Could not load support staff') : null;
  const rows: SupportStaff[] = loadError ? [] : ((data as any)?.data ?? []);
  const stats: Record<string, number> = (data as any)?.stats ?? { total: 0, active: 0, inactive: 0 };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['support-staff'] });

  const toggleStatus = async () => {
    if (!statusTarget) return;
    const next = statusTarget.status === 'active' ? 'inactive' : 'active';
    const res: any = await staffService.update(statusTarget.id, { status: next });
    if (res?.success === false) showToast.apiError(res.error);
    else { showToast.success(next === 'active' ? 'Marked active' : 'Marked inactive'); refresh(); }
    setStatusTarget(null);
  };

  const columns: ColumnDef<SupportStaff, any>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-2.5 min-w-[160px]">
          <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center text-xs font-bold text-slate-600">
            {row.original.photo_url ? <img src={row.original.photo_url} alt="" className="w-full h-full object-cover" /> : `${row.original.first_name[0] ?? ''}${row.original.last_name[0] ?? ''}`}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{row.original.first_name} {row.original.last_name}</p>
            <p className="text-[11px] font-mono text-gray-500">{row.original.staff_id}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'job',
      header: 'Job',
      cell: ({ row }) => (
        <div>
          <p className="text-sm text-gray-800 dark:text-gray-200">{SUPPORT_JOB_LABEL[row.original.job_type] || row.original.job_type}</p>
          {row.original.job_title && <p className="text-[11px] text-gray-500">{row.original.job_title}</p>}
        </div>
      ),
    },
    { id: 'phone', header: 'Phone', cell: ({ row }) => <span className="text-sm text-gray-600 dark:text-gray-300">{row.original.phone || '—'}</span> },
    {
      id: 'emergency',
      header: 'Emergency contact',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-300">
          {row.original.emergency_contact_name || '—'}{row.original.emergency_contact_phone ? ` · ${row.original.emergency_contact_phone}` : ''}
        </span>
      ),
    },
    { id: 'hired', header: 'Hired', cell: ({ row }) => <span className="text-xs text-gray-600 dark:text-gray-300">{fmtDate(row.original.hire_date)}</span> },
    { id: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} showDot /> },
  ];

  const filtered = !!(search || jobFilter || statusFilter);

  return (
    <MainLayout>
      <PageShell
        title="Support Staff"
        subtitle="Security, cleaners, cooks, drivers and other support staff"
        breadcrumbs={[{ label: 'Staff' }, { label: 'Support Staff' }]}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        actions={<Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }} className="whitespace-nowrap shadow-sm">+ Add Support Staff</Button>}
      >
        <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3 dark:border-gray-700 dark:bg-gray-800/40">
          <Info size={18} className="mt-0.5 text-slate-500 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-slate-700 dark:text-gray-300">
            Quick records for support staff who don't use the portal: name, job, phone, photo and an emergency contact. No login is created.
            Teachers, accountants (bursars) and admissions officers go through the full onboarding under <strong>Staff → Teaching &amp; Admin Staff</strong>.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {isLoading ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KPICard title="Total" value={stats.total ?? 0} icon={<div className="p-2 rounded-xl bg-blue-500 text-white"><Users size={20} /></div>} color="blue" />
              <KPICard title="Active" value={stats.active ?? 0} icon={<div className="p-2 rounded-xl bg-green-500 text-white"><UserCheck size={20} /></div>} color="green" />
              <KPICard title="Security" value={stats.security ?? 0} icon={<div className="p-2 rounded-xl bg-slate-600 text-white"><Shield size={20} /></div>} color="blue" />
              <KPICard title="Cleaners" value={stats.cleaner ?? 0} icon={<div className="p-2 rounded-xl bg-teal-500 text-white"><Sparkles size={20} /></div>} color="green" />
            </>
          )}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
          <SearchBar placeholder="Search name, staff ID or phone…" onSearch={setSearch} isLoading={isFetching} className="w-full lg:max-w-md" />
          <div className="flex gap-2">
            <select aria-label="Filter by job" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <option value="">All jobs</option>
              {Object.entries(SUPPORT_JOB_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          error={loadError}
          onRetry={refetch}
          emptyMessage={filtered ? 'No support staff match your filters.' : 'No support staff yet.'}
          emptyAction={filtered ? undefined : { label: 'Add security, cleaner or other support staff', onClick: () => { setEditing(null); setFormOpen(true); } }}
          rowActions={(row) => [
            { label: 'Edit', onClick: (r: SupportStaff) => { setEditing(r); setFormOpen(true); } },
            row.status === 'active'
              ? { label: 'Mark inactive', variant: 'destructive' as const, onClick: (r: SupportStaff) => setStatusTarget(r) }
              : { label: 'Mark active', onClick: (r: SupportStaff) => setStatusTarget(r) },
          ]}
        />
      </PageShell>

      <StaffFormModal isOpen={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} onSuccess={refresh} editing={editing} />

      <ConfirmationDialog
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={toggleStatus}
        title={statusTarget?.status === 'active' ? 'Mark inactive' : 'Mark active'}
        message={statusTarget?.status === 'active'
          ? `${statusTarget?.first_name} ${statusTarget?.last_name} will be marked as no longer working here. The record is kept.`
          : `${statusTarget?.first_name} ${statusTarget?.last_name} will be marked as working here again.`}
        confirmLabel={statusTarget?.status === 'active' ? 'Mark inactive' : 'Mark active'}
      />
    </MainLayout>
  );
};

export default NonTeachingStaffPage;
