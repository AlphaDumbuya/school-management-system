/**
 * Parent Dashboard Page
 * Main dashboard for parents with multi-child support and monitoring
 * Phase 13: Specialized Dashboards
 */

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@lib/apiClient';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { MainLayout } from '@components/layout/MainLayout';
import { AlertCircle, Home, Users, Bell, Settings } from 'lucide-react';
import useAuthStore from '@store/authStore';
import { ChildSelector } from '@components/parent/ChildSelector';
import { ChildMonitoring } from '@components/parent/ChildMonitoring';
import { ChildFeeStatus } from '@components/parent/ChildFeeStatus';
import { CommunicationCenter } from '@components/parent/CommunicationCenter';
import { RecordsAccess } from '@components/parent/RecordsAccess';

// Mock data
const mockChildren = [
  {
    id: 'child-1',
    name: 'Mohamed Kamara',
    class: '10th Grade A',
    gpa: 3.8,
    attendance: 92,
    outstandingFees: 5000,
  },
  {
    id: 'child-2',
    name: 'Fatmata Kamara',
    class: '8th Grade B',
    gpa: 3.6,
    attendance: 95,
    outstandingFees: 2000,
  },
];

const mockGrades = [
  { subject: 'Mathematics', marks: 92, maxMarks: 100, trend: 'up' as const },
  { subject: 'English', marks: 85, maxMarks: 100, trend: 'stable' as const },
  { subject: 'Science', marks: 88, maxMarks: 100, trend: 'up' as const },
  { subject: 'Social Studies', marks: 90, maxMarks: 100, trend: 'up' as const },
];

const mockSchedule = [
  { subject: 'Mathematics', teacher: 'Mr. Bangura', time: '9:00 AM', room: '101' },
  { subject: 'English', teacher: 'Ms. Koroma', time: '10:00 AM', room: '102' },
  { subject: 'Science', teacher: 'Mr. Sesay', time: '11:00 AM', room: '201' },
];

const mockFees = [
  { type: 'Tuition', amount: 50000, paid: 50000, status: 'paid' as const },
  { type: 'Activities', amount: 5000, paid: 0, status: 'pending' as const },
  { type: 'Transport', amount: 10000, paid: 10000, status: 'paid' as const },
  { type: 'Library', amount: 2000, paid: 2000, status: 'paid' as const },
];

const mockMessages = [
  {
    id: '1',
    sender: 'Mr. Bangura (Math Teacher)',
    subject: 'Mohamed is doing well in class',
    preview: 'Mohamed has shown improvement in problem-solving. Keep encouraging him to practice more.',
    timestamp: 'Today at 2:30 PM',
    read: false,
  },
  {
    id: '2',
    sender: 'Principal Office',
    subject: 'Annual Day Celebrations',
    preview: 'Our school will be celebrating the Annual Day on July 15. Your child will be participating.',
    timestamp: 'Yesterday at 10:00 AM',
    read: true,
  },
  {
    id: '3',
    sender: 'Finance Office',
    subject: 'Fee Payment Reminder',
    preview: 'This is a friendly reminder that the activities fee for Term 2 is pending.',
    timestamp: '2 days ago',
    read: true,
  },
];

const mockAnnouncements = [
  {
    id: '1',
    title: 'Summer Holiday Extended',
    content: 'The school will remain closed on July 4-5 for maintenance. Classes will resume on July 6.',
    priority: 'high' as const,
    timestamp: 'Today at 9:00 AM',
  },
  {
    id: '2',
    title: 'Parent-Teacher Meeting',
    content: 'Parent-Teacher meetings are scheduled for July 10-12. Slots are available for booking.',
    priority: 'medium' as const,
    timestamp: 'Yesterday at 3:00 PM',
  },
  {
    id: '3',
    title: 'Sports Day Registration',
    content: 'Sports day is on July 20. Registration for events closes on July 8.',
    priority: 'low' as const,
    timestamp: '2 days ago',
  },
];

const mockMeetings = [
  {
    id: '1',
    title: 'Parent-Teacher Conference - Mathematics',
    date: 'July 10, 2026',
    time: '3:00 PM',
    organizer: 'Mr. Bangura',
    status: 'pending' as const,
  },
  {
    id: '2',
    title: 'General Academic Progress Review',
    date: 'July 11, 2026',
    time: '4:00 PM',
    organizer: 'Class Teacher',
    status: 'confirmed' as const,
  },
];

const mockDocuments = [
  {
    id: '1',
    name: 'Academic Record - Term 1',
    type: 'academic' as const,
    status: 'available' as const,
    lastModified: '2 days ago',
    size: '2.3 MB',
  },
  {
    id: '2',
    name: 'Fee Statement - June 2026',
    type: 'financial' as const,
    status: 'available' as const,
    lastModified: '1 day ago',
    size: '1.1 MB',
  },
  {
    id: '3',
    name: 'Attendance Report - Q2',
    type: 'attendance' as const,
    status: 'available' as const,
    lastModified: 'Today',
    size: '0.8 MB',
  },
  {
    id: '4',
    name: 'Academic Excellence Certificate',
    type: 'certificate' as const,
    status: 'available' as const,
    lastModified: '5 days ago',
    size: '0.5 MB',
  },
];

type TabType = 'overview' | 'monitoring' | 'fees' | 'communication' | 'records';

export const Phase13ParentDashboard: React.FC = () => {
  const { user } = useAuthStore();

  // Fetch real children linked to this parent account
  const { data: parentChildrenData } = useQuery({
    queryKey: ['parent-children', user?.email],
    queryFn: () => apiClient.get<{ success: boolean; data: any[] }>('/api/v1/students/parent/children'),
    enabled: !!user,
    staleTime: 30_000,
  });

  const childrenList = useMemo(() => {
    const fetched = (parentChildrenData as any)?.data?.data ?? (parentChildrenData as any)?.data;
    if (Array.isArray(fetched) && fetched.length > 0) {
      return fetched.map((c: any) => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.student_id,
        class: c.class_name || 'Class Unassigned',
        gpa: 3.8,
        attendance: 95,
        outstandingFees: 0,
      }));
    }
    return mockChildren;
  }, [parentChildrenData]);

  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

  const currentSelectedChildId = selectedChildId || childrenList[0]?.id || mockChildren[0].id;
  const selectedChild = childrenList.find(c => c.id === currentSelectedChildId) || childrenList[0];

  // Calculate fee stats
  const totalFees = mockFees.reduce((sum, f) => sum + f.amount, 0);
  const totalPaid = mockFees.reduce((sum, f) => sum + f.paid, 0);
  const totalOutstanding = totalFees - totalPaid;

  const toggleAlert = (alertId: string) => {
    const newDismissed = new Set(dismissedAlerts);
    if (newDismissed.has(alertId)) {
      newDismissed.delete(alertId);
    } else {
      newDismissed.add(alertId);
    }
    setDismissedAlerts(newDismissed);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Parent Portal</h1>
            <p className="text-gray-600 mt-1 text-sm sm:mt-2">Welcome! Monitor your children's academic progress</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" className="text-gray-700 text-sm px-3 py-1.5 sm:px-4 sm:py-2">
              <Bell className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Notifications</span>
            </Button>
            <Button variant="outline" className="text-gray-700 text-sm px-3 py-1.5 sm:px-4 sm:py-2">
              <Settings className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </div>
        </div>

        {/* Child Selector */}
        <ChildSelector
          children={childrenList}
          selectedChildId={currentSelectedChildId}
          onChildSelect={setSelectedChildId}
          compact={false}
        />

        {selectedChild && (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">GPA</p>
                      <p className="text-3xl font-bold text-blue-600">{selectedChild.gpa}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Attendance</p>
                      <p className={`text-3xl font-bold ${
                        selectedChild.attendance >= 80 ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        {selectedChild.attendance}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Outstanding</p>
                      <p className={`text-3xl font-bold ${
                        selectedChild.outstandingFees === 0 ? 'text-green-600' : 'text-orange-600'
                      }`}>
                        Le{selectedChild.outstandingFees}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm">Class</p>
                      <p className="text-2xl font-bold text-purple-600">{selectedChild.class}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Important Alerts */}
            <div className="space-y-2">
              {selectedChild.outstandingFees > 0 && !dismissedAlerts.has('fees') && (
                <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-orange-900">Outstanding Fees</p>
                      <p className="text-sm text-orange-800">
                        Le{selectedChild.outstandingFees} due. Please make payment to avoid late fees.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAlert('fees')}
                    className="text-orange-600 hover:text-orange-700 font-medium text-sm"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {selectedChild.attendance < 80 && !dismissedAlerts.has('attendance') && (
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-yellow-900">Attendance Below Target</p>
                      <p className="text-sm text-yellow-800">
                        Current attendance is {selectedChild.attendance}%. Target is 80%.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAlert('attendance')}
                    className="text-yellow-600 hover:text-yellow-700 font-medium text-sm"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {!dismissedAlerts.has('meeting') && (
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-blue-900">Parent-Teacher Meeting</p>
                      <p className="text-sm text-blue-800">Scheduled for July 10. Click to confirm your attendance.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAlert('meeting')}
                    className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="border-b">
              <div className="flex gap-4 overflow-x-auto">
                {(['overview', 'monitoring', 'fees', 'communication', 'records'] as const).map(tab => (
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

            {/* Tab Content */}
            <div>
              {activeTab === 'overview' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Academic Overview - {selectedChild.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Quick Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span>Overall Status</span>
                          <span className="font-semibold text-green-600">Excellent</span>
                        </div>
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span>Performance Trend</span>
                          <span className="font-semibold text-green-600">↑ Improving</span>
                        </div>
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span>Next Review Date</span>
                          <span className="font-semibold text-gray-900">July 15, 2026</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">Recent Activities</h4>
                      <div className="space-y-2 text-sm border-l-2 border-blue-300 pl-3">
                        <div>
                          <p className="font-medium text-gray-900">Grades Posted</p>
                          <p className="text-gray-600">Today - Term 1 grades are now available</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Attendance Updated</p>
                          <p className="text-gray-600">Yesterday - Current attendance: 92%</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">Message from Teacher</p>
                          <p className="text-gray-600">2 days ago - {selectedChild.name} is doing well</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'monitoring' && (
                <ChildMonitoring
                  childName={selectedChild.name}
                  grades={mockGrades}
                  attendance={selectedChild.attendance}
                  schedule={mockSchedule}
                />
              )}

              {activeTab === 'fees' && (
                <ChildFeeStatus
                  childName={selectedChild.name}
                  fees={mockFees}
                  totalAmount={totalFees}
                  totalPaid={totalPaid}
                  totalOutstanding={totalOutstanding}
                />
              )}

              {activeTab === 'communication' && (
                <CommunicationCenter
                  messages={mockMessages}
                  announcements={mockAnnouncements}
                  meetings={mockMeetings}
                />
              )}

              {activeTab === 'records' && (
                <RecordsAccess
                  childName={selectedChild.name}
                  documents={mockDocuments}
                />
              )}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default Phase13ParentDashboard;
