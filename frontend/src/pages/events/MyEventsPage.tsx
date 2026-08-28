/**
 * MyEventsPage — /events/my-events
 * Shows events the current user is registered for.
 * Uses GET /user/registrations which returns each registration joined with its event.
 * Follows admin page pattern: KPIs, tabs, card grid, dark mode, proper service.
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Clock, MapPin, CheckCircle,
  CalendarCheck, LayoutGrid, List,
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
import { ColumnDef } from '@tanstack/react-table';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Shape returned by GET /user/registrations
 * Each row is an event_registration joined with the parent event's fields.
 */
interface MyRegistration {
  registration_id: string;
  event_id: string;
  user_id: string;
  status: string;
  rsvp_status?: string;
  guests_count: number;
  attendance_status?: string;
  created_at: string;
  updated_at: string;
  // joined event columns
  title: string;
  start_date: string;
  end_date: string;
  location?: string;
  event_status: string;
  event_type?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
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

function rsvpLabel(s?: string): string {
  switch (s) {
    case 'going': return 'Going';
    case 'maybe': return 'Maybe';
    case 'not_going': return 'Not Going';
    default: return '—';
  }
}

function rsvpColor(s?: string): string {
  switch (s) {
    case 'going':     return 'text-green-600 dark:text-green-400';
    case 'maybe':     return 'text-amber-600 dark:text-amber-400';
    case 'not_going': return 'text-red-600 dark:text-red-400';
    default:          return 'text-gray-500 dark:text-gray-400';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MyEventsPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');

  // ── Fetch user's own registrations ──────────────────────────────────────────
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-registrations'],
    queryFn: () => eventsService.getMyRegistrations(),
    staleTime: 30_000,
  });

  const allRegistrations: MyRegistration[] = useMemo(() => {
    if (!data) return [];
    // Shape: { success, data: [...] }
    if (Array.isArray((data as any)?.data)) return (data as any).data as MyRegistration[];
    if (Array.isArray(data)) return data as MyRegistration[];
    return [];
  }, [data]);

  // ── Derived state ───────────────────────────────────────────────────────────
  const { upcoming, past, filtered, stats } = useMemo(() => {
    const up = allRegistrations.filter((r) => isUpcoming(r.start_date));
    const pa = allRegistrations.filter((r) => !isUpcoming(r.start_date));

    let base: MyRegistration[];
    if (tab === 'upcoming') base = up;
    else if (tab === 'past') base = pa;
    else base = allRegistrations;

    const filt = search
      ? base.filter(
          (r) =>
            r.title.toLowerCase().includes(search.toLowerCase()) ||
            (r.location || '').toLowerCase().includes(search.toLowerCase()),
        )
      : base;

    return {
      upcoming: up,
      past: pa,
      filtered: filt,
      stats: {
        total: allRegistrations.length,
        upcoming: up.length,
        past: pa.length,
        confirmed: allRegistrations.filter((r) => r.status === 'confirmed').length,
      },
    };
  }, [allRegistrations, tab, search]);

  // ── Table Columns ───────────────────────────────────────────────────────────
  const columns: ColumnDef<MyRegistration, any>[] = [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Event',
      cell: ({ row }) => (
        <div className="min-w-[160px]">
          <p className="font-medium text-gray-900 dark:text-white truncate">{row.original.title}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 capitalize">{row.original.event_type || '—'}</p>
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
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
            {formatTime(row.original.start_date)}
          </p>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
          {row.original.location || '—'}
        </span>
      ),
    },
    {
      id: 'rsvp',
      header: 'RSVP',
      cell: ({ row }) => (
        <span className={`text-xs font-semibold ${rsvpColor(row.original.rsvp_status)}`}>
          {rsvpLabel(row.original.rsvp_status)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Registration',
      cell: ({ row }) => <StatusBadge status={row.original.status} showDot />,
    },
    {
      id: 'event_status',
      header: 'Event',
      cell: ({ row }) => <StatusBadge status={row.original.event_status} showDot />,
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <PageShell
        title="My Events"
        subtitle="Events you are registered for"
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
              <KPICard title="Registered" value={stats.total} icon={<div className="p-2 rounded-xl bg-blue-500 text-white shadow-sm flex items-center justify-center"><Calendar size={20} /></div>} color="blue" />
              <KPICard title="Upcoming" value={stats.upcoming} icon={<div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm flex items-center justify-center"><Clock size={20} /></div>} color="amber" />
              <KPICard title="Attended" value={stats.past} icon={<div className="p-2 rounded-xl bg-green-500 text-white shadow-sm flex items-center justify-center"><CheckCircle size={20} /></div>} color="green" />
              <KPICard title="Confirmed" value={stats.confirmed} icon={<div className="p-2 rounded-xl bg-purple-500 text-white shadow-sm flex items-center justify-center"><CalendarCheck size={20} /></div>} color="purple" />
            </>
          )}
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Tabs */}
            <div className="flex gap-1">
              {([
                { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
                { key: 'past',     label: 'Past',     count: past.length },
                { key: 'all',      label: 'All',      count: allRegistrations.length },
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
            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SkeletonCard /><SkeletonCard /><SkeletonCard />
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <EmptyState
                message={
                  search
                    ? 'No matching events'
                    : tab === 'upcoming'
                    ? 'No upcoming registrations'
                    : tab === 'past'
                    ? 'No past events'
                    : 'No registrations yet'
                }
                description={
                  search
                    ? 'Try a different search term'
                    : 'Events you register for will appear here'
                }
              />
            )}

            {!isLoading && filtered.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((reg) => {
                  const upcoming = isUpcoming(reg.start_date);
                  return (
                    <div
                      key={reg.registration_id}
                      onClick={() => navigate(`/events/school/${reg.event_id}`)}
                      className="group rounded-xl border-l-4 border-blue-400 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer hover:-translate-y-0.5"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                          {reg.title}
                        </h3>
                        <StatusBadge status={reg.event_status} showDot />
                      </div>

                      {/* Details */}
                      <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span className="font-medium text-gray-700 dark:text-gray-300">{formatDate(reg.start_date)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span>{formatTime(reg.start_date)}</span>
                        </div>
                        {reg.location && (
                          <div className="flex items-center gap-2">
                            <MapPin size={13} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                            <span className="truncate">{reg.location}</span>
                          </div>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 flex items-center justify-between">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${rsvpColor(reg.rsvp_status)}`}>
                          {rsvpLabel(reg.rsvp_status)}
                        </span>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={reg.status} showDot />
                          {upcoming && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/30">
                              Upcoming
                            </span>
                          )}
                        </div>
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
            emptyMessage={tab === 'upcoming' ? 'No upcoming registrations' : 'No registrations found'}
            rowActions={(reg) => [
              {
                label: 'View Event',
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
