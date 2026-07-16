/**
 * CalendarPage — /events/calendar
 * Monthly calendar view of school events.
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { Button } from '@components/ui/button';
import { apiClient } from '@lib/apiClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  event_id: string;
  title: string;
  event_type: string;
  start_date: string;
  end_date?: string;
  start_time?: string;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_COLORS: Record<string, string> = {
  academic: 'bg-blue-500',
  sports: 'bg-green-500',
  cultural: 'bg-purple-500',
  meeting: 'bg-amber-500',
  ceremony: 'bg-pink-500',
  holiday: 'bg-red-500',
  other: 'bg-gray-500',
};

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CalendarPage: React.FC = () => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // Fetch events for current month
  const { data, isLoading } = useQuery({
    queryKey: ['calendar-events', currentYear, currentMonth],
    queryFn: () => apiClient.get('/api/v1/events', {
      params: {
        start_date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`,
        end_date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${getDaysInMonth(currentYear, currentMonth)}`,
        limit: 100,
      },
    }),
    staleTime: 60_000,
  });

  const events: CalendarEvent[] = (data as any)?.data ?? [];

  // Group events by date
  const eventsByDate = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    events.forEach((e) => {
      const d = new Date(e.start_date).getDate();
      if (!map[d]) map[d] = [];
      map[d].push(e);
    });
    return map;
  }, [events]);

  // Calendar grid
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const goToday = () => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()); };

  return (
    <MainLayout>
      <PageShell
        title="School Calendar"
        subtitle="Monthly view of all school events and activities"
        breadcrumbs={[{ label: 'Calendar' }]}
      >
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white min-w-[180px] text-center">
              {MONTHS[currentMonth]} {currentYear}
            </h2>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>Today</Button>
        </div>

        {/* Calendar Grid */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-900">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {DAYS.map((day) => (
              <div key={day} className="px-1 sm:px-3 py-2 text-center text-[10px] sm:text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">
                {day}
              </div>
            ))}
          </div>

          {/* Date cells */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[60px] sm:min-h-[90px] border-b border-r border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30" />
            ))}

            {/* Date cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
              const dayEvents = eventsByDate[day] || [];

              return (
                <div
                  key={day}
                  className={`min-h-[60px] sm:min-h-[90px] p-1 sm:p-1.5 border-b border-r border-gray-100 dark:border-gray-800 transition-colors hover:bg-blue-50/30 dark:hover:bg-blue-950/10 ${
                    isToday ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                  }`}
                >
                  {/* Date number */}
                  <span className={`inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 text-[10px] sm:text-xs font-bold rounded-full ${
                    isToday
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {day}
                  </span>

                  {/* Events for this day */}
                  <div className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 2).map((e) => (
                      <div
                        key={e.event_id}
                        className="flex items-center gap-1 px-1 py-0.5 rounded text-[9px] sm:text-[10px] font-medium truncate bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                        title={e.title}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_COLORS[e.event_type] || TYPE_COLORS.other}`} />
                        <span className="truncate">{e.title}</span>
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <span className="text-[9px] text-blue-600 dark:text-blue-400 font-semibold px-1">+{dayEvents.length - 2} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 text-[10px] sm:text-xs">
          {Object.entries(TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-gray-600 dark:text-gray-400 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </PageShell>
    </MainLayout>
  );
};

export default CalendarPage;
