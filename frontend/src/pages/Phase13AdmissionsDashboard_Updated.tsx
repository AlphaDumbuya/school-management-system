/**
 * Admissions Dashboard Page
 * Application pipeline and enrollment tracking for admissions staff
 * Phase 13: Specialized Dashboards
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { MainLayout } from '@components/layout/MainLayout';
import { AlertCircle, TrendingUp, FileText, User, Calendar, Plus } from 'lucide-react';
import useAuthStore from '@store/authStore';

// Mock data
const mockApplications = [
  // New
  {
    id: '1',
    name: 'Sorie Koroma',
    class: '9th Grade',
    appliedDate: 'July 2, 2026',
    status: 'new' as const,
    priority: 'normal' as const,
  },
  {
    id: '2',
    name: 'Mariama Fofanah',
    class: '7th Grade',
    appliedDate: 'July 1, 2026',
    status: 'new' as const,
    priority: 'normal' as const,
  },
  // Under Review
  {
    id: '3',
    name: 'Abdul Conteh',
    class: '10th Grade',
    appliedDate: 'June 28, 2026',
    status: 'under_review' as const,
    priority: 'high' as const,
  },
  {
    id: '4',
    name: 'Aminata Bangura',
    class: '8th Grade',
    appliedDate: 'June 27, 2026',
    status: 'under_review' as const,
    priority: 'normal' as const,
  },
  // Approved
  {
    id: '5',
    name: 'Ibrahim Kamara',
    class: '9th Grade',
    appliedDate: 'June 20, 2026',
    status: 'approved' as const,
    priority: 'high' as const,
  },
  {
    id: '6',
    name: 'Hawa Turay',
    class: '7th Grade',
    appliedDate: 'June 19, 2026',
    status: 'approved' as const,
    priority: 'normal' as const,
  },
  // Enrolled
  {
    id: '7',
    name: 'Mohamed Sesay',
    class: '10th Grade',
    appliedDate: 'June 10, 2026',
    status: 'enrolled' as const,
    priority: 'normal' as const,
  },
  // Rejected
  {
    id: '8',
    name: 'Fatmata Koroma',
    class: '9th Grade',
    appliedDate: 'June 5, 2026',
    status: 'rejected' as const,
    priority: 'normal' as const,
  },
];

type TabType = 'pipeline' | 'all_applications';

export const Phase13AdmissionsDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('pipeline');
  const [expandedApp, setExpandedApp] = useState<string | null>(null);

  // Calculate metrics
  const totalApplications = mockApplications.length;
  const newApplications = mockApplications.filter(a => a.status === 'new').length;
  const approvedApplications = mockApplications.filter(a => a.status === 'approved').length;
  const enrolledApplications = mockApplications.filter(a => a.status === 'enrolled').length;
  const enrollmentRate = (enrolledApplications / totalApplications) * 100;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'enrolled':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    return priority === 'high'
      ? 'bg-red-50 border-red-300'
      : 'bg-gray-50 border-gray-300';
  };

  const groupedApplications = {
    new: mockApplications.filter(a => a.status === 'new'),
    under_review: mockApplications.filter(a => a.status === 'under_review'),
    approved: mockApplications.filter(a => a.status === 'approved'),
    enrolled: mockApplications.filter(a => a.status === 'enrolled'),
    rejected: mockApplications.filter(a => a.status === 'rejected'),
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Admissions Dashboard</h1>
            <p className="text-gray-600 mt-2">Application pipeline and enrollment management</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 text-sm px-3 py-1.5 sm:px-4 sm:py-2 flex-shrink-0 self-start sm:self-auto">
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">New Application</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>

        {/* Application Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Applications</p>
                  <p className="text-3xl font-bold text-blue-600">{totalApplications}</p>
                </div>
                <FileText className="w-10 h-10 text-blue-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Under Review</p>
                  <p className="text-3xl font-bold text-yellow-600">{groupedApplications.under_review.length}</p>
                </div>
                <AlertCircle className="w-10 h-10 text-yellow-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Approved</p>
                  <p className="text-3xl font-bold text-green-600">{approvedApplications}</p>
                </div>
                <TrendingUp className="w-10 h-10 text-green-100" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Enrollment Rate</p>
                  <p className="text-3xl font-bold text-purple-600">{enrollmentRate.toFixed(0)}%</p>
                </div>
                <User className="w-10 h-10 text-purple-100" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Required Alert */}
        {newApplications > 0 && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-900">New Applications Pending Review</p>
                <p className="text-sm text-blue-800">
                  {newApplications} new application{newApplications > 1 ? 's' : ''} submitted. Start review process.
                </p>
              </div>
            </div>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
              Review Now
            </Button>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-4 overflow-x-auto">
            {(['pipeline', 'all_applications'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'pipeline' && '📊 Pipeline View'}
                {tab === 'all_applications' && '📋 All Applications'}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {/* Pipeline View */}
          {activeTab === 'pipeline' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* New Applications Column */}
              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                <h3 className="font-bold text-blue-900 mb-3 flex items-center justify-between">
                  <span>🆕 New</span>
                  <span className="text-sm bg-blue-600 text-white px-2 py-1 rounded-full">
                    {groupedApplications.new.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {groupedApplications.new.map(app => (
                    <div key={app.id} className={`p-3 bg-white rounded-lg border-2 border-l-4 border-blue-400 cursor-pointer hover:shadow-md transition`}>
                      <p className="font-semibold text-gray-900 text-sm">{app.name}</p>
                      <p className="text-xs text-gray-600">{app.class}</p>
                      <p className="text-xs text-gray-500 mt-1">{app.appliedDate}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Under Review Column */}
              <div className="bg-yellow-50 rounded-lg p-4 border-2 border-yellow-200">
                <h3 className="font-bold text-yellow-900 mb-3 flex items-center justify-between">
                  <span>⏳ Under Review</span>
                  <span className="text-sm bg-yellow-600 text-white px-2 py-1 rounded-full">
                    {groupedApplications.under_review.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {groupedApplications.under_review.map(app => (
                    <div
                      key={app.id}
                      className={`p-3 bg-white rounded-lg border-2 border-l-4 border-yellow-400 cursor-pointer hover:shadow-md transition ${
                        app.priority === 'high' ? 'ring-2 ring-red-400' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{app.name}</p>
                        {app.priority === 'high' && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">High</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600">{app.class}</p>
                      <p className="text-xs text-gray-500 mt-1">{app.appliedDate}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Approved Column */}
              <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                <h3 className="font-bold text-green-900 mb-3 flex items-center justify-between">
                  <span>✅ Approved</span>
                  <span className="text-sm bg-green-600 text-white px-2 py-1 rounded-full">
                    {groupedApplications.approved.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {groupedApplications.approved.map(app => (
                    <div key={app.id} className="p-3 bg-white rounded-lg border-2 border-l-4 border-green-400 cursor-pointer hover:shadow-md transition">
                      <p className="font-semibold text-gray-900 text-sm">{app.name}</p>
                      <p className="text-xs text-gray-600">{app.class}</p>
                      <Button size="sm" className="w-full mt-2 bg-green-600 hover:bg-green-700 text-white text-xs">
                        Send Enrollment Form
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enrolled Column */}
              <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
                <h3 className="font-bold text-purple-900 mb-3 flex items-center justify-between">
                  <span>📚 Enrolled</span>
                  <span className="text-sm bg-purple-600 text-white px-2 py-1 rounded-full">
                    {groupedApplications.enrolled.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {groupedApplications.enrolled.map(app => (
                    <div key={app.id} className="p-3 bg-white rounded-lg border-2 border-l-4 border-purple-400">
                      <p className="font-semibold text-gray-900 text-sm">{app.name}</p>
                      <p className="text-xs text-gray-600">{app.class}</p>
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded inline-block mt-2">Confirmed</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rejected Column */}
              <div className="bg-red-50 rounded-lg p-4 border-2 border-red-200">
                <h3 className="font-bold text-red-900 mb-3 flex items-center justify-between">
                  <span>❌ Rejected</span>
                  <span className="text-sm bg-red-600 text-white px-2 py-1 rounded-full">
                    {groupedApplications.rejected.length}
                  </span>
                </h3>
                <div className="space-y-2">
                  {groupedApplications.rejected.map(app => (
                    <div key={app.id} className="p-3 bg-white rounded-lg border-2 border-l-4 border-red-400 opacity-75">
                      <p className="font-semibold text-gray-900 text-sm">{app.name}</p>
                      <p className="text-xs text-gray-600">{app.class}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* All Applications Tab */}
          {activeTab === 'all_applications' && (
            <Card>
              <CardHeader>
                <CardTitle>All Applications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mockApplications.map(app => (
                    <div
                      key={app.id}
                      onClick={() => setExpandedApp(expandedApp === app.id ? null : app.id)}
                      className="p-4 border rounded-lg hover:bg-gray-50 transition cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-lg text-gray-900">{app.name}</p>
                          <p className="text-sm text-gray-600 mb-2">{app.class}</p>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-600">Applied: {app.appliedDate}</span>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <div>
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(app.status)}`}>
                              {app.status === 'under_review' ? 'Under Review' :
                               app.status === 'new' ? 'New' :
                               app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                            </span>
                            {app.priority === 'high' && (
                              <span className="inline-block ml-2 px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                                High Priority
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {expandedApp === app.id && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                            <FileText className="w-4 h-4 mr-2" />
                            View Application Details
                          </Button>
                          <div className="grid grid-cols-2 gap-2">
                            <Button variant="outline">Schedule Interview</Button>
                            <Button variant="outline">Add Notes</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Admissions Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Admissions Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Application Funnel</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Total Applications</span>
                    <span className="font-bold">{totalApplications}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Approval Rate</span>
                    <span className="font-bold text-green-600">{((approvedApplications / totalApplications) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Enrollment Rate</span>
                    <span className="font-bold text-purple-600">{enrollmentRate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-600">Target Metrics</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Target Enrollment</span>
                    <span className="font-bold">200 Students</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Current Enrolled</span>
                    <span className="font-bold text-green-600">{enrolledApplications} Students</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Remaining Spots</span>
                    <span className="font-bold">{200 - enrolledApplications} Spots</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Phase13AdmissionsDashboard;
