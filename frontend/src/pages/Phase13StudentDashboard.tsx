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
  name: 'Aarav Sharma',
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
  { id: '5', subject: 'Hindi', marks: 78, maxMarks: 100, grade: 'B+', term: 'Term 1', date: '2026-06-15' },
];

const mockAttendance = {
  present: 45,
  absent: 3,
  late: 2,
  total: 50,
  percentage: 92,
};

const mockUpcomingClasses = [
  { subject: 'Mathematics', teacher: 'Mr. Kumar', time: '9:00 AM', room: '101' },
  { subject: 'English', teacher: 'Ms. Sharma', time: '10:00 AM', room: '102' },
  { subject: 'Science', teacher: 'Mr. Patel', time: '11:00 AM', room: '201' },
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

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">GPA</p>
                  <p className="text-3xl font-bold text-blue-600">{mockStudentData.gpa}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-blue-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Attendance</p>
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
                  <p className="text-gray-600 text-sm">Outstanding</p>
                  <p className="text-3xl font-bold text-orange-600">Le{outstandingFees}</p>
                </div>
                <DollarSign className="w-10 h-10 text-orange-100" />
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
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-4 overflow-x-auto">
            {(['overview', 'grades', 'attendance', 'schedule', 'fees', 'records'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
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
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Academic Standing */}
              <Card>
                <CardHeader>
                  <CardTitle>Academic Standing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Grade Average</p>
                      <p className="text-2xl font-bold text-green-600">A</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">GPA</p>
                      <p className="text-2xl font-bold text-blue-600">{mockStudentData.gpa}</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-gray-600">Status</p>
                      <p className="text-2xl font-bold text-purple-600">Good</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Latest Grades */}
              <Card>
                <CardHeader>
                  <CardTitle>Latest Grades</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockGrades.slice(0, 3).map((grade, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-semibold">{grade.subject}</p>
                          <p className="text-sm text-gray-600">{grade.marks}/{grade.maxMarks}</p>
                        </div>
                        <div className={`text-2xl font-bold ${
                          grade.grade.startsWith('A') ? 'text-green-600' : 
                          grade.grade.startsWith('B') ? 'text-blue-600' : 
                          'text-orange-600'
                        }`}>
                          {grade.grade}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Today's Classes */}
              <Card>
                <CardHeader>
                  <CardTitle>Today's Classes</CardTitle>
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
