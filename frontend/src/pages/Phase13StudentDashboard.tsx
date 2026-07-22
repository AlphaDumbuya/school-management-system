/**
 * Student Dashboard Page
 * Main dashboard for students with grades, attendance, schedule, and fees
 * Phase 13: Specialized Dashboards
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { MainLayout } from '@components/layout/MainLayout';
import { BookOpen, TrendingUp, Calendar, DollarSign, AlertCircle, FileText } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { GradeViewer } from '@components/student/GradeViewer';
import { AttendanceViewer } from '@components/student/AttendanceViewer';
import { ScheduleViewer } from '@components/student/ScheduleViewer';
import { FeeViewer } from '@components/student/FeeViewer';
import { RecordsDownload } from '@components/student/RecordsDownload';

// Mock data - replace with API calls
const mockStudentData = {
  id: 'student-1',
  name: 'Mohamed Kamara',
  rollNumber: '001',
  class: '10th Grade A',
  gpa: 3.8,
  attendancePercentage: 92,
  outstandingFees: 5000,
  upcomingClasses: 3,
};

const mockGrades = [
  { id: '1', subject: 'Mathematics', marks: 92, maxMarks: 100, grade: 'A+', term: 'Term 1', date: '2026-06-15' },
  { id: '2', subject: 'English', marks: 85, maxMarks: 100, grade: 'A', term: 'Term 1', date: '2026-06-15' },
  { id: '3', subject: 'Science', marks: 88, maxMarks: 100, grade: 'A', term: 'Term 1', date: '2026-06-15' },
  { id: '4', subject: 'Social Studies', marks: 90, maxMarks: 100, grade: 'A+', term: 'Term 1', date: '2026-06-15' },
  { id: '5', subject: 'Integrated Science', marks: 78, maxMarks: 100, grade: 'B+', term: 'Term 1', date: '2026-06-15' },
];

const mockAttendance = {
  present: 45,
  absent: 3,
  late: 2,
  total: 50,
  percentage: 92,
};

const mockUpcomingClasses = [
  { subject: 'Mathematics', teacher: 'Mr. Bangura', time: '9:00 AM', room: '101' },
  { subject: 'English', teacher: 'Ms. Koroma', time: '10:00 AM', room: '102' },
  { subject: 'Science', teacher: 'Mr. Sesay', time: '11:00 AM', room: '201' },
];

const mockFees = {
  tuition: { type: 'Tuition', amount: 50000, paid: 50000, status: 'paid' as const },
  activities: { type: 'Activities', amount: 5000, paid: 0, status: 'pending' as const },
  transport: { type: 'Transport', amount: 10000, paid: 10000, status: 'paid' as const },
  library: { type: 'Library', amount: 2000, paid: 2000, status: 'paid' as const },
};

type TabType = 'overview' | 'grades' | 'attendance' | 'schedule' | 'fees' | 'records';

export const Phase13StudentDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(false);

  // Calculate fee statistics
  const totalFees = Object.values(mockFees).reduce((sum, fee) => sum + fee.amount, 0);
  const paidFees = Object.values(mockFees).reduce((sum, fee) => sum + fee.paid, 0);
  const outstandingFees = totalFees - paidFees;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Student Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome, {mockStudentData.name}! Class: {mockStudentData.class}
          </p>
        </div>

        {/* Quick Stats (Version 1.0.0) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Attendance Rate</p>
                  <p className="text-3xl font-bold text-green-600">{mockStudentData.attendancePercentage}%</p>
                </div>
                <Calendar className="w-10 h-10 text-green-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Today's Classes</p>
                  <p className="text-3xl font-bold text-purple-600">{mockUpcomingClasses.length}</p>
                </div>
                <BookOpen className="w-10 h-10 text-purple-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Assignments</p>
                  <p className="text-3xl font-bold text-blue-600">Active</p>
                </div>
                <FileText className="w-10 h-10 text-blue-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">School Events</p>
                  <p className="text-3xl font-bold text-amber-600">Calendar</p>
                </div>
                <Calendar className="w-10 h-10 text-amber-100" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-4 overflow-x-auto">
            {(['overview', 'attendance', 'schedule', 'records'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div>
          {/* Overview Tab (v1.0.0) */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Today's Classes */}
              <Card>
                <CardHeader>
                  <CardTitle>Today's Classes & Timetable</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockUpcomingClasses.map((cls, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div>
                          <p className="font-semibold">{cls.subject}</p>
                          <p className="text-sm text-gray-600">
                            {cls.teacher} • Room {cls.room}
                          </p>
                        </div>
                        <div className="text-sm font-medium text-blue-600">{cls.time}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Attendance Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Attendance Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Present Days</p>
                      <p className="text-2xl font-bold text-green-600">{mockAttendance.present}</p>
                    </div>
                    <div className="p-4 bg-amber-50 rounded-lg">
                      <p className="text-sm text-gray-600">Late Days</p>
                      <p className="text-2xl font-bold text-amber-600">{mockAttendance.late}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-sm text-gray-600">Absences</p>
                      <p className="text-2xl font-bold text-red-600">{mockAttendance.absent}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Grades Tab */}
          {activeTab === 'grades' && (
            <GradeViewer
              grades={mockGrades}
              isLoading={isLoading}
            />
          )}

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <AttendanceViewer
              present={mockAttendance.present}
              absent={mockAttendance.absent}
              late={mockAttendance.late}
              total={mockAttendance.total}
              percentage={mockAttendance.percentage}
              isLoading={isLoading}
            />
          )}

          {/* Schedule Tab */}
          {activeTab === 'schedule' && (
            <ScheduleViewer
              classes={mockUpcomingClasses}
              isLoading={isLoading}
            />
          )}

          {/* Fees Tab */}
          {activeTab === 'fees' && (
            <FeeViewer
              fees={mockFees}
              outstandingAmount={outstandingFees}
              isLoading={isLoading}
            />
          )}

          {/* Records Tab */}
          {activeTab === 'records' && (
            <RecordsDownload isLoading={isLoading} />
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Phase13StudentDashboard;
