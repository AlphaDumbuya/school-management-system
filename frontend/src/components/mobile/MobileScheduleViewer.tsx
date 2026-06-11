/**
 * Mobile Schedule Viewer - Phase 20
 * Touch-friendly schedule display with day/week views
 * Shows classes, timing, and room information
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Clock, MapPin, User, ChevronLeft, ChevronRight } from 'lucide-react';

interface ScheduleEntry {
  id: string;
  subject: string;
  teacher: string;
  time: string;
  endTime: string;
  room: string;
  day: string;
  type: 'class' | 'lab' | 'exam' | 'workshop';
}

interface MobileScheduleViewerProps {
  schedule: ScheduleEntry[];
  isLoading?: boolean;
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const MobileScheduleViewer: React.FC<MobileScheduleViewerProps> = ({
  schedule,
  isLoading = false,
}) => {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Get today's schedule
  const todaySchedule = useMemo(() => {
    const day = DAYS_ORDER[selectedDate.getDay()];
    return schedule.filter(s => s.day === day).sort((a, b) => {
      return new Date(`2024-01-01 ${a.time}`).getTime() -
        new Date(`2024-01-01 ${b.time}`).getTime();
    });
  }, [schedule, selectedDate]);

  // Group schedule by day for week view
  const weekSchedule = useMemo(() => {
    const grouped: Record<string, ScheduleEntry[]> = {};
    DAYS_ORDER.forEach(day => {
      grouped[day] = schedule
        .filter(s => s.day === day)
        .sort((a, b) => {
          return new Date(`2024-01-01 ${a.time}`).getTime() -
            new Date(`2024-01-01 ${b.time}`).getTime();
        });
    });
    return grouped;
  }, [schedule]);

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'class':
        return 'bg-blue-100 text-blue-800 border-l-4 border-blue-600';
      case 'lab':
        return 'bg-green-100 text-green-800 border-l-4 border-green-600';
      case 'exam':
        return 'bg-red-100 text-red-800 border-l-4 border-red-600';
      case 'workshop':
        return 'bg-purple-100 text-purple-800 border-l-4 border-purple-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'lab':
        return '🔬';
      case 'exam':
        return '📝';
      case 'workshop':
        return '🎓';
      default:
        return '📚';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const handlePrevDate = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev);
  };

  const handleNextDate = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    setSelectedDate(next);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-200 animate-spin mb-3">
            <div className="w-6 h-6 rounded-full border-3 border-blue-400 border-t-blue-600" />
          </div>
          <p className="text-sm text-gray-600 font-medium">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (schedule.length === 0) {
    return (
      <Card className="shadow-md">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">No schedule available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* View Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('day')}
          className={`flex-1 py-2 rounded-lg font-medium transition ${
            viewMode === 'day'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Day
        </button>
        <button
          onClick={() => setViewMode('week')}
          className={`flex-1 py-2 rounded-lg font-medium transition ${
            viewMode === 'week'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Week
        </button>
      </div>

      {/* Day View */}
      {viewMode === 'day' && (
        <>
          {/* Date Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={handlePrevDate}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <p className="font-semibold text-gray-800">{formatDate(selectedDate)}</p>
              <p className="text-xs text-gray-500">
                {DAYS_ORDER[selectedDate.getDay()]}
              </p>
            </div>
            <button
              onClick={handleNextDate}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Today's Classes */}
          {todaySchedule.length > 0 ? (
            <div className="space-y-2">
              {todaySchedule.map(entry => (
                <Card key={entry.id} className={`shadow-md ${getTypeColor(entry.type)}`}>
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <span className="text-2xl">{getTypeIcon(entry.type)}</span>
                          <div className="min-w-0">
                            <p className="font-bold text-lg">{entry.subject}</p>
                            <p className="text-sm opacity-75">
                              {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 text-sm opacity-90">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {entry.time} - {entry.endTime}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>Room {entry.room}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{entry.teacher}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="shadow-md">
              <CardContent className="pt-6">
                <div className="text-center py-4">
                  <p className="text-gray-500 text-sm">No classes scheduled for today</p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <div className="space-y-3">
          {Object.entries(weekSchedule).map(([day, entries]) => (
            entries.length > 0 && (
              <Card key={day} className="shadow-md overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{day}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {entries.map(entry => (
                    <div key={entry.id} className="p-2 bg-gray-50 rounded-lg border-l-4 border-blue-600">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-gray-800">
                            {entry.subject}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                            <Clock className="w-3 h-3" />
                            {entry.time}
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded whitespace-nowrap">
                          {entry.type}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileScheduleViewer;
