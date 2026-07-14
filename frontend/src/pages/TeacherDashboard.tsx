import React, { useEffect } from 'react';
import { BookOpen, Users, TrendingUp, Clock, Plus } from 'lucide-react';
import { useAuth } from '@hooks/useAuth';

export const TeacherDashboard: React.FC = () => {
  const { user } = useAuth();

  useEffect(() => {
    // Load teacher-specific dashboard data
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Teacher Dashboard</h1>
            <p className="text-sm text-gray-600 mt-1">
              Welcome, {user?.firstName} {user?.lastName}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">Assigned Classes</p>
                <p className="text-3xl font-bold text-blue-600">4</p>
              </div>
              <BookOpen className="text-blue-500" size={32} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">Total Students</p>
                <p className="text-3xl font-bold text-green-600">156</p>
              </div>
              <Users className="text-green-500" size={32} />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-2">Average Performance</p>
                <p className="text-3xl font-bold text-purple-600">78.5%</p>
              </div>
              <TrendingUp className="text-purple-500" size={32} />
            </div>
          </div>
        </div>

        {/* Assigned Classes */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">My Classes</h2>
          <div className="space-y-3">
            {[
              { name: 'Mathematics - 10A', students: 42, lastActivity: '2 hours ago' },
              { name: 'Mathematics - 10B', students: 45, lastActivity: '1 hour ago' },
              { name: 'Algebra - 9A', students: 38, lastActivity: 'Today' },
              { name: 'Algebra - 9B', students: 31, lastActivity: '3 days ago' },
            ].map((cls, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <div>
                  <p className="font-semibold text-gray-800">{cls.name}</p>
                  <p className="text-sm text-gray-600">{cls.students} students</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Last activity</p>
                  <p className="text-sm font-medium text-gray-800">{cls.lastActivity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <Plus size={24} className="text-blue-600 mb-2" />
            <span className="text-sm font-semibold text-gray-800">Mark Attendance</span>
          </button>
          <button className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <Plus size={24} className="text-green-600 mb-2" />
            <span className="text-sm font-semibold text-gray-800">Enter Grades</span>
          </button>
          <button className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <Plus size={24} className="text-purple-600 mb-2" />
            <span className="text-sm font-semibold text-gray-800">View Schedule</span>
          </button>
          <button className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <Plus size={24} className="text-amber-600 mb-2" />
            <span className="text-sm font-semibold text-gray-800">Send Announcement</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
