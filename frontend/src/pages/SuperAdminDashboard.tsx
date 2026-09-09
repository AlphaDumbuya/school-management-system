/**
 * Super Admin Dashboard — Platform Owner
 * Route: /platform/dashboard
 *
 * Live platform overview: real tenant/user/student counts and the most recent
 * schools, pulled from the platform API. No mock data — everything reflects the
 * actual state of the platform.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  GraduationCap,
  ArrowUpRight,
  AlertTriangle,
  CreditCard,
  BarChart3,
  ExternalLink,
  ChevronRight,
  Loader2,
  UserPlus,
  Pause,
  Clock,
  BadgeCheck,
  ShieldAlert,
  Fingerprint,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import useAuth from '@hooks/useAuth';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { WelcomeHero } from '@components/dashboard/WelcomeHero';
import { StatusBadge } from '@components/admin/feedback/StatusBadge';
import { Button } from '@components/ui/button';
import platformService, { PlatformTenant, PlatformStatistics } from '@services/platformService';

function statusToVariant(status: string): 'active' | 'inactive' | 'pending' | 'suspended' {
  const map: Record<string, 'active' | 'inactive' | 'pending' | 'suspended'> = {
    active: 'active',
    trial: 'pending',
    suspended: 'suspended',
    expired: 'inactive',
  };
  return map[status] || 'inactive';
}

const SuperAdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState<PlatformStatistics | null>(null);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [statsRes, tenantsRes] = await Promise.all([
        platformService.getStatistics().catch(() => ({ success: false, data: null as any })),
        platformService.getTenants({ limit: 6, offset: 0 }).catch(() => ({ success: false, data: [] as any })),
      ]);
      if (!active) return;
      if ((statsRes as any)?.data) setStats((statsRes as any).data);
      // The endpoint returns { success, data: [...], total }. Be defensive about
      // any extra nesting so the list always resolves to the tenant array.
      const raw: any = tenantsRes as any;
      const list = Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.data?.data)
          ? raw.data.data
          : Array.isArray(raw)
            ? raw
            : [];
      setTenants(list);
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  // Derive live alerts from real counts.
  const alerts = useMemo(() => {
    const out: { id: string; type: 'warning' | 'info'; message: string; action: string }[] = [];
    if (stats?.suspendedTenants) {
      out.push({ id: 'susp', type: 'warning', message: `${stats.suspendedTenants} school${stats.suspendedTenants === 1 ? '' : 's'} currently suspended`, action: '/platform/tenants' });
    }
    if (stats?.trialTenants) {
      out.push({ id: 'trial', type: 'info', message: `${stats.trialTenants} school${stats.trialTenants === 1 ? '' : 's'} on trial`, action: '/platform/subscriptions' });
    }
    if (stats?.newTenantsThisMonth) {
      out.push({ id: 'new', type: 'info', message: `${stats.newTenantsThisMonth} new school${stats.newTenantsThisMonth === 1 ? '' : 's'} joined this month`, action: '/platform/tenants' });
    }
    return out;
  }, [stats]);

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

        {/* ── KPI Row (live) ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
          <KPICard
            title="Total Schools"
            value={loading ? '…' : (stats?.totalTenants ?? 0)}
            subtitle={loading ? '' : `${stats?.activeTenants ?? 0} active${stats?.newTenantsThisMonth ? ` · ${stats.newTenantsThisMonth} new` : ''}`}
            icon={<div className="p-2.5 rounded-xl bg-blue-500 text-white shadow-sm"><Building2 size={20} /></div>}
            color="blue"
          />
          <KPICard
            title="Platform Users"
            value={loading ? '…' : (stats?.totalUsers ?? 0).toLocaleString()}
            subtitle={loading ? '' : `across all schools`}
            icon={<div className="p-2.5 rounded-xl bg-purple-500 text-white shadow-sm"><Users size={20} /></div>}
            color="purple"
          />
          <KPICard
            title="Total Students"
            value={loading ? '…' : (stats?.totalStudents ?? 0).toLocaleString()}
            subtitle={loading ? '' : `enrolled platform-wide`}
            icon={<div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-sm"><GraduationCap size={20} /></div>}
            color="green"
          />
          <KPICard
            title="On Trial"
            value={loading ? '…' : (stats?.trialTenants ?? 0)}
            subtitle={loading ? '' : `${stats?.suspendedTenants ?? 0} suspended`}
            icon={<div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-sm"><Clock size={20} /></div>}
            color="amber"
          />
        </div>

        {/* ── Quick Actions + Alerts ───────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <QuickAction
              onClick={() => navigate('/platform/tenants')}
              icon={<Building2 size={20} />}
              tint="blue"
              title="Tenant Management"
              desc="Create & manage schools"
            />
            <QuickAction
              onClick={() => navigate('/platform/subscriptions')}
              icon={<CreditCard size={20} />}
              tint="emerald"
              title="Subscriptions"
              desc="Plans, billing & renewals"
              badge={stats?.trialTenants || undefined}
            />
            <QuickAction
              onClick={() => navigate('/platform/analytics')}
              icon={<BarChart3 size={20} />}
              tint="purple"
              title="Platform Analytics"
              desc="Usage & growth metrics"
            />
          </div>

          {/* Alerts Panel */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500" />
                Alerts
              </h3>
              {alerts.length > 0 && (
                <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  {alerts.length}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-100">
              {loading ? (
                <div className="py-8 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={20} /></div>
              ) : alerts.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-400 text-center">All clear — nothing needs your attention.</p>
              ) : (
                alerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => navigate(alert.action)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${alert.type === 'warning' ? 'bg-amber-400' : 'bg-blue-400'}`} />
                    <span className="text-sm text-gray-700 flex-1">{alert.message}</span>
                    <ChevronRight size={14} className="text-gray-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Recent Schools Table (live) ──────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">Schools Overview</h2>
              <p className="text-xs text-gray-500 mt-0.5">{stats?.totalTenants ?? 0} registered schools</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/platform/tenants')}>
              View All
              <ExternalLink size={13} className="ml-1.5" />
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#3b82f6]">
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-white uppercase tracking-wider">School</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-white uppercase tracking-wider">Contact</th>
                  <th className="px-6 py-3.5 text-right text-xs font-bold text-white uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3.5 text-right text-xs font-bold text-white uppercase tracking-wider">Students</th>
                  <th className="px-6 py-3.5 text-center text-xs font-bold text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-400"><Loader2 className="animate-spin inline" size={22} /></td></tr>
                ) : tenants.length === 0 ? (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-400">No schools registered yet.</td></tr>
                ) : (
                  tenants.map((tenant, i) => (
                    <tr key={tenant.id} className={`transition-colors hover:bg-sky-100 ${i % 2 === 1 ? 'bg-sky-50' : 'bg-white'}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
                            <Building2 size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{tenant.name}</p>
                            <p className="text-[11px] text-gray-400 font-mono truncate">{tenant.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={statusToVariant(tenant.status)} showDot />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs text-gray-600 truncate">{tenant.contact_email || '—'}</span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-700">{tenant.stats?.usersCount ?? '—'}</td>
                      <td className="px-6 py-4 text-right font-medium text-gray-700">{tenant.stats?.studentsCount ?? '—'}</td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Platform composition footer (live) ───────────────────────── */}
        {!loading && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <CompositionCard icon={<Building2 size={18} />} tint="blue" label="Active Schools" value={stats.activeTenants} />
            <CompositionCard icon={<Pause size={18} />} tint="amber" label="Suspended" value={stats.suspendedTenants} />
            <CompositionCard icon={<UserPlus size={18} />} tint="emerald" label="New This Month" value={stats.newTenantsThisMonth ?? 0} />
          </div>
        )}

        {/* ── New feature adoption (live) ──────────────────────────────── */}
        {!loading && stats && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900">Platform Features</h2>
              <span className="text-xs text-gray-400">Adoption across all schools</span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <CompositionCard
                icon={<BadgeCheck size={18} />} tint="emerald"
                label="Verified Schools" value={stats.verifiedSchools ?? 0}
              />
              <CompositionCard
                icon={<ShieldAlert size={18} />} tint="amber"
                label="Unverified Schools" value={stats.unverifiedSchools ?? Math.max(0, (stats.totalTenants || 0) - (stats.verifiedSchools || 0))}
              />
              <CompositionCard
                icon={<Fingerprint size={18} />} tint="purple"
                label="Users with Passkeys" value={stats.passkeyUsers ?? 0}
              />
              <CompositionCard
                icon={<ShieldCheck size={18} />} tint="blue"
                label="2FA Enabled Users" value={stats.twoFactorUsers ?? 0}
              />
            </div>

            {/* Mobile app card — honest: we don't instrument download counts.
                Links to the release/download so admins can see availability. */}
            <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600"><Smartphone size={18} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">WiSkul Android App</p>
                <p className="text-xs text-gray-500">
                  Downloadable APK is live. Download counts aren't tracked on the platform yet.
                </p>
              </div>
              <a
                href="https://www.wiskulsl.com/downloads/wiskul.apk"
                target="_blank" rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-2"
              >
                View APK <ExternalLink size={13} />
              </a>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const TINTS: Record<string, { bg: string; text: string; hover: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', hover: 'hover:border-blue-300' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', hover: 'hover:border-emerald-300' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', hover: 'hover:border-purple-300' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', hover: 'hover:border-amber-300' },
};

const QuickAction: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  tint: keyof typeof TINTS;
  title: string;
  desc: string;
  badge?: number;
}> = ({ onClick, icon, tint, title, desc, badge }) => {
  const t = TINTS[tint];
  return (
    <button onClick={onClick} className={`group bg-white rounded-xl border border-gray-200 p-5 text-left hover:shadow-md transition-all min-w-0 ${t.hover}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${t.bg} ${t.text} shrink-0`}>{icon}</div>
        <div className="flex items-center gap-1 shrink-0">
          {badge ? (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">{badge}</span>
          ) : null}
          <ArrowUpRight size={16} className="text-gray-400 group-hover:text-gray-600 transition-colors" />
        </div>
      </div>
      <h3 className="font-semibold text-gray-900 text-sm truncate">{title}</h3>
      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{desc}</p>
    </button>
  );
};

const CompositionCard: React.FC<{ icon: React.ReactNode; tint: keyof typeof TINTS; label: string; value: number }> = ({ icon, tint, label, value }) => {
  const t = TINTS[tint];
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`p-2.5 rounded-lg ${t.bg} ${t.text}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-extrabold text-gray-900">{value}</p>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
