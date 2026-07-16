/**
 * EventsPage — /events/school
 * School events management following admin page pattern.
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Calendar, Users, Clock, MapPin, Search, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { DataTable } from '@components/admin/table/DataTable';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { showToast } from '@utils/toast';
import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SchoolEvent {
  event_id: string;
  title: string;
  description?: string;
  event_type: string;
  category?: string;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  organizer?: string;
  status: string;
  max_participants?: number;
  registration_count?: number;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const EVENT_TYPES = [
  { value: 'academic', label: 'Academic' },
  { value: 'sports', label: 'Sports' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'ceremony', label: 'Ceremony' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'other', label: 'Other' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const EventsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Fetch events
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['events', { search, typeFilter, statusFilter, page, pageSize }],
    queryFn: async () => {
      const params: any = { page, limit: pageSize };
      if (search) params.search = search;
      if (typeFilter) params.event_type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      return apiClient.get('/api/v1/events', { params });
    },
    staleTime: 30_000,
  });

  const events: SchoolEvent[] = (data as any)?.data ?? [];
  const pagination = (data as any)?.pagination ?? { total: 0, total_pages: 1 };

  // KPIs
  const stats = useMemo(() => {
    const total = Number(pagination.total ?? events.length);
    const upcoming = events.filter((e) => new Date(e.start_date) > new Date()).length;
    const published = events.filter((e) => e.status === 'published').length;
    const totalRegistrations = events.reduce((s, e) => s + Number(e.registration_count ?? 0), 0);
    return { total, upcoming, published, totalRegistrations };
  }, [events, pagination]);

  // Columns
  const columns: ColumnDef<SchoolEvent, any>[] = [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Event',
      cell: ({ row }) => (
        <div className="min-w-[150px]">
          <p className="font-medium text-gray-900 dark:text-white truncate">{row.original.title}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 capitalize">{row.original.event_type}</p>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{formatDate(row.original.start_date)}</span>
      ),
    },
    {
      id: 'time',
      header: 'Time',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {row.original.start_time || '—'}{row.original.end_time ? ` - ${row.original.end_time}` : ''}
        </span>
      ),
    },
    {
      id: 'location',
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{row.original.location || '—'}</span>,
    },
    {
      id: 'type',
      accessorKey: 'event_type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30 capitalize">
          {row.original.event_type}
        </span>
      ),
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
        title="School Events"
        subtitle="Create and manage school events, ceremonies, and activities"
        breadcrumbs={[{ label: 'School Events' }]}
        actions={
          <RoleGuard roles={['principal', 'super_admin', 'teacher']}>
            <Button variant="default" size="sm" className="whitespace-nowrap shadow-sm" disabled>
              + Create Event
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
              <KPICard title="Total Events" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><Calendar size={20} /></div>} color="blue" />
              <KPICard title="Upcoming" value={stats.upcoming} icon={<div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center"><Clock size={20} /></div>} color="amber" />
              <KPICard title="Published" value={stats.published} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><MapPin size={20} /></div>} color="green" />
              <KPICard title="Registrations" value={stats.totalRegistrations} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><Users size={20} /></div>} color="purple" />
            </>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search event title..."
                className="w-full pl-9 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md"><X size={14} /></button>}
            </div>
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:min-w-[130px]">
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="">All Types</option>
                  {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
              <div className="relative flex-1 sm:flex-initial sm:min-w-[130px]">
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
            </div>
          </div>
          {(search || typeFilter || statusFilter) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1"><SlidersHorizontal size={10} /> Filters:</span>
              {search && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">"{search}" <button onClick={() => setSearch('')}><X size={12} /></button></span>}
              {typeFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200/30 capitalize">{typeFilter} <button onClick={() => setTypeFilter('')}><X size={12} /></button></span>}
              {statusFilter && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200/30 capitalize">{statusFilter} <button onClick={() => setStatusFilter('')}><X size={12} /></button></span>}
              <button onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); }} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto">Clear All</button>
            </div>
          )}
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={events}
          isLoading={isLoading}
          error={error ? String(error) : null}
          onRetry={refetch}
          paginationMode="server"
          pageIndex={page}
          pageSize={pageSize}
          totalRows={Number(pagination.total)}
          onPageChange={setPage}
          emptyMessage="No events found"
          emptyAction={{ label: 'Create your first event', onClick: () => {} }}
        />
      </PageShell>
    </MainLayout>
  );
};

export default EventsPage;
