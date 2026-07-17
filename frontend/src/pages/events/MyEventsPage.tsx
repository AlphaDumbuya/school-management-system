/**
 * MyEventsPage — /events/my-events
 * Production-ready page showing events the user registered for or organized.
 * Follows admin page pattern: KPIs, tabs, card grid, dark mode, proper service.
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, Users, CheckCircle, XCircle,
  CalendarCheck, LayoutGrid, List, X,
} from 'lucide-react';
import { SearchBar } from '@components/admin/table/SearchBar';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { EmptyState } from '@components/admin/feedback/EmptyState';
import { DataTable } from '@components/admin/table/DataTable';
import { Button } from '@components/ui/button';
import { eventsService } from '@services/eventsService';
import type { Event } from '@appTypes/events';
import { ColumnDef } from '@tanstack/react-table';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function isUpcoming(dateStr: string): boolean {
  return new Date(dateStr) >= new Date();
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
    case 'single': return 'border-blue-400 bg-blue-50 dark:bg-blue-950/20';
    case 'multi_day': return 'border-purple-400 bg-purple-50 dark:bg-purple-950/20';
    case 'recurring': return 'border-amber-400 bg-amber-50 dark:bg-amber-950/20';
    default: return 'border-gray-400 bg-gray-50 dark:bg-gray-800/50';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MyEventsPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');

  // ── Fetch Events ────────────────────────────────────────────────────────────
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-events'],
    queryFn: () => eventsService.listEvents({ limit: 100 }),
    staleTime: 30_000,
  });

  const allEvents: Event[] = (data as any)?.data ?? [];

  // ── Derived state ───────────────────────────────────────────────────────────
  const { upcoming, past, filtered, stats } = useMemo(() => {
    const up = allEvents.filter((e) => isUpcoming(e.start_date));
    const pa = allEvents.filter((e) => !isUpcoming(e.start_date));

    let base: Event[];
    if (tab === 'upcoming') base = up;
    else if (tab === 'past') base = pa;
    else base = allEvents;

    const filt = search
      ? base.filter((e) =>
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          (e.location || '').toLowerCase().includes(search.toLowerCase())
        )
      : base;

    return {
      upcoming: up,
      past: pa,
      filtered: filt,
      stats: {
        total: allEvents.length,
        upcoming: up.length,
        past: pa.length,
        published: allEvents.filter((e) => e.status === 'published').length,
      },
    };
  }, [allEvents, tab, search]);

  // ── Table Columns ───────────────────────────────────────────────────────────
  const columns: ColumnDef<Event, any>[] = [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Event',
      cell: ({ row }) => (
        <div className="min-w-[160px]">
          <p className="font-medium text-gray-900 dark:text-white truncate">{row.original.title}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 capitalize">{eventTypeLabel(row.original.event_type)}</p>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <div className="min-w-[110px]">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            {formatDate(row.original.start_date)}
          </span>
          {!row.original.all_day && (
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{formatTime(row.original.start_date)}</p>
          )}
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{row.original.location || '—'}</span>
      ),
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
        title="My Events"
        subtitle="Events you're registered for or organizing"
        breadcrumbs={[{ label: 'Events', href: '/events/school' }, { label: 'My Events' }]}
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
          </div>
        }
      >
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          {isLoading ? (
            <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
          ) : (
            <>
              <KPICard title="Total Events" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><Calendar size={20} /></div>} color="blue" />
              <KPICard title="Upcoming" value={stats.upcoming} icon={<div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center"><Clock size={20} /></div>} color="amber" />
              <KPICard title="Completed" value={stats.past} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><CheckCircle size={20} /></div>} color="green" />
              <KPICard title="Published" value={stats.published} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><CalendarCheck size={20} /></div>} color="purple" />
            </>
          )}
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 sm:border-0">
              {([
                { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
                { key: 'past', label: 'Past', count: past.length },
                { key: 'all', label: 'All', count: allEvents.length },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    tab === t.key
                      ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/30'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {t.label} <span className="ml-1 text-[10px] font-bold opacity-70">({t.count})</span>
                </button>
              ))}
            </div>

            {/* Search Bar — shared component */}
            <SearchBar
              placeholder="Search events..."
              onSearch={setSearch}
              className="w-full sm:max-w-[280px]"
            />
          </div>
        </div>

        {/* Content */}
        {viewMode === 'grid' ? (
          <>
            {/* Loading */}
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </div>
            )}

            {/* Empty */}
            {!isLoading && filtered.length === 0 && (
              <EmptyState
                message={search ? 'No matching events' : tab === 'upcoming' ? 'No upcoming events' : tab === 'past' ? 'No past events' : 'No events found'}
                description={search ? 'Try a different search term' : 'Events you register for will appear here'}
              />
            )}

            {/* Event Cards */}
            {!isLoading && filtered.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((event) => {
                  const typeColor = eventTypeColor(event.event_type);
                  const upcoming = isUpcoming(event.start_date);

                  return (
                    <div
                      key={event.event_id}
                      onClick={() => navigate(`/events/school/${event.event_id}`)}
                      className={`group rounded-xl border-l-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5 ${typeColor.split(' ')[0]}`}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                          {event.title}
                        </h3>
                        <StatusBadge status={event.status} showDot />
                      </div>

                      {/* Details */}
                      <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">{formatDate(event.start_date)}</span>
                        </div>
                        {!event.all_day && (
                          <div className="flex items-center gap-2">
                            <Clock size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                            <span>{formatTime(event.start_date)}{event.end_date ? ` – ${formatTime(event.end_date)}` : ''}</span>
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-2">
                            <MapPin size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 capitalize">
                          {eventTypeLabel(event.event_type)}
                        </span>
                        {upcoming && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                            Upcoming
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            isLoading={isLoading}
            error={error ? String(error) : null}
            onRetry={refetch}
            emptyMessage={tab === 'upcoming' ? 'No upcoming events' : 'No events found'}
            rowActions={(evt) => [
              {
                label: 'View Details',
                onClick: (row) => navigate(`/events/school/${row.event_id}`),
              },
            ]}
          />
        )}
      </PageShell>
    </MainLayout>
  );
};

export default MyEventsPage;
