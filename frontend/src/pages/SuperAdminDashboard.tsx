/**
 * Super Admin Dashboard
 * Phase 1.1: Add Super Admin Role
 * 
 * Platform-wide dashboard for Super Admin (Platform Owner)
 * Displays tenant management, subscriptions, and platform analytics
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '@hooks/useAuth';
import {
  FaBuilding,
  FaChartLine,
  FaCreditCard,
  FaUsers,
  FaServer,
  FaDollarSign,
  FaCheckCircle,
  FaExclamationTriangle,
  FaArrowUp,
  FaArrowDown,
} from 'react-icons/fa';

interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  newSignups: number;
  activeSubscriptions: number;
  expiringSubscriptions: number;
}

interface TenantSummary {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'trial' | 'expired';
  plan: string;
  users: number;
  students: number;
  expiresAt?: string;
}

const SuperAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Mock data - will be replaced with API calls
  const platformStats: PlatformStats = {
    totalTenants: 45,
    activeTenants: 42,
    totalUsers: 12540,
    totalRevenue: 125000,
    monthlyRevenue: 25000,
    newSignups: 8,
    activeSubscriptions: 42,
    expiringSubscriptions: 3,
  };

  const recentTenants: TenantSummary[] = [
    { id: '1', name: 'Springfield High School', status: 'active', plan: 'Premium', users: 450, students: 3200 },
    { id: '2', name: 'Riverside Academy', status: 'trial', plan: 'Trial', users: 120, students: 800, expiresAt: '2026-06-30' },
    { id: '3', name: 'Greenwood Elementary', status: 'active', plan: 'Basic', users: 85, students: 450 },
    { id: '4', name: 'Oakdale International', status: 'active', plan: 'Enterprise', users: 680, students: 5000 },
    { id: '5', name: 'Sunset College', status: 'suspended', plan: 'Premium', users: 320, students: 2100 },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trial':
        return 'bg-blue-100 text-blue-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Platform Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Welcome back, {user?.firstName} {user?.lastName}
          </p>
          <p className="text-sm text-gray-500">Super Admin - Platform Owner</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Tenants */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tenants</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{platformStats.totalTenants}</p>
                <p className="text-sm text-green-600 mt-2 flex items-center">
                  <FaArrowUp className="mr-1" />
                  {platformStats.newSignups} new this month
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <FaBuilding className="text-blue-600 text-2xl" />
              </div>
            </div>
          </div>

          {/* Active Tenants */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Tenants</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{platformStats.activeTenants}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {Math.round((platformStats.activeTenants / platformStats.totalTenants) * 100)}% active rate
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <FaCheckCircle className="text-green-600 text-2xl" />
              </div>
            </div>
          </div>

          {/* Total Users */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{platformStats.totalUsers.toLocaleString()}</p>
                <p className="text-sm text-gray-500 mt-2">Across all schools</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <FaUsers className="text-purple-600 text-2xl" />
              </div>
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Revenue</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">${platformStats.monthlyRevenue.toLocaleString()}</p>
                <p className="text-sm text-green-600 mt-2 flex items-center">
                  <FaArrowUp className="mr-1" />
                  12% vs last month
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <FaDollarSign className="text-green-600 text-2xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <button
            onClick={() => navigate('/platform/tenants')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <FaBuilding className="text-blue-600 text-xl" />
              </div>
              <span className="text-sm font-medium text-gray-600">Manage</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Tenant Management</h3>
            <p className="text-sm text-gray-600 mt-2">Create, manage, and monitor school tenants</p>
          </button>

          <button
            onClick={() => navigate('/platform/subscriptions')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <FaCreditCard className="text-green-600 text-xl" />
              </div>
              {platformStats.expiringSubscriptions > 0 && (
                <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
                  {platformStats.expiringSubscriptions} expiring
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Subscriptions</h3>
            <p className="text-sm text-gray-600 mt-2">Manage plans, billing, and renewals</p>
          </button>

          <button
            onClick={() => navigate('/platform/analytics')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <FaChartLine className="text-purple-600 text-xl" />
              </div>
              <span className="text-sm font-medium text-gray-600">View</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Platform Analytics</h3>
            <p className="text-sm text-gray-600 mt-2">Revenue, usage, and performance metrics</p>
          </button>
        </div>

        {/* Recent Tenants */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Recent Tenants</h2>
            <button
              onClick={() => navigate('/platform/tenants')}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View All →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    School Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                      {tenant.expiresAt && (
                        <div className="text-xs text-gray-500">Expires: {tenant.expiresAt}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(tenant.status)}`}>
                        {tenant.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tenant.plan}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tenant.users}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{tenant.students.toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => navigate(`/platform/tenants/${tenant.id}`)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        View
                      </button>
                      <button className="text-gray-600 hover:text-gray-900">
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <FaExclamationTriangle className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Attention Required</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>{platformStats.expiringSubscriptions} subscriptions expiring in the next 7 days</li>
                  <li>2 tenants have exceeded storage limits</li>
                  <li>1 support ticket requires platform admin attention</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
