/**
 * EventsPage — /events/school
 * School events management — production-ready following admin page pattern.
 * Reference: ClassesPage (grid/table toggle, KPIs, search, filters, row actions, CRUD modals)
 */

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
  Calendar, Users, Clock, MapPin, X, ChevronDown, SlidersHorizontal,
  LayoutGrid, List, Eye, Edit, Copy, CheckCircle, XCircle, Trash2,
} from 'lucide-react';
import { SearchBar } from '@components/admin/table/SearchBar';
import { useNavigate } from 'react-router-dom';
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
import { eventsService } from '@services/eventsService';
import { EventFormModal } from './components/EventFormModal';
import type { Event, EventStatus, EventType } from '@appTypes/events';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function eventTypeLabel(t: string): string {
  switch (t) {
    case 'single': return 'Single Day';
    case 'multi_day': return 'Multi-Day';
    case 'recurring': return 'Recurring';
    default: return t;
  }
}

function eventTypeColor(t: string): string {
  switch (t) {
    case 'single': return 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30';
    case 'multi_day': return 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/30';
    case 'recurring': return 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30';
    default: return 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-700';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const EventsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // View & filter state
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Event | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);

  // ── Fetch Events ────────────────────────────────────────────────────────────

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['events', { search, typeFilter, statusFilter, page, pageSize }],
    queryFn: () => eventsService.listEvents({
      page,
      limit: pageSize,
      search: search || undefined,
      event_type: (typeFilter as EventType) || undefined,
      status: (statusFilter as EventStatus) || undefined,
    }),
    staleTime: 30_000,
  });

  const events: Event[] = (data as any)?.data ?? [];
  const pagination = {
    total: Number((data as any)?.total ?? (data as any)?.pagination?.total ?? 0),
    total_pages: Number((data as any)?.totalPages ?? (data as any)?.pagination?.total_pages ?? 1),
  };

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = pagination.total || events.length;
    const upcoming = events.filter((e) => new Date(e.start_date) > new Date()).length;
    const published = events.filter((e) => e.status === 'published').length;
    const totalRegistrations = events.reduce((s, e) => s + Number(e.registrations_count ?? 0), 0);
    return { total, upcoming, published, totalRegistrations };
  }, [events, pagination]);

  // ── Action Handlers ─────────────────────────────────────────────────────────

  const handleCancelEvent = async () => {
    if (!cancelTarget) return;
    const res = await eventsService.cancelEvent(cancelTarget.event_id);
    if ((res as any).success === false) {
      showToast.apiError((res as any).error);
    } else {
      showToast.success('Event cancelled');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
    setCancelTarget(null);
  };

  const handleDeleteEvent = async () => {
    if (!deleteTarget) return;
    const res = await eventsService.deleteEvent(deleteTarget.event_id);
    if ((res as any).success === false) {
      showToast.apiError((res as any).error);
    } else {
      showToast.deleted('Event');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
    setDeleteTarget(null);
  };

  const handlePublish = async (event: Event) => {
    const res = await eventsService.publishEvent(event.event_id);
    if ((res as any).success === false) {
      showToast.apiError((res as any).error);
    } else {
      showToast.success('Event published');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  };

  const handleDuplicate = async (event: Event) => {
    const res = await eventsService.duplicateEvent(event.event_id);
    if ((res as any).success === false) {
      showToast.apiError((res as any).error);
    } else {
      showToast.success('Event duplicated');
      queryClient.invalidateQueries({ queryKey: ['events'] });
    }
  };

  // ── Table Columns ───────────────────────────────────────────────────────────

  const columns: ColumnDef<Event, any>[] = [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Event',
      cell: ({ row }) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-gray-900 dark:text-white truncate">{row.original.title}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {row.original.location || 'No location'}
          </p>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <div className="min-w-[100px]">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{formatDate(row.original.start_date)}</span>
          {!row.original.all_day && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              {formatTime(row.original.start_date)}{row.original.end_date ? ` – ${formatTime(row.original.end_date)}` : ''}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'type',
      accessorKey: 'event_type',
      header: 'Type',
      cell: ({ row }) => (
        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border capitalize ${eventTypeColor(row.original.event_type)}`}>
          {eventTypeLabel(row.original.event_type)}
        </span>
      ),
    },
    {
      id: 'visibility',
      accessorKey: 'visibility',
      header: 'Visibility',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{row.original.visibility}</span>
      ),
    },
    {
      id: 'registrations',
      header: 'Registrations',
      cell: ({ row }) => {
        const count = Number(row.original.registrations_count ?? 0);
        const cap = row.original.capacity;
        return (
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {count}{cap ? ` / ${cap}` : ''}
          </span>
        );
      },
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} showDot />,
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <MainLayout>
      <PageShell
        title="School Events"
        subtitle="Create and manage school events, ceremonies, and activities"
        breadcrumbs={[{ label: 'School Events' }]}
        actions={
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Toggle */}
            <div className="flex items-center border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
                title="Table View"
              >
                <List size={18} />
              </button>
            </div>

            <RoleGuard roles={['principal', 'super_admin', 'teacher']}>
              <Button variant="default" size="sm" onClick={() => { setEditingEvent(null); setFormOpen(true); }} className="whitespace-nowrap shadow-sm hover:shadow">
                + Create Event
              </Button>
            </RoleGuard>
          </div>
        }
      >
        {/* KPI Row */}
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

        {/* ── Search & Filter Action Bar ── */}
        <div className="flex flex-col gap-3 sm:gap-4 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Bar — shared component */}
            <SearchBar
              placeholder="Search event title, location..."
              onSearch={(v) => { setSearch(v); setPage(1); }}
              isLoading={isLoading}
              resultCount={search ? events.length : undefined}
              className="w-full lg:max-w-md"
            />

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 sm:gap-2.5 w-full lg:w-auto">
              <div className="relative flex-1 sm:flex-initial sm:min-w-[130px]">
                <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all">
                  <option value="">All Types</option>
                  <option value="single">Single Day</option>
                  <option value="multi_day">Multi-Day</option>
                  <option value="recurring">Recurring</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
              <div className="relative flex-1 sm:flex-initial sm:min-w-[130px]">
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="w-full appearance-none pl-3 pr-8 py-2.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all">
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

          {/* Active Filter Badges */}
          {(search || typeFilter || statusFilter) && (
            <div className="flex flex-wrap items-center gap-2 pt-1 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-450 dark:text-gray-500 flex items-center gap-1 mr-1">
                <SlidersHorizontal size={10} /> Active Filters:
              </span>
              {search && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 text-xs font-semibold border border-primary-200/30">
                  "{search}" <button onClick={() => { setSearch(''); setPage(1); }} className="hover:text-primary-900 dark:hover:text-primary-200"><X size={12} /></button>
                </span>
              )}
              {typeFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 text-xs font-semibold border border-blue-200/30 capitalize">
                  {eventTypeLabel(typeFilter)} <button onClick={() => { setTypeFilter(''); setPage(1); }} className="hover:text-blue-900 dark:hover:text-blue-200"><X size={12} /></button>
                </span>
              )}
              {statusFilter && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold border border-emerald-200/30 capitalize">
                  {statusFilter} <button onClick={() => { setStatusFilter(''); setPage(1); }} className="hover:text-emerald-900 dark:hover:text-emerald-200"><X size={12} /></button>
                </span>
              )}
              <button onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setPage(1); }} className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 font-bold ml-auto transition-colors">
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* ── Content: Grid or Table ── */}
        {viewMode === 'grid' ? (
          isLoading && !data ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Calendar size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">No events found</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">Try adjusting your filters or create a new event.</p>
              <RoleGuard roles={['principal', 'super_admin', 'teacher']}>
                <Button onClick={() => { setEditingEvent(null); setFormOpen(true); }}>Create your first event</Button>
              </RoleGuard>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {events.map((evt) => {
                const isUpcoming = new Date(evt.start_date) > new Date();
                return (
                  <div
                    key={evt.event_id}
                    className="group relative overflow-hidden bg-white dark:bg-gray-800 border border-gray-200/60 dark:border-gray-700/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1 mr-2">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white leading-snug truncate group-hover:text-primary dark:group-hover:text-primary transition-colors">
                          {evt.title}
                        </h3>
                        <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${eventTypeColor(evt.event_type)}`}>
                          {eventTypeLabel(evt.event_type)}
                        </span>
                      </div>
                      <StatusBadge status={evt.status} showDot />
                    </div>

                    {/* Details */}
                    <div className="space-y-2 mb-4 text-xs text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-blue-500/80 dark:text-blue-400/80 flex-shrink-0" />
                        <span className="font-semibold text-gray-700 dark:text-gray-300">{formatDate(evt.start_date)}</span>
                        {!evt.all_day && <span className="text-gray-400">{formatTime(evt.start_date)}</span>}
                      </div>
                      {evt.location && (
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-green-500/80 dark:text-green-400/80 flex-shrink-0" />
                          <span className="truncate">{evt.location}</span>
                        </div>
                      )}
                      {evt.capacity && (
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-purple-500/80 dark:text-purple-400/80 flex-shrink-0" />
                          <span>{Number(evt.registrations_count ?? 0)} / {evt.capacity} registered</span>
                        </div>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-700/50 pt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/events/school/${evt.event_id}`)}
                        className="h-8 text-xs font-bold px-2.5 rounded-lg text-primary hover:text-primary dark:text-primary hover:bg-primary-50 dark:hover:bg-primary-950/20"
                      >
                        <Eye size={14} className="mr-1" /> View
                      </Button>

                      <RoleGuard roles={['principal', 'super_admin']}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditingEvent(evt); setFormOpen(true); }}
                          className="h-8 p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Edit Event"
                        >
                          <Edit size={16} />
                        </Button>
                        {evt.status !== 'cancelled' && evt.status !== 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCancelTarget(evt)}
                            className="h-8 p-1.5 rounded-lg text-red-500 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                            title="Cancel Event"
                          >
                            <XCircle size={16} />
                          </Button>
                        )}
                      </RoleGuard>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <DataTable
            columns={columns}
            data={events}
            isLoading={isLoading}
            error={error ? String(error) : null}
            onRetry={refetch}
            paginationMode="server"
            pageIndex={page}
            pageSize={pageSize}
            totalRows={pagination.total}
            onPageChange={setPage}
            emptyMessage="No events found"
            emptyAction={{ label: 'Create your first event', onClick: () => { setEditingEvent(null); setFormOpen(true); } }}
            rowActions={(evt) => [
              {
                label: 'View Details',
                onClick: (row) => navigate(`/events/school/${row.event_id}`),
              },
              {
                label: 'Edit',
                onClick: (row) => { setEditingEvent(row); setFormOpen(true); },
              },
              ...(evt.status === 'draft' ? [{
                label: 'Publish',
                onClick: (row: Event) => handlePublish(row),
              }] : []),
              {
                label: 'Duplicate',
                onClick: (row) => handleDuplicate(row),
              },
              ...(evt.status !== 'cancelled' && evt.status !== 'completed' ? [{
                label: 'Cancel',
                variant: 'destructive' as const,
                onClick: (row: Event) => setCancelTarget(row),
              }] : []),
              {
                label: 'Delete',
                variant: 'destructive' as const,
                onClick: (row: Event) => setDeleteTarget(row),
              },
            ]}
          />
        )}
      </PageShell>

      {/* ── Create / Edit Modal ── */}
      <EventFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingEvent(null); }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['events'] })}
        editingEvent={editingEvent}
      />

      {/* ── Cancel Confirmation ── */}
      <ConfirmationDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelEvent}
        title="Cancel Event"
        message={`Are you sure you want to cancel "${cancelTarget?.title}"? Participants will be notified of the cancellation.`}
        confirmLabel="Cancel Event"
      />

      {/* ── Delete Confirmation ── */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteEvent}
        title="Delete Event Permanently"
        message={`Are you sure you want to permanently delete "${deleteTarget?.title}"? This cannot be undone. Events with registrations may not be deletable.`}
        confirmLabel="Delete Permanently"
      />
    </MainLayout>
  );
};

export default EventsPage;
