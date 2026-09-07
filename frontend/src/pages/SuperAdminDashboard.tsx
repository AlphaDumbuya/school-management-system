/**
 * Super Admin Dashboard — Platform Owner
 * Route: /platform/dashboard
 * Full platform overview with tenant management, revenue, and system health
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  AlertTriangle,
  CreditCard,
  BarChart3,
  Server,
  Shield,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import useAuth from '@hooks/useAuth';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { Button } from '@components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantSummary {
  id: string;
  name: string;
  status: 'active' | 'suspended' | 'trial' | 'expired';
  plan: string;
  users: number;
  students: number;
  monthlyRevenue: number;
  expiresAt?: string;
}

// ── Mock Data (replace with API calls) ────────────────────────────────────────

const stats = {
  totalTenants: 45,
  activeTenants: 42,
  totalUsers: 12540,
  totalStudents: 48200,
  monthlyRevenue: 25000,
  annualRevenue: 285000,
  newSignups: 8,
  activeSubscriptions: 42,
  expiringSubscriptions: 3,
  storageUsed: 72,
  uptime: 99.97,
};

const recentTenants: TenantSummary[] = [
  { id: '1', name: 'Sierra Leone Grammar School', status: 'active', plan: 'Premium', users: 450, students: 3200, monthlyRevenue: 2500 },
  { id: '2', name: 'Annie Walsh Memorial School', status: 'trial', plan: 'Trial', users: 120, students: 800, monthlyRevenue: 0, expiresAt: '2026-07-30' },
  { id: '3', name: 'Model Primary School Bo', status: 'active', plan: 'Basic', users: 85, students: 450, monthlyRevenue: 800 },
  { id: '4', name: "St. Edward's Secondary School", status: 'active', plan: 'Enterprise', users: 680, students: 5000, monthlyRevenue: 5000 },
  { id: '5', name: 'Freetown Secondary School', status: 'suspended', plan: 'Premium', users: 320, students: 2100, monthlyRevenue: 0 },
  { id: '6', name: 'Methodist Boys High School', status: 'active', plan: 'Premium', users: 290, students: 1800, monthlyRevenue: 2500 },
];

const alerts = [
  { id: 1, type: 'warning', message: '3 subscriptions expiring within 7 days', action: '/platform/subscriptions' },
  { id: 2, type: 'warning', message: '2 tenants exceeded 90% storage limit', action: '/platform/tenants' },
  { id: 3, type: 'info', message: '1 new tenant awaiting onboarding approval', action: '/platform/tenants' },
];

// ── Helper ────────────────────────────────────────────────────────────────────

function statusToVariant(status: string): 'active' | 'inactive' | 'pending' | 'suspended' {
  const map: Record<string, 'active' | 'inactive' | 'pending' | 'suspended'> = {
    active: 'active',
    trial: 'pending',
    suspended: 'suspended',
    expired: 'inactive',
  };
  return map[status] || 'inactive';
}

// ── Component ─────────────────────────────────────────────────────────────────

const SuperAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <MainLayout>
      <PageShell
        title="Platform Overview"
        subtitle="How the platform is performing"
        breadcrumbs={[{ label: 'Platform Dashboard' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/platform/analytics')}>
              <BarChart3 size={15} className="mr-1.5" />
              Full Analytics
            </Button>
            <Button size="sm" onClick={() => navigate('/platform/tenants')}>
              <Building2 size={15} className="mr-1.5" />
              Manage Tenants
            </Button>
          </div>
        }
      >
        <WelcomeHero
          firstName={user?.firstName}
          role="super_admin"
          roleLabel="Platform Admin"
          subtitle="Here's how the WiSkul platform is performing today."
        />

        {/* ── KPI Row ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <KPICard
            title="Total Schools"
            value={stats.totalTenants}
            subtitle={`${stats.activeTenants} active · ${stats.newSignups} new this month`}
            icon={<div className="p-2.5 rounded-xl bg-blue-500 text-white shadow-sm"><Building2 size={20} /></div>}
            color="blue"
          />
          <KPICard
            title="Platform Users"
            value={stats.totalUsers.toLocaleString()}
            subtitle={`${stats.totalStudents.toLocaleString()} students total`}
            icon={<div className="p-2.5 rounded-xl bg-purple-500 text-white shadow-sm"><Users size={20} /></div>}
            color="purple"
          />
          <KPICard
            title="Monthly Revenue"
            value={`Le ${stats.monthlyRevenue.toLocaleString()}`}
            subtitle={`Annual: Le ${stats.annualRevenue.toLocaleString()}`}
            icon={<div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-sm"><DollarSign size={20} /></div>}
            color="green"
          />
          <KPICard
            title="System Uptime"
            value={`${stats.uptime}%`}
            subtitle={`Storage: ${stats.storageUsed}% used`}
            icon={<div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-sm"><Server size={20} /></div>}
            color="amber"
          />
        </div>

        {/* ── Quick Actions + Alerts ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/platform/tenants')}
              className="group bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-blue-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                  <Building2 size={20} />
                </div>
                <ArrowUpRight size={16} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">Tenant Management</h3>
              <p className="text-xs text-gray-500 mt-1">Create & manage schools</p>
            </button>

            <button
              onClick={() => navigate('/platform/subscriptions')}
              className="group bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-emerald-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
                  <CreditCard size={20} />
                </div>
                <div className="flex items-center gap-1">
                  {stats.expiringSubscriptions > 0 && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      {stats.expiringSubscriptions}
                    </span>
                  )}
                  <ArrowUpRight size={16} className="text-gray-400 group-hover:text-emerald-500 transition-colors" />
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">Subscriptions</h3>
              <p className="text-xs text-gray-500 mt-1">Plans, billing & renewals</p>
            </button>

            <button
              onClick={() => navigate('/platform/analytics')}
              className="group bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-purple-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 group-hover:bg-purple-100 transition-colors">
                  <TrendingUp size={20} />
                </div>
                <ArrowUpRight size={16} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
              </div>
              <h3 className="font-semibold text-gray-900 text-sm">Platform Analytics</h3>
              <p className="text-xs text-gray-500 mt-1">Revenue & usage metrics</p>
            </button>
          </div>

          {/* Alerts Panel */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" />
                Alerts
              </h3>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                {alerts.length}
              </span>
            </div>
            <div className="divide-y divide-gray-100">
              {alerts.map(alert => (
                <button
                  key={alert.id}
                  onClick={() => navigate(alert.action)}
                  className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${alert.type === 'warning' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                  <span className="text-sm text-gray-700 flex-1">{alert.message}</span>
                  <ChevronRight size={14} className="text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tenants Table ────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Schools Overview</h2>
              <p className="text-xs text-gray-500 mt-0.5">{stats.totalTenants} registered schools</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/platform/tenants')}>
              View All
              <ExternalLink size={13} className="ml-1.5" />
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">School</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Students</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">MRR</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentTenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Building2 size={16} className="text-gray-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{tenant.name}</p>
                          {tenant.expiresAt && (
                            <p className="text-[11px] text-gray-400">Expires {tenant.expiresAt}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={statusToVariant(tenant.status)} showDot />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                        {tenant.plan}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-700">{tenant.users}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-700">{tenant.students.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-semibold text-gray-900">
                        {tenant.monthlyRevenue > 0 ? `Le ${tenant.monthlyRevenue.toLocaleString()}` : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/platform/tenants/${tenant.id}`)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Platform Health Footer ───────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <Shield size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Security Status</p>
              <p className="text-sm font-bold text-green-700">All Systems Secure</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Server size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">API Response</p>
              <p className="text-sm font-bold text-gray-900">142ms avg</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <BarChart3 size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">Active Sessions</p>
              <p className="text-sm font-bold text-gray-900">1,247 right now</p>
            </div>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
};

export default SuperAdminDashboard;
