/**
 * Mobile Student Dashboard - Phase 20
 * Mobile-optimized student dashboard with responsive design
 * Touch-friendly controls and offline support
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/card';
import { AlertCircle, TrendingUp, Menu, X, RefreshCw } from 'lucide-react';
import { useApi } from '@hooks/useApi';
import { dashboardService } from '@services/dashboardService';

interface StudentStats {
  totalGrades: number;
  averageMarks: number;
  attendancePercentage: number;
  feesStatus: string;
  upcomingEvents: number;
}

interface MobileMenuState {
  isOpen: boolean;
}

export const Phase20MobileStudentDashboard: React.FC = () => {
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [menu, setMenu] = useState<MobileMenuState>({ isOpen: false });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch dashboard data
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);
        // Attempt to get from cache first
        const cached = localStorage.getItem('student_dashboard_cache');
        if (cached && !isOnline) {
          setStats(JSON.parse(cached));
        } else if (isOnline) {
          const dashboard = await dashboardService.getStudentDashboard();
          setStats({
            totalGrades: dashboard.grades?.length || 0,
            averageMarks: dashboard.averageMarks || 0,
            attendancePercentage: dashboard.attendance || 0,
            feesStatus: dashboard.feesStatus || 'Pending',
            upcomingEvents: dashboard.events?.length || 0,
          });
          // Cache data
          localStorage.setItem('student_dashboard_cache', JSON.stringify(stats));
        }
      } catch (error) {
        console.error('Failed to load dashboard', error);
        // Fall back to cached data
        const cached = localStorage.getItem('student_dashboard_cache');
        if (cached) {
          setStats(JSON.parse(cached));
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [isOnline]);

  const handleRefresh = async () => {
    if (!isOnline) return;
    setIsSyncing(true);
    try {
      // Trigger data sync
      const dashboard = await dashboardService.getStudentDashboard();
      setStats({
        totalGrades: dashboard.grades?.length || 0,
        averageMarks: dashboard.averageMarks || 0,
        attendancePercentage: dashboard.attendance || 0,
        feesStatus: dashboard.feesStatus || 'Pending',
        upcomingEvents: dashboard.events?.length || 0,
      });
    } catch (error) {
      console.error('Sync failed', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-200 animate-spin mb-4">
            <div className="w-8 h-8 rounded-full border-4 border-blue-400 border-t-blue-600" />
          </div>
          <p className="text-gray-600 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-20">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Student Portal</h1>
          <div className="flex items-center gap-2">
            {/* Offline Indicator */}
            {!isOnline && (
              <div className="flex items-center gap-1 px-2 py-1 bg-red-100 rounded-full">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-xs text-red-600 font-medium">Offline</span>
              </div>
            )}
            {/* Sync Button */}
            <button
              onClick={handleRefresh}
              disabled={!isOnline || isSyncing}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition"
              aria-label="Refresh"
            >
              <RefreshCw
                className={`w-5 h-5 text-gray-600 ${isSyncing ? 'animate-spin' : ''}`}
              />
            </button>
            {/* Menu Toggle */}
            <button
              onClick={() => setMenu({ isOpen: !menu.isOpen })}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
              aria-label="Menu"
            >
              {menu.isOpen ? (
                <X className="w-5 h-5 text-gray-600" />
              ) : (
                <Menu className="w-5 h-5 text-gray-600" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menu.isOpen && (
          <div className="border-t bg-gray-50 px-4 py-3 space-y-2">
            <a
              href="/grades"
              className="block px-3 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              Grades
            </a>
            <a
              href="/attendance"
              className="block px-3 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              Attendance
            </a>
            <a
              href="/schedule"
              className="block px-3 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              Schedule
            </a>
            <a
              href="/fees"
              className="block px-3 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              Fees
            </a>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Quick Stats - Mobile Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Grades Card */}
          <Card className="shadow-md hover:shadow-lg transition">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-xs text-gray-600 font-medium mb-1">Grades</p>
                <p className="text-2xl font-bold text-blue-600">{stats?.totalGrades || 0}</p>
                <p className="text-xs text-gray-500 mt-1">subjects</p>
              </div>
            </CardContent>
          </Card>

          {/* Average Card */}
          <Card className="shadow-md hover:shadow-lg transition">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-xs text-gray-600 font-medium mb-1">Average</p>
                <p className="text-2xl font-bold text-green-600">{stats?.averageMarks || 0}%</p>
                <p className="text-xs text-gray-500 mt-1">overall</p>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Card */}
          <Card className="shadow-md hover:shadow-lg transition">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-xs text-gray-600 font-medium mb-1">Attendance</p>
                <p className="text-2xl font-bold text-purple-600">{stats?.attendancePercentage || 0}%</p>
                <p className="text-xs text-gray-500 mt-1">present</p>
              </div>
            </CardContent>
          </Card>

          {/* Fees Card */}
          <Card className="shadow-md hover:shadow-lg transition">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className="text-xs text-gray-600 font-medium mb-1">Fees</p>
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${getStatusColor(stats?.feesStatus || '')}`}>
                  {stats?.feesStatus || 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href="/grades"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition active:scale-95"
          >
            <TrendingUp className="w-4 h-4" />
            View Grades
          </a>
          <a
            href="/attendance"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition active:scale-95"
          >
            <AlertCircle className="w-4 h-4" />
            Attendance
          </a>
        </div>

        {/* Upcoming Events */}
        {stats && stats.upcomingEvents > 0 && (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Array.from({ length: stats.upcomingEvents }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-blue-600">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">Event {i + 1}</p>
                      <p className="text-xs text-gray-500">More details available</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Offline Notice */}
        {!isOnline && (
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">You are offline</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Viewing cached data. Connect to internet to sync latest updates.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bottom Navigation Placeholder */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16" />
    </div>
  );
};

export default Phase20MobileStudentDashboard;
