/**
 * Mobile Attendance Viewer - Phase 20
 * Touch-friendly attendance display with calendar view
 * Shows daily, weekly, and monthly attendance stats
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { CheckCircle, XCircle, Calendar, TrendingUp } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  subject?: string;
  remarks?: string;
}

interface MobileAttendanceViewerProps {
  records: AttendanceRecord[];
  isLoading?: boolean;
}

export const MobileAttendanceViewer: React.FC<MobileAttendanceViewerProps> = ({
  records,
  isLoading = false,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Calculate statistics
  const stats = useMemo(() => {
    if (records.length === 0) {
      return { percentage: 0, present: 0, absent: 0, late: 0, leave: 0, total: 0 };
    }

    const present = records.filter(r => r.status === 'present').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const late = records.filter(r => r.status === 'late').length;
    const leave = records.filter(r => r.status === 'leave').length;
    const total = records.length;
    const percentage = Math.round(((present + late + leave) / total) * 100);

    return { percentage, present, absent, late, leave, total };
  }, [records]);

  // Get monthly records
  const monthlyRecords = useMemo(() => {
    return records.filter(r => {
      const date = new Date(r.date);
      return date.getMonth() === selectedMonth.getMonth() &&
        date.getFullYear() === selectedMonth.getFullYear();
    });
  }, [records, selectedMonth]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'present':
        return 'bg-green-100 text-green-800 border-l-4 border-green-600';
      case 'absent':
        return 'bg-red-100 text-red-800 border-l-4 border-red-600';
      case 'late':
        return 'bg-yellow-100 text-yellow-800 border-l-4 border-yellow-600';
      case 'leave':
        return 'bg-blue-100 text-blue-800 border-l-4 border-blue-600';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
      case 'late':
      case 'leave':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'absent':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-200 animate-spin mb-3">
            <div className="w-6 h-6 rounded-full border-3 border-blue-400 border-t-blue-600" />
          </div>
          <p className="text-sm text-gray-600 font-medium">Loading attendance...</p>
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <Card className="shadow-md">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">No attendance records yet</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Attendance Percentage Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 shadow-md">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <p className="text-sm text-gray-600 font-medium">Attendance Rate</p>
            </div>
            <p className="text-4xl font-bold text-blue-600">{stats.percentage}%</p>
            <p className="text-xs text-gray-500 mt-2">
              {stats.present + stats.late + stats.leave} out of {stats.total} days
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Status Summary Grid */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <div className="text-center">
              <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-green-600">{stats.present}</p>
              <p className="text-xs text-gray-500">Present</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <div className="text-center">
              <XCircle className="w-6 h-6 text-red-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              <p className="text-xs text-gray-500">Absent</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <div className="text-center">
              <Calendar className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-yellow-600">{stats.late}</p>
              <p className="text-xs text-gray-500">Late</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="pt-4">
            <div className="text-center">
              <CheckCircle className="w-6 h-6 text-blue-600 mx-auto mb-1" />
              <p className="text-2xl font-bold text-blue-600">{stats.leave}</p>
              <p className="text-xs text-gray-500">Leave</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between px-2">
        <button
          onClick={() => {
            const prev = new Date(selectedMonth);
            prev.setMonth(prev.getMonth() - 1);
            setSelectedMonth(prev);
          }}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          ←
        </button>
        <h3 className="font-semibold text-gray-800">
          {selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <button
          onClick={() => {
            const next = new Date(selectedMonth);
            next.setMonth(next.getMonth() + 1);
            setSelectedMonth(next);
          }}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          →
        </button>
      </div>

      {/* Monthly Records List */}
      {monthlyRecords.length > 0 ? (
        <Card className="shadow-md overflow-hidden">
          <CardContent className="p-0">
            <div className="space-y-1">
              {monthlyRecords.map(record => (
                <div
                  key={record.id}
                  className={`p-3 flex items-center justify-between border-b last:border-b-0 ${getStatusColor(
                    record.status
                  )}`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(record.status)}
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{formatDate(record.date)}</p>
                      {record.subject && (
                        <p className="text-xs opacity-75 truncate">{record.subject}</p>
                      )}
                      {record.remarks && (
                        <p className="text-xs opacity-75 truncate">{record.remarks}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold uppercase ml-2">
                    {record.status}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-md">
          <CardContent className="pt-6">
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm">No records for this month</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MobileAttendanceViewer;
