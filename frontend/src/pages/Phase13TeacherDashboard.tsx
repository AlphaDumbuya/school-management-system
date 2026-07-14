/**
 * Teacher Dashboard Page
 * Main dashboard for teachers with class management, grading, and attendance
 * Phase 13: Specialized Dashboards
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { MainLayout } from '@components/layout/MainLayout';
import AssignedClassesPanel from '@components/teacher/AssignedClassesPanel';
import QuickAttendanceMarking from '@components/teacher/QuickAttendanceMarking';
import BulkGradeEntry from '@components/teacher/BulkGradeEntry';
import { Users, BookOpen, BarChart3, AlertCircle, Calendar } from 'lucide-react';
import useAuthStore from '@store/authStore';

// Mock data - replace with API calls
const mockClasses = [
  {
    id: 'class-1',
    name: 'Mathematics - 10th Grade',
    subject: 'Mathematics',
    level: '10th Grade',
    section: 'A',
    studentCount: 35,
    status: 'active' as const,
    room: '101',
    schedule: 'Mon, Wed, Fri 9:00-10:00',
  },
  {
    id: 'class-2',
    name: 'Mathematics - 10th Grade',
    subject: 'Mathematics',
    level: '10th Grade',
    section: 'B',
    studentCount: 32,
    status: 'active' as const,
    room: '102',
    schedule: 'Tue, Thu 9:00-10:00',
  },
  {
    id: 'class-3',
    name: 'Advanced Calculus - 12th Grade',
    subject: 'Mathematics',
    level: '12th Grade',
    section: 'A',
    studentCount: 28,
    status: 'active' as const,
    room: '201',
    schedule: 'Mon, Wed, Fri 10:00-11:00',
  },
];

const mockStudents = [
  { id: 'std-1', name: 'Aarav Sharma', rollNumber: '001', email: 'aarav@example.com' },
  { id: 'std-2', name: 'Bhavna Patel', rollNumber: '002', email: 'bhavna@example.com' },
  { id: 'std-3', name: 'Chirag Kumar', rollNumber: '003', email: 'chirag@example.com' },
  { id: 'std-4', name: 'Divya Singh', rollNumber: '004', email: 'divya@example.com' },
  { id: 'std-5', name: 'Esha Gupta', rollNumber: '005', email: 'esha@example.com' },
];

type TabType = 'overview' | 'classes' | 'grading' | 'attendance';

export const Phase13TeacherDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Get selected class data
  const selectedClass = selectedClassId ? mockClasses.find(c => c.id === selectedClassId) : null;

  // Statistics
  const stats = {
    totalClasses: mockClasses.length,
    totalStudents: mockClasses.reduce((sum, c) => sum + c.studentCount, 0),
    activeClasses: mockClasses.filter(c => c.status === 'active').length,
    pendingGrades: 3,
  };

  const handleSelectClass = (classId: string) => {
    setSelectedClassId(classId);
    setActiveTab('classes');
  };

  const handleGradeEntry = (classId: string) => {
    setSelectedClassId(classId);
    setActiveTab('grading');
  };

  const handleMarkAttendance = (classId: string) => {
    setSelectedClassId(classId);
    setActiveTab('attendance');
  };

  const handleGradeSubmit = async (grades: Array<{ studentId: string; grade: number }>) => {
    try {
      setIsLoading(true);
      // TODO: Call API to submit grades
      console.log('Submitting grades:', grades);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttendanceSubmit = async (records: Array<{ studentId: string; status: string }>) => {
    try {
      setIsLoading(true);
      // TODO: Call API to submit attendance
      console.log('Submitting attendance:', records);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome, {user?.firstName || 'Teacher'}! Manage your classes and students.</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Classes</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.totalClasses}</p>
                </div>
                <BookOpen className="w-10 h-10 text-blue-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Students</p>
                  <p className="text-3xl font-bold text-green-600">{stats.totalStudents}</p>
                </div>
                <Users className="w-10 h-10 text-green-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Active Classes</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.activeClasses}</p>
                </div>
                <BarChart3 className="w-10 h-10 text-purple-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Pending Grades</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.pendingGrades}</p>
                </div>
                <AlertCircle className="w-10 h-10 text-orange-100" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-4">
            {(['overview', 'classes', 'grading', 'attendance'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium border-b-2 transition ${
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
              {/* Today's Schedule */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Today's Schedule
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockClasses.slice(0, 3).map(cls => (
                      <div key={cls.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div>
                          <p className="font-semibold">{cls.name}</p>
                          <p className="text-sm text-gray-600">{cls.schedule} • Room {cls.room}</p>
                        </div>
                        <div className="text-sm text-gray-600">{cls.studentCount} students</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activities */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center gap-3 p-2 bg-blue-50 rounded">
                      <div className="w-2 h-2 bg-blue-600 rounded-full" />
                      <div>Grade submission deadline: 2 days remaining</div>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-green-50 rounded">
                      <div className="w-2 h-2 bg-green-600 rounded-full" />
                      <div>Attendance marked for 10th Grade A</div>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-yellow-50 rounded">
                      <div className="w-2 h-2 bg-yellow-600 rounded-full" />
                      <div>New assignment posted by admin</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Classes Tab */}
          {activeTab === 'classes' && (
            <AssignedClassesPanel
              classes={mockClasses}
              onSelectClass={handleSelectClass}
              onGradeEntry={handleGradeEntry}
              onMarkAttendance={handleMarkAttendance}
              isLoading={isLoading}
            />
          )}

          {/* Grading Tab */}
          {activeTab === 'grading' && (
            <div className="space-y-4">
              {selectedClass ? (
                <BulkGradeEntry
                  classId={selectedClass.id}
                  className={selectedClass.name}
                  subject={selectedClass.subject}
                  students={mockStudents.map(s => ({
                    studentId: s.id,
                    name: s.name,
                    rollNumber: s.rollNumber,
                    grade: '' as any,
                    maxMarks: 100,
                    passMark: 40,
                  }))}
                  maxMarks={100}
                  passMark={40}
                  onSubmit={handleGradeSubmit}
                  isLoading={isLoading}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-gray-600 text-center">Select a class to enter grades</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Attendance Tab */}
          {activeTab === 'attendance' && (
            <div className="space-y-4">
              {selectedClass ? (
                <QuickAttendanceMarking
                  classId={selectedClass.id}
                  className={selectedClass.name}
                  date={new Date()}
                  students={mockStudents}
                  onSubmit={handleAttendanceSubmit}
                  isLoading={isLoading}
                />
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-gray-600 text-center">Select a class to mark attendance</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Phase13TeacherDashboard;
