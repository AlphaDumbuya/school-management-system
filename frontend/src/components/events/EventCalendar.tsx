/**
 * EventCalendar Component
 * Calendar view with month/week/day views
 * Task 5.5
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@components/ui/button';
import { EventCalendarProps, Event, CalendarView, CalendarFilters } from '@types/events';
import { eventsService } from '@services/eventsService';
import { toast } from 'react-toastify';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    addMonths,
    subMonths,
    isSameMonth,
    isSameDay,
    isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

export const EventCalendar: React.FC<EventCalendarProps> = ({
    filters: initialFilters,
    defaultView = 'month',
    onEventClick,
    onDateClick,
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState<CalendarView>(defaultView);
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCalendarEvents();
    }, [currentDate, view]);

    const fetchCalendarEvents = async () => {
        setLoading(true);

        let startDate: Date;
        let endDate: Date;

        if (view === 'month') {
            startDate = startOfWeek(startOfMonth(currentDate));
            endDate = endOfWeek(endOfMonth(currentDate));
        } else if (view === 'week') {
            startDate = startOfWeek(currentDate);
            endDate = endOfWeek(currentDate);
        } else {
            // day view
            startDate = currentDate;
            endDate = currentDate;
        }

        const filters: CalendarFilters = {
            start_date: format(startDate, 'yyyy-MM-dd'),
            end_date: format(endDate, 'yyyy-MM-dd'),
            view,
            ...initialFilters,
        };

        try {
            const response = await eventsService.getCalendarEvents(filters);
            if (response.success && response.data) {
                setEvents(response.data);
            } else {
                toast.error('Failed to load calendar events');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to load calendar events');
        } finally {
            setLoading(false);
        }
    };

    const handlePrevious = () => {
        if (view === 'month') {
            setCurrentDate(subMonths(currentDate, 1));
        } else if (view === 'week') {
            setCurrentDate(addDays(currentDate, -7));
        } else {
            setCurrentDate(addDays(currentDate, -1));
        }
    };

    const handleNext = () => {
        if (view === 'month') {
            setCurrentDate(addMonths(currentDate, 1));
        } else if (view === 'week') {
            setCurrentDate(addDays(currentDate, 7));
        } else {
            setCurrentDate(addDays(currentDate, 1));
        }
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const getEventsForDate = (date: Date): Event[] => {
        return events.filter((event) => {
            const eventStart = new Date(event.start_date);
            const eventEnd = new Date(event.end_date);
            return date >= eventStart && date <= eventEnd;
        });
    };

    const renderMonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                const currentDay = day;
                const dayEvents = getEventsForDate(currentDay);
                const isCurrentMonth = isSameMonth(currentDay, monthStart);
                const isCurrentDay = isToday(currentDay);

                days.push(
                    <div
                        key={day.toString()}
                        className={`
              min-h-[120px] border border-gray-200 p-2 cursor-pointer transition-colors
              ${isCurrentMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}
              ${isCurrentDay ? 'ring-2 ring-blue-500' : ''}
              hover:bg-gray-100 dark:hover:bg-gray-700
            `}
                        onClick={() => onDateClick?.(currentDay)}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span
                                className={`
                  text-sm font-medium
                  ${isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                  ${isCurrentDay ? 'text-blue-600 font-bold' : ''}
                `}
                            >
                                {format(currentDay, 'd')}
                            </span>
                            {dayEvents.length > 0 && (
                                <span className="text-xs text-gray-500">
                                    {dayEvents.length}
                                </span>
                            )}
                        </div>

                        <div className="space-y-1">
                            {dayEvents.slice(0, 3).map((event) => (
                                <div
                                    key={event.event_id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEventClick?.(event);
                                    }}
                                    className="text-xs p-1 rounded truncate cursor-pointer hover:opacity-80"
                                    style={{
                                        backgroundColor:
                                            event.categories?.[0]?.color || '#3B82F6',
                                        color: '#FFFFFF',
                                    }}
                                >
                                    {format(new Date(event.start_date), 'h:mm a')} {event.title}
                                </div>
                            ))}
                            {dayEvents.length > 3 && (
                                <div className="text-xs text-gray-500 pl-1">
                                    +{dayEvents.length - 3} more
                                </div>
                            )}
                        </div>
                    </div>
                );
                day = addDays(day, 1);
            }

            rows.push(
                <div key={day.toString()} className="grid grid-cols-7">
                    {days}
                </div>
            );
            days = [];
        }

        return rows;
    };

    const renderWeekView = () => {
        const startDate = startOfWeek(currentDate);
        const days = [];

        for (let i = 0; i < 7; i++) {
            const day = addDays(startDate, i);
            const dayEvents = getEventsForDate(day);
            const isCurrentDay = isToday(day);

            days.push(
                <div key={i} className="border-r border-gray-200 last:border-r-0">
                    <div
                        className={`
              text-center py-2 border-b border-gray-200 dark:border-gray-700
              ${isCurrentDay ? 'bg-gray-100 dark:bg-gray-700' : 'bg-gray-50 dark:bg-gray-800'}
            `}
                    >
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {format(day, 'EEE')}
                        </div>
                        <div
                            className={`
                text-2xl font-bold
                ${isCurrentDay ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}
              `}
                        >
                            {format(day, 'd')}
                        </div>
                    </div>

                    <div className="p-2 space-y-2 min-h-[400px]">
                        {dayEvents.map((event) => (
                            <div
                                key={event.event_id}
                                onClick={() => onEventClick?.(event)}
                                className="p-2 rounded-lg cursor-pointer hover:opacity-80"
                                style={{
                                    backgroundColor: event.categories?.[0]?.color || '#3B82F6',
                                    color: '#FFFFFF',
                                }}
                            >
                                <div className="font-medium text-sm">{event.title}</div>
                                <div className="text-xs mt-1">
                                    {format(new Date(event.start_date), 'h:mm a')}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        return <div className="grid grid-cols-7 border border-gray-200">{days}</div>;
    };

    const renderDayView = () => {
        const dayEvents = getEventsForDate(currentDate);

        return (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {format(currentDate, 'EEEE, MMMM d, yyyy')}
                    </h3>
                </div>

                <div className="p-4 space-y-3">
                    {dayEvents.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-8">No events for this day</p>
                    ) : (
                        dayEvents.map((event) => (
                            <div
                                key={event.event_id}
                                onClick={() => onEventClick?.(event)}
                                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className="w-1 h-full rounded"
                                        style={{
                                            backgroundColor: event.categories?.[0]?.color || '#3B82F6',
                                        }}
                                    />
                                    <div className="flex-1">
                                        <h4 className="font-semibold text-gray-900 dark:text-white">{event.title}</h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                            {format(new Date(event.start_date), 'h:mm a')} -{' '}
                                            {format(new Date(event.end_date), 'h:mm a')}
                                        </p>
                                        {event.location && (
                                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{event.location}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Calendar Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                        {view === 'month' && format(currentDate, 'MMMM yyyy')}
                        {view === 'week' &&
                            `${format(startOfWeek(currentDate), 'MMM d')} - ${format(
                                endOfWeek(currentDate),
                                'MMM d, yyyy'
                            )}`}
                        {view === 'day' && format(currentDate, 'MMMM d, yyyy')}
                    </h2>

                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrevious}>
                            <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleToday}>
                            Today
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleNext}>
                            <ChevronRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Switcher */}
                    <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                        {(['month', 'week', 'day'] as CalendarView[]).map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v)}
                                className={`
                  px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${view === v
                                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                    }
                `}
                            >
                                {v.charAt(0).toUpperCase() + v.slice(1)}
                            </button>
                        ))}
                    </div>

                    <Button onClick={() => onDateClick?.(new Date())}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Event
                    </Button>
                </div>
            </div>

            {/* Weekday Headers (for month view) */}
            {view === 'month' && (
                <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div
                            key={day}
                            className="text-center py-2 text-sm font-semibold text-gray-700 dark:text-gray-300"
                        >
                            {day}
                        </div>
                    ))}
                </div>
            )}

            {/* Calendar Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
                </div>
            ) : (
                <>
                    {view === 'month' && renderMonthView()}
                    {view === 'week' && renderWeekView()}
                    {view === 'day' && renderDayView()}
                </>
            )}
        </div>
    );
};

export default EventCalendar;
