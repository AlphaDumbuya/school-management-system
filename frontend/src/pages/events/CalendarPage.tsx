/**
 * CalendarPage — /events/calendar
 * A real month calendar: 6-week grid (neighbouring-month days faded), today
 * highlighted, multi-day events drawn as bars spanning the days they cover,
 * "+N more" on busy days, a day panel, and an Agenda (list) view for phones.
 * Principals/admins/teachers can create events from any day.
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, MapPin, Plus, CalendarDays, List, Loader2 } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { RoleGuard } from '@components/admin/common/RoleGuard';
import { Button } from '@components/ui/button';
import { eventsService } from '@services/eventsService';
import { EventFormModal } from './components/EventFormModal';
import type { Event } from '@appTypes/events';

// ── Constants ─────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_LANES = 3; // event bars shown per day before "+N more"

// Colour by event type (the calendar only shows published events).
const TYPE_STYLE: Record<string, { bar: string; dot: string; label: string }> = {
  single: { bar: 'bg-blue-100 text-blue-800 border-l-blue-500 dark:bg-blue-900/40 dark:text-blue-200', dot: 'bg-blue-500', label: 'Single day' },
  multi_day: { bar: 'bg-violet-100 text-violet-800 border-l-violet-500 dark:bg-violet-900/40 dark:text-violet-200', dot: 'bg-violet-500', label: 'Multi-day' },
  recurring: { bar: 'bg-amber-100 text-amber-800 border-l-amber-500 dark:bg-amber-900/40 dark:text-amber-200', dot: 'bg-amber-500', label: 'Recurring' },
};
const styleFor = (e: Event) => TYPE_STYLE[e.event_type] ?? TYPE_STYLE.single;

// ── Date helpers (local time, day precision) ──────────────────────────────────

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const sameDay = (a: Date, b: Date) => dayKey(a) === dayKey(b);
const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);

/** First Monday on/before the 1st of the month → start of the 6-week grid. */
function gridStartFor(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  return addDays(first, -offset);
}

/** An event's first and last calendar day (end never before start). */
function eventSpan(e: Event): { start: Date; end: Date } {
  const start = startOfDay(new Date(e.start_date));
  const rawEnd = e.end_date ? startOfDay(new Date(e.end_date)) : start;
  return { start, end: rawEnd < start ? start : rawEnd };
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatRange(e: Event): string {
  const { start, end } = eventSpan(e);
  if (sameDay(start, end)) {
    return e.all_day ? 'All day' : `${formatTime(e.start_date)}${e.end_date ? ` – ${formatTime(e.end_date)}` : ''}`;
  }
  const f = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${f(start)} – ${f(end)}`;
}

interface Segment { event: Event; col: number; span: number; lane: number; startsHere: boolean; endsHere: boolean }

/** Lay out one week's events as bars: clip to the week, then stack into lanes. */
function layoutWeek(weekStart: Date, events: Event[]): Segment[] {
  const weekEnd = addDays(weekStart, 6);
  const segs = events
    .map((event) => {
      const { start, end } = eventSpan(event);
      if (end < weekStart || start > weekEnd) return null;
      const s = start < weekStart ? weekStart : start;
      const t = end > weekEnd ? weekEnd : end;
      return { event, col: dayDiff(weekStart, s), span: dayDiff(s, t) + 1, lane: 0, startsHere: start >= weekStart, endsHere: end <= weekEnd };
    })
    .filter(Boolean) as Segment[];
  // Longer bars first so they get the top lanes, then by start column.
  segs.sort((a, b) => a.col - b.col || b.span - a.span);
  const lanes: boolean[][] = [];
  for (const seg of segs) {
    let lane = 0;
    while (lanes[lane] && lanes[lane].slice(seg.col, seg.col + seg.span).some(Boolean)) lane++;
    lanes[lane] ??= Array(7).fill(false);
    for (let c = seg.col; c < seg.col + seg.span; c++) lanes[lane][c] = true;
    seg.lane = lane;
  }
  return segs;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CalendarPage: React.FC = () => {
  const today = useMemo(() => startOfDay(new Date()), []);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [selected, setSelected] = useState<string>(dayKey(today));
  const [view, setView] = useState<'month' | 'agenda'>('month');

  // Event form modal state
  const [formOpen, setFormOpen] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  // The 42 days shown (6 weeks), including faded days of the next/previous month.
  const gridStart = useMemo(() => gridStartFor(year, month), [year, month]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);
  const gridEnd = days[41];

  // Fetch everything visible in the grid (so faded days show their events too).
  // The calendar endpoint returns published events visible to this user and
  // includes multi-day events that overlap the range.
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['calendar-events', dayKey(gridStart), dayKey(gridEnd)],
    queryFn: () => eventsService.getCalendarEvents({
      start_date: `${dayKey(gridStart)}T00:00:00`,
      end_date: `${dayKey(gridEnd)}T23:59:59`,
    }),
    staleTime: 60_000,
  });

  const events: Event[] = useMemo(() => {
    const list = Array.isArray((data as any)?.data) ? (data as any).data : Array.isArray(data) ? (data as Event[]) : [];
    return [...list].sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  }, [data]);

  // Events on each day (multi-day events listed on every day they cover).
  const eventsByDay = useMemo(() => {
    const map: Record<string, Event[]> = {};
    for (const e of events) {
      const { start, end } = eventSpan(e);
      for (let d = start; d <= end && d <= gridEnd; d = addDays(d, 1)) {
        if (d < gridStart) continue;
        (map[dayKey(d)] ??= []).push(e);
      }
    }
    return map;
  }, [events, gridStart, gridEnd]);

  const weeks = useMemo(
    () => Array.from({ length: 6 }, (_, w) => ({ start: days[w * 7], days: days.slice(w * 7, w * 7 + 7), segs: layoutWeek(days[w * 7], events) })),
    [days, events],
  );

  // ── Navigation ──────────────────────────────────────────────────────────────
  const goMonth = useCallback((delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
    setSelected(dayKey(d));
  }, [year, month]);

  const goToday = useCallback(() => {
    setMonth(today.getMonth());
    setYear(today.getFullYear());
    setSelected(dayKey(today));
  }, [today]);

  const pickDay = (d: Date) => {
    setSelected(dayKey(d));
    // Clicking a faded day jumps to its month, like a real calendar.
    if (d.getMonth() !== month) { setMonth(d.getMonth()); setYear(d.getFullYear()); }
  };

  const selectedDate = useMemo(() => {
    const [y, m, d] = selected.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selected]);
  const selectedEvents = eventsByDay[selected] || [];

  const createOn = (key: string) => { setPrefillDate(key); setFormOpen(true); };
  const openEvent = (e: Event) => navigate(`/events/school/${e.event_id}`);

  // Agenda: this month's events, grouped by the day they start (or the 1st if
  // they began last month).
  const agenda = useMemo(() => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const groups = new Map<string, { date: Date; items: Event[] }>();
    for (const e of events) {
      const { start, end } = eventSpan(e);
      if (end < monthStart || start > monthEnd) continue;
      const anchor = start < monthStart ? monthStart : start;
      const k = dayKey(anchor);
      if (!groups.has(k)) groups.set(k, { date: anchor, items: [] });
      groups.get(k)!.items.push(e);
    }
    return [...groups.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, year, month]);

  const monthEventCount = useMemo(() => agenda.reduce((n, g) => n + g.items.length, 0), [agenda]);

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
            <Button variant="default" size="sm" onClick={() => createOn(selected)} className="whitespace-nowrap shadow-sm hover:shadow">
              <Plus size={16} className="mr-1" /> Create Event
            </Button>
          </RoleGuard>
        }
      >
        {/* ── Toolbar: month navigation + view switch ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
            <button onClick={() => goMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400" aria-label="Previous month">
              <ChevronLeft size={20} />
            </button>
            <button onClick={() => goMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400" aria-label="Next month">
              <ChevronRight size={20} />
            </button>
            <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white ml-1" aria-live="polite">
              {MONTHS[month]} {year}
            </h2>
            {isLoading && <Loader2 size={16} className="animate-spin text-gray-400 ml-1" aria-label="Loading events" />}
          </div>

          <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5" role="tablist" aria-label="Calendar view">
            {([['month', 'Month', CalendarDays], ['agenda', 'Agenda', List]] as const).map(([v, label, Icon]) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  view === v ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>

        {view === 'month' ? (
          <div className="flex flex-col xl:flex-row gap-5">
            {/* ── Month grid ── */}
            <div className="flex-1 min-w-0">
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
                {/* Weekday header */}
                <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  {WEEKDAYS.map((d, i) => (
                    <div key={d} className={`py-2 text-center text-[11px] sm:text-xs font-bold uppercase tracking-wide ${i >= 5 ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
                      <span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span>
                    </div>
                  ))}
                </div>

                {weeks.map((week) => {
                  // Per-day count of events hidden beyond MAX_LANES.
                  const hidden = Array(7).fill(0);
                  week.segs.forEach((s) => { if (s.lane >= MAX_LANES) for (let c = s.col; c < s.col + s.span; c++) hidden[c]++; });
                  return (
                    <div key={dayKey(week.start)} className="relative grid grid-cols-7 border-b last:border-b-0 border-gray-100 dark:border-gray-800">
                      {/* Day cells */}
                      {week.days.map((d, i) => {
                        const key = dayKey(d);
                        const inMonth = d.getMonth() === month;
                        const isToday = sameDay(d, today);
                        const isSelected = key === selected;
                        const count = (eventsByDay[key] || []).length;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => pickDay(d)}
                            onDoubleClick={() => createOn(key)}
                            aria-label={`${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, ${count} event${count === 1 ? '' : 's'}`}
                            aria-pressed={isSelected}
                            className={`min-h-[64px] sm:min-h-[132px] p-1 sm:p-1.5 text-left align-top border-r last:border-r-0 border-gray-100 dark:border-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                              isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : inMonth ? (i >= 5 ? 'bg-gray-50/40 dark:bg-gray-900' : 'bg-white dark:bg-gray-900') : 'bg-gray-50 dark:bg-gray-950/40'
                            } hover:bg-blue-50/60 dark:hover:bg-gray-800/60`}
                          >
                            <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 text-xs sm:text-sm font-semibold rounded-full ${
                              isToday ? 'bg-blue-600 text-white' : isSelected ? 'ring-2 ring-blue-500 text-blue-700 dark:text-blue-300' : inMonth ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-600'
                            }`}>
                              {d.getDate()}
                            </span>
                            {/* Phones: coloured dots instead of bars */}
                            {count > 0 && (
                              <div className="sm:hidden mt-1 flex flex-wrap gap-0.5 px-0.5">
                                {(eventsByDay[key] || []).slice(0, 3).map((e) => (
                                  <span key={e.event_id} className={`w-1.5 h-1.5 rounded-full ${styleFor(e).dot}`} />
                                ))}
                                {count > 3 && <span className="text-[9px] leading-none text-gray-500">+{count - 3}</span>}
                              </div>
                            )}
                          </button>
                        );
                      })}

                      {/* Event bars (tablet/desktop) — spans the days each event covers */}
                      <div className="hidden sm:grid absolute inset-x-0 top-9 grid-cols-7 gap-y-1 px-0.5 pointer-events-none" style={{ gridAutoRows: '20px' }}>
                        {week.segs.filter((s) => s.lane < MAX_LANES).map((s) => (
                          <button
                            key={`${s.event.event_id}-${s.col}`}
                            type="button"
                            onClick={() => openEvent(s.event)}
                            title={`${s.event.title} · ${formatRange(s.event)}`}
                            style={{ gridColumn: `${s.col + 1} / span ${s.span}`, gridRow: s.lane + 1 }}
                            className={`pointer-events-auto mx-0.5 px-1.5 text-[11px] font-semibold truncate text-left border-l-[3px] hover:brightness-95 ${styleFor(s.event).bar} ${
                              s.startsHere ? 'rounded-l' : 'rounded-l-none border-l-0 pl-2'
                            } ${s.endsHere ? 'rounded-r' : 'rounded-r-none'} ${s.event.status === 'cancelled' ? 'line-through opacity-60' : ''}`}
                          >
                            {!s.event.all_day && s.startsHere && s.span === 1 && <span className="font-normal opacity-75 mr-1">{formatTime(s.event.start_date)}</span>}
                            {s.event.title}
                          </button>
                        ))}
                        {hidden.map((n, c) => n > 0 && (
                          <button
                            key={`more-${c}`}
                            type="button"
                            onClick={() => pickDay(week.days[c])}
                            style={{ gridColumn: `${c + 1} / span 1`, gridRow: MAX_LANES + 1 }}
                            className="pointer-events-auto mx-0.5 px-1.5 text-[11px] font-bold text-left text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            +{n} more
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-600 dark:text-gray-400">
                {Object.values(TYPE_STYLE).map((t) => (
                  <span key={t.label} className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${t.dot}`} /> {t.label}</span>
                ))}
                <RoleGuard roles={['principal', 'super_admin', 'teacher']}>
                  <span className="hidden sm:inline text-gray-400">· Double-click a day to add an event</span>
                </RoleGuard>
              </div>
            </div>

            {/* ── Selected day panel ── */}
            <aside className="xl:w-[340px] flex-shrink-0">
              <div className="xl:sticky xl:top-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                  <div className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl ${sameDay(selectedDate, today) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 ring-1 ring-gray-200 dark:ring-gray-700 text-gray-900 dark:text-white'}`}>
                    <span className="text-[10px] font-bold uppercase leading-none opacity-80">{selectedDate.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                    <span className="text-lg font-black leading-tight">{selectedDate.getDate()}</span>
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                      {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedEvents.length} event{selectedEvents.length === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="p-3 max-h-[460px] overflow-y-auto space-y-2">
                  {selectedEvents.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-6">No events on this day.</p>
                  )}
                  {selectedEvents.map((e) => <EventItem key={e.event_id} event={e} onOpen={openEvent} />)}
                  <RoleGuard roles={['principal', 'super_admin', 'teacher']}>
                    <button
                      onClick={() => createOn(selected)}
                      className="w-full p-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 flex items-center justify-center gap-1"
                    >
                      <Plus size={13} /> Add event on this day
                    </button>
                  </RoleGuard>
                </div>
              </div>
            </aside>
          </div>
        ) : (
          /* ── Agenda view ── */
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 text-xs font-semibold text-gray-500">
              {monthEventCount} event{monthEventCount === 1 ? '' : 's'} in {MONTHS[month]}
            </div>
            {agenda.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">No events this month.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {agenda.map((g) => {
                  const isToday = sameDay(g.date, today);
                  return (
                    <li key={dayKey(g.date)} className="flex gap-3 sm:gap-4 px-3 sm:px-4 py-3">
                      <div className={`flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'}`}>
                        <span className="text-[10px] font-bold uppercase leading-none opacity-80">{g.date.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                        <span className="text-lg font-black leading-tight">{g.date.getDate()}</span>
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        {g.items.map((e) => <EventItem key={e.event_id} event={e} onOpen={openEvent} />)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
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

/** One event row (used in the day panel and the agenda). */
const EventItem: React.FC<{ event: Event; onOpen: (e: Event) => void }> = ({ event: e, onOpen }) => (
  <button
    type="button"
    onClick={() => onOpen(e)}
    className="group w-full text-left flex gap-2.5 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50/40 dark:hover:bg-blue-950/10 transition-colors"
  >
    <span className={`w-1 self-stretch rounded-full flex-shrink-0 ${styleFor(e).dot}`} />
    <span className="min-w-0 flex-1">
      <span className={`block text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate ${e.status === 'cancelled' ? 'line-through opacity-60' : ''}`}>
        {e.title}
      </span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1"><Clock size={11} /> {formatRange(e)}</span>
        {e.location && <span className="flex items-center gap-1 min-w-0"><MapPin size={11} /> <span className="truncate">{e.location}</span></span>}
      </span>
    </span>
  </button>
);

export default CalendarPage;
