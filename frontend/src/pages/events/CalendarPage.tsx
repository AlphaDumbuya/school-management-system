/**
 * CalendarPage — /events/calendar
 * Production-ready monthly calendar view following admin page pattern.
 * Principals/admins can create events directly from the calendar.
 * Uses eventsService, dark mode, proper types, responsive design.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Eye, Plus } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { SkeletonCard } from '@components/admin/feedback/Skeleton';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { eventsService } from '@services/eventsService';
import { EventFormModal } from './components/EventFormModal';
import type { Event } from '@appTypes/events';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-blue-500',
  draft: 'bg-gray-400',
  cancelled: 'bg-red-500',
  completed: 'bg-green-500',
};

const TYPE_COLORS: Record<string, string> = {
  single: 'bg-blue-500',
  multi_day: 'bg-purple-500',
  recurring: 'bg-amber-500',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CalendarPage: React.FC = () => {
  const today = new Date();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // Event form modal state
  const [formOpen, setFormOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  // ── Fetch events for current month ──────────────────────────────────────────
  // Use the purpose-built calendar endpoint: it returns only published events,
  // applies visibility rules (public + the user's own registrations), and
  // correctly includes multi-day events that span into the month. Boundaries
  // cover the full first/last day so time-of-day components aren't excluded.
  const startDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01T00:00:00`;
  const lastDay = getDaysInMonth(currentYear, currentMonth);
  const endDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['calendar-events', currentYear, currentMonth],
    queryFn: () => eventsService.getCalendarEvents({
      start_date: startDate,
      end_date: endDate,
    }),
    staleTime: 60_000,
  });

  const events: Event[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray((data as any)?.data)) return (data as any).data;
    if (Array.isArray(data)) return data as Event[];
    return [];
  }, [data]);

  // ── Group events by date ────────────────────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const map: Record<number, Event[]> = {};
    events.forEach((e) => {
      const d = new Date(e.start_date).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(e);
    });
    return map;
  }, [events]);

  // Calendar grid info
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  // ── Navigation ──────────────────────────────────────────────────────────────
  const prevMonth = useCallback(() => {
    setSelectedDay(null);
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  }, [currentMonth, currentYear]);

  const nextMonth = useCallback(() => {
    setSelectedDay(null);
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  }, [currentMonth, currentYear]);

  const goToday = useCallback(() => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDay(today.getDate());
  }, []);

  // Selected day events
  const selectedDayEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];

  // Create event from a specific day
  const handleCreateFromDay = useCallback((day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setPrefillDate(dateStr);
    setFormOpen(true);
  }, [currentYear, currentMonth]);

  return (
    <MainLayout>
      <PageShell
        title="School Calendar"
        subtitle="Monthly view of all school events and activities"
        breadcrumbs={[{ label: 'Events', href: '/events/school' }, { label: 'Calendar' }]}
        onRefresh={() => refetch()}
        isRefreshing={isLoading}
        actions={
          <RoleGuard roles={['principal', 'super_admin', 'teacher']}>
            <Button variant="default" size="sm" onClick={() => { setPrefillDate(null); setFormOpen(true); }} className="whitespace-nowrap shadow-sm hover:shadow">
              <Plus size={16} className="mr-1" /> Create Event
            </Button>
          </RoleGuard>
        }
      >
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors" title="Previous month">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white min-w-[200px] text-center">
              {MONTHS[currentMonth]} {currentYear}
            </h2>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors" title="Next month">
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Calendar Grid */}
          <div className="flex-1">
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
              {/* Day headers */}
              <div className="grid grid-cols-7 bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6] border-b border-blue-700">
                {DAYS.map((day) => (
                  <div key={day} className="px-1 sm:px-3 py-3 text-center text-[10px] sm:text-xs font-bold text-white uppercase tracking-wide">
                    {day}
                  </div>
                ))}
              </div>

              {/* Date cells */}
              <div className="grid grid-cols-7">
                {/* Empty cells before first day */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[60px] sm:min-h-[90px] border-b border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-850/30" />
                ))}

                {/* Date cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                  const isSelected = day === selectedDay;
                  const dayEvents = eventsByDate[day] || [];
                  const hasEvents = dayEvents.length > 0;

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                      className={`min-h-[60px] sm:min-h-[90px] p-1 sm:p-1.5 border-b border-r border-gray-100 dark:border-gray-800 transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/30 ring-1 ring-inset ring-blue-300 dark:ring-blue-700'
                          : isToday
                            ? 'bg-blue-50/50 dark:bg-blue-950/10'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      {/* Date number */}
                      <span className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-[10px] sm:text-xs font-bold rounded-full transition-colors ${
                        isToday
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {day}
                      </span>

                      {/* Event indicators */}
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 2).map((e) => (
                          <div
                            key={e.event_id}
                            className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] sm:text-[10px] font-medium truncate bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                            title={e.title}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_COLORS[e.status] || TYPE_COLORS[e.event_type] || 'bg-gray-400'}`} />
                            <span className="truncate">{e.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold px-1">
                            +{dayEvents.length - 2} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 text-[10px] sm:text-xs">
              <span className="text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Status:</span>
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                  <span className="text-gray-600 dark:text-gray-400 capitalize">{status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Day Detail Panel */}
          <div className="lg:w-[320px] xl:w-[360px] flex-shrink-0">
            <div className="sticky top-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                  {selectedDay
                    ? `${MONTHS[currentMonth]} ${selectedDay}, ${currentYear}`
                    : 'Select a day'
                  }
                </h3>
                {selectedDay && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

              <div className="p-3 max-h-[400px] overflow-y-auto">
                {!selectedDay && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-8">
                    Click a day on the calendar to see its events
                  </p>
                )}

                {selectedDay && selectedDayEvents.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      No events on this day
                    </p>
                    <RoleGuard roles={['principal', 'super_admin', 'teacher']}>
                      <Button variant="outline" size="sm" onClick={() => handleCreateFromDay(selectedDay)} className="text-xs">
                        <Plus size={14} className="mr-1" /> Add Event Here
                      </Button>
                    </RoleGuard>
                  </div>
                )}

                {selectedDay && selectedDayEvents.length > 0 && (
                  <div className="space-y-2.5">
                    {selectedDayEvents.map((evt) => (
                      <div
                        key={evt.event_id}
                        className="group p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/30 dark:hover:bg-blue-950/10 transition-all cursor-pointer"
                        onClick={() => navigate(`/events/school/${evt.event_id}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">
                            {evt.title}
                          </h4>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${STATUS_COLORS[evt.status] || 'bg-gray-400'}`} />
                        </div>
                        <div className="mt-1.5 space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                          {!evt.all_day && (
                            <div className="flex items-center gap-1.5">
                              <Clock size={11} className="flex-shrink-0" />
                              <span>{formatTime(evt.start_date)}{evt.end_date ? ` – ${formatTime(evt.end_date)}` : ''}</span>
                            </div>
                          )}
                          {evt.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin size={11} className="flex-shrink-0" />
                              <span className="truncate">{evt.location}</span>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${
                            evt.status === 'published' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                            evt.status === 'completed' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                            evt.status === 'cancelled' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                            'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                          }`}>
                            {evt.status}
                          </span>
                          <Eye size={12} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                      </div>
                    ))}

                    {/* Add event button after event list */}
                    <RoleGuard roles={['principal', 'super_admin', 'teacher']}>
                      <button
                        onClick={() => handleCreateFromDay(selectedDay!)}
                        className="w-full mt-2 p-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all flex items-center justify-center gap-1"
                      >
                        <Plus size={13} /> Add event on this day
                      </button>
                    </RoleGuard>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageShell>

      {/* Create Event Modal */}
      <EventFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setPrefillDate(null); }}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['calendar-events'] })}
        editingEvent={null}
        prefillDate={prefillDate}
      />
    </MainLayout>
  );
};

export default CalendarPage;
