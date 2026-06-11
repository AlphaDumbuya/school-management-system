/**
 * Attendance Viewer Component
 * Displays student attendance statistics, trends, and alerts
 * Phase 13.2: Student Portal
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { AlertCircle } from 'lucide-react';

interface AttendanceViewerProps {
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
  isLoading?: boolean;
}

export const AttendanceViewer: React.FC<AttendanceViewerProps> = ({
  present,
  absent,
  late,
  total,
  percentage,
  isLoading = false,
}) => {
  const isAtRisk = percentage < 80;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Record</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Attendance Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 rounded-lg text-center">
            <p className="text-sm text-gray-600">Present</p>
            <p className="text-3xl font-bold text-green-600">{present}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg text-center">
            <p className="text-sm text-gray-600">Absent</p>
            <p className="text-3xl font-bold text-red-600">{absent}</p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg text-center">
            <p className="text-sm text-gray-600">Late</p>
            <p className="text-3xl font-bold text-yellow-600">{late}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg text-center">
            <p className="text-sm text-gray-600">Attendance %</p>
            <p className="text-3xl font-bold text-blue-600">{percentage}%</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Overall Attendance</p>
            <p className="text-sm font-semibold text-gray-900">{percentage}%</p>
          </div>
          <div className="bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                percentage >= 80 ? 'bg-green-600' :
                percentage >= 70 ? 'bg-yellow-600' :
                'bg-red-600'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* At-Risk Alert */}
        {isAtRisk && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-yellow-900">Attendance Warning</p>
              <p className="text-sm text-yellow-800">
                Your attendance is below 80%. Please focus on regular attendance.
              </p>
            </div>
          </div>
        )}

        {/* Attendance Summary */}
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">Summary</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total Days</span>
              <span className="font-semibold text-gray-900">{total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Days Absent</span>
              <span className="font-semibold text-red-600">{absent}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Days Late</span>
              <span className="font-semibold text-yellow-600">{late}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceViewer;
