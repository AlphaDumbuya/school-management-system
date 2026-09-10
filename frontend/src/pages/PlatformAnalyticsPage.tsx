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
import platformService, { PlatformStatistics, PlatformTenant, SuspensionOverview, SuspensionCategory } from '../services/platformService';

const SUSPENSION_META: Record<SuspensionCategory, { label: string; dot: string; chip: string }> = {
  payment:  { label: 'Overdue payment',        dot: 'bg-amber-500',   chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  policy:   { label: 'Policy / terms',          dot: 'bg-orange-500',  chip: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  abuse:    { label: 'Misuse / abuse',          dot: 'bg-red-500',     chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  security: { label: 'Security',                dot: 'bg-rose-500',    chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  review:   { label: 'Pending review',          dot: 'bg-blue-500',    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  other:    { label: 'Other',                   dot: 'bg-gray-400',    chip: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

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
  const [suspensions, setSuspensions] = useState<SuspensionOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [statsRes, tenantsRes, suspRes] = await Promise.all([
          platformService.getStatistics(),
          platformService.getTenants({ limit: 200 }),
          platformService.getSuspensionOverview(),
        ]);
        if (statsRes.success && statsRes.data) setStatistics(statsRes.data);
        if (tenantsRes.success && tenantsRes.data) setTenants(tenantsRes.data);
        if (suspRes.success && suspRes.data) setSuspensions(suspRes.data);
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

              {/* Suspension Tracking — suspended tenants by category (real) */}
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm lg:col-span-2">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 dark:border-gray-700">
                  <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <PieChart size={16} className="text-amber-500" /> Suspension Tracking
                  </h3>
                  <span className="text-[10px] text-gray-400 font-bold uppercase">{suspensions?.total ?? 0} suspended</span>
                </div>

                {/* Category counts */}
                {suspensions && suspensions.total > 0 ? (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
                      {(Object.keys(SUSPENSION_META) as SuspensionCategory[]).map((cat) => (
                        <div key={cat} className="border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-center">
                          <span className={`inline-block w-2 h-2 rounded-full ${SUSPENSION_META[cat].dot} mb-1`} />
                          <span className="block text-lg font-black text-gray-800 dark:text-gray-100">{suspensions.counts[cat] ?? 0}</span>
                          <span className="block text-[10px] text-gray-400 leading-tight">{SUSPENSION_META[cat].label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Per-tenant list */}
                    <div className="space-y-2">
                      {suspensions.tenants.map((t) => (
                        <div key={t.id} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{t.name}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SUSPENSION_META[t.category].chip}`}>
                                {SUSPENSION_META[t.category].label}
                              </span>
                            </div>
                            {t.reason && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{t.reason}</p>}
                          </div>
                          <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">{t.suspendedAt ? timeAgo(t.suspendedAt) : ''}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
                    <Info size={16} /> No suspended schools. Everything's running normally.
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
