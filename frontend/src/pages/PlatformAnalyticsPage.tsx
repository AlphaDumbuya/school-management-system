import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Users,
  GraduationCap,
  PieChart,
  BarChart3,
  Loader2,
  UserPlus,
  Info,
} from 'lucide-react';
import MainLayout from '@components/layout/MainLayout';
import { PageShell } from '@components/admin/layout/PageShell';
import { KPICard } from '@components/dashboard/KPICard';
import { showToast } from '@utils/toast';
import platformService, { PlatformStatistics, PlatformTenant } from '../services/platformService';

const PLAN_META: Record<string, { label: string; bar: string }> = {
  freetong: { label: 'Freetong (Basic Trial)', bar: 'bg-blue-500' },
  combra: { label: 'Combra (Standard)', bar: 'bg-emerald-500' },
  bintumani: { label: 'Bintumani (Enterprise)', bar: 'bg-purple-600' },
};

const timeAgo = (iso: string): string => {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const diff = Date.now() - d;
  const day = 86_400_000;
  if (diff < day) return 'today';
  const days = Math.floor(diff / day);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
};

export const PlatformAnalyticsPage: React.FC = () => {
  const [statistics, setStatistics] = useState<PlatformStatistics | null>(null);
  const [tenants, setTenants] = useState<PlatformTenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [statsRes, tenantsRes] = await Promise.all([
          platformService.getStatistics(),
          platformService.getTenants({ limit: 200 }),
        ]);
        if (statsRes.success && statsRes.data) setStatistics(statsRes.data);
        if (tenantsRes.success && tenantsRes.data) setTenants(tenantsRes.data);
      } catch (err) {
        console.error('Error loading platform analytics:', err);
        showToast.error('Failed to load platform analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  // Real plan-tier distribution derived from the tenant list.
  const distribution = useMemo(() => {
    const counts: Record<string, number> = { freetong: 0, combra: 0, bintumani: 0 };
    tenants.forEach((t) => {
      const plan = ((t as any).plan || 'freetong').toString().toLowerCase();
      counts[plan] = (counts[plan] ?? 0) + 1;
    });
    const total = tenants.length || 1;
    return Object.entries(counts).map(([plan, count]) => ({
      plan,
      count,
      pct: Math.round((count / total) * 100),
    }));
  }, [tenants]);

  // Real recent signups: newest tenants by created_at.
  const recentSignups = useMemo(
    () =>
      [...tenants]
        .filter((t) => t.created_at)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6),
    [tenants]
  );

  return (
    <MainLayout>
      <PageShell
        title="Platform Analytics"
        subtitle="Live signups, tenant growth, and subscription tier distribution across all schools."
        breadcrumbs={[{ label: 'Platform Dashboard', path: '/platform/dashboard' }, { label: 'Platform Analytics' }]}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="animate-spin text-blue-500" size={32} />
              <span className="text-sm text-gray-500">Loading analytics dashboards...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI ROW — real counts only */}
            {statistics && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <KPICard
                  title="Total Schools"
                  value={statistics.totalTenants}
                  subtitle={`${statistics.activeTenants} active · ${statistics.trialTenants} trial`}
                  icon={<div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500"><Building2 size={20} /></div>}
                />
                <KPICard
                  title="Platform Users"
                  value={statistics.totalUsers.toLocaleString()}
                  subtitle="Across all schools"
                  icon={<div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500"><Users size={20} /></div>}
                />
                <KPICard
                  title="Total Students"
                  value={statistics.totalStudents.toLocaleString()}
                  subtitle="Enrolled platform-wide"
                  icon={<div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500"><GraduationCap size={20} /></div>}
                />
                <KPICard
                  title="New This Month"
                  value={statistics.newTenantsThisMonth ?? 0}
                  subtitle="Schools registered"
                  icon={<div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500"><UserPlus size={20} /></div>}
                />
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Plan Distribution — real */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <PieChart size={16} className="text-purple-500" /> Subscription Tier Distribution
                  </h3>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">{tenants.length} schools</span>
                </div>
                <div className="space-y-4">
                  {distribution.map(({ plan, count, pct }) => (
                    <div key={plan}>
                      <div className="flex justify-between text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">
                        <span>{PLAN_META[plan]?.label || plan}</span>
                        <span>{count} · {pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-900 h-2 rounded-full overflow-hidden">
                        <div className={`${PLAN_META[plan]?.bar || 'bg-gray-400'} h-full rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tenant status snapshot — real */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <BarChart3 size={16} className="text-blue-500" /> Tenant Status Snapshot
                  </h3>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">Live</span>
                </div>
                {statistics && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-3.5 bg-emerald-50/50 dark:bg-emerald-900/10">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Active</span>
                      <span className="text-lg font-black text-emerald-600">{statistics.activeTenants}</span>
                    </div>
                    <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-3.5 bg-blue-50/50 dark:bg-blue-900/10">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">On Trial</span>
                      <span className="text-lg font-black text-blue-600">{statistics.trialTenants}</span>
                    </div>
                    <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-3.5 bg-amber-50/50 dark:bg-amber-900/10">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Suspended</span>
                      <span className="text-lg font-black text-amber-600">{statistics.suspendedTenants}</span>
                    </div>
                    <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-3.5 bg-gray-50 dark:bg-gray-900/30">
                      <span className="text-[10px] text-gray-400 uppercase font-bold block">Total</span>
                      <span className="text-lg font-black text-gray-800 dark:text-gray-100">{statistics.totalTenants}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Signups — real, from tenant created_at */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm lg:col-span-2">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <UserPlus size={16} className="text-emerald-500" /> Recent School Registrations
                  </h3>
                </div>
                {recentSignups.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
                    <Info size={16} /> No schools registered yet.
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {recentSignups.map((t) => (
                      <div key={t.id} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${t.status === 'active' ? 'bg-emerald-500' : t.status === 'trial' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                          <span className="font-bold text-gray-800 dark:text-gray-200">{t.name}</span>
                        </div>
                        <span className="text-gray-400 capitalize">{t.status} · {timeAgo(t.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
};

export default PlatformAnalyticsPage;
